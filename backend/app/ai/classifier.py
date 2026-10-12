import json
import os
import re
import time
import urllib.request
import urllib.error
import logging
from ..database.database import SessionLocal
from ..models.ticket import Ticket
from ..services.ticket_service import update_ticket
from ..schemas.ticket import TicketUpdate
from ..metrics import AI_CLASSIFICATION_DURATION, sync_database_metrics
from .prompts import TICKET_CLASSIFICATION_PROMPT

logger = logging.getLogger(__name__)

DEFAULT_AI_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2:1b"

def get_ai_base_url() -> str:
    return os.getenv("AI_BASE_URL", DEFAULT_AI_URL).rstrip("/")

def get_installed_models() -> list[str]:
    """Fetch installed model names from AI service /api/tags."""
    base_url = get_ai_base_url()
    try:
        req = urllib.request.Request(f"{base_url}/api/tags", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
            models = [m.get("name") for m in payload.get("models", []) if m.get("name")]
            return models
    except Exception as e:
        logger.warning(f"Could not retrieve AI model list: {e}")
        return []

def resolve_model_name() -> str:
    """
    Selects the configured model, or finds a matching available model from the local AI service.
    """
    configured_model = os.getenv("AI_MODEL", DEFAULT_MODEL).strip()
    available = get_installed_models()
    
    if not available:
        # Fallback to configured model if service tags endpoint is unreachable
        return configured_model

    # Check exact match or name without tag
    for model in available:
        if model == configured_model or model.startswith(f"{configured_model}:"):
            return model

    # If configured model not found, try preferred fallbacks in order
    preferred_fallbacks = ["llama3.2:1b", "llama3.1:8b", "qwen2.5:7b", "mistral:latest", "mistral"]
    for fallback in preferred_fallbacks:
        for model in available:
            if model == fallback or model.startswith(f"{fallback}:"):
                logger.info(f"Configured model '{configured_model}' not found. Using available fallback '{model}'.")
                return model

    # Default to the first available model
    chosen = available[0]
    logger.info(f"Using first available model: '{chosen}'.")
    return chosen

def parse_json_from_response(raw_text: str) -> dict:
    """
    Strips markdown code blocks and extracts JSON object.
    """
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    # If extra conversational text surrounds JSON, extract outermost braces
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        text = match.group(0)

    return json.loads(text)

def classify_ticket(ticket_id: int, subject: str, description: str):
    """
    Calls the local AI model to classify the ticket and check for duplicate/incident clusters.
    """
    base_url = get_ai_base_url()
    generate_url = f"{base_url}/api/generate"
    model_name = resolve_model_name()
    
    # Query active open tickets to provide context for clustering
    db = SessionLocal()
    active_tickets_str = "None (this is the first or only active ticket in queue)."
    try:
        open_tickets = db.query(Ticket).filter(
            Ticket.id != ticket_id,
            Ticket.status != "Resolved"
        ).order_by(Ticket.id.desc()).limit(10).all()
        
        if open_tickets:
            lines = []
            for t in open_tickets:
                tag = f" [Tag: {t.cluster_tag}]" if t.cluster_tag else ""
                lines.append(f"- ID #{t.id}: \"{t.subject}\" - Summary: {t.summary or 'Pending'}{tag}")
            active_tickets_str = "\n".join(lines)
    finally:
        db.close()
    
    prompt = TICKET_CLASSIFICATION_PROMPT.format(
        active_tickets=active_tickets_str,
        subject=subject,
        description=description
    )
    
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        generate_url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    
    start_time = time.time()
    try:
        logger.info(f"Connecting to AI Engine ({model_name}) to classify ticket #{ticket_id}...")
        with urllib.request.urlopen(req, timeout=60) as response:
            duration = time.time() - start_time
            AI_CLASSIFICATION_DURATION.observe(duration)

            result = json.loads(response.read().decode("utf-8"))
            ai_response_text = result.get("response", "")
            classification = parse_json_from_response(ai_response_text)
            
            department = classification.get("department")
            priority = classification.get("priority")
            sentiment = classification.get("sentiment")
            summary = classification.get("summary")
            
            is_cluster = classification.get("is_duplicate_or_cluster", False)
            raw_parent_id = classification.get("duplicate_parent_id")
            cluster_tag = classification.get("cluster_tag")
            cluster_reason = classification.get("cluster_reason")
            
            assigned_parent_id = None
            assigned_cluster_tag = cluster_tag
            
            # Update Database and link clusters
            db = SessionLocal()
            try:
                # 1. Direct duplicate parent ID link from AI
                if is_cluster and raw_parent_id:
                    try:
                        p_id = int(raw_parent_id)
                        parent_ticket = db.query(Ticket).filter(Ticket.id == p_id).first()
                        if parent_ticket and parent_ticket.id != ticket_id:
                            root_parent = parent_ticket
                            if parent_ticket.parent_ticket_id:
                                root = db.query(Ticket).filter(Ticket.id == parent_ticket.parent_ticket_id).first()
                                if root:
                                    root_parent = root
                            
                            root_parent.is_cluster_parent = True
                            if not root_parent.cluster_tag and cluster_tag:
                                root_parent.cluster_tag = cluster_tag
                            db.commit()
                            
                            assigned_parent_id = root_parent.id
                            assigned_cluster_tag = root_parent.cluster_tag or cluster_tag
                    except (ValueError, TypeError) as pe:
                        logger.warning(f"Could not parse duplicate_parent_id '{raw_parent_id}': {pe}")

                # 2. Correlate by cluster_tag if duplicate_parent_id was not explicitly set
                if not assigned_parent_id and cluster_tag and cluster_tag.strip():
                    norm_tag = cluster_tag.strip().upper()
                    # Look for an earlier active ticket with the exact same cluster tag
                    existing_incident = db.query(Ticket).filter(
                        Ticket.id != ticket_id,
                        Ticket.status != "Resolved",
                        Ticket.cluster_tag == norm_tag
                    ).order_by(Ticket.id.asc()).first()

                    if existing_incident:
                        root_parent = existing_incident
                        if existing_incident.parent_ticket_id:
                            root = db.query(Ticket).filter(Ticket.id == existing_incident.parent_ticket_id).first()
                            if root:
                                root_parent = root
                        root_parent.is_cluster_parent = True
                        db.commit()

                        assigned_parent_id = root_parent.id
                        assigned_cluster_tag = norm_tag
                        if not cluster_reason:
                            cluster_reason = f"Correlated with active incident cluster '{norm_tag}'"
                    else:
                        # This is the root parent for this incident tag
                        assigned_cluster_tag = norm_tag

                ticket_update = TicketUpdate(
                    department=department,
                    priority=priority,
                    sentiment=sentiment,
                    summary=summary,
                    parent_ticket_id=assigned_parent_id,
                    is_cluster_parent=(assigned_parent_id is None and bool(cluster_tag)),
                    cluster_tag=assigned_cluster_tag,
                    cluster_reason=cluster_reason if assigned_parent_id else None
                )
                
                updated_ticket = update_ticket(db, ticket_id=ticket_id, ticket_update=ticket_update)
                
                # Automatically assign ticket to best available agent based on department and current workload
                try:
                    from ..services.ticket_service import auto_assign_ticket
                    auto_assign_ticket(db, ticket_id=ticket_id)
                except Exception as assign_err:
                    logger.warning(f"Auto-assignment failed for ticket #{ticket_id}: {assign_err}")

                sync_database_metrics(db)
                logger.info(f"Successfully classified ticket #{ticket_id} in {duration:.2f}s using {model_name}: {classification}")
                return updated_ticket
            finally:
                db.close()
                
    except urllib.error.URLError as e:
        logger.error(f"Failed to connect to AI Engine at {generate_url}: {e}")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI JSON response: {e}")
    except Exception as e:
        logger.error(f"Error during classification of ticket {ticket_id}: {e}")
    return None

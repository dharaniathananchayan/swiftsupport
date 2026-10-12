from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from ..models.ticket import Ticket
from ..schemas.ticket import TicketCreate, TicketUpdate
from .sla_service import calculate_sla_deadline

def create_ticket(db: Session, ticket: TicketCreate) -> Ticket:
    db_ticket = Ticket(
        customer_name=ticket.customer_name,
        customer_email=ticket.customer_email,
        subject=ticket.subject,
        description=ticket.description,
        screenshot_url=ticket.screenshot_url,
        status="Open"
    )
    # At creation, we don't have AI classification yet, so default SLA is set.
    # The SLA might be updated after AI processes the ticket.
    db_ticket.sla_deadline = calculate_sla_deadline("Unknown", db)
    
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)

    # Immediately assign to best available online agent based on initial workload & department
    try:
        auto_assign_ticket(db, db_ticket.id)
        db.refresh(db_ticket)
    except Exception as e:
        pass

    return db_ticket

def get_tickets(db: Session, skip: int = 0, limit: int = 100, customer_email: Optional[str] = None) -> List[Ticket]:
    query = db.query(Ticket)
    if customer_email:
        query = query.filter(Ticket.customer_email == customer_email)
    return query.order_by(Ticket.id.desc()).offset(skip).limit(limit).all()

def get_ticket(db: Session, ticket_id: int) -> Optional[Ticket]:
    return db.query(Ticket).filter(Ticket.id == ticket_id).first()

def update_ticket(db: Session, ticket_id: int, ticket_update: TicketUpdate) -> Optional[Ticket]:
    db_ticket = get_ticket(db, ticket_id)
    if not db_ticket:
        return None
        
    update_data = ticket_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ticket, key, value)
        
    # If priority changes, recalculate SLA with dynamic DB policy
    if "priority" in update_data and update_data["priority"]:
        db_ticket.sla_deadline = calculate_sla_deadline(update_data["priority"], db)
        
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def resolve_ticket(db: Session, ticket_id: int) -> Optional[Ticket]:
    db_ticket = get_ticket(db, ticket_id)
    if not db_ticket:
        return None
        
    db_ticket.status = "Resolved"
    db_ticket.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def assign_ticket(db: Session, ticket_id: int, agent_id: Optional[int]) -> Optional[Ticket]:
    db_ticket = get_ticket(db, ticket_id)
    if not db_ticket:
        return None
    db_ticket.assigned_agent_id = agent_id
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def auto_assign_ticket(db: Session, ticket_id: int) -> Optional[Ticket]:
    """
    Intelligently assigns a ticket to the most appropriate available support agent.
    Considers:
    1. Availability status (is_available == 1 / Online)
    2. Matching department specialty (e.g. Technical, Billing, Sales, Account, Shipping)
    3. Active workload capacity (least open tickets currently assigned)
    """
    from ..models.user import User
    from sqlalchemy import func

    db_ticket = get_ticket(db, ticket_id)
    if not db_ticket:
        return None

    ticket_dept = (db_ticket.department or "Technical").strip().lower()

    # Find staff (agents and admins) who are online/available
    online_staff = db.query(User).filter(
        User.role.in_(["agent", "admin"]),
        User.is_available == 1
    ).all()

    if not online_staff:
        # Fallback to any agent or admin if none marked explicitly online
        online_staff = db.query(User).filter(
            User.role.in_(["agent", "admin"])
        ).all()

    if not online_staff:
        return db_ticket

    # Calculate active workload (open tickets count) for each candidate
    candidate_scores = []
    for staff in online_staff:
        active_count = db.query(func.count(Ticket.id)).filter(
            Ticket.assigned_agent_id == staff.id,
            Ticket.status != "Resolved"
        ).scalar() or 0

        # Department match score (higher is better)
        staff_dept = (staff.department or "").strip().lower()
        dept_match = 1 if (staff_dept == ticket_dept) else 0

        # Capacity check
        max_capacity = staff.max_concurrent_tickets or 5
        has_capacity = 1 if (active_count < max_capacity) else 0

        # Score tuple:
        # 1. Department match (1 or 0, prioritize matching department)
        # 2. Has capacity (1 or 0)
        # 3. Negative active workload (lower active_count is better)
        candidate_scores.append((dept_match, has_capacity, -active_count, staff))

    # Sort descending by (dept_match, has_capacity, -active_count)
    candidate_scores.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)

    best_agent = candidate_scores[0][3]
    db_ticket.assigned_agent_id = best_agent.id
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def reply_to_ticket(db: Session, ticket_id: int, reply_text: str, resolve: bool = False) -> Optional[Ticket]:
    db_ticket = get_ticket(db, ticket_id)
    if not db_ticket:
        return None

    now = datetime.utcnow()
    db_ticket.agent_reply = reply_text
    db_ticket.agent_reply_at = now
    if not db_ticket.first_response_at:
        db_ticket.first_response_at = now

    if resolve:
        db_ticket.status = "Resolved"
        db_ticket.resolved_at = now

    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def resolve_cluster(db: Session, parent_id: int) -> Tuple[Optional[Ticket], int]:
    """
    Resolves the parent ticket and all associated child tickets in the cluster.
    Returns (parent_ticket, total_resolved_count).
    """
    parent = get_ticket(db, parent_id)
    if not parent:
        return None, 0

    now = datetime.utcnow()
    resolved_count = 0
    if parent.status != "Resolved":
        parent.status = "Resolved"
        parent.resolved_at = now
        resolved_count += 1

    children = db.query(Ticket).filter(
        Ticket.parent_ticket_id == parent_id,
        Ticket.status != "Resolved"
    ).all()

    for child in children:
        child.status = "Resolved"
        child.resolved_at = now
        resolved_count += 1

    db.commit()
    db.refresh(parent)
    return parent, resolved_count

def get_active_clusters(db: Session) -> List[dict]:
    """
    Retrieves all open parent incident tickets with their associated child tickets.
    """
    parents = db.query(Ticket).filter(
        Ticket.is_cluster_parent == True,
        Ticket.status != "Resolved"
    ).order_by(Ticket.id.desc()).all()

    clusters = []
    for parent in parents:
        children = db.query(Ticket).filter(
            Ticket.parent_ticket_id == parent.id
        ).order_by(Ticket.id.asc()).all()

        clusters.append({
            "parent_ticket": parent,
            "child_tickets": children,
            "cluster_tag": parent.cluster_tag or "INCIDENT_CLUSTER",
            "total_affected": 1 + len(children)
        })
    return clusters

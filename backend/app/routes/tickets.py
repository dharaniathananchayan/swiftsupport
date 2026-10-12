from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database.dependencies import get_db
from ..models.user import User
from ..schemas.ticket import TicketCreate, TicketResponse, TicketUpdate, IncidentClusterDetail, TicketReplyCreate, TicketAssignCreate
from ..services import ticket_service
from ..ai.classifier import classify_ticket
from ..auth.security import get_optional_current_user
from ..metrics import TICKETS_CREATED_TOTAL, TICKETS_RESOLVED_TOTAL, sync_database_metrics

router = APIRouter(
    prefix="/tickets",
    tags=["Tickets"]
)

@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    ticket: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # If customer is logged in, ensure ticket has their email/name if missing
    if current_user and current_user.role == "customer":
        if not ticket.customer_email:
            ticket.customer_email = current_user.email
        if not ticket.customer_name:
            ticket.customer_name = current_user.full_name

    # Create the ticket in DB
    created_ticket = ticket_service.create_ticket(db=db, ticket=ticket)
    
    # Prometheus metric
    TICKETS_CREATED_TOTAL.inc()
    sync_database_metrics(db)
    
    # Immediately attempt auto-assignment based on title/keywords or available agents, then re-tune once AI classifies
    try:
        ticket_service.auto_assign_ticket(db, ticket_id=created_ticket.id)
    except Exception as e:
        pass

    # Trigger AI classification asynchronously (which also refines department & reassures best agent)
    background_tasks.add_task(
        classify_ticket,
        ticket_id=created_ticket.id,
        subject=ticket.subject,
        description=ticket.description
    )
    
    return created_ticket

@router.get("/", response_model=List[TicketResponse])
def get_tickets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # Role-based scoping: Customers only see their own tickets
    customer_email = None
    if current_user and current_user.role == "customer":
        customer_email = current_user.email

    return ticket_service.get_tickets(db=db, skip=skip, limit=limit, customer_email=customer_email)

@router.get("/clusters/active", response_model=List[IncidentClusterDetail])
def get_active_clusters(db: Session = Depends(get_db)):
    """
    Returns active incident clusters grouped under root parent tickets.
    """
    return ticket_service.get_active_clusters(db=db)

@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = ticket_service.get_ticket(db, ticket_id=ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(ticket_id: int, ticket_update: TicketUpdate, db: Session = Depends(get_db)):
    ticket = ticket_service.update_ticket(db, ticket_id=ticket_id, ticket_update=ticket_update)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    sync_database_metrics(db)
    return ticket

@router.post("/{ticket_id}/resolve", response_model=TicketResponse)
def resolve_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = ticket_service.resolve_ticket(db, ticket_id=ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    TICKETS_RESOLVED_TOTAL.inc()
    sync_database_metrics(db)
    return ticket

@router.post("/{ticket_id}/reply", response_model=TicketResponse)
def reply_ticket(ticket_id: int, reply_data: TicketReplyCreate, db: Session = Depends(get_db)):
    """
    Submits an official technical support response/reply to the customer ticket.
    """
    ticket = ticket_service.reply_to_ticket(db, ticket_id=ticket_id, reply_text=reply_data.reply, resolve=reply_data.resolve)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if reply_data.resolve:
        TICKETS_RESOLVED_TOTAL.inc()
    sync_database_metrics(db)
    return ticket

@router.post("/{ticket_id}/assign", response_model=TicketResponse)
def assign_ticket_endpoint(ticket_id: int, assign_data: TicketAssignCreate, db: Session = Depends(get_db)):
    """
    Assigns or reassigns a ticket to a support agent.
    """
    ticket = ticket_service.assign_ticket(db, ticket_id=ticket_id, agent_id=assign_data.assigned_agent_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.post("/{ticket_id}/auto-assign", response_model=TicketResponse)
def auto_assign_ticket_endpoint(ticket_id: int, db: Session = Depends(get_db)):
    """
    Automatically assigns ticket based on agent availability, department specialty, and active workload.
    """
    ticket = ticket_service.auto_assign_ticket(db, ticket_id=ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.post("/{ticket_id}/resolve-cluster", response_model=TicketResponse)
def resolve_cluster_endpoint(ticket_id: int, db: Session = Depends(get_db)):
    """
    Bulk-resolves the parent ticket and all clustered child tickets matching this incident.
    """
    parent, count = ticket_service.resolve_cluster(db, parent_id=ticket_id)
    if parent is None:
        raise HTTPException(status_code=404, detail="Parent ticket not found")
    
    if count > 0:
        TICKETS_RESOLVED_TOTAL.inc(count)
    sync_database_metrics(db)
    return parent

@router.post("/{ticket_id}/classify", response_model=TicketResponse)
def classify_ticket_endpoint(ticket_id: int, db: Session = Depends(get_db)):
    ticket = ticket_service.get_ticket(db, ticket_id=ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    classify_ticket(ticket_id=ticket.id, subject=ticket.subject, description=ticket.description)
    db.refresh(ticket)
    sync_database_metrics(db)
    return ticket

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from .user import UserResponse

class TicketBase(BaseModel):
    customer_name: str
    customer_email: EmailStr
    subject: str
    description: str
    screenshot_url: Optional[str] = None

class TicketCreate(TicketBase):
    pass

class TicketReplyCreate(BaseModel):
    reply: str
    resolve: Optional[bool] = False

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    department: Optional[str] = None
    priority: Optional[str] = None
    sentiment: Optional[str] = None
    summary: Optional[str] = None
    screenshot_url: Optional[str] = None
    agent_reply: Optional[str] = None
    assigned_agent_id: Optional[int] = None
    parent_ticket_id: Optional[int] = None
    is_cluster_parent: Optional[bool] = None
    cluster_tag: Optional[str] = None
    cluster_reason: Optional[str] = None

class TicketAssignCreate(BaseModel):
    assigned_agent_id: Optional[int] = None

class TicketResponse(TicketBase):
    id: int
    department: Optional[str] = None
    priority: Optional[str] = None
    sentiment: Optional[str] = None
    summary: Optional[str] = None
    screenshot_url: Optional[str] = None
    status: str
    
    # Technical Support Reply & Agent Assignment
    agent_reply: Optional[str] = None
    agent_reply_at: Optional[datetime] = None
    assigned_agent_id: Optional[int] = None
    assigned_agent: Optional[UserResponse] = None
    
    created_at: datetime
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    sla_deadline: Optional[datetime] = None
    
    # Clustering metadata
    parent_ticket_id: Optional[int] = None
    is_cluster_parent: Optional[bool] = False
    cluster_tag: Optional[str] = None
    cluster_reason: Optional[str] = None
    clustered_tickets_count: Optional[int] = 0

    class Config:
        from_attributes = True

class IncidentClusterDetail(BaseModel):
    parent_ticket: TicketResponse
    child_tickets: List[TicketResponse]
    cluster_tag: str
    total_affected: int

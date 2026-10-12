from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship, backref
from ..database.database import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, index=True)
    customer_email = Column(String, index=True)
    subject = Column(String)
    description = Column(Text)
    screenshot_url = Column(Text, nullable=True)
    
    # AI Classification Fields
    department = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    sentiment = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    
    # Duplicate & Outage Clustering Fields
    parent_ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True)
    is_cluster_parent = Column(Boolean, default=False)
    cluster_tag = Column(String, nullable=True) # e.g. "INCIDENT:PAYMENT_GATEWAY"
    cluster_reason = Column(Text, nullable=True)
    
    # Relationships
    clustered_tickets = relationship(
        "Ticket",
        backref=backref("parent_ticket", remote_side=[id]),
        foreign_keys=[parent_ticket_id]
    )
    
    # Lifecycle
    status = Column(String, default="Open", index=True)
    
    # Technical Support Reply & Agent Assignment
    agent_reply = Column(Text, nullable=True)
    agent_reply_at = Column(DateTime, nullable=True)
    assigned_agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id])
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    first_response_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    sla_deadline = Column(DateTime, nullable=True)

    @property
    def clustered_tickets_count(self) -> int:
        if self.clustered_tickets:
            return len(self.clustered_tickets)
        return 0


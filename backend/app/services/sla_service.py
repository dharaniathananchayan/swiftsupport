from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from ..models.sla_policy import SLAPolicy

DEFAULT_SLA_HOURS = {
    "High": 1,
    "Medium": 4,
    "Low": 24,
    "Default": 24
}

def seed_default_sla_policies(db: Session):
    for priority, hours in DEFAULT_SLA_HOURS.items():
        existing = db.query(SLAPolicy).filter(SLAPolicy.priority == priority).first()
        if not existing:
            policy = SLAPolicy(
                priority=priority,
                target_hours=hours,
                description=f"Target resolution within {hours} hours"
            )
            db.add(policy)
    db.commit()

def get_target_hours(priority: str, db: Optional[Session] = None) -> int:
    if db:
        policy = db.query(SLAPolicy).filter(SLAPolicy.priority == priority).first()
        if policy:
            return policy.target_hours
    return DEFAULT_SLA_HOURS.get(priority, DEFAULT_SLA_HOURS["Default"])

def calculate_sla_deadline(priority: str, db: Optional[Session] = None) -> datetime:
    """
    Calculate the SLA deadline based on the ticket priority and configured policy.
    """
    now = datetime.utcnow()
    hours = get_target_hours(priority, db)
    return now + timedelta(hours=hours)

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from ..database.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="customer", index=True, nullable=False) # "customer", "agent", "admin"
    department = Column(String, default="Technical", nullable=True) # "Technical", "Billing", "Sales", "Account", "Shipping"
    is_available = Column(Integer, default=1, nullable=False) # 1 = Available/Online, 0 = Offline/Away
    max_concurrent_tickets = Column(Integer, default=5, nullable=False) # Workload capacity
    created_at = Column(DateTime, default=datetime.utcnow)

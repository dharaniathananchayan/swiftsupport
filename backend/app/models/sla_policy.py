from sqlalchemy import Column, Integer, String
from ..database.database import Base

class SLAPolicy(Base):
    __tablename__ = "sla_policies"

    id = Column(Integer, primary_key=True, index=True)
    priority = Column(String, unique=True, index=True, nullable=False) # "High", "Medium", "Low", "Default"
    target_hours = Column(Integer, nullable=False)
    description = Column(String, nullable=True)

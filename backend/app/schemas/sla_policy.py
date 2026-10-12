from pydantic import BaseModel
from typing import Optional

class SLAPolicyBase(BaseModel):
    priority: str
    target_hours: int
    description: Optional[str] = None

class SLAPolicyCreate(SLAPolicyBase):
    pass

class SLAPolicyUpdate(BaseModel):
    target_hours: int
    description: Optional[str] = None

class SLAPolicyResponse(SLAPolicyBase):
    id: int

    class Config:
        from_attributes = True

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    department: Optional[str] = "Technical"

class UserCreate(UserBase):
    password: str
    role: Optional[str] = "customer" # "customer", "agent", "admin"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    is_available: bool = True
    max_concurrent_tickets: int = 5
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserRoleUpdate(BaseModel):
    role: str

class UserProfileUpdate(BaseModel):
    department: Optional[str] = None
    is_available: Optional[bool] = None
    max_concurrent_tickets: Optional[int] = None

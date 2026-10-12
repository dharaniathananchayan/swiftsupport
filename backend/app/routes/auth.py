from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database.dependencies import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, UserRoleUpdate, UserProfileUpdate
from ..auth.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    require_roles,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication & RBAC"]
)

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
        
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role if user_in.role in ["customer", "agent", "admin"] else "customer",
        department=user_in.department or "Technical",
        is_available=1,
        max_concurrent_tickets=5
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token(data={"sub": user.email, "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=TokenResponse)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    token = create_access_token(data={"sub": user.email, "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_roles(["admin", "agent"]))
):
    return db.query(User).offset(skip).limit(limit).all()

@router.put("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles(["admin"]))
):
    if role_update.role not in ["customer", "agent", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = role_update.role
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{user_id}/profile", response_model=UserResponse)
def update_user_profile(
    user_id: int,
    profile_update: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_roles(["admin", "agent"]))
):
    """
    Updates staff department specialty, availability toggle, and ticket capacity.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if profile_update.department is not None:
        user.department = profile_update.department
    if profile_update.is_available is not None:
        user.is_available = 1 if profile_update.is_available else 0
    if profile_update.max_concurrent_tickets is not None:
        user.max_concurrent_tickets = profile_update.max_concurrent_tickets

    db.commit()
    db.refresh(user)
    return user

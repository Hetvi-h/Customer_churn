"""
Profile router — view/update user profile, change password
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models import User
from ..dependencies import get_current_user
from ..routers.auth import hash_password, verify_password

router = APIRouter(prefix="/api/profile", tags=["Profile"])


class UpdateProfileRequest(BaseModel):
    name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("")
def get_profile(current_user: User = Depends(get_current_user)):
    """Return current user's profile"""
    return {
        "id":         current_user.id,
        "email":      current_user.email,
        "name":       current_user.name,
        "google_id":  current_user.google_id,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "has_password": current_user.password_hash is not None,
    }


@router.patch("")
def update_profile(
    req: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update display name"""
    if not req.name.strip():
        raise HTTPException(400, "Name cannot be empty.")
    current_user.name = req.name.strip()
    db.commit()
    return {"message": "Profile updated.", "name": current_user.name}


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change password — requires current password"""
    if not current_user.password_hash:
        raise HTTPException(400, "Your account uses Google sign-in. Set a password via registration instead.")
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    if len(req.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters.")
    current_user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"message": "Password changed successfully."}

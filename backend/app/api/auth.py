from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import create_token, current_user
from ..database import get_db
from ..models import User
from ..schemas import LoginIn, LoginOut, ProfileUpdateIn, UserOut

router = APIRouter()


def user_out(user: User) -> UserOut:
    return UserOut(username=user.username, role=user.role, display_name=user.display_name)


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username, User.role == payload.role).first()
    if not user or user.password != payload.password:
        raise HTTPException(status_code=401, detail="用户名或密码不对")
    return LoginOut(token=create_token(user), user=user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User | None = Depends(current_user)):
    if not user:
        return UserOut(username="guest", role="guest", display_name="游客")
    return user_out(user)


@router.put("/profile", response_model=UserOut)
def update_profile(payload: ProfileUpdateIn, user: User | None = Depends(current_user), db: Session = Depends(get_db)):
    if not user or user.role not in {"me", "her"}:
        raise HTTPException(status_code=403, detail="Guest is read-only")
    user.display_name = payload.displayName.strip()[:80] or user.display_name
    db.commit()
    db.refresh(user)
    return user_out(user)

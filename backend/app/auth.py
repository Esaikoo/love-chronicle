import os
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

security = HTTPBearer(auto_error=False)


def create_token(user: User) -> str:
    expire_days = int(os.getenv("JWT_EXPIRE_DAYS", "30"))
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(days=expire_days)
    }
    return jwt.encode(payload, os.getenv("JWT_SECRET", "please_change_this_secret"), algorithm="HS256")


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db)
) -> User | None:
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, os.getenv("JWT_SECRET", "please_change_this_secret"), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_user(user: User | None = Depends(current_user)) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")
    return user


def require_writer(user: User | None = Depends(current_user)) -> User:
    if not user or user.role not in {"me", "her"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Guest is read-only")
    return user

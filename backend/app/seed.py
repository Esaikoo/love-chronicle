import os
from sqlalchemy.orm import Session

from .models import User


def upsert_user(db: Session, role: str, username: str, password: str, display_name: str) -> None:
    user = db.query(User).filter(User.role == role).first()
    if user:
        user.username = username
        user.password = password
        if not user.display_name or user.display_name in {"我", "她", "WLY", "LXQ"}:
            user.display_name = display_name
        return
    db.add(User(username=username, password=password, role=role, display_name=display_name))


def upsert_named_user(db: Session, role: str, username: str, password: str, display_name: str) -> None:
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.role = role
        user.password = password
        if not user.display_name:
            user.display_name = display_name
        return
    db.add(User(username=username, password=password, role=role, display_name=display_name))


def seed_users(db: Session) -> None:
    desired = {
        "me": os.getenv("ME_USERNAME", "lxq"),
        "her": os.getenv("HER_USERNAME", "wly"),
    }
    for role, username in desired.items():
        conflicting = db.query(User).filter(User.username == username, User.role != role).first()
        if conflicting:
            conflicting.username = f"__swap_{conflicting.role}_{conflicting.id}"
    db.flush()

    upsert_user(
        db,
        "me",
        desired["me"],
        os.getenv("ME_PASSWORD", "xiao"),
        "LXQ",
    )
    upsert_user(
        db,
        "her",
        desired["her"],
        os.getenv("HER_PASSWORD", "0717"),
        "WLY",
    )
    upsert_named_user(
        db,
        "me",
        os.getenv("ZS_USERNAME", "zs"),
        os.getenv("ZS_PASSWORD", "0229"),
        "ZS",
    )
    db.commit()

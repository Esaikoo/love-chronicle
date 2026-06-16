from datetime import datetime, timedelta
from functools import lru_cache
import ipaddress
import json
from urllib.parse import quote
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import current_user, require_writer
from ..database import get_db
from ..models import AccessLog, User
from ..utils.time import now_beijing

router = APIRouter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else ""


def normalize_ip(ip: str) -> str:
    value = (ip or "").strip()
    if value.startswith("::ffff:"):
        value = value.removeprefix("::ffff:")
    return value


@lru_cache(maxsize=512)
def ip_location(ip: str) -> str:
    value = normalize_ip(ip)
    if not value:
        return "未知"
    try:
        parsed = ipaddress.ip_address(value)
        if parsed.is_loopback:
            return "本机"
        if parsed.is_private:
            return "内网"
        if parsed.is_multicast or parsed.is_reserved or parsed.is_unspecified:
            return "特殊地址"
    except ValueError:
        return "未知"
    try:
        with urlopen(f"http://ip-api.com/json/{quote(value)}?fields=status,country,regionName,city,query,message&lang=zh-CN", timeout=2.2) as response:
            data = json.loads(response.read().decode("utf-8"))
        if data.get("status") != "success":
            return data.get("message") or "未知"
        parts = [data.get("country"), data.get("regionName"), data.get("city")]
        return " ".join(part for part in parts if part) or "未知"
    except Exception:
        return "未知"


def visit_item_out(item: AccessLog) -> dict:
    return {
        "id": item.id,
        "ipAddress": item.ip_address,
        "ipLocation": ip_location(item.ip_address),
        "role": item.user_role,
        "username": item.username,
        "path": item.path,
        "sessionId": item.session_id,
        "eventType": item.event_type,
        "moduleId": item.module_id,
        "durationMs": item.duration_ms,
        "userAgent": item.user_agent,
        "visitedAt": item.visited_at,
    }


def require_admin_user(user: User = Depends(require_writer)) -> User:
    if user.username.lower() != "lxq":
        raise HTTPException(status_code=403, detail="Only LXQ can view admin statistics")
    return user


def apply_time_filter(query, granularity: str = "", value: str = ""):
    if not granularity or not value:
        return query
    formats = {
        "month": ("%Y-%m", timedelta(days=32)),
        "day": ("%Y-%m-%d", timedelta(days=1)),
        "hour": ("%Y-%m-%d %H", timedelta(hours=1)),
        "minute": ("%Y-%m-%d %H:%M", timedelta(minutes=1)),
    }
    if granularity not in formats:
        return query
    fmt, span = formats[granularity]
    try:
        start = datetime.strptime(value, fmt)
    except ValueError:
        return query
    if granularity == "month":
        end = datetime(start.year + (1 if start.month == 12 else 0), 1 if start.month == 12 else start.month + 1, 1)
    else:
        end = start + span
    return query.filter(AccessLog.visited_at >= start, AccessLog.visited_at < end)


class ModuleViewIn(BaseModel):
    moduleId: str
    durationMs: int = 0


class HeartbeatIn(BaseModel):
    moduleId: str = ""
    sessionId: str = ""
    durationMs: int = 0


@router.post("/page-view")
def page_view(request: Request, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    db.add(AccessLog(
        ip_address=client_ip(request),
        user_role=user.role if user else "guest",
        username=user.username if user else "guest",
        path=request.headers.get("x-love-page", request.url.path)[:500],
        session_id=request.headers.get("x-love-session", "")[:120],
        event_type="page_view",
        module_id="",
        duration_ms=0,
        user_agent=request.headers.get("user-agent", "")[:1200],
        visited_at=now_beijing(),
    ))
    db.commit()
    return {"ok": True}


@router.post("/module-view")
def module_view(payload: ModuleViewIn, request: Request, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    db.add(AccessLog(
        ip_address=client_ip(request),
        user_role=user.role if user else "guest",
        username=user.username if user else "guest",
        path=request.headers.get("x-love-page", request.url.path)[:500],
        session_id=request.headers.get("x-love-session", "")[:120],
        event_type="module_view",
        module_id=payload.moduleId[:80],
        duration_ms=max(0, payload.durationMs),
        user_agent=request.headers.get("user-agent", "")[:1200],
        visited_at=now_beijing(),
    ))
    db.commit()
    return {"ok": True}


@router.post("/heartbeat")
def heartbeat(payload: HeartbeatIn, request: Request, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    db.add(AccessLog(
        ip_address=client_ip(request),
        user_role=user.role if user else "guest",
        username=user.username if user else "guest",
        path=request.headers.get("x-love-page", request.url.path)[:500],
        session_id=payload.sessionId[:120],
        event_type="heartbeat",
        module_id=payload.moduleId[:80],
        duration_ms=max(0, payload.durationMs),
        user_agent=request.headers.get("user-agent", "")[:1200],
        visited_at=now_beijing(),
    ))
    db.commit()
    return {"ok": True}


@router.get("")
def list_visits(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    granularity: str = Query(default=""),
    value: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_user),
):
    query = apply_time_filter(db.query(AccessLog), granularity, value)
    total = query.count()
    records = query.order_by(AccessLog.visited_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [visit_item_out(item) for item in records],
    }


@router.get("/summary")
def visit_summary(db: Session = Depends(get_db), user: User = Depends(require_admin_user)):
    total_visits = db.query(func.count(AccessLog.id)).filter(AccessLog.event_type == "page_view").scalar() or 0
    unique_ips = db.query(func.count(func.distinct(AccessLog.ip_address))).scalar() or 0
    module_rows = (
        db.query(
            AccessLog.module_id,
            func.count(AccessLog.id),
            func.coalesce(func.sum(AccessLog.duration_ms), 0),
        )
        .filter(AccessLog.event_type == "module_view", AccessLog.module_id != "")
        .group_by(AccessLog.module_id)
        .order_by(func.coalesce(func.sum(AccessLog.duration_ms), 0).desc())
        .all()
    )
    recent = db.query(AccessLog).order_by(AccessLog.visited_at.desc()).limit(12).all()
    return {
        "totalVisits": total_visits,
        "uniqueIps": unique_ips,
        "modules": [
            {"moduleId": module_id, "views": views, "durationMs": duration_ms}
            for module_id, views, duration_ms in module_rows
        ],
        "recent": [
            {
                "ipAddress": item.ip_address,
                "ipLocation": ip_location(item.ip_address),
                "role": item.user_role,
                "username": item.username,
                "path": item.path,
                "eventType": item.event_type,
                "moduleId": item.module_id,
                "durationMs": item.duration_ms,
                "visitedAt": item.visited_at,
            }
            for item in recent
        ],
    }


@router.get("/admin-summary")
def admin_visit_summary(db: Session = Depends(get_db), user: User = Depends(require_admin_user)):
    now = now_beijing()
    online_cutoff = now - timedelta(seconds=95)
    records = db.query(AccessLog).order_by(AccessLog.visited_at.desc()).all()
    total_visits = db.query(func.count(AccessLog.id)).filter(AccessLog.event_type == "page_view").scalar() or 0
    unique_ips = db.query(func.count(func.distinct(AccessLog.ip_address))).scalar() or 0
    module_rows = (
        db.query(
            AccessLog.module_id,
            func.count(AccessLog.id),
            func.coalesce(func.sum(AccessLog.duration_ms), 0),
        )
        .filter(AccessLog.event_type == "module_view", AccessLog.module_id != "")
        .group_by(AccessLog.module_id)
        .order_by(func.coalesce(func.sum(AccessLog.duration_ms), 0).desc())
        .all()
    )
    sessions: dict[str, AccessLog] = {}
    session_start: dict[str, datetime] = {}
    for item in records:
        key = item.session_id or f"{item.ip_address}:{item.username}:{item.user_role}"
        if key not in sessions and item.event_type == "heartbeat" and item.visited_at >= online_cutoff:
            sessions[key] = item
        if key not in session_start or item.visited_at < session_start[key]:
            session_start[key] = item.visited_at
    by_ip: dict[str, dict] = {}
    for item in records:
        if item.ip_address not in by_ip:
            by_ip[item.ip_address] = {
                "ipAddress": item.ip_address,
                "ipLocation": ip_location(item.ip_address),
                "users": set(),
                "visits": 0,
                "durationMs": 0,
                "lastSeen": item.visited_at,
            }
        row = by_ip[item.ip_address]
        if item.username:
            row["users"].add(item.username)
        if item.event_type == "page_view":
            row["visits"] += 1
        if item.event_type == "module_view":
            row["durationMs"] += item.duration_ms or 0
        if item.visited_at > row["lastSeen"]:
            row["lastSeen"] = item.visited_at
    online = []
    for key, item in sessions.items():
        started_at = session_start.get(key, item.visited_at)
        online.append({
            "ipAddress": item.ip_address,
            "ipLocation": ip_location(item.ip_address),
            "role": item.user_role,
            "username": item.username,
            "moduleId": item.module_id,
            "onlineMs": max(item.duration_ms or 0, int((item.visited_at - started_at).total_seconds() * 1000)),
            "lastSeen": item.visited_at,
        })
    return {
        "totalVisits": total_visits,
        "uniqueIps": unique_ips,
        "totalModuleDurationMs": sum(duration_ms for _, _, duration_ms in module_rows),
        "online": online,
        "modules": [
            {"moduleId": module_id, "views": views, "durationMs": duration_ms}
            for module_id, views, duration_ms in module_rows
        ],
        "byIp": [
            {
                **row,
                "users": sorted(row["users"]),
            }
            for row in sorted(by_ip.values(), key=lambda value: value["lastSeen"], reverse=True)
        ],
        "recent": [
            {
                "ipAddress": item.ip_address,
                "ipLocation": ip_location(item.ip_address),
                "role": item.user_role,
                "username": item.username,
                "path": item.path,
                "eventType": item.event_type,
                "moduleId": item.module_id,
                "durationMs": item.duration_ms,
                "visitedAt": item.visited_at,
            }
            for item in records[:40]
        ],
    }

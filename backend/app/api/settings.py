import json
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_writer
from ..database import get_db
from ..models import SiteSetting, User
from ..schemas import LoveSettingsIn, LoveSettingsOut, MapKeySettingsIn, MapKeySettingsOut

router = APIRouter()

AMAP_JS_KEY = "amap_js_key"
AMAP_WEB_SERVICE_KEY = "amap_web_service_key"
LOVE_SETTINGS = "love_settings"

DEFAULT_LOVE_SETTINGS = LoveSettingsOut(
    firstMeetDate="2023-08-20",
    loveStartDate="2023-08-20",
    visualEffect="mixed",
    nicknameMe="LXQ",
    nicknameHer="WLY",
    avatarMe="",
    avatarHer="",
)


def get_setting(db: Session, key: str) -> str:
    item = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    return item.value if item else ""


def set_setting(db: Session, key: str, value: str) -> None:
    item = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    if item:
        item.value = value
    else:
        db.add(SiteSetting(key=key, value=value))


def amap_js_key(db: Session) -> str:
    return get_setting(db, AMAP_JS_KEY) or os.getenv("AMAP_JS_KEY", "")


def amap_web_service_key(db: Session) -> str:
    return get_setting(db, AMAP_WEB_SERVICE_KEY) or os.getenv("AMAP_WEB_SERVICE_KEY", "")


def love_settings(db: Session) -> LoveSettingsOut:
    raw = get_setting(db, LOVE_SETTINGS)
    if not raw:
        return DEFAULT_LOVE_SETTINGS
    try:
        data = json.loads(raw)
        return LoveSettingsOut(**{**DEFAULT_LOVE_SETTINGS.model_dump(), **data})
    except Exception:
        return DEFAULT_LOVE_SETTINGS


@router.get("/map-keys", response_model=MapKeySettingsOut)
def get_map_keys(db: Session = Depends(get_db)):
    return MapKeySettingsOut(
        amapJsKey=amap_js_key(db),
        hasWebServiceKey=bool(amap_web_service_key(db)),
    )


@router.put("/map-keys", response_model=MapKeySettingsOut)
def update_map_keys(payload: MapKeySettingsIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    if user.role not in {"me", "her"}:
        raise HTTPException(status_code=403, detail="Guest is read-only")
    set_setting(db, AMAP_JS_KEY, payload.amapJsKey.strip())
    if payload.amapWebServiceKey.strip():
        set_setting(db, AMAP_WEB_SERVICE_KEY, payload.amapWebServiceKey.strip())
    db.commit()
    return MapKeySettingsOut(
        amapJsKey=amap_js_key(db),
        hasWebServiceKey=bool(amap_web_service_key(db)),
    )


@router.get("/love", response_model=LoveSettingsOut)
def get_love_settings(db: Session = Depends(get_db)):
    return love_settings(db)


@router.put("/love", response_model=LoveSettingsOut)
def update_love_settings(payload: LoveSettingsIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    if user.role not in {"me", "her"}:
        raise HTTPException(status_code=403, detail="Guest is read-only")
    next_value = LoveSettingsOut(**payload.model_dump())
    set_setting(db, LOVE_SETTINGS, json.dumps(next_value.model_dump(), ensure_ascii=False))
    db.commit()
    return love_settings(db)

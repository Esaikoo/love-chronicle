import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_writer
from ..database import get_db
from ..models import SiteSetting, User
from ..schemas import MapKeySettingsIn, MapKeySettingsOut

router = APIRouter()

AMAP_JS_KEY = "amap_js_key"
AMAP_WEB_SERVICE_KEY = "amap_web_service_key"


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

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.types import UserDefinedType
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .utils.time import now_beijing


class Vector512(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kwargs):
        return "VECTOR(512)"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)


class HeartPhoto(Base):
    __tablename__ = "heart_photos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    file_url: Mapped[str] = mapped_column(String(500))
    created_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)


class MusicTrack(Base):
    __tablename__ = "music_tracks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    artist: Mapped[str] = mapped_column(String(200), default="Local")
    duration: Mapped[int | None] = mapped_column(Integer)
    file_url: Mapped[str] = mapped_column(String(500))
    cover_url: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)


class CalendarNote(Base):
    __tablename__ = "calendar_notes"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    emoji: Mapped[str] = mapped_column(String(20), default="💗")
    rating: Mapped[int] = mapped_column(Integer, default=5)
    rating_me: Mapped[int] = mapped_column(Integer, default=5)
    rating_her: Mapped[int] = mapped_column(Integer, default=5)
    text: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str | None] = mapped_column(String(20))
    updated_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing, onupdate=now_beijing)
    images: Mapped[list["CalendarNoteImage"]] = relationship(cascade="all, delete-orphan")


class CalendarNoteImage(Base):
    __tablename__ = "calendar_note_images"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    note_date: Mapped[date] = mapped_column(ForeignKey("calendar_notes.date", ondelete="CASCADE"))
    file_url: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)


class Countdown(Base):
    __tablename__ = "countdowns"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    target_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text, default="")
    emoji: Mapped[str] = mapped_column(String(20), default="✨")
    cover_url: Mapped[str | None] = mapped_column(String(500))
    type: Mapped[str] = mapped_column(String(30), default="normal")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_by: Mapped[str | None] = mapped_column(String(20))
    updated_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)


class Preference(Base):
    __tablename__ = "preferences"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner: Mapped[str] = mapped_column(String(20), index=True)
    category: Mapped[str] = mapped_column(String(80), default="生活")
    content: Mapped[str] = mapped_column(String(200))
    emoji: Mapped[str] = mapped_column(String(20), default="💗")
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String(20))
    updated_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)


class Checkin(Base):
    __tablename__ = "checkins"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200), default="")
    date: Mapped[date] = mapped_column(Date)
    emoji: Mapped[str] = mapped_column(String(20), default="📍")
    text: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str | None] = mapped_column(String(20))
    updated_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    images: Mapped[list["CheckinImage"]] = relationship(cascade="all, delete-orphan")


class CheckinImage(Base):
    __tablename__ = "checkin_images"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    checkin_id: Mapped[str] = mapped_column(ForeignKey("checkins.id", ondelete="CASCADE"))
    file_url: Mapped[str] = mapped_column(String(500))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    embedding: Mapped[str | None] = mapped_column(Vector512)
    embedding_model: Mapped[str | None] = mapped_column(String(120))
    embedding_status: Mapped[str] = mapped_column(String(20), default="pending")
    embedding_error: Mapped[str | None] = mapped_column(Text)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)


class TravelPlan(Base):
    __tablename__ = "travel_plans"
    __table_args__ = (UniqueConstraint("countdown_id"), UniqueConstraint("travel_code"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    countdown_id: Mapped[str] = mapped_column(String(64), index=True)
    travel_code: Mapped[str | None] = mapped_column(String(120), index=True)
    title: Mapped[str] = mapped_column(String(200))
    destination: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    intro: Mapped[str] = mapped_column(Text, default="")
    cover_url: Mapped[str | None] = mapped_column(String(500))
    default_map_mode: Mapped[str] = mapped_column(String(20), default="2D")
    created_by: Mapped[str | None] = mapped_column(String(20))
    updated_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    days: Mapped[list["TravelDay"]] = relationship(cascade="all, delete-orphan", order_by="TravelDay.day_number")


class TravelDay(Base):
    __tablename__ = "travel_days"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("travel_plans.id", ondelete="CASCADE"), index=True)
    day_number: Mapped[int] = mapped_column(Integer)
    date: Mapped[date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(200), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    theme_color: Mapped[str] = mapped_column(String(40), default="#ff7eb3")
    stops: Mapped[list["TravelStop"]] = relationship(cascade="all, delete-orphan", order_by="TravelStop.sort_order")
    legs: Mapped[list["TravelLeg"]] = relationship(cascade="all, delete-orphan")


class TravelStop(Base):
    __tablename__ = "travel_stops"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    day_id: Mapped[str] = mapped_column(ForeignKey("travel_days.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer)
    stop_type: Mapped[str] = mapped_column(String(40), default="other")
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(120), default="")
    district: Mapped[str] = mapped_column(String(120), default="")
    address: Mapped[str] = mapped_column(String(500), default="")
    longitude: Mapped[float | None] = mapped_column(Float)
    latitude: Mapped[float | None] = mapped_column(Float)
    coord_system: Mapped[str] = mapped_column(String(40), default="gcj02")
    arrive_time: Mapped[str] = mapped_column(String(20), default="")
    leave_time: Mapped[str] = mapped_column(String(20), default="")
    stay_minutes: Mapped[int | None] = mapped_column(Integer)
    cost: Mapped[float | None] = mapped_column(Float)
    open_time: Mapped[str] = mapped_column(String(120), default="")
    ticket: Mapped[str] = mapped_column(String(120), default="")
    need_reservation: Mapped[bool] = mapped_column(Boolean, default=False)
    meal_type: Mapped[str] = mapped_column(String(60), default="")
    recommended_food: Mapped[str] = mapped_column(Text, default="")
    guide: Mapped[str] = mapped_column(Text, default="")
    warning: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(String(500))
    image_urls: Mapped[str] = mapped_column(Text, default="")


class TravelLeg(Base):
    __tablename__ = "travel_legs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    day_id: Mapped[str] = mapped_column(ForeignKey("travel_days.id", ondelete="CASCADE"), index=True)
    from_stop_id: Mapped[str | None] = mapped_column(String(64), index=True)
    to_stop_id: Mapped[str | None] = mapped_column(String(64), index=True)
    transport: Mapped[str] = mapped_column(String(40), default="other")
    transports: Mapped[str] = mapped_column(Text, default="")
    depart_time: Mapped[str] = mapped_column(String(20), default="")
    arrive_time: Mapped[str] = mapped_column(String(20), default="")
    planned_minutes: Mapped[int | None] = mapped_column(Integer)
    planned_cost: Mapped[float | None] = mapped_column(Float)
    planned_distance_km: Mapped[float | None] = mapped_column(Float)
    use_map_route: Mapped[bool] = mapped_column(Boolean, default=True)
    map_minutes: Mapped[int | None] = mapped_column(Integer)
    map_distance_km: Mapped[float | None] = mapped_column(Float)
    route_geometry: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")


class TravelPlanImage(Base):
    __tablename__ = "travel_plan_images"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("travel_plans.id", ondelete="CASCADE"), index=True)
    file_url: Mapped[str] = mapped_column(String(500))
    image_type: Mapped[str] = mapped_column(String(40), default="stop")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)


class TravelImportJob(Base):
    __tablename__ = "travel_import_jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    countdown_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(40), default="pending")
    message: Mapped[str] = mapped_column(Text, default="")
    error_report: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing)


class SiteSetting(Base):
    __tablename__ = "site_settings"
    __table_args__ = (UniqueConstraint("key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(120), index=True)
    value: Mapped[str] = mapped_column(Text, default="")


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ip_address: Mapped[str] = mapped_column(String(80), index=True)
    user_role: Mapped[str] = mapped_column(String(20), default="guest", index=True)
    username: Mapped[str] = mapped_column(String(80), default="guest", index=True)
    path: Mapped[str] = mapped_column(String(500), default="")
    session_id: Mapped[str] = mapped_column(String(120), default="", index=True)
    event_type: Mapped[str] = mapped_column(String(40), default="page_view", index=True)
    module_id: Mapped[str] = mapped_column(String(80), default="", index=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    user_agent: Mapped[str] = mapped_column(Text, default="")
    visited_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing, index=True)


class Letter(Base):
    __tablename__ = "letters"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, default="")
    from_user: Mapped[str] = mapped_column(String(80), default="")
    to_user: Mapped[str] = mapped_column(String(80), default="")
    emoji: Mapped[str] = mapped_column(String(20), default="💌")
    envelope_style: Mapped[str] = mapped_column(String(40), default="sakura")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_by: Mapped[str] = mapped_column(String(20), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_beijing, index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)


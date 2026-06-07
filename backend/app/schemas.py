from datetime import date, datetime

from pydantic import BaseModel


class UserOut(BaseModel):
    username: str
    role: str
    display_name: str


class ProfileUpdateIn(BaseModel):
    displayName: str


class LoginIn(BaseModel):
    username: str
    password: str
    role: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class PhotoOut(BaseModel):
    id: str
    title: str | None = None
    description: str | None = None
    src: str
    source: str = "uploaded"
    createdAt: datetime


class MusicOut(BaseModel):
    id: str
    title: str
    artist: str
    duration: int | None = None
    src: str
    coverSrc: str | None = None
    source: str = "uploaded"
    createdAt: datetime


class CalendarNoteIn(BaseModel):
    date: date
    emoji: str = "💗"
    rating: int = 5
    ratingMe: int = 5
    ratingHer: int = 5
    text: str = ""
    tags: list[str] = []
    imageUrls: list[str] = []


class CalendarNoteOut(CalendarNoteIn):
    createdBy: str | None = None
    updatedBy: str | None = None
    createdAt: datetime
    updatedAt: datetime


class CountdownIn(BaseModel):
    title: str
    targetDate: date
    description: str = ""
    emoji: str = "✨"
    coverUrl: str | None = None
    type: str = "normal"
    status: str = "pending"


class CountdownOut(CountdownIn):
    id: str
    createdBy: str | None = None
    updatedBy: str | None = None
    createdAt: datetime
    updatedAt: datetime | None = None
    completedAt: datetime | None = None


class PreferenceIn(BaseModel):
    owner: str
    category: str = "生活"
    content: str
    emoji: str = "💗"
    note: str | None = None


class PreferenceOut(PreferenceIn):
    id: str
    createdBy: str | None = None
    updatedBy: str | None = None
    createdAt: datetime
    updatedAt: datetime | None = None


class CheckinIn(BaseModel):
    title: str
    location: str = ""
    date: date
    emoji: str = "📍"
    text: str = ""
    imageUrls: list[str] = []


class CheckinOut(CheckinIn):
    id: str
    imageStatuses: dict[str, str] = {}
    createdBy: str | None = None
    updatedBy: str | None = None
    createdAt: datetime
    updatedAt: datetime | None = None


class CheckinPhotoSearchOut(BaseModel):
    imageId: str
    imageUrl: str
    checkinId: str
    title: str
    location: str
    date: date
    score: float


class LetterIn(BaseModel):
    title: str
    content: str
    fromUser: str = ""
    toUser: str = ""
    emoji: str = "💌"
    envelopeStyle: str = "sakura"
    isPublic: bool = False
    createdAt: datetime | None = None


class LetterOut(LetterIn):
    id: str
    createdBy: str
    updatedAt: datetime | None = None


class IndexStatusOut(BaseModel):
    running: bool
    total: int = 0
    done: int = 0
    failed: int = 0
    message: str = ""
    modelReady: bool = False


class TravelStopIn(BaseModel):
    id: str | None = None
    dayNumber: int
    order: int
    type: str = "other"
    name: str
    city: str = ""
    district: str = ""
    address: str = ""
    longitude: float | None = None
    latitude: float | None = None
    coordSystem: str = "gcj02"
    arriveTime: str = ""
    leaveTime: str = ""
    stayMinutes: int | None = None
    cost: float | None = None
    openTime: str = ""
    ticket: str = ""
    needReservation: bool = False
    mealType: str = ""
    recommendedFood: str = ""
    guide: str = ""
    warning: str = ""
    note: str = ""
    imageUrl: str | None = None
    imageUrls: list[str] = []


class TravelLegIn(BaseModel):
    id: str | None = None
    dayNumber: int
    fromOrder: int
    toOrder: int
    transport: str = "other"
    transports: list[str] = []
    departTime: str = ""
    arriveTime: str = ""
    plannedMinutes: int | None = None
    plannedCost: float | None = None
    plannedDistanceKm: float | None = None
    useMapRoute: bool = True
    mapMinutes: int | None = None
    mapDistanceKm: float | None = None
    routeGeometry: list[list[float]] | None = None
    note: str = ""


class TravelDayIn(BaseModel):
    dayNumber: int
    date: date
    title: str = ""
    summary: str = ""
    themeColor: str = "#ff7eb3"
    stops: list[TravelStopIn] = []
    legs: list[TravelLegIn] = []


class TravelPlanIn(BaseModel):
    travelCode: str | None = None
    title: str
    destination: str
    startDate: date
    endDate: date
    intro: str = ""
    coverUrl: str | None = None
    defaultMapMode: str = "2D"
    days: list[TravelDayIn] = []


class TravelStopOut(TravelStopIn):
    id: str


class TravelLegOut(TravelLegIn):
    id: str
    fromStopId: str | None = None
    toStopId: str | None = None


class TravelDayOut(BaseModel):
    id: str
    dayNumber: int
    date: date
    title: str = ""
    summary: str = ""
    themeColor: str = "#ff7eb3"
    stops: list[TravelStopOut] = []
    legs: list[TravelLegOut] = []


class TravelPlanOut(BaseModel):
    id: str
    countdownId: str
    travelCode: str | None = None
    title: str
    destination: str
    startDate: date
    endDate: date
    intro: str = ""
    coverUrl: str | None = None
    defaultMapMode: str = "2D"
    createdBy: str | None = None
    updatedBy: str | None = None
    createdAt: datetime
    updatedAt: datetime | None = None
    days: list[TravelDayOut] = []


class TravelImportErrorOut(BaseModel):
    sheet: str
    row: int
    field: str
    reason: str
    suggestion: str


class TravelImportOut(BaseModel):
    ok: bool
    plan: TravelPlanOut | None = None
    errors: list[TravelImportErrorOut] = []
    message: str = ""


class TravelGeocodeIn(BaseModel):
    city: str = ""
    district: str = ""
    address: str


class TravelGeocodeOut(BaseModel):
    longitude: float | None = None
    latitude: float | None = None
    formattedAddress: str = ""
    ok: bool = False
    message: str = ""


class MapKeySettingsIn(BaseModel):
    amapJsKey: str = ""
    amapWebServiceKey: str = ""


class MapKeySettingsOut(BaseModel):
    amapJsKey: str = ""
    hasWebServiceKey: bool = False

export type HeartPhotoAsset = {
  id: string;
  title?: string;
  description?: string;
  fileId?: string;
  src?: string;
  mediaType?: "image" | "video";
  source: "uploaded" | "mock";
  createdAt: string;
};

export type MusicTrackAsset = {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  fileId?: string;
  src?: string;
  coverId?: string;
  coverSrc?: string;
  source: "uploaded" | "mock";
  createdAt: string;
};

export type PlayMode = "sequence" | "shuffle" | "single";
export type CountdownType = "normal" | "travel" | "anniversary" | "event" | "other";

export type CalendarNote = {
  date: string;
  emoji: string;
  rating: number;
  ratingMe?: number;
  ratingHer?: number;
  text: string;
  tags: string[];
  imageIds: string[];
  createdBy?: "me" | "her";
  updatedBy?: "me" | "her";
  createdAt?: string;
  updatedAt: string;
};

export type CountdownItem = {
  id: string;
  title: string;
  targetDate: string;
  description: string;
  emoji: string;
  coverImageId?: string;
  type?: CountdownType;
  status: "pending" | "completed";
  createdAt: string;
  completedAt?: string;
  createdBy?: "me" | "her";
  updatedBy?: "me" | "her";
  updatedAt?: string;
};

export type PreferenceOwner = "me" | "her" | "both";

export type PreferenceItem = {
  id: string;
  owner: PreferenceOwner;
  category: string;
  content: string;
  emoji: string;
  note?: string;
  createdAt: string;
  createdBy?: "me" | "her";
  updatedBy?: "me" | "her";
  updatedAt?: string;
};

export type CheckinItem = {
  id: string;
  title: string;
  location: string;
  date: string;
  emoji: string;
  text: string;
  imageIds: string[];
  imageStatuses?: Record<string, "pending" | "ready" | "failed" | string>;
  createdAt: string;
  createdBy?: "me" | "her";
  updatedBy?: "me" | "her";
  updatedAt?: string;
};

export type CheckinPhotoSearchResult = {
  imageId: string;
  imageUrl: string;
  checkinId: string;
  title: string;
  location: string;
  date: string;
  score: number;
};

export type LoveSettings = {
  firstMeetDate: string;
  loveStartDate: string;
  visualEffect: "hearts" | "meteors" | "petals" | "starlight" | "mixed" | "none";
  nicknameMe: string;
  nicknameHer: string;
  avatarMe: string;
  avatarHer: string;
};

export type EnvelopeStyle = "sakura" | "cream" | "lavender" | "rose";

export type LetterItem = {
  id: string;
  title: string;
  content: string;
  fromUser: string;
  toUser: string;
  emoji: string;
  envelopeStyle: EnvelopeStyle | string;
  isPublic: boolean;
  createdBy: "me" | "her";
  createdAt: string;
  updatedAt?: string | null;
};

export type CheckinIndexStatus = {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  message: string;
  modelReady: boolean;
};

export type TravelStopType = "start" | "end" | "scenic" | "restaurant" | "hotel" | "station" | "airport" | "shopping" | "rest" | "other";
export type TravelTransport = "walk" | "bike" | "drive" | "taxi" | "bus" | "subway" | "train" | "flight" | "other";

export type TravelStop = {
  id?: string;
  dayNumber: number;
  order: number;
  type: TravelStopType;
  name: string;
  city: string;
  district?: string;
  address?: string;
  longitude?: number;
  latitude?: number;
  coordSystem?: string;
  arriveTime?: string;
  leaveTime?: string;
  stayMinutes?: number;
  cost?: number;
  openTime?: string;
  ticket?: string;
  needReservation?: boolean;
  mealType?: string;
  recommendedFood?: string;
  guide?: string;
  warning?: string;
  note?: string;
  imageUrl?: string;
  imageUrls?: string[];
};

export type TravelLeg = {
  id?: string;
  dayNumber: number;
  fromOrder: number;
  toOrder: number;
  fromStopId?: string;
  toStopId?: string;
  transport: TravelTransport;
  transports?: TravelTransport[];
  departTime?: string;
  arriveTime?: string;
  plannedMinutes?: number;
  plannedCost?: number;
  plannedDistanceKm?: number;
  useMapRoute?: boolean;
  mapMinutes?: number;
  mapDistanceKm?: number;
  routeGeometry?: [number, number][];
  note?: string;
};

export type TravelDay = {
  id?: string;
  dayNumber: number;
  date: string;
  title?: string;
  summary?: string;
  themeColor?: string;
  stops: TravelStop[];
  legs: TravelLeg[];
};

export type TravelPlan = {
  id?: string;
  countdownId?: string;
  travelCode?: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  intro?: string;
  coverUrl?: string;
  defaultMapMode?: "2D" | "2.5D" | string;
  createdBy?: "me" | "her";
  updatedBy?: "me" | "her";
  createdAt?: string;
  updatedAt?: string;
  days: TravelDay[];
};

export type TravelImportError = {
  sheet: string;
  row: number;
  field: string;
  reason: string;
  suggestion: string;
};

export type TravelImportResult = {
  ok: boolean;
  plan?: TravelPlan | null;
  errors: TravelImportError[];
  message: string;
};

import type { CalendarNote, CheckinIndexStatus, CheckinItem, CheckinPhotoSearchResult, CountdownItem, HeartPhotoAsset, LetterItem, MusicTrackAsset, PreferenceItem, TravelImportResult, TravelPlan } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:18080";
const TOKEN_KEY = "love-chronicle:auth-token";
const USER_KEY = "love-chronicle:current-user";
const SESSION_KEY = "love-chronicle:session-id";

export type UserRole = "me" | "her" | "guest";

export type CurrentUser = {
  username: string;
  role: UserRole;
  display_name?: string;
};

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function currentSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...authHeaders(),
    ...((options.headers as Record<string, string> | undefined) ?? {})
  };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export const authStorage = {
  tokenKey: TOKEN_KEY,
  userKey: USER_KEY,
  save(token: string, user: CurrentUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  saveGuest() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: "guest", role: "guest", display_name: "游客" }));
  },
  current(): CurrentUser {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : { username: "guest", role: "guest", display_name: "游客" };
    } catch {
      return { username: "guest", role: "guest", display_name: "游客" };
    }
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  hasToken() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }
};

const toCalendarPayload = (note: CalendarNote) => ({
  date: note.date,
  emoji: note.emoji,
  rating: note.rating,
  ratingMe: note.ratingMe ?? note.rating,
  ratingHer: note.ratingHer ?? note.rating,
  text: note.text,
  tags: note.tags,
  imageUrls: note.imageIds
});

const fromCheckin = (item: any): CheckinItem => ({
  ...item,
  imageIds: item.imageIds ?? item.imageUrls ?? []
});

const toCheckinPayload = (item: CheckinItem) => ({
  title: item.title,
  location: item.location,
  date: item.date,
  emoji: item.emoji,
  text: item.text,
  imageUrls: item.imageIds ?? []
});

export const api = {
  login: (payload: { username: string; password: string; role: "me" | "her" }) =>
    request<{ token: string; user: CurrentUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<CurrentUser>("/api/auth/me"),
  updateProfile: (payload: { displayName: string }) => request<CurrentUser>("/api/auth/profile", { method: "PUT", body: JSON.stringify(payload) }),
  recordPageView: (path = window.location.pathname) => request<{ ok: boolean }>("/api/visits/page-view", { method: "POST", headers: { "X-Love-Page": path, "X-Love-Session": currentSessionId() } }),
  recordModuleView: (payload: { moduleId: string; durationMs: number }) => request<{ ok: boolean }>("/api/visits/module-view", { method: "POST", headers: { "X-Love-Session": currentSessionId() }, body: JSON.stringify(payload) }),
  recordHeartbeat: (payload: { moduleId: string; durationMs: number; sessionId?: string }) => request<{ ok: boolean }>("/api/visits/heartbeat", { method: "POST", headers: { "X-Love-Page": window.location.pathname, "X-Love-Session": currentSessionId() }, body: JSON.stringify({ ...payload, sessionId: payload.sessionId || currentSessionId() }) }),
  visits: {
    list: (limit = 100) => request<Array<{ id: number; ipAddress: string; role: string; username: string; path: string; userAgent: string; visitedAt: string }>>(`/api/visits?limit=${limit}`),
    summary: () => request<{ totalVisits: number; uniqueIps: number; modules: Array<{ moduleId: string; views: number; durationMs: number }>; recent: Array<{ ipAddress: string; role: string; username: string; path: string; eventType: string; moduleId: string; durationMs: number; visitedAt: string }> }>("/api/visits/summary")
  },
  settings: {
    mapKeys: {
      get: () => request<{ amapJsKey: string; hasWebServiceKey: boolean }>("/api/settings/map-keys"),
      update: (payload: { amapJsKey: string; amapWebServiceKey: string }) => request<{ amapJsKey: string; hasWebServiceKey: boolean }>("/api/settings/map-keys", { method: "PUT", body: JSON.stringify(payload) })
    }
  },
  photos: {
    list: () => request<HeartPhotoAsset[]>("/api/photos"),
    upload: (file: File, title?: string, description?: string) => {
      const form = new FormData();
      form.append("file", file);
      if (title) form.append("title", title);
      if (description) form.append("description", description);
      return request<HeartPhotoAsset>("/api/photos", { method: "POST", body: form });
    },
    update: (id: string, meta: { title?: string; description?: string }) => {
      const form = new FormData();
      form.append("title", meta.title ?? "");
      form.append("description", meta.description ?? "");
      return request<HeartPhotoAsset>(`/api/photos/${id}`, { method: "PUT", body: form });
    },
    delete: (id: string) => request<{ ok: boolean }>(`/api/photos/${id}`, { method: "DELETE" })
  },
  music: {
    list: () => request<MusicTrackAsset[]>("/api/music"),
    upload: (file: File, meta: { title: string; artist: string; duration?: number; cover?: Blob }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("title", meta.title);
      form.append("artist", meta.artist);
      if (meta.duration) form.append("duration", String(Math.round(meta.duration)));
      if (meta.cover) form.append("cover", meta.cover, "cover.jpg");
      return request<MusicTrackAsset>("/api/music", { method: "POST", body: form });
    },
    delete: (id: string) => request<{ ok: boolean }>(`/api/music/${id}`, { method: "DELETE" })
  },
  calendar: {
    list: () => request<any[]>("/api/calendar-notes"),
    create: (note: CalendarNote) => request<any>("/api/calendar-notes", { method: "POST", body: JSON.stringify(toCalendarPayload(note)) }),
    update: (date: string, note: CalendarNote) => request<any>(`/api/calendar-notes/${date}`, { method: "PUT", body: JSON.stringify(toCalendarPayload(note)) }),
    delete: (date: string) => request<{ ok: boolean }>(`/api/calendar-notes/${date}`, { method: "DELETE" })
  },
  countdowns: {
    list: () => request<CountdownItem[]>("/api/countdowns"),
    create: (item: any) => request<CountdownItem>("/api/countdowns", { method: "POST", body: JSON.stringify(item) }),
    update: (id: string, item: any) => request<CountdownItem>(`/api/countdowns/${id}`, { method: "PUT", body: JSON.stringify(item) }),
    delete: (id: string) => request<{ ok: boolean }>(`/api/countdowns/${id}`, { method: "DELETE" }),
    travelPlan: {
      get: (id: string) => request<TravelPlan | null>(`/api/countdowns/${id}/travel-plan`),
      save: (id: string, plan: TravelPlan, exists: boolean) => request<TravelPlan>(`/api/countdowns/${id}/travel-plan`, { method: exists ? "PUT" : "POST", body: JSON.stringify(plan) }),
      delete: (id: string) => request<{ ok: boolean }>(`/api/countdowns/${id}/travel-plan`, { method: "DELETE" }),
      mapData: (id: string) => request<TravelPlan | null>(`/api/countdowns/${id}/travel-plan/map-data`),
      generateRoutes: (id: string) => request<TravelPlan | null>(`/api/countdowns/${id}/travel-plan/generate-routes`, { method: "POST" }),
      geocode: (id: string, payload: { city?: string; district?: string; address: string }) => request<{ ok: boolean; longitude?: number; latitude?: number; formattedAddress?: string; message: string }>(`/api/countdowns/${id}/travel-plan/geocode`, { method: "POST", body: JSON.stringify(payload) }),
      importExcel: (id: string, file: File, strategy = "overwrite") => {
        const form = new FormData();
        form.append("file", file);
        form.append("strategy", strategy);
        return request<TravelImportResult>(`/api/countdowns/${id}/travel-plan/import`, { method: "POST", body: form });
      }
    }
  },
  preferences: {
    list: () => request<PreferenceItem[]>("/api/preferences"),
    create: (item: any) => request<PreferenceItem>("/api/preferences", { method: "POST", body: JSON.stringify(item) }),
    update: (id: string, item: any) => request<PreferenceItem>(`/api/preferences/${id}`, { method: "PUT", body: JSON.stringify(item) }),
    delete: (id: string) => request<{ ok: boolean }>(`/api/preferences/${id}`, { method: "DELETE" })
  },
  checkins: {
    list: async () => (await request<any[]>("/api/checkins")).map(fromCheckin),
    create: async (item: CheckinItem) => fromCheckin(await request<any>("/api/checkins", { method: "POST", body: JSON.stringify(toCheckinPayload(item)) })),
    update: async (id: string, item: CheckinItem) => fromCheckin(await request<any>(`/api/checkins/${id}`, { method: "PUT", body: JSON.stringify(toCheckinPayload(item)) })),
    delete: (id: string) => request<{ ok: boolean }>(`/api/checkins/${id}`, { method: "DELETE" }),
    searchPhotos: (q: string, limit = 12) => request<CheckinPhotoSearchResult[]>(`/api/checkins/photos/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    reindexPhotos: () => request<{ ok: boolean; message: string }>("/api/checkins/photos/reindex", { method: "POST" }),
    indexStatus: () => request<CheckinIndexStatus>("/api/checkins/photos/index-status")
  },
  letters: {
    list: (params: { q?: string; from?: string; to?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.q) query.set("q", params.q);
      if (params.from) query.set("from", params.from);
      if (params.to) query.set("to", params.to);
      return request<LetterItem[]>(`/api/letters${query.toString() ? `?${query}` : ""}`);
    },
    create: (item: Omit<LetterItem, "id" | "createdBy" | "updatedAt">) => request<LetterItem>("/api/letters", { method: "POST", body: JSON.stringify(item) }),
    update: (id: string, item: Omit<LetterItem, "id" | "createdBy" | "updatedAt">) => request<LetterItem>(`/api/letters/${id}`, { method: "PUT", body: JSON.stringify(item) }),
    delete: (id: string) => request<{ ok: boolean }>(`/api/letters/${id}`, { method: "DELETE" })
  },
  upload: (kind: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>(`/api/uploads?kind=${kind}`, { method: "POST", body: form });
  }
};

export function uploadWithProgress(kind: string, file: File, onProgress: (progress: number) => void) {
  const form = new FormData();
  form.append("file", file);
  return new Promise<{ url: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE_URL}/api/uploads?kind=${encodeURIComponent(kind)}`);
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(98, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(JSON.parse(request.responseText));
      } else {
        reject(new Error(request.responseText || "Upload failed"));
      }
    };
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(form);
  });
}

export function absoluteUrl(url?: string) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  if (!API_BASE_URL) return url;
  return `${API_BASE_URL}${url}`;
}

import os
from datetime import datetime

import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from .database import Base, SessionLocal, engine
from .models import AccessLog
from .seed import seed_users
from .api import auth, calendar, checkins, countdowns, letters, music, photos, preferences, settings, travel, uploads, visits
from .utils.semantic_search import warm_models_in_background

app = FastAPI(title="love-chronicle-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

COMPATIBILITY_MIGRATIONS = [
    "ALTER TABLE heart_photos ADD COLUMN IF NOT EXISTS created_by VARCHAR(20)",
    "ALTER TABLE music_tracks ADD COLUMN IF NOT EXISTS created_by VARCHAR(20)",
    "ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS rating_me INTEGER NOT NULL DEFAULT 5",
    "ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS rating_her INTEGER NOT NULL DEFAULT 5",
    "ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS created_by VARCHAR(20)",
    "ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS updated_by VARCHAR(20)",
    "ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE countdowns ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500)",
    "ALTER TABLE countdowns ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'normal'",
    "ALTER TABLE countdowns ADD COLUMN IF NOT EXISTS created_by VARCHAR(20)",
    "ALTER TABLE countdowns ADD COLUMN IF NOT EXISTS updated_by VARCHAR(20)",
    "ALTER TABLE countdowns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
    "ALTER TABLE countdowns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
    "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS created_by VARCHAR(20)",
    "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS updated_by VARCHAR(20)",
    "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
    "ALTER TABLE checkins ADD COLUMN IF NOT EXISTS created_by VARCHAR(20)",
    "ALTER TABLE checkins ADD COLUMN IF NOT EXISTS updated_by VARCHAR(20)",
    "ALTER TABLE checkins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
    "ALTER TABLE checkin_images ADD COLUMN IF NOT EXISTS embedding vector(512)",
    "ALTER TABLE checkin_images ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(120)",
    "ALTER TABLE checkin_images ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending'",
    "ALTER TABLE checkin_images ADD COLUMN IF NOT EXISTS embedding_error TEXT",
    "ALTER TABLE checkin_images ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP",
    "ALTER TABLE travel_stops ADD COLUMN IF NOT EXISTS image_urls TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE travel_legs ADD COLUMN IF NOT EXISTS transports TEXT NOT NULL DEFAULT ''",
    "CREATE TABLE IF NOT EXISTS access_logs (id SERIAL PRIMARY KEY, ip_address VARCHAR(80) NOT NULL, user_role VARCHAR(20) NOT NULL DEFAULT 'guest', username VARCHAR(80) NOT NULL DEFAULT 'guest', path VARCHAR(500) NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '', visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS event_type VARCHAR(40) NOT NULL DEFAULT 'page_view'",
    "ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS module_id VARCHAR(80) NOT NULL DEFAULT ''",
    "ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(120) NOT NULL DEFAULT ''",
    "CREATE INDEX IF NOT EXISTS access_logs_visited_at_idx ON access_logs (visited_at)",
    "CREATE INDEX IF NOT EXISTS access_logs_ip_address_idx ON access_logs (ip_address)",
    "CREATE INDEX IF NOT EXISTS access_logs_username_idx ON access_logs (username)",
    "CREATE INDEX IF NOT EXISTS access_logs_event_type_idx ON access_logs (event_type)",
    "CREATE INDEX IF NOT EXISTS access_logs_module_id_idx ON access_logs (module_id)",
    "CREATE INDEX IF NOT EXISTS access_logs_session_id_idx ON access_logs (session_id)",
    "CREATE TABLE IF NOT EXISTS letters (id VARCHAR(64) PRIMARY KEY, title VARCHAR(200) NOT NULL, content TEXT NOT NULL DEFAULT '', from_user VARCHAR(80) NOT NULL DEFAULT '', to_user VARCHAR(80) NOT NULL DEFAULT '', emoji VARCHAR(20) NOT NULL DEFAULT '💌', envelope_style VARCHAR(40) NOT NULL DEFAULT 'sakura', is_public BOOLEAN NOT NULL DEFAULT FALSE, created_by VARCHAR(20) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS letters_created_by_idx ON letters (created_by)",
    "CREATE INDEX IF NOT EXISTS letters_is_public_idx ON letters (is_public)",
    "CREATE INDEX IF NOT EXISTS letters_created_at_idx ON letters (created_at)",
    "CREATE INDEX IF NOT EXISTS checkin_images_embedding_idx ON checkin_images USING ivfflat (embedding vector_cosine_ops) WITH (lists = 80)",
]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else ""


def user_from_request(request: Request) -> tuple[str, str]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return "guest", "guest"
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET", "please_change_this_secret"), algorithms=["HS256"])
    except jwt.PyJWTError:
        return "guest", "guest"
    return str(payload.get("role") or "guest"), str(payload.get("sub") or "guest")


@app.middleware("http")
async def record_page_visit(request: Request, call_next):
    return await call_next(request)


@app.on_event("startup")
def on_startup():
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        for statement in COMPATIBILITY_MIGRATIONS:
            connection.execute(text(statement))
    db = SessionLocal()
    try:
        seed_users(db)
    finally:
        db.close()
    warm_models_in_background()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/")
def root():
    return {
        "name": "love-chronicle-backend",
        "message": "Backend is running. Open /docs for API docs.",
        "docs": "/docs"
    }


@app.get("/admin/visits", response_class=HTMLResponse)
def visits_admin_page():
    return """
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Love Chronicle 后台 · 访问统计</title>
  <style>
    :root { color: #74335c; background: linear-gradient(135deg, #fff1f7, #ffd6e8 52%, #e9d5ff); font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: 28px; }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background: radial-gradient(circle at 18% 12%, rgba(255,255,255,.62), transparent 22%), radial-gradient(circle at 78% 0%, rgba(179,136,255,.18), transparent 28%); }
    main { width: min(1180px, 100%); margin: 0 auto; }
    main > * { position: relative; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 18px; }
    h1 { margin: 0; font-size: clamp(1.7rem, 4vw, 2.8rem); }
    p { color: #9a6680; }
    .card { border: 1px solid rgba(255,255,255,.76); border-radius: 24px; padding: 18px; background: rgba(255,255,255,.58); box-shadow: 0 22px 70px rgba(126,48,105,.16); backdrop-filter: blur(18px); }
    .login { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
    input, select, button { height: 42px; border-radius: 999px; border: 1px solid rgba(255,126,179,.24); padding: 0 14px; font: inherit; color: #74335c; background: rgba(255,255,255,.78); outline: none; }
    button { cursor: pointer; font-weight: 850; background: linear-gradient(135deg, #ff7eb3, #b388ff); color: #fff; border: 0; box-shadow: 0 10px 24px rgba(216,61,145,.18); }
    button:disabled { cursor: not-allowed; opacity: .45; box-shadow: none; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
    .stat b { display: block; font-size: 2rem; color: #d83d91; }
    .grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 16px; align-items: start; }
    .full { grid-column: 1 / -1; }
    .filters { display: grid; grid-template-columns: 140px minmax(180px, 1fr) auto auto; gap: 10px; margin-bottom: 12px; align-items: center; }
    .scroll-table { max-height: 420px; overflow: auto; border-radius: 16px; border: 1px solid rgba(255,126,179,.12); background: rgba(255,255,255,.38); }
    .scroll-table table { min-width: 920px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { position: sticky; top: 0; z-index: 1; background: rgba(255, 246, 251, .96); backdrop-filter: blur(10px); }
    th, td { padding: 11px 10px; border-bottom: 1px solid rgba(255,126,179,.14); text-align: left; vertical-align: top; }
    tbody tr:hover { background: rgba(255, 126, 179, .07); }
    th { color: #8a3b66; font-size: .82rem; }
    h2 { margin: 0 0 12px; }
    .online-dot { display: inline-flex; width: 9px; height: 9px; border-radius: 50%; background: #28c76f; box-shadow: 0 0 0 6px rgba(40,199,111,.12); margin-right: 8px; }
    .bar { height: 9px; border-radius: 999px; background: rgba(255,126,179,.14); overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #ff7eb3, #b388ff); }
    .pager { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
    .pager select { width: 112px; }
    .muted { color: #aa7892; font-size: .86rem; }
    @media (max-width: 860px) { body { padding: 14px; } header, .grid { grid-template-columns: 1fr; display: grid; } .stats, .login, .filters { grid-template-columns: 1fr; } table { font-size: 13px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div><h1>访问统计后台</h1><p>这里只放后台查看：在线 IP、用户、停留时长和模块热度。</p></div>
      <button id="refresh">刷新数据</button>
    </header>
    <section class="card login" id="loginBox">
      <select id="role"><option value="me">LXQ</option><option value="her">WLY</option></select>
      <input id="username" placeholder="账号，例如 lxq" />
      <input id="password" type="password" placeholder="密码" />
      <button id="loginBtn">登录后台</button>
    </section>
    <section class="stats">
      <div class="card stat"><b id="onlineCount">0</b><span>当前在线</span></div>
      <div class="card stat"><b id="ipCount">0</b><span>独立 IP</span></div>
      <div class="card stat"><b id="visitCount">0</b><span>总访问</span></div>
      <div class="card stat"><b id="moduleTime">0 分</b><span>模块停留</span></div>
    </section>
    <section class="grid">
      <div class="card"><h2>在线用户</h2><table><thead><tr><th>IP</th><th>用户</th><th>当前模块</th><th>在线时长</th><th>最后心跳</th></tr></thead><tbody id="onlineRows"></tbody></table></div>
      <div class="card"><h2>模块热度</h2><div id="moduleRows"></div></div>
      <div class="card"><h2>按 IP 统计</h2><table><thead><tr><th>IP</th><th>用户</th><th>访问</th><th>停留</th><th>最后访问</th></tr></thead><tbody id="ipRows"></tbody></table></div>
      <div class="card"><h2>最近记录</h2><table><thead><tr><th>时间</th><th>IP / 用户</th><th>事件</th></tr></thead><tbody id="recentRows"></tbody></table></div>
      <div class="card full">
        <h2>全部访问记录</h2>
        <div class="filters">
          <select id="recordGranularity">
            <option value="">全部时间</option>
            <option value="month">按月</option>
            <option value="day">按天</option>
            <option value="hour">按小时</option>
            <option value="minute">按分钟</option>
          </select>
          <input id="recordValue" placeholder="例如 2026-06、2026-06-07、2026-06-07 18、2026-06-07 18:30" />
          <button id="recordSearch">查找</button>
          <button id="recordReset">全部</button>
        </div>
        <div class="scroll-table">
          <table><thead><tr><th>时间</th><th>IP</th><th>用户</th><th>模块/事件</th><th>停留</th><th>页面</th><th>设备</th></tr></thead><tbody id="allRows"></tbody></table>
        </div>
        <div class="pager">
          <select id="pageSize"><option value="50">50 条/页</option><option value="80" selected>80 条/页</option><option value="150">150 条/页</option><option value="300">300 条/页</option></select>
          <button id="prevPage">上一页</button>
          <span class="muted" id="pageInfo">第 1 页</span>
          <button id="nextPage">下一页</button>
        </div>
      </div>
    </section>
  </main>
  <script>
    const moduleNames = { home: "首页", days: "日历", countdowns: "约定", letters: "信箱", preferences: "喜好", checkins: "打卡" };
    const fmt = (ms) => {
      const sec = Math.max(0, Math.round((ms || 0) / 1000));
      if (sec < 60) return sec + " 秒";
      const min = Math.floor(sec / 60);
      const rest = sec % 60;
      if (min < 60) return min + " 分 " + rest + " 秒";
      return Math.floor(min / 60) + " 小时 " + (min % 60) + " 分";
    };
    const token = () => localStorage.getItem("love-chronicle:admin-token") || localStorage.getItem("love-chronicle:auth-token") || "";
    const recordsState = { offset: 0, limit: 80, total: 0 };
    const filterTips = {
      "": "不填则显示全部访问记录",
      month: "按月搜索，例如 2026-06",
      day: "按天搜索，例如 2026-06-07",
      hour: "按小时搜索，例如 2026-06-07 18",
      minute: "按分钟搜索，例如 2026-06-07 18:30"
    };
    async function login() {
      const role = document.getElementById("role").value;
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, username, password }) });
      if (!res.ok) { alert("账号或密码不对"); return; }
      const data = await res.json();
      localStorage.setItem("love-chronicle:admin-token", data.token);
      load();
    }
    async function load() {
      const res = await fetch("/api/visits/admin-summary", { headers: { Authorization: "Bearer " + token() } });
      if (!res.ok) { document.getElementById("loginBox").style.display = "grid"; return; }
      document.getElementById("loginBox").style.display = "none";
      const data = await res.json();
      document.getElementById("onlineCount").textContent = data.online.length;
      document.getElementById("ipCount").textContent = data.uniqueIps;
      document.getElementById("visitCount").textContent = data.totalVisits;
      document.getElementById("moduleTime").textContent = fmt(data.totalModuleDurationMs);
      document.getElementById("onlineRows").innerHTML = data.online.map(item => `<tr><td><span class="online-dot"></span>${item.ipAddress}</td><td>${item.username || "guest"}<br><span class="muted">${item.role}</span></td><td>${moduleNames[item.moduleId] || item.moduleId || "-"}</td><td>${fmt(item.onlineMs)}</td><td>${new Date(item.lastSeen).toLocaleString()}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">暂时没有在线用户</td></tr>`;
      const max = Math.max(1, ...data.modules.map(item => item.durationMs));
      document.getElementById("moduleRows").innerHTML = data.modules.map(item => `<p><b>${moduleNames[item.moduleId] || item.moduleId}</b> <span class="muted">${fmt(item.durationMs)} · ${item.views} 次</span></p><div class="bar"><i style="width:${Math.max(5, item.durationMs / max * 100)}%"></i></div>`).join("") || `<p class="muted">还没有模块停留数据</p>`;
      document.getElementById("ipRows").innerHTML = data.byIp.map(item => `<tr><td>${item.ipAddress}</td><td>${item.users.join(", ")}</td><td>${item.visits}</td><td>${fmt(item.durationMs)}</td><td>${new Date(item.lastSeen).toLocaleString()}</td></tr>`).join("");
      document.getElementById("recentRows").innerHTML = data.recent.map(item => `<tr><td>${new Date(item.visitedAt).toLocaleString()}</td><td>${item.ipAddress}<br><span class="muted">${item.username}</span></td><td>${item.eventType}${item.moduleId ? " · " + (moduleNames[item.moduleId] || item.moduleId) : ""}</td></tr>`).join("");
      loadRecords();
    }
    async function loadRecords(reset = false) {
      if (reset) recordsState.offset = 0;
      recordsState.limit = Number(document.getElementById("pageSize").value || 80);
      const granularity = document.getElementById("recordGranularity").value;
      const value = document.getElementById("recordValue").value.trim();
      const params = new URLSearchParams({ limit: String(recordsState.limit), offset: String(recordsState.offset) });
      if (granularity && value) {
        params.set("granularity", granularity);
        params.set("value", value);
      }
      const res = await fetch("/api/visits?" + params.toString(), { headers: { Authorization: "Bearer " + token() } });
      if (!res.ok) return;
      const data = await res.json();
      recordsState.total = data.total || 0;
      document.getElementById("allRows").innerHTML = (data.items || []).map(item => `<tr><td>${new Date(item.visitedAt).toLocaleString()}</td><td>${item.ipAddress}</td><td>${item.username}<br><span class="muted">${item.role}</span></td><td>${item.eventType}${item.moduleId ? " · " + (moduleNames[item.moduleId] || item.moduleId) : ""}</td><td>${fmt(item.durationMs)}</td><td>${item.path || "-"}</td><td class="muted">${(item.userAgent || "").slice(0, 120)}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">没有找到访问记录</td></tr>`;
      const currentPage = Math.floor(recordsState.offset / recordsState.limit) + 1;
      const pages = Math.max(1, Math.ceil(recordsState.total / recordsState.limit));
      document.getElementById("pageInfo").textContent = `第 ${currentPage} / ${pages} 页 · 共 ${recordsState.total} 条`;
      document.getElementById("prevPage").disabled = recordsState.offset <= 0;
      document.getElementById("nextPage").disabled = recordsState.offset + recordsState.limit >= recordsState.total;
    }
    document.getElementById("loginBtn").onclick = login;
    document.getElementById("refresh").onclick = load;
    document.getElementById("recordSearch").onclick = () => loadRecords(true);
    document.getElementById("recordReset").onclick = () => { document.getElementById("recordGranularity").value = ""; document.getElementById("recordValue").value = ""; loadRecords(true); };
    document.getElementById("recordGranularity").onchange = (event) => { document.getElementById("recordValue").placeholder = filterTips[event.target.value] || filterTips[""]; };
    document.getElementById("pageSize").onchange = () => loadRecords(true);
    document.getElementById("prevPage").onclick = () => { recordsState.offset = Math.max(0, recordsState.offset - recordsState.limit); loadRecords(); };
    document.getElementById("nextPage").onclick = () => { if (recordsState.offset + recordsState.limit < recordsState.total) recordsState.offset += recordsState.limit; loadRecords(); };
    load();
    setInterval(load, 15000);
  </script>
</body>
</html>
"""


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
app.include_router(music.router, prefix="/api/music", tags=["music"])
app.include_router(calendar.router, prefix="/api/calendar-notes", tags=["calendar"])
app.include_router(countdowns.router, prefix="/api/countdowns", tags=["countdowns"])
app.include_router(travel.router, prefix="/api/countdowns", tags=["travel"])
app.include_router(letters.router, prefix="/api/letters", tags=["letters"])
app.include_router(preferences.router, prefix="/api/preferences", tags=["preferences"])
app.include_router(checkins.router, prefix="/api/checkins", tags=["checkins"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(visits.router, prefix="/api/visits", tags=["visits"])

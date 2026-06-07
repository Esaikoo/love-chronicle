# Love Chronicle

`love-chronicle` 是一个给她看的纪念册网站。当前版本已经整理成普通部署优先的结构，不依赖 Docker 也可以在 Windows、本地 Linux 或 Ubuntu 服务器上运行。

## 项目结构

```text
love-chronicle/
├─ frontend/                  # React + Vite + TypeScript
├─ backend/                   # Python + FastAPI
│  ├─ app/
│  └─ uploads/                # 运行时上传文件，Git 只保留 .gitkeep
├─ deploy/                    # systemd / nginx 示例配置
├─ docs/
│  └─ UBUNTU_NO_DOCKER.md     # Ubuntu 无 Docker 部署文档
├─ .env.example
└─ README.md
```

## 技术栈

- 前端：React、Vite、TypeScript、Framer Motion、Lucide React
- 后端：FastAPI、SQLAlchemy、PostgreSQL、pgvector
- 运行方式：普通 Python 进程 + Nginx 静态站点 + PostgreSQL

## 数据说明

仓库已经清理为适合提交 GitHub 的干净版本：

- 不包含真实照片、音乐、视频和上传文件
- `frontend/src/data/mockPhotos.ts` 和 `mockMusic.ts` 为空数组
- `backend/uploads/` 只保留 `.gitkeep`
- `.env` 被 `.gitignore` 忽略，不应该提交

## 本地普通启动

### 1. 准备 PostgreSQL

需要 PostgreSQL，并安装 pgvector 扩展。

创建数据库和用户示例：

```sql
CREATE USER love_user WITH PASSWORD 'please_change_me';
CREATE DATABASE love_chronicle OWNER love_user;
\c love_chronicle
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

普通部署默认数据库配置：

```env
POSTGRES_DB=love_chronicle
POSTGRES_USER=love_user
POSTGRES_PASSWORD=please_change_me
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

### 3. 启动后端

```bash
cd backend
python -m venv .venv
```

Windows PowerShell：

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 18080 --reload
```

Linux/macOS：

```bash
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 18080 --reload
```

后端访问：

```text
http://127.0.0.1:18080/docs
http://127.0.0.1:18080/admin/visits
```

首次启动会自动建表、执行兼容迁移、创建默认账号。

### 4. 启动前端开发服务器

```bash
cd frontend
cp .env.development.example .env.development
npm install
npm run dev
```

开发访问：

```text
http://127.0.0.1:5173
```

## 前端生产构建

如果前端和后端由同一个域名的 Nginx 代理，生产环境建议：

```bash
cd frontend
cp .env.production.example .env.production
npm install
npm run build
```

`.env.production` 默认：

```env
VITE_API_BASE_URL=
VITE_AMAP_JS_KEY=
```

空的 `VITE_API_BASE_URL` 表示浏览器会请求同域的 `/api`、`/uploads` 和 `/admin`，适合 Nginx 反向代理。

如果你不使用 Nginx，而是前端直接访问后端端口，可以写成：

```env
VITE_API_BASE_URL=http://你的服务器IP:18080
```

## 默认账号

默认账号从 `.env` 读取：

```env
ME_USERNAME=lxq
ME_PASSWORD=xiao
HER_USERNAME=wly
HER_PASSWORD=0717
ZS_USERNAME=zs
ZS_PASSWORD=0229
```

部署前请修改默认密码和 `JWT_SECRET`。

## 地图配置

旅行攻略使用高德地图：

```env
AMAP_JS_KEY=
AMAP_WEB_SERVICE_KEY=
```

- `AMAP_JS_KEY`：前端地图展示。
- `AMAP_WEB_SERVICE_KEY`：后端地址定位和 Excel 导入定位。
- 也可以在网页里的“地图 Key 设置”里保存，保存后会写入数据库。

## GitHub 提交

如果还不是 Git 仓库：

```bash
cd love-chronicle
git init
git add .
git commit -m "Initial clean love-chronicle project"
git branch -M main
git remote add origin https://github.com/你的用户名/love-chronicle.git
git push -u origin main
```

如果已经是 Git 仓库：

```bash
cd love-chronicle
git status --ignored
git add .
git commit -m "Prepare non-docker deployment version"
git push
```

提交前确认不要提交：

- `.env`
- `node_modules/`
- `frontend/dist/`
- `backend/.venv/`
- `backend/uploads/` 里的真实上传文件
- 数据库备份文件，例如 `*.sql`
- 镜像或压缩包，例如 `*.tar`

## Ubuntu 无 Docker 部署

请看详细文档：

```text
docs/UBUNTU_NO_DOCKER.md
```

里面包含：

- PostgreSQL + pgvector 安装
- 数据库创建
- Python 后端 venv 启动
- systemd 常驻服务
- 前端构建
- Nginx 反向代理
- HTTPS
- 更新、备份、恢复

## 常用命令

后端健康检查：

```bash
curl http://127.0.0.1:18080/api/health
```

前端构建：

```bash
cd frontend
npm run build
```

后端启动：

```bash
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 18080
```

## 备注

项目仍保留 `docker-compose.yml`，但现在主推荐路径是普通部署。服务器不能使用 Docker 时，直接按照 `docs/UBUNTU_NO_DOCKER.md` 部署即可。

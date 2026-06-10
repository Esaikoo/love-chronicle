# Ubuntu 无 Docker 部署 Love Chronicle

这份文档适用于服务器不能使用 Docker 的情况。部署方式为：

```text
Nginx 静态前端
  ├─ /                 -> frontend/dist
  ├─ /api/             -> FastAPI 127.0.0.1:18080
  ├─ /uploads/         -> FastAPI 127.0.0.1:18080/uploads
  └─ /admin/visits     -> FastAPI 后台统计页

FastAPI 后端
  └─ 连接本机 PostgreSQL + pgvector
```

示例部署目录：

```text
/opt/love-chronicle
├─ backend/
├─ frontend/
├─ deploy/
├─ .env
└─ .cache/

/var/www/love-chronicle
└─ 前端构建产物
```

## 1. 安装系统依赖

```bash
sudo apt update
sudo apt install -y git curl wget build-essential nginx python3 python3-venv python3-pip
```

安装 Node.js 20：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2. 安装 PostgreSQL 和 pgvector

推荐使用 PostgreSQL 16。

### 方式 A：如果系统源里有 pgvector 包

```bash
sudo apt install -y postgresql postgresql-contrib postgresql-server-dev-all postgresql-16-pgvector
```

如果提示找不到 `postgresql-16-pgvector`，使用方式 B。

### 方式 B：从源码安装 pgvector

```bash
sudo apt install -y postgresql postgresql-contrib postgresql-server-dev-all git make gcc
cd /tmp
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

确认 PostgreSQL 运行：

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

## 3. 创建数据库和用户

进入 PostgreSQL：

```bash
sudo -u postgres psql
```

执行：

```sql
CREATE USER love_user WITH PASSWORD 'please_change_me';
CREATE DATABASE love_chronicle OWNER love_user;
\c love_chronicle
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

测试连接：

```bash
psql "postgresql://love_user:please_change_me@127.0.0.1:5432/love_chronicle" -c "SELECT 1;"
```

如果连接失败，检查：

```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "\du"
sudo -u postgres psql -c "\l"
```

## 4. 拉取项目

```bash
cd /opt
sudo git clone https://github.com/你的用户名/love-chronicle.git
sudo chown -R $USER:$USER /opt/love-chronicle
cd /opt/love-chronicle
cp .env.example .env
```

编辑 `.env`：

```bash
nano .env
```

推荐配置：

```env
POSTGRES_DB=love_chronicle
POSTGRES_USER=love_user
POSTGRES_PASSWORD=please_change_me
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

BACKEND_PORT=18080
FRONTEND_PORT=15173

JWT_SECRET=please_change_this_to_a_long_random_secret
JWT_EXPIRE_DAYS=30

ME_USERNAME=lxq
ME_PASSWORD=xiao
HER_USERNAME=wly
HER_PASSWORD=0717
ZS_USERNAME=zs
ZS_PASSWORD=0229

AMAP_JS_KEY=
AMAP_WEB_SERVICE_KEY=

CLIP_IMAGE_MODEL=sentence-transformers/clip-ViT-B-32
CLIP_TEXT_MODEL=sentence-transformers/clip-ViT-B-32-multilingual-v1
```

必须修改：

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- 各账号密码
- 高德地图 Key，尤其是 `AMAP_WEB_SERVICE_KEY`

## 5. 启动后端

```bash
cd /opt/love-chronicle/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

首次测试启动：

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 18080
```

另开一个 SSH 窗口测试：

```bash
curl http://127.0.0.1:18080/api/health
```

正常返回：

```json
{"ok":true}
```

首次启动会自动：

- 创建数据表
- 执行兼容迁移
- 创建默认账号
- 尝试预热照片搜索模型

如果模型下载慢，可以先让服务跑一会儿。模型缓存目录建议使用：

```text
/opt/love-chronicle/.cache/huggingface
```

## 6. 配置 systemd 后端服务

创建上传和模型缓存目录：

```bash
sudo mkdir -p /opt/love-chronicle/backend/uploads/photos
sudo mkdir -p /opt/love-chronicle/backend/uploads/music
sudo mkdir -p /opt/love-chronicle/backend/uploads/covers
sudo mkdir -p /opt/love-chronicle/backend/uploads/calendar
sudo mkdir -p /opt/love-chronicle/backend/uploads/checkins
sudo mkdir -p /opt/love-chronicle/backend/uploads/travel
sudo mkdir -p /opt/love-chronicle/.cache/huggingface
sudo chown -R www-data:www-data /opt/love-chronicle/backend/uploads /opt/love-chronicle/.cache
```

复制服务文件：

```bash
sudo cp /opt/love-chronicle/deploy/love-chronicle-backend.service /etc/systemd/system/love-chronicle-backend.service
```

确认文件里路径是：

```ini
WorkingDirectory=/opt/love-chronicle/backend
EnvironmentFile=/opt/love-chronicle/.env
ExecStart=/opt/love-chronicle/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 18080 --proxy-headers
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable love-chronicle-backend
sudo systemctl start love-chronicle-backend
sudo systemctl status love-chronicle-backend
```

查看日志：

```bash
journalctl -u love-chronicle-backend -f
```

## 7. 构建前端

同域 Nginx 部署时，前端 API 地址建议为空。

```bash
cd /opt/love-chronicle/frontend
cp .env.production.example .env.production
nano .env.production
```

内容：

```env
VITE_API_BASE_URL=
VITE_AMAP_JS_KEY=你的高德 JS Key
```

构建：

```bash
npm install
npm run build
```

发布到 Nginx 目录：

```bash
sudo mkdir -p /var/www/love-chronicle
sudo rsync -av --delete dist/ /var/www/love-chronicle/
sudo chown -R www-data:www-data /var/www/love-chronicle
```

## 8. 配置 Nginx

复制示例：

```bash
sudo cp /opt/love-chronicle/deploy/nginx-love-chronicle.conf /etc/nginx/sites-available/love-chronicle
```

编辑域名：

```bash
sudo nano /etc/nginx/sites-available/love-chronicle
```

把：

```nginx
server_name your-domain.com;
```

改成你的域名或服务器 IP，例如：

```nginx
server_name example.com;
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/love-chronicle /etc/nginx/sites-enabled/love-chronicle
sudo nginx -t
sudo systemctl reload nginx
```

访问：

```text
http://你的域名/
```

后台：

```text
http://你的域名/admin/visits
```

## 9. 配置 HTTPS

如果有域名：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

自动续期测试：

```bash
sudo certbot renew --dry-run
```

## 10. 防火墙

如果使用 Nginx 反代，只需要开放 80/443：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

不建议公开 PostgreSQL 5432 或后端 18080。

## 11. 数据库连接说明

后端通过 `.env` 读取数据库：

```env
POSTGRES_DB=love_chronicle
POSTGRES_USER=love_user
POSTGRES_PASSWORD=please_change_me
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

连接串等价于：

```text
postgresql+psycopg://love_user:please_change_me@127.0.0.1:5432/love_chronicle
```

手动测试：

```bash
psql "postgresql://love_user:please_change_me@127.0.0.1:5432/love_chronicle"
```

查看表：

```sql
\dt
```

查看扩展：

```sql
\dx
```

必须看到：

```text
vector
```

## 12. 更新部署

```bash
cd /opt/love-chronicle
git pull

cd backend
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart love-chronicle-backend

cd ../frontend
npm install
npm run build
sudo rsync -av --delete dist/ /var/www/love-chronicle/
sudo systemctl reload nginx
```

## 13. 备份和恢复

备份数据库：

```bash
pg_dump "postgresql://love_user:please_change_me@127.0.0.1:5432/love_chronicle" > love_chronicle_backup.sql
```

备份上传文件：

```bash
tar -czf uploads-backup.tar.gz -C /opt/love-chronicle/backend uploads
```

恢复数据库：

```bash
psql "postgresql://love_user:please_change_me@127.0.0.1:5432/love_chronicle" < love_chronicle_backup.sql
```

恢复上传文件：

```bash
tar -xzf uploads-backup.tar.gz -C /opt/love-chronicle/backend
sudo chown -R www-data:www-data /opt/love-chronicle/backend/uploads
```

## 14. 常见问题

### 后端启动时报 `type "vector" does not exist`

说明 pgvector 没装好，或数据库里没有启用扩展。

检查：

```bash
sudo -u postgres psql -d love_chronicle -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d love_chronicle -c "\dx"
```

### 前端能打开，但接口失败

检查 Nginx 是否代理 `/api/`：

```bash
curl http://127.0.0.1:18080/api/health
curl http://你的域名/api/health
```

如果第一个成功、第二个失败，问题在 Nginx。

### 上传图片后无法显示

检查：

```bash
ls -lah /opt/love-chronicle/backend/uploads
sudo chown -R www-data:www-data /opt/love-chronicle/backend/uploads
```

并确认 Nginx 有：

```nginx
location /uploads/ {
    proxy_pass http://127.0.0.1:18080;
}
```

### 模型下载慢

照片查找会使用 Hugging Face 模型：

```env
CLIP_IMAGE_MODEL=sentence-transformers/clip-ViT-B-32
CLIP_TEXT_MODEL=sentence-transformers/clip-ViT-B-32-multilingual-v1
```

首次启动可能较慢。模型会缓存到：

```text
/opt/love-chronicle/.cache/huggingface
```

### 修改账号密码

编辑：

```bash
vi /opt/love-chronicle/.env
```

然后重启后端：

```bash
pkill -f "uvicorn app.main:app"
cd /opt/love-chronicle/backend
source .venv/bin/activate
nohup python -m uvicorn app.main:app --host 127.0.0.1 --port 18080 --proxy-headers > /opt/love-chronicle/logs/backend.log 2>&1 &
```

启动时种子逻辑会同步默认账号密码。

## 15. 如果服务器没有 systemctl 或 nano

有些轻量 Ubuntu 环境、面板环境或容器化主机不提供 `systemctl`，也可能没有 `nano`。这种情况下可以用下面的普通方式启动。

### 编辑配置

没有 `nano` 时可以用 `vi`：

```bash
vi /opt/love-chronicle/.env
```

如果也不熟悉 `vi`，可以先在本地编辑好 `.env`，再上传到服务器：

```text
/opt/love-chronicle/.env
```

### 后端临时启动

适合先验证服务能不能跑：

```bash
cd /opt/love-chronicle/backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 18080
```

这个窗口关闭后服务也会停止。

### 后端后台启动

没有 `systemctl` 时可以先用 `nohup`：

```bash
cd /opt/love-chronicle/backend
source .venv/bin/activate
mkdir -p /opt/love-chronicle/logs
nohup python -m uvicorn app.main:app --host 127.0.0.1 --port 18080 --proxy-headers > /opt/love-chronicle/logs/backend.log 2>&1 &
```

查看日志：

```bash
tail -f /opt/love-chronicle/logs/backend.log
```

查看进程：

```bash
ps -ef | grep "uvicorn app.main:app"
```

停止进程：

```bash
pkill -f "uvicorn app.main:app"
```

### 推荐长期方案：Supervisor

如果服务器允许安装软件，推荐用 Supervisor 管理后端，比 `nohup` 稳定。

安装：

```bash
sudo apt update
sudo apt install -y supervisor
```

创建配置：

```bash
sudo vi /etc/supervisor/conf.d/love-chronicle-backend.conf
```

写入：

```ini
[program:love-chronicle-backend]
directory=/opt/love-chronicle/backend
command=/opt/love-chronicle/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 18080 --proxy-headers
autostart=true
autorestart=true
stderr_logfile=/opt/love-chronicle/logs/backend.err.log
stdout_logfile=/opt/love-chronicle/logs/backend.out.log
environment=PYTHONUNBUFFERED="1",HF_HOME="/opt/love-chronicle/.cache/huggingface",TRANSFORMERS_CACHE="/opt/love-chronicle/.cache/huggingface"
```

启动：

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start love-chronicle-backend
```

重启后端：

```bash
sudo supervisorctl restart love-chronicle-backend
```

前端仍然按文档执行 `npm run build`，然后把 `frontend/dist/` 同步到 Nginx 的站点目录即可。

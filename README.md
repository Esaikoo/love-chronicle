# Love Chronicle

`love-chronicle` 是一个粉色唯美风格的纪念册网站，前端用于展示和编辑内容，后端负责登录、数据持久化、文件上传、旅行攻略地图、访问统计等能力。

当前项目已经整理为适合提交 GitHub 的干净版本：仓库内不包含真实上传照片、音乐、打卡图片、旅行图片和数据库数据。

## 功能概览

- 封面登录：`LXQ`、`WLY`、`ZS` 三个账号入口，游客入口默认隐藏。
- 首页：空心爱心照片墙、波浪音乐律动、底部播放器。
- 相识日历：日期记录、评分、图片、特殊日期标记。
- 未来约定：倒计时、封面、完成状态、旅行攻略。
- 旅行攻略：Excel 导入/导出、真实地图展示、路线和地点时间线。
- 喜好记录：分组、查看详情、编辑和删除。
- 打卡记录：多图上传、叠放轮播、照片查找。
- 信封 / 情书：信封卡片、打开动画、信纸阅读。
- 后台访问统计：在线用户、IP、模块停留、全量访问记录分页筛选。

## 技术栈

前端：

- React
- Vite
- TypeScript
- Framer Motion
- Lucide React

后端：

- Python
- FastAPI
- PostgreSQL
- pgvector
- Docker Compose

文件存储：

- 上传文件保存在 `backend/uploads/`
- 数据库只保存文件路径和业务数据

## 目录结构

```text
love-chronicle/
├─ frontend/                 # React + Vite 前端
│  ├─ public/assets/          # 静态资源占位目录
│  └─ src/
├─ backend/                  # FastAPI 后端
│  ├─ app/
│  └─ uploads/               # 运行时上传文件，提交时只保留 .gitkeep
├─ docker-compose.yml
├─ .env.example
├─ .gitignore
└─ README.md
```

## 本地启动

先复制环境变量：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

访问地址：

- 前端：http://localhost:15173
- 后端：http://localhost:18080
- API 文档：http://localhost:18080/docs
- 后台统计：http://localhost:18080/admin/visits

## 默认账号

默认账号来自 `.env`：

```env
ME_USERNAME=lxq
ME_PASSWORD=xiao
HER_USERNAME=wly
HER_PASSWORD=0717
ZS_USERNAME=zs
ZS_PASSWORD=0229
```

部署前建议改掉默认密码。

## 地图配置

旅行攻略使用高德地图。

`.env` 中可以配置：

```env
AMAP_JS_KEY=
AMAP_WEB_SERVICE_KEY=
```

说明：

- `AMAP_JS_KEY` 用于前端地图展示。
- `AMAP_WEB_SERVICE_KEY` 用于后端地理编码。
- 也可以在网页里的“地图 Key 设置”中填写，保存后会写入 PostgreSQL。
- 没有配置 Key 时，旅行攻略仍能保存，但 Excel 导入时无法自动定位地址。

## Excel 旅行攻略模板

模板下载地址：

```text
http://localhost:18080/api/countdowns/travel-plan/template
```

模板包含：

- `行程信息`
- `行程节点`
- `交通段`
- `填写说明`

导入要求：

- `行程信息` 至少填写一行。
- `行程节点` 使用 `城市/区域 + 详细地址` 定位，不需要手动填写经纬度。
- `交通段` 支持 `地铁+步行`、`打车+步行` 等组合交通方式。
- 如果没有配置 `AMAP_WEB_SERVICE_KEY`，导入会提示无法自动定位。

## 干净数据说明

当前仓库已清理：

- `frontend/public/assets/photos/` 中的真实照片
- `frontend/public/assets/music/` 中的真实音乐
- `backend/uploads/` 中的上传文件
- 前端 mock 照片和 mock 音乐已改为空数组

仓库只保留：

- `README.md`
- `.gitkeep`
- 目录结构

如果你本地数据库里还有旧数据，提交 GitHub 不会包含这些数据；它们保存在 Docker volume 中。

如需把本地 Docker 数据库也重置为空，请谨慎执行：

```bash
docker compose down -v
docker compose up -d --build
```

`-v` 会删除 PostgreSQL 数据卷，执行后旧数据无法恢复。

## 提交到 GitHub

如果 `love-chronicle` 目录还不是 Git 仓库：

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
git status
git add .
git commit -m "Prepare clean GitHub version"
git push
```

提交前建议检查：

```bash
git status --ignored
```

确认不要提交：

- `.env`
- `node_modules/`
- `frontend/dist/`
- `backend/uploads/` 中的真实文件
- Docker volume 数据

## Ubuntu 服务器部署

以下以 Ubuntu 22.04/24.04 为例。

### 1. 安装 Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

把当前用户加入 docker 组：

```bash
sudo usermod -aG docker $USER
```

退出 SSH 后重新登录。

### 2. 拉取项目

```bash
git clone https://github.com/你的用户名/love-chronicle.git
cd love-chronicle
cp .env.example .env
```

编辑 `.env`：

```bash
nano .env
```

至少修改：

```env
POSTGRES_PASSWORD=换成强密码
JWT_SECRET=换成随机长字符串
ME_PASSWORD=换成你的密码
HER_PASSWORD=换成她的密码
ZS_PASSWORD=换成备用账号密码
AMAP_JS_KEY=你的高德 JS Key
AMAP_WEB_SERVICE_KEY=你的高德 Web 服务 Key
```

### 3. 启动服务

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
```

默认端口：

- 前端：`15173`
- 后端：`18080`
- PostgreSQL：`15432`

如果服务器开启了防火墙：

```bash
sudo ufw allow 15173/tcp
sudo ufw allow 18080/tcp
```

### 4. 域名和 Nginx 反向代理

推荐不要直接暴露后端端口给普通访问者。可以使用宿主机 Nginx：

```bash
sudo apt install -y nginx
```

示例配置：

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:15173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用 HTTPS：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5. 更新部署

```bash
cd love-chronicle
git pull
docker compose up -d --build
```

### 6. 备份数据

备份 PostgreSQL：

```bash
docker compose exec postgres pg_dump -U love_user love_chronicle > backup.sql
```

备份上传文件：

```bash
tar -czf uploads-backup.tar.gz backend/uploads
```

恢复数据库：

```bash
cat backup.sql | docker compose exec -T postgres psql -U love_user love_chronicle
```

## 常见问题

### 端口被占用

修改 `.env`：

```env
FRONTEND_PORT=15173
BACKEND_PORT=18080
POSTGRES_PORT=15432
```

然后重启：

```bash
docker compose up -d --build
```

### Excel 导入无法定位

请配置：

```env
AMAP_WEB_SERVICE_KEY=
```

或者在网页里的“地图 Key 设置”中保存高德 Web 服务 Key。

### 上传文件丢失

确认服务器上存在：

```text
backend/uploads/
```

并且 `docker-compose.yml` 中保留：

```yaml
./backend/uploads:/app/uploads
```

## 当前版本注意事项

- 默认密码是明文配置，部署前必须修改。
- 上传文件存储在服务器本地目录，后续可以扩展为对象存储。
- 后台访问统计只允许 `LXQ` 管理员账号查看。
- 提交 GitHub 前不要提交真实照片、音乐、`.env` 或数据库备份文件。

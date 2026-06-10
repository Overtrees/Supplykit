# SupplyChain V1 · 免费线上部署版

## 架构
- 前端：Vercel 免费
- 后端：Render 免费 Web Service
- 数据库：Supabase PostgreSQL 免费
- 刷新：前端轮询（默认 20 秒）
- 导入：CSV / XLSX 上传到 FastAPI

---

## 目录
- `frontend/` React + ECharts + Zustand
- `backend/` FastAPI + SQLAlchemy

---

## 一、Supabase 创建免费 PostgreSQL

1. 打开 Supabase，新建 Project
2. 等待数据库初始化完成
3. 进入 `Project Settings` → `Database`
4. 找到连接串
5. 将连接串改成 SQLAlchemy 用法：

```env
postgresql+psycopg://USER:PASSWORD@HOST:6543/postgres
```

保存为后端的 `DATABASE_URL`

---

## 二、Render 部署后端

### 1. 新建 Web Service
- 代码仓库根目录：`backend`
- Build Command:
```bash
pip install -r requirements.txt
```
- Start Command:
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 2. 环境变量
参考：`backend/.env.example`

至少配置：

```env
APP_ENV=production
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:6543/postgres
CORS_ORIGINS=https://your-frontend.vercel.app
```

### 3. 首次初始化
Render 部署完成后，服务启动时会自动建表。
如果你想手动初始化，可在本地或 Render Shell 执行：

```bash
python init_db.py
```

---

## 三、Vercel 部署前端

### 1. 新建 Project
- Root Directory：`frontend`
- Framework：Vite

### 2. 环境变量
参考：`frontend/.env.example`

至少配置：

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
VITE_POLL_INTERVAL_MS=20000
```

### 3. Build 设置
默认即可：

```bash
npm run build
```

输出目录：
```bash
dist
```

---

## 四、当前线上 API
- `GET /api/dashboard/summary`
- `GET /api/orders`
- `POST /api/orders/import`
- `GET /api/inventory`
- `POST /api/inventory/import`
- `GET /api/quality-logs`
- `GET /api/alerts`
- `GET /api/events`
- `GET /api/sync-tasks`

---

## 五、导入说明

### 订单支持字段
- `订单编号`
- `父订单编号`
- `店铺名称`
- `商品编号`
- `商品名称`
- `商品数量`
- `商品单价`
- `实付金额`
- `订单状态`
- `下单时间`

### 库存支持字段
- `商品编号`
- `SKU编号`
- `商品名称`
- `店铺名称`
- `可用库存`
- `锁定库存`
- `在途数量`
- `预警库存`

支持格式：
- `.csv`
- `.xlsx`

---

## 六、上线检查清单

### 后端
- [ ] Render 已创建服务
- [ ] `DATABASE_URL` 已配置
- [ ] `CORS_ORIGINS` 已配置为 Vercel 域名
- [ ] 服务首页 `/` 可返回 JSON
- [ ] `/api/dashboard/summary` 可访问

### 数据库
- [ ] Supabase Project 已创建
- [ ] Postgres 连接串可用
- [ ] 表已自动创建

### 前端
- [ ] Vercel 已部署
- [ ] `VITE_API_BASE_URL` 已配置
- [ ] 首页图表可显示
- [ ] 文件上传可成功

---

## 七、免费版限制
- Render 免费实例会冷启动
- 首次访问 API 可能慢几秒
- 第一版使用轮询，不依赖常驻 WebSocket
- 适合演示、验证、小规模使用

---

## 八、后续增强建议
- 增加分页 / 筛选 / 查询参数
- 增加认证登录
- 增加规则引擎配置页
- 增加任务重跑与导出
- 后续再上 WebSocket / SSE

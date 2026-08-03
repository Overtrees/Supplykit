# SupplyKit — 供应链数据清洗与补货决策看板

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Cloudflare%20Pages-deployed-F38020?logo=cloudflare" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/status-production-brightgreen" alt="Status">
  <img src="https://img.shields.io/github/last-commit/Overtrees/Supplykit" alt="Last commit">
</p>

<p align="center">
  <a href="https://supplykit-frontend.pages.dev">🌐 在线体验</a> ·
  <a href="#产品亮点">亮点</a> ·
  <a href="#功能总览">功能</a> ·
  <a href="#快速开始">开发</a> ·
  <a href="#部署">部署</a>
</p>

---

## 产品定位

面向电商供应链运营人员的**轻量级数据工作台**。从原始导出文件到补货建议，一条链路打通，无需 Excel 来回倒腾。

### 解决了什么

| 痛点 | 方案 |
|------|------|
| 京东/天猫后台导出数据杂乱，手动清洗费时 | 智能列名匹配 + 可视化映射，一次配置永久复用 |
| 补货靠经验拍脑袋，不同人算出来不一样 | 三窗口滚动预测日销 + BBCC/传统双模式，结果可复现可追溯 |
| B 仓超期仓储费、C 仓断货风险没人盯 | 双阈值预警（15天/90天）+ 濒临断货 TOP10，自动告警推送到看板 |
| Excel 做报表，每次都要重新拉数 | 看板实时更新，WebSocket 推送，打开即用 |

---

## 产品亮点

### 🎯 从数据到决策，三步完成

```
导入 → 智能匹配 → 预览确认 → 一键执行
  ↓
补货建议 → 查看/导出 → 标记操作 → 追踪入库 → 仓储费预警
```

### 🌐 多渠道支持，数据独立隔离

```
┌─ 全局渠道筛选 ─────────────────┐
│ [☰] [京东 ▼]     实时        │  ← 切换一次，所有页面联动
└────────────────────────────────┘
```

京东/其他渠道（天猫、唯品会等）的数据完全隔离：
- 库存、商品、规则、配置、告警均按渠道独立存储
- 补货建议按渠道查询对应数据
- 清洗导入时标记渠道来源

### 🔄 双模式补货，适配不同供应链模型

| 模式 | 一句话 | 适用渠道 |
|------|--------|---------|
| **BBCC** | 全国一盘棋，盯 B 仓库存能不能撑住 C 仓消耗 | 京东 |
| **传统** | 按仓逐条算，各仓独立补货 | 京东 / 其他渠道 |

### 📊 看板一页尽览，按渠道自动切换

- GMV 趋势 + 店铺分布 + 订单阶段转化漏斗
- 库存健康度（自有仓/平台仓/B仓三视图）
- **濒临断货 TOP10** — 按可撑天数排序
- 规则引擎实时告警，全部按渠道过滤

### 🧹 数据清洗，告别 Excel 手工

- 上传 Excel/CSV → 自动识别 30+ 种中文列名 → 可视化映射
- 支持 6 种导入类型：订单 / 库存 / 平台仓库存 / 入库 / 出库 / 商品
- 导入时标记渠道（京东/其他），数据自动隔离
- 支持模板保存复用，异步导入 + 进度追踪
- 去重保护 + 异常记录

### ⚙️ 规则引擎，按渠道独立

- 规则按渠道（京东/其他）独立创建和生效
- 条件编辑无需写代码，下拉选字段 + 设阈值即可
- 支持百分比比较（如"安全库存的 30%"）
- 告警实时推送到看板，点击跳转库存详情

### 📋 列选择器，自定义表格显示

- 所有表格页面支持自定义列显隐 + 拖拽排序
- 列配置按页面和仓库类型独立持久化
- 移动端触摸拖拽支持

### ↩️ 操作撤销 + 回收站

- 删除规则/订单后，toast 5秒撤销窗口，超时后永久删除
- 设置页回收站可查看和恢复已删除数据，支持一键恢复

### 📱 PWA 离线支持

- 支持添加到主屏幕（iOS Safari → 分享 → 添加到主屏幕）
- 网络优先策略，离线时使用缓存，核心功能可用
- 支持 `display: standalone` 全屏运行

### 🎨 首次使用引导

- 首次打开展示欢迎页，产品定位 + 4 核心功能入口卡片
- "开始体验"按钮一键填充种子数据，跳过直接进入
- 设置页可重置欢迎页，重新显示引导

---

## 功能总览

| 页面 | 核心能力 |
|------|---------|
| 📊 **看板** | GMV趋势 / 店铺GMV / 漏斗转化 / 库存健康度 / 濒临断货TOP10 / 实时告警 / **按渠道过滤** |
| 💡 **补货建议** | BBCC全国汇总 / 传统按仓 / 三窗口滚动日销 / B仓超储预警 / 一键标记操作 / **渠道筛选** |
| 📦 **采购建议** | 14+28天融合日销 / 系统总库存视角 / MOQ兜底 / 导出Excel |
| 🧹 **数据清洗** | 6种导入类型 / 渠道标记 / 智能列名匹配 / 字段映射 / 模板复用 / 异步导入 / 自定义字段 |
| ⚙️ **规则引擎** | 事件驱动 / 条件可视化编辑 / 百分比比较 / 告警模板变量 / **按渠道独立** |
| 📋 **订单明细** | 分页 / 搜索 / 状态筛选 / **按渠道过滤** |
| 📦 **进销存台账** | 自有仓/平台仓/B仓三视图 / 周转计算 / **列选择器拖拽排序** |
| 🏷️ **商品/供应商** | CRUD / 搜索 / **平台列标识渠道** |
| ⚠️ **异常记录** | 数据质量日志 |

---

## 快速开始（开发）

```bash
git clone https://github.com/Overtrees/Supplykit.git
cd Supplykit

# 前端
cd frontend && npm install && npm run dev

# 后端
cd ../backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# 生成模拟数据（可选，含12SKU×60天×900订单）
python seed_realistic.py
```

环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `https://overtrees.pythonanywhere.com` |
| `SQLITE_PATH` | 数据库路径 | `app/supplykit.db` |
| `CORS_ORIGINS` | 跨域来源 | `*` |
| `PYTHONANYWHERE_TOKEN` | PA 部署 Token | — |

---

## 架构

```
┌─ 前端 (Cloudflare Pages) ─────────────────────┐
│  React 18 · TypeScript · ECharts 5 · Zustand   │
│  Axios(缓存+去重+统一响应解包) · WebSocket      │
└──────────────────────┬─────────────────────────┘
                       │ HTTPS
┌─ 后端 (PythonAnywhere) ───────────────────────┐
│  FastAPI · 18 路由模块 · 56 个测试             │
│  ├─ 业务: dashboard / replenishment / purchase │
│  │        insights / cleansing / rules / ...   │
│  ├─ 核心: sales_utils(日销融合)                │
│  │        response(统一响应)                   │
│  │        cleansing_parser(文件解析)           │
│  │        cleansing_templates(模板管理)        │
│  └─ 基础: database.py(SQLite ORM + 版本管理)   │
│         scheduler.py(APScheduler 定时任务)     │
│         events.py(EventBus)                   │
└──────────────────────┬─────────────────────────┘
                       │
┌─ 数据库 ──────────────────────────────────────┐
│  SQLite (WAL模式) · 每日自动备份 · 版本管理     │
│  可迁 PostgreSQL (ORM 接口兼容 supabase-py)    │
└───────────────────────────────────────────────┘
```

### 后端路由一览（18个）

| 路由 | 前缀 | 功能 |
|------|------|------|
| `dashboard` | `/api/dashboard` | 看板摘要 + 濒临断货TOP10 |
| `replenishment` | `/api/insights` | BBCC/传统补货建议 + 导出 |
| `purchase` | `/api/insights` | 采购建议 + 导出 |
| `insights` | `/api/insights` | 慢动识别 / 趋势 / 同步 / 库存带日销 |
| `cleansing` | `/api/cleansing` | 数据清洗导入 + 模板/字段管理 |
| `orders/inventory` | `/api/*` | 订单/库存 CRUD |
| `products/suppliers` | `/api/*` | 商品/供应商 CRUD |
| `rules` | `/api/rules` | 规则引擎 CRUD |
| `alerts/events` | `/api/*` | 告警/事件记录 |
| `purchase_orders` | `/api/purchase-orders` | 采购单标记 + 入库日期追踪 |
| `replenishment_config` | `/api/replenishment-config` | 补货参数 + 活动系数 |
| `records` | `/api/records` | 出入库记录 |
| `quality_logs` | `/api/quality-logs` | 质量日志 |
| `sync_tasks` | `/api/sync-tasks` | 同步任务状态 |
| `ws` | `/ws/events` | WebSocket 实时推送 |

### 项目结构

```
frontend/src/
├── pages/ (9个): Dashboard / Insights / Cleansing / Rules / Orders / Inventory / Products / Suppliers / Quality
├── components/ (10个): Chart / Sidebar / Toast / Card / ErrorBoundary / Icons / ...
├── store/useAppStore.ts          Zustand + WebSocket
├── api/client.ts                 Axios + 缓存 + 统一响应
└── App.tsx / main.tsx / theme.ts

backend/app/
├── main.py                       FastAPI 入口
├── api/routes/ (18个路由模块)
├── core/
│   ├── database.py               SQLite ORM + 任务系统 + 版本管理
│   ├── sales_utils.py            三窗口日销滚动预测
│   ├── response.py               统一响应 ok()/fail()
│   ├── dashboard_cache.py        看板缓存
│   ├── cleansing_parser.py       文件解析 + 字段清洗
│   ├── cleansing_templates.py    模板管理 + 系统字段定义
│   ├── rules.py                 规则引擎
│   ├── events.py                EventBus
│   └── scheduler.py             APScheduler
├── tests/ (3个文件, 56个测试)
│   test_core.py (34) / test_e2e.py (13) / test_more.py (9)
└── seed_realistic.py             模拟数据生成器
```

---

## 补货核心逻辑

### 日销滚动预测（三窗口融合）

7天/14天/28天三个窗口各自做 3σ 异常剔除 + 近3天1.5倍加权，按趋势信号自动分配权重：

| 趋势 | 7天权重 | 14天权重 | 28天权重 |
|------|---------|---------|---------|
| 📈📈 持续上行 | 50% | 30% | 20% |
| ➡️➡️ 平稳 | 10% | 20% | 70% |
| 📉📉 持续下行 | 40% | 35% | 25% |

### BBCC 两步法

```
C仓缺口 = max(日销×前置期 − C仓可用 − B→C在途, 0)
实补 = min(C仓缺口, B仓可用)
```

### 采购建议公式

```
建议采购 = max(日销(14+28融合)×采购前置期 + 安全库存 − 系统总库存, 0)
兜底: max(采购量, MOQ)
```

---

## 测试

```bash
cd backend
python -m pytest tests/ -v          # 全部 56 个
python -m pytest tests/test_e2e.py  # 端到端 13 个
python -m pytest tests/test_more.py # 补充 9 个
```

---

## 部署

| 组件 | 位置 | 方式 |
|------|------|------|
| [前端](https://supplykit-frontend.pages.dev) | Cloudflare Pages | 推 `main` 自动构建 |
| [后端 API](https://overtrees.pythonanywhere.com) | PythonAnywhere | `curl` 上传 + `reload` |
| [API 文档](https://overtrees.pythonanywhere.com/api/docs) | Swagger UI | 自动生成 |
| 数据库 | SQLite | 每日 2:00 自动备份 |

### 定时任务

| 时间 | 任务 |
|------|------|
| 每 30 分钟 | 库存同步 |
| 每天 02:00 | 数据库备份 |
| 每天 03:00 | 日志清理 |
| 每天 04:00 | 规则评估（滞销识别等） |

---

<p align="center">
  <a href="https://github.com/Overtrees/Supplykit">GitHub 仓库</a> ·
  <a href="https://supplykit-frontend.pages.dev">在线体验</a> ·
  <a href="https://overtrees.pythonanywhere.com/api/docs">API 文档</a>
</p>
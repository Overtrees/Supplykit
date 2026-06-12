# SupplyKit · SupplyChain V1

供应链管理工具——数据清洗、订单管理、库存预警、BI 看板、异常追踪。

## 线上地址
- 后端 API：https://overtrees.pythonanywhere.com/
- 前端页面：https://supplykit-frontend.vercel.app/

## 技术栈
| 层 | 技术 | 托管 |
|---|---|---|
| 前端 | React 18 + ECharts 5 + Zustand | Vercel |
| 后端 | FastAPI + SQLite（→ PostgreSQL 预留） | PythonAnywhere |
| 数据库 | SQLite（单人）→ PostgreSQL（多人协同） | 本地文件 |
| 通信 | REST API + WebSocket 实时 + 30s 轮询兜底 |
| 定时任务 | APScheduler（库存同步/备份/日志清理/规则检查） |
| 事件驱动 | 内部 EventBus → WebSocket 广播 → 前端实时刷新 |
| 规则引擎 | 可扩展的条件→动作规则（库存/补货/滞销/超卖） |

## 当前状态

- ✅ 数据库：Supabase → SQLite（跨国延迟问题解决）
- ✅ 清洗异步化：提交 → 后台处理 → 轮询进度，永不超时
- ✅ 库存异步调整：清洗后自动异步同步
- ✅ 实时看板：WebSocket + 轮询兜底
- ✅ APScheduler 定时任务（30min 库存同步 / 每日备份 / 每日规则检查）
- ✅ 规则引擎：低库存预警 / 紧急补货 / 超卖保护 / 滞销识别
- ✅ 异常数据池：格式错误 + 业务校验错误可追溯
- ⏳ 上游平台对接（京东/天猫/WMS/ERP）
- ⏳ 多人协同（JWT + owner_id 过滤 + PostgreSQL）

## 项目结构

```
Supplykit-react/
├── frontend/                        # Vite + React 前端
│   ├── src/
│   │   ├── App.jsx                 # 主应用（导航 + 9 个页面路由）
│   │   ├── main.jsx
│   │   ├── app.css                 # 全局样式
│   │   ├── api/client.js           # API 客户端
│   │   ├── store/useAppStore.js    # Zustand + WebSocket 状态管理
│   │   └── pages/
│   │       ├── ProductPage.jsx     # 商品管理
│   │       ├── SupplierPage.jsx    # 供应商管理
│   │       ├── InsightsPage.jsx    # 建议中心（补货/采购/滞销/回溯）
│   │       └── CleansingPage.jsx   # 数据清洗（4 步向导 + 异步）
│   ├── preview.html                # 独立预览页（Babel standalone）
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/                         # FastAPI 后端
│   ├── app/
│   │   ├── main.py                 # 应用入口 + 路由 + APScheduler 启动
│   │   ├── api/routes/
│   │   │   ├── dashboard.py        # 总览统计
│   │   │   ├── orders.py           # 订单 CRUD + 导入
│   │   │   ├── inventory.py        # 库存 CRUD + 导入
│   │   │   ├── products.py         # 商品管理
│   │   │   ├── suppliers.py        # 供应商管理
│   │   │   ├── insights.py         # 补货/采购/滞销/趋势/异常追踪
│   │   │   ├── cleansing.py        # 数据清洗（检测→映射→预览→异步执行）
│   │   │   ├── alerts.py           # 告警管理
│   │   │   ├── quality_logs.py     # 数据质量日志
│   │   │   ├── events.py           # 事件记录
│   │   │   ├── sync_tasks.py       # 同步任务 + Scheduler 状态
│   │   │   └── ws.py               # WebSocket 广播
│   │   └── core/
│   │       ├── database.py          # SQLite 封装层（supabase-py 兼容接口）
│   │       ├── events.py            # EventBus + 所有事件处理器
│   │       ├── rules.py             # 规则引擎
│   │       ├── scheduler.py         # APScheduler 定时任务
│   │       ├── dashboard_cache.py   # 看板缓存
│   │       └── models/              # SQLAlchemy 模型（PostgreSQL 迁移预留）
│   │           ├── base.py          # 引擎 + 会话 + Base
│   │           └── tables.py        # 所有表 ORM 模型
│   ├── alembic/                     # Alembic 迁移
│   ├── seed_data.py                 # 种子数据
│   └── supplykit.db                 # SQLite 数据库文件
└── README.md
```

## API 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 服务状态 |
| **总览** | | |
| GET | `/api/dashboard/summary` | 总览统计（GMV、趋势、店铺分布、漏斗、健康度） |
| **订单** | | |
| GET | `/api/orders` | 订单列表（分页、搜索、筛选） |
| POST | `/api/orders/import` | 导入订单 CSV/XLSX |
| **库存** | | |
| GET | `/api/inventory` | 库存列表 |
| POST | `/api/inventory/import` | 导入库存 CSV/XLSX |
| POST | `/api/inventory` | 创建库存 |
| PUT | `/api/inventory/{id}` | 更新库存 |
| DELETE | `/api/inventory/{id}` | 删除库存 |
| POST | `/api/insights/sync-from-orders` | 从订单同步库存 |
| **商品** | GET | `/api/products` | 商品列表 |
| **供应商** | GET | `/api/suppliers` | 供应商列表 |
| **建议** | | |
| GET | `/api/insights/replenishment` | 补货建议 |
| GET | `/api/insights/purchase` | 采购建议 |
| GET | `/api/insights/slow-moving` | 滞销商品 |
| GET | `/api/insights/summary` | 洞察总览 |
| GET | `/api/insights/trend-analysis` | 趋势分析 |
| GET | `/api/insights/anomaly-tracking` | 异常追踪 |
| **清洗** | | |
| POST | `/api/cleansing/detect` | 上传检测列名 |
| POST | `/api/cleansing/preview` | 映射后预览 |
| POST | `/api/cleansing/execute` | 同步执行清洗 |
| POST | `/api/cleansing/execute-async` | 异步执行清洗（推荐） |
| GET | `/api/cleansing/task/{task_id}` | 异步任务进度 |
| GET | `/api/cleansing/errors` | 清洗错误详情 |
| POST | `/api/cleansing/backup` | 手动备份数据库 |
| GET | `/api/cleansing/templates` | 清洗模板列表 |
| **告警** | GET | `/api/alerts` | 告警列表 |
| **质量日志** | GET | `/api/quality-logs` | 数据质量日志 |
| **事件** | GET | `/api/events` | 事件记录 |
| **定时任务** | GET | `/api/sync-tasks` | 同步任务列表 |
| | GET | `/api/sync-tasks/scheduler` | Scheduler 状态 |
| **WebSocket** | `ws://.../ws/events` | 实时事件推送 |

## 规则引擎

| 规则 | 事件 | 条件 | 动作 |
|------|------|------|------|
| 低库存预警 | `inventory.changed` | 可用 < 安全线 | 创建告警 + 补货建议 |
| 紧急补货 | `inventory.changed` | 可用 ≤ 30% 安全线 | 创建告警 |
| 超卖保护 | `order.created` | 订单数 > 可用库存 | 创建告警 |
| 滞销识别 | `scheduled.daily` | 30 天无销售 + 有库存 | 创建告警 + 标记滞销 |

## 定时任务（APScheduler）

| 任务 | 频率 |
|------|------|
| 库存同步 | 每 30 分钟 |
| 数据库备份 | 每天 02:00 |
| 日志清理（>30天） | 每天 03:00 |
| 规则检查（滞销等） | 每天 04:00 |

## 实时看板联动

```
数据变更 → EventBus → WebSocket 广播
                         ↓
前端收到 → loadAll() → Zustand 更新 → ECharts 自动重绘

🟢 WebSocket 在线 → 实时刷新
🟡 轮询兜底 → 30s 间隔
```

## 数据库模型

包含 `owner_id` / `created_at` / `updated_at` 预留字段，SQLAlchemy ORM 已就绪。

| 表 | 说明 |
|----|------|
| orders | 订单（拍平设计，一行一 SKU） |
| inventory | 库存（available / locked / in_transit / safety） |
| products | 商品 |
| suppliers | 供应商 |
| alerts | 告警（低库存/补货/滞销/超卖） |
| quality_logs | 数据质量日志 |
| events | 事件流 |
| cleansing_templates | 清洗模板 |
| cleansing_errors | 清洗错误记录（格式异常/业务校验失败） |
| sync_tasks | 同步任务 |

## 开发工作流

1. 编辑 `frontend/src/` 源码（唯一准源）
2. 同步改动到 `frontend/preview.html`（本地 Safari 预览）
3. 预览测试通过后 `git push`
4. Vercel 自动检测 main 并构建部署

## 部署

### 后端（PythonAnywhere）
1. Fork 仓库到你的 GitHub
2. PythonAnywhere 新建 Web App（Python 3.11）
3. 源码目录指向 `~/Supplykit/backend`
4. 虚拟环境安装依赖：`pip install -r requirements.txt`
5. WSGI 文件配置 FastAPI
6. 无需额外数据库配置（SQLite 自动创建）
7. 上传 `supplykit.db` 或运行 `python3 seed_data.py` 注入种子数据

### 前端（Vercel）
1. Vercel 新建 Project，Root Directory 选 `frontend`
2. Framework 选 Vite
3. 环境变量：`VITE_API_BASE_URL` = 后端地址
4. 部署后自动 HTTPS

## 未来规划

- 上游平台对接（京东/天猫/WMS/ERP）
- 订单模型重构（Order + OrderItem 子表）
- 多人协同（JWT 认证 + owner_id 过滤）
- 数据库迁 PostgreSQL（SQLAlchemy + Alembic 就绪）
- WebSocket 全面取代轮询

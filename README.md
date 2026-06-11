# SupplyKit · SupplyChain V1

供应链管理工具——制单、订单管理、库存预警、数据清洗、BI 看板。

## 线上地址
- 后端 API：https://overtrees.pythonanywhere.com/
- 前端页面：https://supplykit-frontend.vercel.app/

## 技术栈
| 层 | 技术 | 托管 |
|---|---|---|
| 前端 | React 18 + ECharts 5 + Zustand | Vercel |
| 后端 | FastAPI + supabase-py | PythonAnywhere |
| 数据库 | Supabase PostgreSQL | Supabase Cloud (Free) |
| 通信 | REST API + 前端轮询 (20s) | — |

## 项目结构
```
Supplykit-react/
├── frontend/                    # Vite + React 前端
│   ├── src/
│   │   ├── App.jsx             # 主应用（导航 + 9 个页面路由）
│   │   ├── main.jsx
│   │   ├── app.css             # 全局样式
│   │   ├── api/client.js       # API 客户端
│   │   ├── store/useAppStore.js # Zustand 状态管理
│   │   └── pages/
│   │       ├── ProductPage.jsx   # 商品管理
│   │       ├── SupplierPage.jsx  # 供应商管理
│   │       ├── InsightsPage.jsx  # 建议中心（补货/采购/滞销/回溯）
│   │       └── CleansingPage.jsx # 数据清洗（4 步向导）
│   ├── preview.html            # 独立预览页（Babel standalone，本地 Safari 测试用）
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口 + 路由注册
│   │   ├── api/routes/         # 各模块路由
│   │   │   ├── dashboard.py    # 总览统计
│   │   │   ├── orders.py       # 订单 CRUD + 导入
│   │   │   ├── inventory.py    # 库存 CRUD + 导入
│   │   │   ├── products.py     # 商品管理
│   │   │   ├── suppliers.py    # 供应商管理
│   │   │   ├── insights.py     # 补货/采购建议
│   │   │   ├── cleansing.py    # 数据清洗（检测→映射→导入）
│   │   │   ├── alerts.py       # 告警管理
│   │   │   ├── quality_logs.py # 数据质量日志
│   │   │   ├── events.py       # 事件记录
│   │   │   ├── sync_tasks.py   # 同步任务
│   │   │   └── ws.py           # WebSocket（预留）
│   │   └── core/
│   │       └── supabase_client.py  # Supabase 客户端
│   ├── seed_data.py            # 种子数据
│   ├── requirements.txt
│   └── .env.example
└── README.md
```

## API 端点一览
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 服务状态 |
| GET | `/api/dashboard/summary` | 总览统计（GMV、趋势、店铺分布） |
| GET | `/api/orders` | 订单列表（分页） |
| POST | `/api/orders/import` | 导入订单 CSV/XLSX |
| GET | `/api/inventory` | 库存列表 |
| POST | `/api/inventory/import` | 导入库存 CSV/XLSX |
| GET | `/api/products` | 商品列表 |
| GET | `/api/suppliers` | 供应商列表 |
| GET | `/api/insights/replenishment` | 补货建议 |
| GET | `/api/insights/purchase` | 采购建议 |
| GET | `/api/insights/summary` | 洞察总览 |
| GET | `/api/insights/slow-moving` | 滞销商品 |
| POST | `/api/cleansing/detect` | 上传检测列名 |
| POST | `/api/cleansing/preview` | 映射后预览 |
| POST | `/api/cleansing/execute` | 执行清洗写入 |
| GET | `/api/alerts` | 告警列表 |
| GET | `/api/quality-logs` | 数据质量日志 |
| GET | `/api/events` | 事件记录 |
| GET | `/api/sync-tasks` | 同步任务 |

## 数据库表结构（Supabase）
- `orders` — 订单（store/warehouse 双维度）
- `inventory` — 库存（store/warehouse 双维度）
- `products` — 商品
- `suppliers` — 供应商
- `alerts` — 告警
- `quality_logs` — 数据质量日志
- `events` — 事件流
- `sync_tasks` — 同步任务
- `cleansing_templates` — 清洗模板

## 部署

### 后端（PythonAnywhere）
1. Fork 仓库到你的 GitHub
2. PythonAnywhere 新建 Web App（Python 3.11）
3. 源码目录指向 `~/Supplykit/backend`
4. 虚拟环境安装依赖：`pip install -r requirements.txt`
5. WSGI 文件配置 FastAPI
6. 环境变量：
   - `SUPABASE_URL` — Supabase 项目 URL
   - `SUPABASE_SECRET_KEY` — Supabase service_role key 或 sb_secret_ key
   - `CORS_ORIGINS` — 前端域名（逗号分隔）
7. Supabase SQL Editor 执行建表 SQL 创建 9 张表
8. 运行 `python3 seed_data.py` 注入种子数据

### 前端（Vercel）
1. Vercel 新建 Project，Root Directory 选 `frontend`
2. Framework 选 Vite
3. 环境变量：`VITE_API_BASE_URL` = 后端地址
4. 部署后自动 HTTPS

## 种子样例数据
- 22 笔订单（3 个店铺 + 1 个仓库维度）
- 10 个商品（耳机/充电宝/配件等）
- 3 个供应商
- 8 条库存记录（含低库存预警样例）
- 4 条数据质量日志

## 事件总线（Event Bus）
订单/库存变更时自动触发事件，驱动下游处理：
```
订单导入 ──→ order.created ──→ 库存扣减 + 看板缓存失效 + 补货规则评估
库存变动 ──→ inventory.changed ──→ 预警生成 + 看板缓存失效
```

## 前端修复记录
- **Chart 二次渲染崩溃**：`echarts.init()` 前先 `getInstanceByDom().dispose()` 清理旧实例
- **loadAll 容错**：`Promise.all` → `Promise.allSettled`，任一 API 失败不影响其他
- **闭包过期**：`useRef` 存储最新函数引用，轮询始终调用最新版本

## 开发工作流
1. 编辑 `frontend/src/` 源码（唯一准源）
2. 同步改动到 `frontend/preview.html`（Babel standalone，本地 Safari 预览）
3. 预览测试通过后 `git push`
4. Vercel 自动检测 main 并构建部署

## 免费版限制
- PythonAnywhere 免费实例每天 6 小时停机（可通过 Always-On 付费解决）
- 首次访问后 API 可能冷启动
- 前端轮询 20s，不依赖 WebSocket（预留中）

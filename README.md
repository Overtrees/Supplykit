# SupplyKit

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Cloudflare%20Pages-deployed-F38020?logo=cloudflare" alt="Cloudflare Pages">
  <img src="https://img.shields.io/github/last-commit/Overtrees/Supplykit" alt="Last commit">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

<p align="center">
  <a href="https://supplykit-frontend.pages.dev">🌐 在线体验</a> ·
  <a href="#功能">功能</a> ·
  <a href="#架构">架构</a> ·
  <a href="#部署">部署</a>
</p>

供应链数据清洗与管理看板。单人工作流工具，预留多人协同接口。

---

## 快速开始

```bash
git clone https://github.com/Overtrees/Supplykit.git
cd Supplykit

# 前端
cd frontend && npm install && npm run dev

# 后端
cd ../backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# 生成模拟数据（可选）
python seed_realistic.py
```

环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `https://overtrees.pythonanywhere.com` |
| `SQLITE_PATH` | 数据库路径 | `app/supplykit.db` |
| `CORS_ORIGINS` | 跨域允许来源 | `*` |
| `PYTHONANYWHERE_TOKEN` | PA 部署 Token | — |

---

## 功能

| 页面 | 说明 |
|------|------|
| 📊 **看板** | GMV趋势、店铺GMV、订单阶段转化漏斗、库存健康度、濒临断货TOP10、待处理告警 |
| 🏷️ **商品** | 列表 + 搜索 |
| 🏭 **供应商** | 列表 + 搜索 + 评分 |
| 📋 **订单** | 分页 + 搜索 + 状态筛选 |
| 📦 **库存** | 进销存台账 + 周转计算 |
| 💡 **补货建议** | BBCC（全国一盘棋）/ 传统（按仓逐条）双模式，三窗口滚动预测日销 |
| 📦 **采购建议** | 14+28天双窗口融合，系统总库存视角，MOQ兜底 |
| 🧹 **清洗导入** | 上传→智能匹配→字段映射→预览→执行，支持模板/自定义字段/异步导入 |
| ⚙️ **规则引擎** | 事件驱动（库存变动/订单创建/每日定时），条件可视化编辑，百分比比较 |
| ⚠️ **异常记录** | 数据质量日志 |

---

## 架构

```
前端 (Cloudflare Pages)              后端 (PythonAnywhere)         数据库
┌─────────────────────┐              ┌──────────────────────┐      ┌─────────┐
│ React 18 + TypeScript│              │ FastAPI + 18 路由模块  │      │ SQLite  │
│ ECharts 5            │  HTTPS       │ sales_utils (日销融合) │      │ WAL模式 │
│ Zustand 状态管理      │◄───────────►│ response (统一响应格式) │─────►│ 每日备份│
│ Axios + 缓存/去重     │              │ cleansing_parser       │      │ SCHEMA  │
│ ErrorBoundary 页面    │              │ APScheduler 定时任务   │      │ 版本管理│
└─────────────────────┘              │ WebSocket + 30s轮询    │      └─────────┘
                                      │ 56 个测试用例           │
                                      └──────────────────────┘
```

### 后端模块（18个路由）

| 路由 | 前缀 | 功能 |
|------|------|------|
| `dashboard` | `/api/dashboard` | 看板摘要 + 濒临断货 TOP10 |
| `replenishment` | `/api/insights` | BBCC + 传统补货建议、导出 |
| `purchase` | `/api/insights` | 采购建议 + 导出 |
| `insights` | `/api/insights` | 慢动识别、趋势分析、同步、库存带日销 |
| `cleansing` | `/api/cleansing` | 数据清洗导入、模板、字段管理 |
| `orders` | `/api/orders` | 订单 CRUD + 分页 |
| `inventory` | `/api/inventory` | 库存 CRUD + 仓库类型管理 |
| `products` | `/api/products` | 商品 CRUD |
| `suppliers` | `/api/suppliers` | 供应商 CRUD |
| `alerts` | `/api/alerts` | 告警列表 |
| `rules` | `/api/rules` | 规则引擎 CRUD |
| `purchase_orders` | `/api/purchase-orders` | 采购单标记 |
| `replenishment_config` | `/api/replenishment-config` | 补货参数配置 |
| `records` | `/api/records` | 出入库记录 |
| `events` | `/api/events` | 事件记录 |
| `quality_logs` | `/api/quality-logs` | 质量日志 |
| `sync_tasks` | `/api/sync-tasks` | 同步任务状态 |
| `ws` | `/ws/events` | WebSocket 实时推送 |

---

## 补货逻辑

### 双模式

| 模式 | 数据粒度 | 适用场景 |
|------|---------|---------|
| **BBCC** | 全国按SKU汇总，B仓做供给约束 | 京东B→C送仓 |
| **传统** | 按仓库+SKU逐条计算 | 自有仓→全国各仓 |

### 滚动预测日销

三窗口（7/14/28天）各经异常剔除(3σ)+趋势加权，按趋势信号自动分配权重融合：

| 趋势 | 7天 | 14天 | 28天 |
|------|-----|------|------|
| 📈📈 持续上行 | 50% | 30% | 20% |
| 📈➡️ 刚抬头 | 35% | 40% | 25% |
| ➡️➡️ 平稳 | 10% | 20% | 70% |
| 📉📉 持续下行 | 40% | 35% | 25% |

### BBCC两列拆分

| C仓建议补 | B仓需补 |
|-----------|---------|
| C仓实际缺口（箱规取整） | B仓不足时自有仓→B调拨量 |
| B充足时全额满足 | B充足时显示0 |

---

## 数据清洗

| 功能 | 说明 |
|------|------|
| 支持格式 | CSV / XLSX |
| 导入类型 | 订单 / 库存 / 入库 / 出库 |
| 智能匹配 | 30+ 组中文别名自动映射 |
| 系统字段 | 26 个（订单号、SKU、数量、金额、供应商、平台等） |
| 自定义字段 | 运行时可添加/删除，持久化到 localStorage |
| 映射模板 | 保存/加载/应用，支持同名覆盖 |
| 异步执行 | 提交→轮询进度（每50条更新）→结果展示 |
| 去重保护 | `order_no + sku` 唯一索引 |

---

## 规则引擎

| 规则 | 触发条件 | 严重级别 |
|------|---------|---------|
| 低库存预警 | 可用库存 < 安全库存 | ⚠️ 警告 |
| 紧急补货 | 可用库存 ≤ 安全库存的 30% | 🔴 严重 |
| 超卖保护 | 订单数量 > 可用库存 | 🔴 严重 |
| 滞销识别 | 30 天无销售 | ⚠️ 警告 |

条件编辑支持可视化字段选择器 + 百分比比较，无需手写 `max(1, safety*0.3)` 公式。

---

## 项目结构

```
frontend/src/
├── App.tsx / main.tsx / theme.ts
├── api/client.ts          axios + 缓存 + 统一响应解包
├── store/useAppStore.ts   Zustand + WebSocket
├── pages/ (9个页面)
└── components/ (10个组件)

backend/app/
├── main.py                FastAPI 入口
├── api/routes/ (18个路由)
├── core/
│   ├── database.py        SQLite ORM + 任务系统 + 版本管理
│   ├── sales_utils.py     三窗口日销融合
│   ├── response.py        统一响应 ok()/fail()
│   ├── dashboard_cache.py 看板缓存
│   ├── cleansing_parser.py 文件解析 + 字段清洗
│   ├── cleansing_templates.py 模板管理 + 系统字段
│   ├── rules.py / events.py / scheduler.py
└── tests/ (3个文件, 56个测试)
    test_core.py (34) / test_e2e.py (13) / test_more.py (9)
```

---

## 测试

```bash
cd backend
python -m pytest tests/ -v          # 全部 56 个
python -m pytest tests/test_e2e.py  # 端到端 13 个
python -m pytest tests/test_more.py # 补充 9 个
```

## 模拟数据

```bash
cd backend && python seed_realistic.py
```
生成 12 SKU × 60 天 × ~900 订单，含促销波峰、断货、滞销等真实场景。

---

## 部署

| 组件 | 位置 | 部署方式 |
|------|------|---------|
| [前端](https://supplykit-frontend.pages.dev) | Cloudflare Pages | 推 `main` 自动构建 |
| [后端 API](https://overtrees.pythonanywhere.com) | PythonAnywhere | `curl` 上传 + `reload` |
| [API 文档](https://overtrees.pythonanywhere.com/api/docs) | Swagger UI | 自动生成 |
| 数据库 | SQLite | 每日 2:00 自动备份 |

---

## 定时任务

| 时间 | 任务 |
|------|------|
| 每 30 分钟 | 库存同步 |
| 每天 02:00 | 数据库备份 |
| 每天 03:00 | 清理 30 天前日志 |
| 每天 04:00 | 规则评估（滞销识别等） |

---

<p align="center">
  <a href="https://github.com/Overtrees/Supplykit">GitHub 仓库</a> ·
  <a href="https://supplykit-frontend.pages.dev">在线体验</a> ·
  <a href="https://overtrees.pythonanywhere.com/api/docs">API 文档</a>
</p>
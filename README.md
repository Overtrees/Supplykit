# SupplyKit

供应链数据清洗与管理看板。单人工作流工具，预留多人协同接口。

## 架构

```
前端 (Vercel)        后端 (PythonAnywhere)       数据库
React 18              FastAPI                    SQLite → PostgreSQL(预留)
ECharts 5             WebSocket(降级→轮询)        owner_id/created_at/raw_data
Zustand               APScheduler 定时任务        全部表已带
WebSocket → 轮询降级  规则引擎(DB存储)             SQLAlchemy模型已建
```

## 功能

| 页面 | 说明 |
|------|------|
| 📊 总览 | 时段切换、GMV趋势、漏斗图、分类饼图、库存健康度、告警列表 |
| 🏷️ 商品 | 商品列表 |
| 🏭 供应商 | 供应商列表 |
| 📋 订单 | 订单列表、仓库列、分页 |
| 📦 库存 | 库存列表、仓库列 |
| 💡 建议 | 补货建议、采购建议、滞销识别、操作回溯 |
| 🧹 清洗 | CSV/Excel 上传→字段映射→预览→异步执行，含格式校验+异常数据池 |
| ⚙️ 规则 | 可自定义规则引擎（低库存预警/紧急补货/超卖保护/滞销识别） |
| 📤 导入数据 | Excel 批量导入 |
| ⚠️ 异常 | 数据质量日志 |

## 实时看板

- WebSocket → 自动降级为 30s 轮询（PythonAnywhere免费版限制）
- 事件驱动：数据变更 → EventBus → 看板自动刷新

## 规则引擎

4 条内置规则（低库存预警、紧急补货、超卖保护、滞销识别），可在 ⚙️ 规则页新增/编辑/删除。规则存在数据库，事件触发时自动评估。

## 异步清洗

```
POST /api/cleansing/execute-async → task_id
GET  /api/cleansing/task/{id}     → 轮询进度
GET  /api/cleansing/errors        → 异常数据池
```

## 项目结构

```
Supplykit/
├── frontend/              # Vite + React
│   ├── src/
│   │   ├── App.jsx        # 主应用（导航 + 页面路由）
│   │   ├── main.jsx
│   │   ├── api/client.js
│   │   ├── store/useAppStore.js  # Zustand + WebSocket
│   │   └── pages/
│   │       ├── ProductPage.jsx
│   │       ├── SupplierPage.jsx
│   │       ├── InsightsPage.jsx
│   │       ├── CleansingPage.jsx
│   │       └── RulesPage.jsx
│   ├── preview.html       # 本地预览（Babel standalone）
│   └── index.html
├── backend/               # FastAPI + SQLite
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── database.py     # SQLite 包装器
│       │   ├── rules.py        # 规则引擎
│       │   ├── events.py       # EventBus
│       │   ├── scheduler.py    # APScheduler
│       │   └── dashboard_cache.py
│       ├── api/routes/   # 各模块 API
│       └── models/       # SQLAlchemy 模型
└── README.md
```

## 部署

| 组件 | 位置 | 自动部署 |
|------|------|---------|
| 前端 | Vercel (`supplykit-frontend.vercel.app`) | 推 main 自动构建 |
| 后端 API | PythonAnywhere (`overtrees.pythonanywhere.com`) | 需手动上传 + reload |
| 数据库 | SQLite（同服务器文件） | 每天 2:00 自动备份 |

## 开发工作流

1. 改 `frontend/src/` 源码
2. 同步改动到 `frontend/preview.html`（本地 Safari 测试）
3. 测试通过 → `git push`
4. Vercel 自动部署

## 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 库存同步 | 每 30 分钟 | 自动调整库存 |
| 数据库备份 | 每天 2:00 | 备份 SQLite |
| 日志清理 | 每天 3:00 | 清理 30 天前日志 |
| 规则评估 | 每天 4:00 | 滞销识别等定时规则 |

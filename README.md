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
# 克隆仓库
git clone https://github.com/Overtrees/Supplykit.git
cd Supplykit

# 前端
cd frontend && npm install && npm run dev

# 后端
cd ../backend && pip install -r requirements.txt
uvicorn app.main:app --reload
```

环境变量（前端 `.env`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `https://overtrees.pythonanywhere.com` |

---

## 架构

```
前端 (Cloudflare Pages)       后端 (PythonAnywhere)    数据库
React 18 + TypeScript          FastAPI                  SQLite → PostgreSQL
ECharts 5 + React Query        WebSocket(降级轮询)      owner_id / created_at
Zustand + ErrorBoundary        APScheduler 定时任务     raw_data 全部表已带
```

---

## 功能

| 页面 | 说明 |
|------|------|
| 📊 总览 | 时段切换、GMV趋势、漏斗图、分类饼图、库存健康度、告警列表(点击→库存高亮) |
| 🏷️ 商品 | 列表 + 搜索 |
| 🏭 供应商 | 列表 + 搜索 |
| 📋 订单 | 分页 + 仓库列 |
| 📦 库存 | 列表 + 告警高亮(从总览跳转) |
| 💡 建议 | 补货 / 采购 / 滞销 / 回溯 |
| 🧹 清洗 | 上传→智能匹配→字段映射→预览→异步执行→异常池，支持模板保存/加载、自定义字段 |
| ⚙️ 规则 | 自定义规则引擎（低库存/补货/超卖/滞销），保存至数据库 |
| 📤 导入 | Excel 批量导入，成功后自动跳转 |
| ⚠️ 异常 | 数据质量日志 |

---

## 技术栈

- **TypeScript** 全量迁移（.tsx / .ts，非严格模式）
- **组件拆分**：App.tsx ~60行，Card/Chart/Sidebar/UploadPanel + 8 页面文件
- **ErrorBoundary** 包裹所有页面，崩溃时显示错误信息而非空白
- **键盘快捷键**：Cmd+B 开关侧栏、Esc 关闭
- **智能列名匹配**：30+ 组中文→字段名自动映射（ALIAS 表）
- **React Query** 已接入（QueryClientProvider）
- **Toast 通知** 替代 alert()，已全局注入
- **颜色 token** 集中管理（theme.ts）
- **WebSocket** 10s 重连退避，失败降级 30s 轮询
- **EmptyState** 空状态引导组件
- **localStorage** 自定义字段持久化

---

## 清洗页特性

| 功能 | 说明 |
|------|------|
| 智能列名匹配 | 30+ 组中文别名自动映射 |
| 系统字段 | 26 个（订单号、SKU、数量、金额、供应商、平台、收货人、币种等） |
| 自定义字段 | 运行时添加/删除，持久化到 localStorage，预览时显示中文名 |
| 映射模板 | 保存/加载/应用，支持同名覆盖 |
| 异步执行 | 提交→轮询进度→结果展示 |
| 预览表头 | 中文显示（映射字段查找系统字段或自定义字段的中文名） |

---

## 联动链路

| 链路 | 说明 |
|------|------|
| 总览告警→库存高亮 | 点击告警 → 切换到库存页 → 自动滚动并黄色高亮对应 SKU 行 |
| 清洗导入→库存同步 | `data.cleaned` → `sync_inventory_from_orders` 异步同步 |
| 库存变动→规则评估 | `inventory.changed` → 低库存预警/补货规则 |
| 订单创建→超卖保护 | `order.created` → 检查库存 → 超卖告警 |
| 每日定时→滞销识别 | `scheduled.daily` → 30天无销售→滞销标记 |
| EventBus→看板刷新 | 任何事件 → 看板缓存失效 → WS/轮询 → 前端刷新 |

---

## 项目结构

```
frontend/src/
├── App.tsx                   路由 + 全局 layout（~60行）
├── main.tsx                  QueryClientProvider
├── theme.ts                  颜色 token
├── version.ts                构建版本
├── api/client.ts             axios 实例
├── store/useAppStore.ts      Zustand + WebSocket
├── hooks/useKeyboard.ts      键盘快捷键
├── components/
│   ├── Card.tsx / Chart.tsx / Sidebar.tsx
│   ├── UploadPanel.tsx / Toast.tsx / EmptyState.tsx
│   └── ErrorBoundary.tsx     错误边界
└── pages/
    ├── DashboardPage.tsx / OrdersPage.tsx / InventoryPage.tsx
    ├── ProductPage.tsx / SupplierPage.tsx
    ├── InsightsPage.tsx / CleansingPage.tsx
    ├── RulesPage.tsx / QualityPage.tsx

backend/app/
├── main.py                   FastAPI 入口
├── core/
│   ├── database.py           SQLite 包装器
│   ├── rules.py              规则引擎
│   ├── events.py             EventBus
│   ├── scheduler.py          APScheduler
│   └── dashboard_cache.py
├── api/routes/               12 个路由模块
├── models/                   SQLAlchemy（预留）
└── alembic/                  数据迁移（预留）
```

---

## 部署

| 组件 | 位置 | 自动部署 |
|------|------|---------|
| [前端](https://supplykit-frontend.pages.dev) | Cloudflare Pages | 推 main 自动构建 |
| [后端 API](https://overtrees.pythonanywhere.com) | PythonAnywhere | 手动上传 + reload |
| 数据库 | SQLite（本地文件） | 每天 2:00 自动备份 |

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
  <a href="https://overtrees.pythonanywhere.com/docs">API 文档</a>
</p>

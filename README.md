# SupplyKit

供应链数据清洗与管理看板。单人工作流工具，预留多人协同接口。

---

## 架构

```
前端 (Vercel)             后端 (PythonAnywhere)    数据库
React 18 + TypeScript      FastAPI                  SQLite → PostgreSQL
ECharts 5                  WebSocket(降级轮询)      owner_id / created_at
React Query + Zustand      APScheduler 定时任务     raw_data 全部表已带
```

---

## 功能

| 页面 | 说明 |
|------|------|
| 📊 总览 | 时段切换、GMV趋势、漏斗图、分类饼图、库存健康度、告警列表 |
| 🏷️ 商品 | 列表 + 搜索 |
| 🏭 供应商 | 列表 + 搜索 |
| 📋 订单 | 分页 + 仓库列 |
| 📦 库存 | 仓库列 |
| 💡 建议 | 补货 / 采购 / 滞销 / 回溯 |
| 🧹 清洗 | 上传 → 智能匹配 → 映射 → 预览 → 异步执行 → 异常池 |
| ⚙️ 规则 | 自定义规则引擎，支持试运行 |
| 📤 导入 | Excel 批量导入，成功后自动跳转 |
| ⚠️ 异常 | 数据质量日志 |

---

## 技术栈

- **TypeScript** 全量迁移（.tsx / .ts）
- **组件拆分**：Card / Chart / Sidebar / UploadPanel + 8 个页面文件
- **键盘快捷键**：Cmd+B 开关侧栏、Esc 关闭
- **智能列名匹配**：24 组中文 → 字段名自动映射
- **React Query** 已接入（`QueryClientProvider` 配置完成）
- **Toast 通知** 替代 `alert()`
- **颜色 token** 集中管理（`theme.ts`）
- **WebSocket** 10s 重连退避，失败降级 30s 轮询
- **EmptyState** 空状态引导组件

---

## 项目结构

```
frontend/src/
├── App.tsx                   路由 + 全局 layout（~80行）
├── main.tsx                  QueryClientProvider
├── theme.ts                  颜色 token
├── api/client.ts
├── store/useAppStore.ts      Zustand + WebSocket
├── hooks/useKeyboard.ts
├── components/
│   ├── Card.tsx / Chart.tsx / Sidebar.tsx
│   ├── UploadPanel.tsx / Toast.tsx / EmptyState.tsx
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
└── models/                   SQLAlchemy（预留）
```

---

## 部署

| 组件 | 位置 | 自动部署 |
|------|------|---------|
| 前端 | Vercel | 推 main 自动构建 |
| 后端 API | PythonAnywhere | 手动上传 + reload |
| 数据库 | SQLite（本地文件） | 每天 2:00 自动备份 |

---

## 工作流

1. 改 `frontend/src/` 源码
2. `git push` → Vercel 自动部署
3. 线上验证

---

## 定时任务

| 时间 | 任务 |
|------|------|
| 每 30 分钟 | 库存同步 |
| 每天 02:00 | 数据库备份 |
| 每天 03:00 | 清理 30 天前日志 |
| 每天 04:00 | 规则评估（滞销识别等） |

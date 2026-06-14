# SupplyKit

供应链数据清洗与管理看板。单人工作流工具，预留多人协同接口。

## 架构

前端 (Vercel) React 18 + TypeScript + ECharts 5 + React Query + Zustand | 后端 (PythonAnywhere) FastAPI + WebSocket(降级轮询) + APScheduler + 规则引擎 | 数据库 SQLite → PostgreSQL(预留) owner_id/created_at/raw_data 全部表已带

## 功能

📊 总览：时段切换、GMV趋势、漏斗图、分类饼图、库存健康度、告警列表
🏷️ 商品：列表+搜索 | 🏭 供应商：列表+搜索 | 📋 订单：分页+仓库列
📦 库存：仓库列 | 💡 建议：补货/采购/滞销/回溯
🧹 清洗：上传→智能匹配→映射→预览→异步执行→异常池
⚙️ 规则：自定义规则引擎，支持试运行
📤 导入：Excel批量导入 | ⚠️ 异常：质量日志

## 技术栈

TypeScript全量迁移 | 组件拆分(Card/Chart/Sidebar/UploadPanel + 8页面)
键盘快捷键(Cmd+B/Esc) | 智能列名匹配(24组别名)
Toast通知(替代alert) | 颜色token集中管理(theme.ts)
React Query已接入 | WebSocket→10s重连→30s轮询降级

## 项目结构

frontend/src/App.tsx(~80行路由) / main.tsx(QueryClientProvider) / theme.ts
components/Card.tsx Chart.tsx Sidebar.tsx UploadPanel.tsx Toast.tsx EmptyState.tsx
pages/DashboardPage OrdersPage InventoryPage ProductPage SupplierPage InsightsPage CleansingPage RulesPage QualityPage
hooks/useKeyboard.ts | store/useAppStore.ts | api/client.ts

backend/app/main.py core/database.py rules.py events.py scheduler.py dashboard_cache.py + 12路由模块 + models(SQLAlchemy预留)

## 部署

前端(Vercel)：推main自动构建 | 后端(PythonAnywhere)：手动上传+reload | 数据库(SQLite)：每天2:00自动备份

## 工作流

1. 改 frontend/src/ 源码
2. git push → Vercel 自动部署
3. 线上验证

## 定时任务

每30分：库存同步 | 每天2:00：备份 | 每天3:00：清理日志 | 每天4:00：规则评估

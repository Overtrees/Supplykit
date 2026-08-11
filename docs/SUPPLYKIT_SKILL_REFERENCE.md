## 数据库稳定性（2026-08-11）
- **禁用 WAL**（PA 文件系统 WAL 反复损坏）→ DELETE 模式
- **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收
- 归档 60 天 + 压缩备份（gzip）+ 启动自愈（.gz 备份恢复）
- VACUUM 阈值 150MB（真实数据 99MB，防反复触发）
- 经验：SQLite on PA 的关键是禁用 WAL + auto_vacuum + 压缩备份

## 补货建议缓存格式（2026-08-11）
- 后端缓存命中：`ok(cached.get('data'))` 统一格式（防双重包装）
- 前端 client.ts 缓存命中：解包 `{ok,data}`（与拦截器一致）
- 库存调整 → invalidate 补货缓存（inventory.changed 事件）
- 经验：缓存命中与 miss 的返回格式必须一致，前端缓存也要解包

## 看板聚合优化（2026-08-11）
- 表达式索引 `idx_orders_cdate`：GROUP BY substr(ordered_at,1,10) 走索引
- 周期查询合并 + 大查询并行化（23s → 14s）
- 看板 TTL 180s（invalidate 保证实时性，TTL 只是兜底）

## 任务管理页（2026-08-09）
- 统一管理所有异步任务（种子填充/清洗导入/导出）
- 入口：看板锤子菜单「任务管理」按钮
- 按渠道隔离，任务按创建时间倒序
- 状态标签：进行中/已完成/失败，进度条动画
- 导出任务：完成时显示下载按钮，点击下载
- 经验：所有大数据量操作（导出/清洗/填充）统一走异步，由任务管理页统一调度

## 异步导出（2026-08-09）
- 所有页面导出统一异步（采购建议/补货建议/滞销/订单/库存）
- 导出列数齐全（24列/13列/8列），按渠道隔离
- 导出文件存 `exports/` 目录，通过 `/api/exports/download/{filename}` 下载

## 数据库稳定性（2026-08-09）
- DeleteBuilder WHERE 防护（误删全表防护）
- transaction() 上下文管理器
- write_execute() 写入队列（串行化写操作）
- 版本化迁移系统（@_register_migration）
- 连接健康检查（get_conn 自动 SELECT 1 检测）
- TMPDIR 统一到项目 tmp 目录

# SupplyKit

## 线上
前端: Cloudflare Pages (supplykit-frontend.pages.dev)
后端: PythonAnywhere (overtrees.pythonanywhere.com)
PA Token: $PYTHONANYWHERE_TOKEN
PA 用户: Overtrees (首字母大写)
项目根: /home/Overtrees/Supplykit/
OpenAPI 文档: https://overtrees.pythonanywhere.com/api/docs

## 全局渠道筛选
所有页面、API 统一按 `channel`（jd/other）隔离数据。
- 切换位置: header 左侧主体切换框，菜单按钮在右侧，看板页额外有锤子按钮
- API 自动注入: `api/client.ts` 请求拦截器自动加 `?channel=`
- 切换时: `setChannel` 调用 `clearCache()` + `clearInflight()` 清除缓存和在途请求，同时恢复各页面按渠道持久化的状态（whType、dashPeriod 等）
- 各页面 `useEffect` 监听 `channel` 变化自动刷新数据
- 数据隔离: 多张表有 `channel` 列（inventory/products/rules/alerts/replenishment_config/suppliers/purchase_orders/inbound_records/outbound_records），列配置 localStorage 按渠道独立
- **渠道隔离完整性**（2026-08-07 完善）：告警/规则/供应商/已下单/出入库/供应链全链路按 channel 隔离；规则引擎 `evaluate()` 按 `ctx.channel` 过滤规则；`sku_to_channel()` 从 products 主表推断渠道（回退 inventory）

## 锤子菜单体系（新增）
所有页面的工具栏功能已从页面内移入右上角 🔨 锤子菜单弹窗，通过 Zustand store 共享状态避免同步问题。

| 页面 | 锤子菜单功能 |
|------|-------------|
| 看板页 | 时间维度切换（今日/本周/本月）+ 聚合日期 |
| 商品页 | 列选择器 + 搜索 |
| 供应商页 | 列选择器 + 搜索 |
| 订单页 | 列选择器 + 搜索 + 状态筛选 + 导出 |
| 进销存页 | 列选择器 + 搜索 + 仓库类型切换 + 导出 |
| 建议页 | tab 入口（补货/采购/滞销）+ 补货模式切换 + 搜索 + 列选择器 + 导出 |
| 规则页 | tab 入口（规则/补货参数/采购参数）+ 新建规则 + 补货模式切换 |
| 清洗页 | 渠道标注（京东/其他渠道） |

**侧边栏图标**（2026-08-03 重设计）：看板(4宫格) / 商品(购物袋) / 供应商(建筑) / 订单(单据) / 进销存(货架) / 建议(L框+折线+箭头) / 清洗(漏斗) / 规则(开关) / 异常(感叹号圆) / 设置(齿轮+扳手)
- 看板页时自动隐藏"看板"菜单项
- 无蓝色激活态，所有菜单项统一样式

**跨组件通信**: 锤子菜单通过 Zustand store 与页面共享状态，列配置通过 `hammerCols[pageKey]` 同步，搜索通过 `hammerSearch` 共享，页面特定状态（tab、whType 等）提升到 store。

## 看板卡片（重构）
全部卡片按渠道过滤，分为小/中/大三类，用不同 grid 容器分隔：

- 🟦 **小卡**（4个正方形）：GMV、待处理、库存健康度、濒临断货 TOP10 — `aspect-ratio:1`，`padding:16px`，圆角 `26px`，iOS 控制中心风格
- 🟨 **中卡**（2个图表卡）：订单阶段转化、店铺 GMV — `.mid-chart-grid`，竖屏 1 列，横屏手机 ≤932px 2 列，宽屏 ≥1024px 自适应
- 🟥 **大卡**（2个列表卡）：低库存告警、补货告警 — `.chart-row-3`，竖屏 1 列，≥640px 2 列，≥1024px 自适应
- 告警"还有 N 条"可点击，展开毛玻璃底部弹窗显示全部告警，支持滚动

## 欢迎页（2026-08-03 新增）
- 首次打开 `supplykit-frontend.pages.dev` 时全屏覆盖，解决"打开空白不知从何开始"
- 产品名 + 一句话定位：*电商供应链数据清洗与补货决策看板*
- 4 个入口卡片（看数据/看补货/导数据/设规则），纯展示不导航
- "开始体验"按钮 → 一键填充种子数据后刷新进入看板
- "跳过，直接进入"按钮 → 关闭欢迎页
- 通过 `localStorage('c_welcome_seen')` 控制显隐
- 设置页种子数据分组下新增"重置欢迎页"选项
- 背景色直接继承 `html`，主题切换无延迟

## 订单页（客户端过滤重构）
- 改为客户端即时过滤（同商品页体验），输入即过滤，不调 API
- 分页改为客户端分页，`loadAll` 全量加载（page_size=1000）
- 搜索 + 状态筛选联动
- 删除订单后重新全量加载

## 源码目录结构
frontend/src/ — 唯一准源
├── pages/ (10个): DashboardPage / InsightsPage / CleansingPage / RulesPage / OrdersPage / InventoryPage / ProductPage / SupplierPage / QualityPage / SettingsPage
├── components/ (10个): Sidebar / Toast / ConfirmDialog / EmptyState / Chart / Icons / Card / ErrorBoundary / Loading / Skeleton
├── store/useAppStore.ts — Zustand 全局状态 + channel 全局筛选 + 锤子菜单状态
├── api/client.ts — Axios 封装 + 缓存 + 统一响应解包 + 自动注入 channel

backend/app/
├── main.py — FastAPI 入口 + CORS + 路由注册
├── api/routes/ (18个路由模块):
│   dashboard.py / replenishment.py / purchase.py / insights.py / cleansing.py
│   orders.py / inventory.py / products.py / suppliers.py / alerts.py
│   rules.py / events.py / quality_logs.py / records.py / sync_tasks.py
│   purchase_orders.py / replenishment_config.py / ws.py
├── core/ (9个):
│   database.py (SQLite ORM + 任务系统 + 版本管理 + 渠道迁移 + busy_timeout)
│   sales_utils.py (三窗口日销融合 calc_sales / rolling_predict)
│   response.py (统一响应 ok() / fail())
│   dashboard_cache.py (看板缓存 + 按渠道隔离)
│   cleansing_parser.py (文件解析 + 字段清洗)
│   cleansing_templates.py (模板CRUD + 系统字段定义)
│   events.py / rules.py / scheduler.py
└── tests/ (4个):
    test_core.py (34个) / test_e2e.py (13个) / test_more.py (9个) / test_api.py (31个)

## 渠道化数据表
| 表 | channel 字段 | 约束 | 说明 |
|-----|-------------|------|------|
| inventory | `TEXT DEFAULT 'jd'` | — | 库存按渠道隔离 |
| products | `TEXT DEFAULT 'jd'` | — | 商品按渠道隔离 |
| rules | `TEXT DEFAULT 'jd'` | — | 规则按渠道独立 |
| alerts | `TEXT DEFAULT 'jd'` | — | 告警按渠道独立 |
| replenishment_config | `TEXT DEFAULT 'jd'` | `UNIQUE(key, channel)` | 配置按渠道+key独立 |

## 渠道切换页面加载机制
各页面通过 `useEffect` 监听 `channel` 变化自动刷新：
- **看板页**: 直接调 API 并行加载 summary/alerts/stock-risk
- **订单页**: `useEffect` 调用 `loadAll()` 刷新全量数据
- **进销存页**: `useEffect` 监听 `hammerWhType` + `globalChannel`，调用 `loadInv()`
- **建议页**: `useEffect` 监听 `globalChannel` + `replenMode`，加载补货/采购/慢动
- **商品/供应商**: `useEffect` 监听 `globalChannel`，调用对应 API
- **规则页**: `useEffect` 监听 `globalChannel` + `hammerRulesMode`，加载规则/参数/配置/活动系数

## API 缓存须知
- 请求缓存: `api/client.ts` 内存缓存，TTL 30s
- 在途去重: `inflight` Map，相同 key 的请求复用 Promise
- 渠道切换时: `setChannel` 调用 `clearCache()` + `clearInflight()` 清除所有缓存
- 注意: 缓存 key 在请求拦截器注入 `channel` 参数前计算，`config.params` 为 `undefined` 时不同渠道的 key 相同

## 仓库类型体系
- platform: 京东C仓(北京/上海/广州/成都/武汉/沈阳/西安/郑州) — 补货建议使用
- platform_b: 京东B仓 — BBCC中间仓，库存单独统计，有"供应商-B仓"和"B-C调拨在途"两列
- own: 京东集货仓(自有仓) — 库存页/采购建议使用，有合计行

## 补货双模式

### BBCC 模式 — 全国一盘棋（仅京东渠道）
前置期 = b_to_c_days + c_safety_days (仅B→C调拨周期)
数据源: platform(京东C仓) + platform_b(京东B仓)，按 channel 过滤

两列拆分:
  C仓建议补 = C仓缺口(箱规取整) — 与B仓库存无关
  B仓需补 = 自有仓→B仓调拨量(运输消耗+安全储备)

两步法公式:
  第一步: C仓缺口 = max(日销×前置期 − C仓可用 − B→C在途, 0)
  第二步: 实补 = min(C仓缺口, B仓可用)

### 传统模式 — 按仓逐条（京东/其他渠道通用）
前置期 = lead_time_days
数据源: platform(各C仓)，按 channel 过滤
备注含趋势分析(近7/14天箭头) + 跨仓提示

### 京东 vs 其他渠道
| 特性 | 京东 | 其他渠道 |
|------|------|---------|
| BBCC | ✅ | ❌ 隐藏 |
| 传统多仓 | ✅ | ✅ |
| 补货参数 | 独立 | 独立 |
| 规则 | 独立 | 独立 |
| 采购参数 | 独立 | 独立 |

## 日销滚动预测（三窗口融合）
日销 = 异常剔除(3σ) + 趋势加权(近3天×1.5)，三个窗口各自算
融合 = s7×w7 + s14×w14 + s28×w28，按趋势信号分配权重
  平稳(➡️➡️) → 0.10/0.20/0.70
  持续上行(📈📈) → 0.50/0.30/0.20
  刚抬头(📈➡️) → 0.35/0.40/0.25
  采购建议: 14+28双窗口融合(去7天排除促销干扰)
  有效天数 < 3 时: 跳过异常值剔除，直接用总销量/天数
  复合 key: 支持 sku|barcode 提高匹配精度，无 barcode 降级为 sku

## 传统多仓补货（2026-08-08 重写）
- **按仓库维度算日销**：快照加 warehouse 列，各仓库日销独立
- 安全库存 = 日销 × `safety_multiplier`（与 BBCC 口径一致）
- 前置期 = `lead_time_days` + `c_safety_days`（可独立配置）
- 备注增强：箱数提示（补X箱）+ 跨仓调拨/人工复核提醒

## 进销存页
- 仓库类型筛选已移入锤子菜单（自有仓/平台仓/B仓）
- 列配置按仓库类型独立持久化（localStorage: `c_cols_inventory_own/platform/platform_b`）
- 列选择器已移入锤子菜单
- 合计行仅自有仓显示
- 仓库类型按渠道持久化 `localStorage('c_wh_type_{channel}')`
- **当月入库/出库**: 从 inbound/outbound_records 按月聚合，种子数据已生成
- **在库周转**: 按融合日销（三窗口 3σ + 趋势加权）计算，非简单平均
- 仓库类型筛选已移入锤子菜单（自有仓/平台仓/B仓）
- 列配置按仓库类型独立持久化（localStorage: `c_cols_inventory_own/platform/platform_b`）
- 列选择器已移入锤子菜单
- 合计行仅自有仓显示
- 仓库类型按渠道持久化 `localStorage('c_wh_type_{channel}')`

## 列选择器
所有表格页面的列选择器已从页面内移入锤子菜单。
- 列配置 localStorage 按页面独立存储，按渠道隔离
- 进销存页按仓库类型独立存储
- 列渲染兜底 `<td>-</td>` 防止错位
- 通过 `hammerCols[pageKey]` 共享状态即时同步到表格

## 规则引擎（更新）
- 规则按渠道独立（创建时携带 channel），evaluate 按 channel 过滤规则
- 条件编辑: 可视化字段选择器，支持百分比比较，**新增仓库主体选择（全部/B仓/C仓/自有仓）**，**新增补货模式过滤（全部/BBCC/传统多仓）**
- **组合表达式（2026-08-07）**: 四则运算 +-*/，如 可用+在途、安全线-可用、可用/日销（可撑天数）、订单数量×单价
- **日销注入**: 每日定时任务从快照注入 daily_sales，支持可撑天数类断货风险规则
- **告警来源区分**: source=replenishment_engine（补货建议生成）/ rules_engine（规则引擎生成），互不误关
- 告警模板变量: `{product_name}` `{sku}` `{avail}` `{safety}`
- tab 入口已移入锤子菜单（规则/补货参数/采购参数）
- 规则列表显示补货模式标签，条件预览显示仓库名

## 清洗页
- 导入类型按订单/库存/出入库记录/商品分类分组
- 库存分自有仓/平台仓/B仓三种导入，写入不同 `warehouse_type`
- 入库/出库记录针对自有仓在库周转计算
- 字段映射行 `padding: 8px 12px`，模板管理按钮 `minHeight: 36`，加 `clickable` 点击态

## 补货参数(规则页)
- 按渠道显示/保存（京东/其他渠道独立参数）
- 参数范围: BBCC(C仓/B仓) + 传统 + 采购参数 + 活动系数
- 模式切换已移入锤子菜单
- **活动系数默认关闭**（2026-08-07）：618/双11/年货节 3 个活动 `enabled: false`，用户按需开启

## 采购参数(规则页，2026-08-08)
- 按渠道显示/保存，支持供应商独立配置
- 参数范围: 采购前置天数、采购安全库存天数、MOQ 最小起订（可按供应商独立）、目标周转
- **供应商下拉选择器**：联动供应商页，选中后 MOQ/前置期/安全天数自动切换为 `{key}_{供应商代码}`

## 采购 MOQ 按供应商汇总（2026-08-08）
- 同一供应商所有 SKU 的采购量合计 < 该供应商 MOQ 时触发提升，按需求占比分摊
- products 表 `supplier_code` 字段关联 SKU-供应商
- 采购备注按优先级显示：供应商起订→箱规取整→补后周转

## 设置页
- API 连接状态 + 响应延迟 + 自动轮询 30s
- WebSocket 实时连接状态（实时/轮询/断开）
- 版本号 v1.0.0
- 清除本地缓存按钮
- **种子数据**：一键填充（80 SKU × 2 渠道、600+ 订单、9 仓库、5 供应商）+ 一键重置（清空所有业务数据）

## 种子数据（重构）
真实业务场景，覆盖大促/日常/周末波动：
- 商品：80 SKU × 2 渠道（jd/other），含 barcode/channel/unit/weight/volume 等全字段
- 订单：600+ 条（京东日均 4 单，其他渠道 2 单），含 618 大促（3-6 倍）、月末大促场景
- 库存：1,440 条（80 SKU × 9 仓库 × 2 渠道），8% SKU 低库存模拟断货风险
- 供应商：5 个 × 2 渠道
- 时间跨度：近 60 天
- 通过设置页「一键填充」/「一键重置」操作

## PWA 离线支持
- `manifest.json` — 应用名称、图标、`display: standalone`
- `sw.js` — Service Worker，network-first 策略，离线时从缓存加载
- 浏览器会提示"添加到主屏幕"

## 配置变更历史
- 后端 `replenishment_config_history` 表，每次保存补货参数/采购参数/活动系数时自动记录
- 查询接口 `GET /api/replenishment-config/history?channel=&limit=50`
- 规则页锤子菜单 → "变更历史"按钮 → 底部 sheet 弹窗（AirPods 风格）
- 显示参数名、模式、旧值（红色删划线）、新值（绿色）、时间、渠道来源

## 看板缓存机制
- `dashboard_cache.py`：`_cache_by_channel` + `_stock_risk_cache` 双缓存
- 缓存 TTL 3 分钟（2026-08-07 从 5min 缩短），通过 `invalidate()` 清除
- **跨进程缓存失效**：数据库版本号 `_cache_version`，每次 `invalidate()` 递增并持久化到 `replenishment_config` 表，各 worker 读取时对比版本号，不一致则重建
- `stock-risk` 独立缓存同样加版本号检查
- **缓存降级**（2026-08-07）：过期<30s 时异步重建，返回旧缓存不阻塞请求
- **北京时间时区**（2026-08-07）：漏斗/店铺/周期用 UTC+8
- **看板 30s 静默刷新**（2026-08-07）：前端无操作时自动更新数据，无骨架屏闪烁

## 测试
```bash
cd backend && python -m pytest tests/ -v
# API 测试（31个）
python -m pytest tests/test_api.py -v
```

## 导出按钮
所有导出按钮（订单/库存/建议页）统一点击态：
- `className="clickable"` + `btn btn-ghost` 点击态
- 点击后显示旋转 spinner + "导出中..."，`disabled` 防重复
- 完成后 toast 提示"导出完成"
- 失败 toast 提示错误

## 构建配置
- `vite.config.js` 中 `esbuild: { minifyIdentifiers: false, minifySyntax: true }` 避免 ESBuild 压缩 TDZ 错误
- 构建日期：`new Date().toISOString().slice(0,10)` 实时显示

## 国际化（2026-08-04）
- 轻量级 i18n，无外部依赖，中英双语
- 自动检测系统语言（`navigator.language`），支持手动切换
- 150+ 翻译键，覆盖 26 个文件
- 使用 `t(key)` 函数调用，支持参数插值

## CSS 工具类（2026-08-04）
- 50+ 工具类：布局（flex/grid）、间距（gap/margin/padding）、文字（fontSize/color/weight）、圆角、按钮、锤子菜单
- 8 个 Hammer 组件已迁移，内联样式减少 70%

## TypeScript 类型（2026-08-04）
- 全文件覆盖：组件 Props、Store 状态、API 响应、Toast 消息
- 新增 `XxxProps` 接口，核心组件类型覆盖率 100%

## 魔法数字→CSS 变量（2026-08-04）
- 15 个变量：`--radius-sm/md/lg/full`、`--space-xs/sm/md/lg/xl`、`--font-xs/sm/md/lg`、`--h-btn/lg/xl`

## 部署
后端: curl 上传 → reload
```bash
curl -X POST -H "Authorization: Token $PYTHONANYWHERE_TOKEN" -F "content=@file" "https://www.pythonanywhere.com/api/v0/user/Overtrees/files/path/home/Overtrees/Supplykit/backend/app/..."
curl -X POST -H "Authorization: Token $PYTHONANYWHERE_TOKEN" "https://www.pythonanywhere.com/api/v0/user/Overtrees/webapps/overtrees.pythonanywhere.com/reload/"
```
前端: 推 GitHub main → Cloudflare Pages 自动构建

## 冷启动（2026-08-03）
UptimeRobot 免费版每 5 分钟 ping `https://overtrees.pythonanywhere.com/api/insights/ping`，防止 PythonAnywhere 休眠。

## 补货建议缓存（2026-08-03，TTL 2026-08-07 更新）
- 3 分钟 TTL，持久化到 `replenishment_config` 表
- 缓存 key：mode + channel + days + 数据版本号（2026-08-07 去掉订单数/库存数，避免每次数据变更都重建）
- 失效时机：种子数据填充/重置、清洗导入、`invalidate()` 调用
- 首次计算 4-17s，后续 3 分钟内即时

## 操作撤销（2026-08-03）
- 规则/订单删除改为软删除（`is_active=0` / `deleted_at`）
- 删除后 toast 5 秒撤销窗口，超时后永久删除
- 设置页回收站可查看和恢复已删除数据

## 订单页服务端分页（2026-08-03）
- 每页 30 条，搜索/状态筛选传递到服务端
- 翻页时 `orderLoading` 显示骨架屏

## 页面过渡动画（2026-08-03）
- `@keyframes fadeIn` — 0.2s ease，`<main key={page}>` 触发

## 调试日志
- API 请求日志: 默认开启，>500ms 标 warning
- 数据库查询日志: DB_LOG=1
- 日销计算日志: SALES_LOG=1
- 前端 API 日志: console.debug (Verbose 级别可见)

## 后台任务（2026-08-06，提交方式 2026-08-07 更新）
- 种子填充和清洗导入通过 `submit_task` 提交，使用 **threading.Thread** 运行（2026-08-07 从 APScheduler 改为 threading，因 APScheduler date trigger 在 PythonAnywhere 环境不工作）
- 任务 ID 存 localStorage，App.tsx 全局轮询（跨页面/挂后台/关闭后重开均有效）
- 种子填充分 7 步独立执行（清空/商品/订单/库存/规则/配置/快照），失败跳过继续
- 前端 SeedProgress 组件显示步骤进度和状态（SVG 图标）
- 批量写入 50 条/批避免 SQLite 变量超限

## 认证系统（2026-08-07）
- 纯标准库 JWT（HMAC-SHA256），零外部依赖
- 首次使用设置密码（`/api/auth/setup`），自动创建 admin + demo 账号
- 后端正中件强制鉴权，所有 `/api/*` 路由保护（auth/health/ping/docs 除外）
- 访客模式：`demo / demo123`（仅可查看，不可修改）
- `JWT_SECRET` 持久化到 `replenishment_config` 表，跨重启 token 有效

## 数据库自动恢复（2026-08-07）
- 启动时 `quick_check` → 检测到损坏 → VACUUM → 从备份恢复
- 运行中健康检查检测到损坏时后台异步修复（不阻塞响应）

## APM 监控（2026-08-07）
- 内存聚合请求统计：总请求数、平均响应时间、错误率、慢请求数
- 慢接口 TOP10：按平均耗时排序，含请求数和错误数
- 慢请求（>5s）自动持久化到 quality_logs（慢查询告警）
- 公开接口 `GET /api/monitor`，无需鉴权
- 后端正中件自动记录所有 `/api/*` 请求

## 健康检查端点（2026-08-06）
- `GET /api/health` 返回数据库状态、完整性、磁盘空间、版本号、WAL 大小

## 数据库迁移工具（2026-08-06）
- `python3 migrate.py [check|create|apply|list]`
- 迁移文件存放在 `backend/migrations/` 目录

## 新增列（2026-08-06）
- 订单页：数量列、单价列
- 进销存页：单价列、在库金额列（含页脚合计）
- 库存 API 联表查询商品价格

## CSS 样式系统（2026-08-06）
- 4 级毛玻璃：`--blur-ultra-thin/thin/regular/thick` + 对应 `--bg-*`
- 阴影系统：`--shadow-card/sheet/alert/control`
- 高光渐变：`card::before` 顶部渐变
- 文字层级：`--text-secondary/tertiary`
- 分段控件：`hammer-segmented` + `hammer-segment`（替换 hammer-tab）
- 材料类：`material-thin/regular/thick`（替换 glass-bg 内联样式）
- 表格嵌套容器：外层 `overflow-y:auto` 上下滚动，内层 `overflow-x:auto` 左右滑动

## 列配置渠道隔离（2026-08-06）
- 进销存列 key：`c_cols_inventory_{ch}_{wt}`
- 建议页列 key：`c_cols_insights_{ch}_{mode}`
- 锤子数据：`c_hammer_data_{ch}`
- 已下单：`c_ordered_{ch}`
- 健康度 tab：`health_tab_{ch}`

## 种子数据优化（2026-08-06，2026-08-07 更新）
- 品类拓展到 70 种（调味品+零食+日化）
- 价格分层：80% 正常 + 10% 引流 + 10% 高毛利
- 订单完成率 45% + 3% 退货场景
- 安全库存随机 30-200
- 补货参数按渠道写入 + 规则按渠道隔离
- 供应商 10 家，SKU 1000/渠道（200 共享）
- 订单量 base 1100/550，约 10 万条
- **12% SKU 全仓低库存**（模拟需补货场景，2026-08-07）
- **填充后立即构建日销快照**（不等次日凌晨，2026-08-07）
- **供应商 code 加渠道后缀**（避免两渠道共用 code 互相覆盖，2026-08-07）

## 自定义日期范围（2026-08-04）
- 看板锤子菜单新增"自定义"按钮，展开日期选择器
- 支持今日/本周/本月/自定义四种时间维度
- 自定义时实时计算指定范围的 GMV/订单数/趋势/漏斗/店铺 GMV
- 切换回预设维度时自动清除自定义参数

## 店铺 GMV / 漏斗按周期维度展示（2026-08-04）
- 后端新增 `period_stores` / `period_funnel` 缓存
- 切换今日/本周/本月/自定义时，店铺 GMV 和漏斗图表同步更新
- 数据按渠道隔离，jd/other 互不影响

## 数据归档策略（2026-08-04）
- 每天凌晨 1 点自动执行
- 90 天前的订单按天+渠道+店铺+SKU 聚合为 `daily_stats` 行
- 删除原始订单行（分批 100 条，避免锁表）
- 数据库大小稳定在 90 万行以内

## 补货建议增量更新（2026-08-04，2026-08-07 更新）
- `daily_sales_snapshot` 表存储每天每 SKU 的订单数
- 计算日销时优先从快照读取历史数据，只从原始订单补充当天数据
- 3σ 异常剔除和趋势加权从快照+当天订单合并后重新计算，精度不受影响
- 计算速度 15-33s → 1-3s
- 每天凌晨 3:30 自动构建快照
- **清洗导入后立即触发快照增量更新**（2026-08-07）
- **种子填充后立即构建快照**（2026-08-07）

## 供应商页搜索（2026-08-04）
- 锤子菜单新增搜索按钮和输入框
- 搜索覆盖：名称、编号、联系人、电话
- 与商品页/订单页搜索体验一致

## 产品定位更新（2026-08-04）
- 从"无需 Excel 来回倒腾"改为"SupplyKit 做自动化，Excel 做灵活性"
- 定位为 ERP 与 Excel 之间的"中间层工具"
- 不做 ERP 的流程管理，也不替代 Excel 的灵活性

## 开发规范文档（2026-08-04）
- `docs/DEVELOPMENT.md` 完整开发规范，12 章
- 覆盖：项目定位、技术栈、代码规范、数据流、部署、测试、自动化检查、代码审查、国际化、版本控制
- 严格标准：测试先于代码、提交前自动化检查、代码审查流程

## 锤子菜单 UI 统一（2026-08-04）
- 所有按钮统一 `btn-ghost hammer-btn` 类（`min-height: 32px`，`white-space: nowrap`）
- 4 个按钮的页面（订单/进销存）改为 2×2 布局
- 标题统一 `hammer-header` 类
- 面板统一 `hammer-panel` 类
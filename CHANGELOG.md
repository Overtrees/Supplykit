## 2026-08-11 数据库稳定性治理 + 补货建议加载修复 + 看板性能优化

### 数据库稳定性（根本治理）
- 禁用 WAL 模式改用 DELETE（PA 文件系统 WAL 反复损坏 → malformed database schema）
- 数据库损坏恢复：重建表结构 + 清除损坏 WAL/SHM + admin 用户重建 + seed 重填
- `auto_vacuum=INCREMENTAL`：DELETE 后空间自动回收，不再膨胀（148MB → 13MB）
- `incremental_vacuum()`：无锁回收，归档/自检后执行
- 归档阈值 90→60 天（匹配 seed 数据窗口，确保归档实际触发）
- 备份改压缩（VACUUM INTO + gzip）：148MB → ~30MB
- 启动自检支持 .gz 备份恢复
- VACUUM 阈值提高到 150MB（数据库真实 99MB，防反复触发锁死接口）
- 健康检查防重复提交 VACUUM
- 数据库大小监控：`db_size_mb` 返回 + 超阈值自动维护

### 补货建议加载修复（核心 bug）
- 后端：缓存命中返回格式统一（双重 data 包装解包 → `ok(data)` 格式）
- 前端：`client.ts` 30s 内存缓存命中未解包 → 补货建议/看板等缓存命中时空数据
- seed 补模式默认参数（bbcc/传统），解决模式切换后空数据

### 实时性闭环
- 库存调整（inventory.changed）→ 补货缓存失效（立即反映，不再等 15min）
- 清洗导入 → 补货/看板/日销 全链路实时
- 看板 TTL 保持 180s（及时性与等待平衡）

### 看板性能优化（23s → 14s）
- 表达式索引 `idx_orders_cdate(channel, substr(ordered_at,1,10), order_status)`：GROUP BY 走索引
- 周期查询 6 次 → 2 次（单次查询 + Python 分组）
- rows/stores/inv 三查询并行化（独立连接）
- 后续可继续并行化到 ~8s

### 体验优化
- 403 提示可视化：访客模式显示「访客模式仅可查看，不可修改数据」
- 补货参数页模式参数默认值补齐

---
## 2026-08-09 任务卡片 UI/UX 细节优化

- 卡片上下 padding 12px→14px，图标颜色统一 var(--primary)
- 标题→副标题→时间行间距 2px→4px，信息层级分明
- 时间字号 10px→11px，下载按钮 padding 3px 16px
- 时间行与下载按钮 baseline 对齐（消除按钮下沉视觉）
- 下载按钮点击显示"下载中..."，hover/active 交互态

---
## 2026-08-09 任务管理页 + 异步导出系统 + 数据库稳定性

### 任务管理页（全新）
- 新建 `TaskPage` 页面，统一管理所有异步任务（种子填充/清洗导入/导出）
- 看板锤子菜单 + 侧边栏均可进入，按渠道隔离
- 任务卡片显示：类型图标（SVG）、状态标签、副标题明细名、北京时间、下载按钮
- 导出任务卡片副标题显示具体导出类型（订单明细/库存明细等）
- 清洗任务卡片副标题显示目标表名（订单表/库存表等）
- 统一任务查询接口 `GET /api/tasks?channel=jd`

### 异步导出系统（全新）
- 所有页面导出统一改为异步（不再同步阻塞 worker）
- 后端 `exports.py` 支持导出类型：采购建议/补货建议/滞销/订单/库存
- 导出任务提交 → 后台生成 Excel → 完成自动持久化到 `exports/` 目录
- 订单/库存/采购建议/补货/滞销导出列数补齐（24列/13列/8列）
- 订单导出：加单价/数量/69码联查/入库日期(paid_at)
- 库存导出：加仓维度筛选(wh_type)+期初/入库/出库/周转
- 导出按钮：点击后 toast 提示，按钮恢复，任务管理页查看进度

### 导出体验优化
- 下载按钮：点击显示"下载中..."→ 确认框弹出后恢复
- 下载按钮交互态：hover/active 过渡效果
- 导出副标题：去掉无意义 task_id 后缀
- 导出卡片布局：时间与下载按钮同行，按钮自适应高度
- 图标 SVG 化：任务页图标统一用 `IconRefresh/IconBroom/IconExport`

### 清洗页 8s 阈值
- 执行导入超过 8s 自动转为后台异步，页面恢复
- 8s 内完成则正常显示结果
- 清洗任务表名识别（订单表/库存表等）

### 数据库稳定性（P0/P1/P2 全部处理）
- `DeleteBuilder` 加 WHERE 防护（误删全表防护）
- `transaction()` 上下文管理器（自动 commit/rollback）
- `write_execute()` 写入队列（串行化写操作）
- 版本化迁移系统（`@_register_migration` 装饰器）
- 连接健康检查（`get_conn` 自动 `SELECT 1` 检测）
- TMPDIR 统一（`tempfile.tempdir` → 项目 tmp 目录，避免 /tmp 不可用）
- `_task_db_save` 参数修复（task_type/channel 持久化）
- 一键填充按钮保持进行中→任务完成后恢复

### 修复
- 种子填充跨页面持久化（seeding 从 localStorage 恢复）
- 北京时间显示（`toBeijing` 函数）
- 侧边栏去除任务管理（仅保留看板锤子菜单入口）
- 锤子菜单自动展开修复（`__setPage` 关闭锤子菜单）
- 全局主体隔离：滞销导出按 channel 过滤

---
## 2026-08-08 规则页加载并行化 + 模式切换 reqSeq 防竞态

### 性能优化
- 规则页加载从串行 9s 改为并行 **3s**（Promise.all 并行 5 个接口）
- 模式切换（BBCC/传统）去除多余 clearCache，30s 缓存复用加速
- 快速切换模式加 reqSeq 竞态防护，loading 不再提前关闭

### 修复
- 质量日志页面标题硬编码改为国际化 key，统一走 `nav.quality`
- 设置页"界面"卡片最后一行边框修复（Row→LastRow）

---
## 2026-08-08 UpdateBuilder 加 in_ 方法 + 界面卡片边框修复

### 修复
- `UpdateBuilder` 加 `in_()` 方法（之前缺失导致批量更新按 id 列表时运行时 bug）
- 设置页"界面"卡片最后一行用 `Row` 而非 `LastRow`，底部多一条分割线（已修复）

---
## 2026-08-08 看板复合索引 + 缓存 TTL 15min + 批量 update

### 性能优化
- 看板加复合索引 `(channel, order_status, ordered_at)`，查询从 O(n) 回表扫描 → O(log n) 索引范围扫描
- 补货建议缓存 TTL 3min → 15min（版本号失效机制保障实时性）
- 批量设置仓库类型改为一次 update（逐条 5000 次 25s → 一次 0.05s）

---
## 2026-08-08 清洗页仓库必填校验 + 库存空值兜底

### 清洗页
- 库存导入时 warehouse 列必填校验，未映射仓库列时弹提示阻止提交
- 后端 warehouse 空值自动填充默认值（平台仓/自有仓/B仓），防止 UNIQUE 冲突覆盖

---
## 2026-08-08 采购MOQ按供应商汇总+传统多仓仓库维度日销+补货参数缓存修复

### 采购 MOQ 按供应商汇总（重大改进）
- 之前：每 SKU 独立触发 MOQ（采购量虚高——30+20+10 各×150=450）
- 现在：按供应商汇总同一供应商所有 SKU 采购量，总采购量 < 该供应商 MOQ 时按比例分摊提升
- products 表加 `supplier_code` 字段，seed 数据分配 10 家供应商
- 采购参数页新增供应商下拉选择器（联动供应商页），MOQ/前置期/安全天数均可按供应商独立配置
- 采购备注按优先级显示：供应商起订→箱规取整→补后周转

### 传统多仓按仓库维度算日销
- 快照表 `daily_sales_snapshot` 加 `warehouse` 列，按 `(date, sku, warehouse)` 聚合
- 传统模式各仓库日销独立（不再共用 SKU 总日销）
- 传统模式安全库存 = 日销 × `safety_multiplier`（与 BBCC 口径一致）
- 备注增强：箱数提示 + 跨仓调拨提醒 + 人工复核提醒

### 补货参数缓存修复
- `replenishment-config` 接口过滤 `_cache_replen_*` 缓存数据（6.4MB→0）
- 接口响应时间：33s → 1.4s（提升 20 倍）

### 前端 CSS 类化
- `.hammer-select` 下拉选择框、`.hammer-params-grid` 参数网格
- 供应商选择按渠道独立持久化（localStorage）

---
## 2026-08-08 全页面鉴权修复 + 构建修复 + 规则引擎优化

### 全页面原生 fetch 鉴权修复（10 个文件）
- 后端加强制鉴权后，SettingsPage/App/SeedProgress/Orders/Inventory/Rules/Hammer 等页面原生 fetch 未带 token → 功能失效
- 修复 10 个文件共 20+ 处 fetch 调用，全部加 `Authorization: Bearer` 头
- 公开接口（auth/login、health、ping）不加 token，其余全部注入

### 构建修复
- 批量修复脚本导致 OrdersPage/InventoryPage 模板字符串错误、RulesPage 重复 headers key
- 本地验证 + CF Pages 构建成功

### 规则引擎优化
- `_seed_rules` SQL HAVING 聚合筛选替代 Python 全量遍历
- `detect_slow_moving` 只遍历有库存 SKU（避免 10 万+ SKU 全量遍历）
- 批量导入 evaluate 节流（>100 条跳过逐条 evaluate，改为后台批量评估）
- `_task_daily_rules` 去掉多余 evaluate 调用（告警已由 detect_slow_moving 直接创建）

### 内存优化
- 6 处 `select(*)` 改为原始 SQL 仅加载所需字段（省 ~300MB）
- 移除 with-sales 中死代码 orders 全量加载（改用快照后残留，省 ~200MB）

---
## 2026-08-07 性能优化（calc_sales_multi + dashboard SQL 合并）
- `calc_sales_multi` 一次遍历算多窗口，替代 3 次独立 calc_sales_from_daily 调用
- dashboard `_rebuild` 合并 4 个独立聚合为 1 次查询，status_dist 从 trend 数据推导

---
## 2026-08-07 前端 token 有效性验证

- App.tsx 启动时异步验证 `/api/auth/check`，token 失效自动清除并弹登录页
- 修复：旧 token 过期后直接进主界面数据空白的问题（需硬刷新或重新登录）

---
## 2026-08-07 进销存数据完善 + 周转天数融合日销

### 进销存页面
- 种子数据新增出入库记录生成（每 SKU 1-3 条入库 + 1-2 条出库，不同日期）
- 进销存页当月入库/出库列从 0 变为有真实数据（1000/1000 行）
- 修复周转天数 `∞` 显示（从 inventory 表不存在的字段改为计算）

### 周转天数算法
- 从简单平均（可用/(28天总量/28)）改为**融合日销**（三窗口 3σ 剔除 + 趋势加权）
- 与补货建议口径一致，更精准（剔除异常、反映趋势）

### 修复
- `seed_reset` 清空 `replenishment_config` 表后恢复 jwt_secret，避免重置后 token 失效

---
## 2026-08-07 APM 监控 + 最终完善

### APM 监控
- 内存聚合请求统计：总请求数/平均响应时间/错误率/慢接口 TOP10
- 慢请求（>5s）自动持久化到 quality_logs
- 公开接口 `GET /api/monitor`

---
## 2026-08-07 JWT 认证 + 访客模式 + 数据库自动恢复

### JWT 认证（零外部依赖）
- 纯标准库 HMAC-SHA256 JWT 生成/验证，无需 PyJWT/python-jose
- users 表（id/username/password_hash/role），预留多用户扩展
- 登录/设置接口 + 前端登录页
- 后端正中件强制鉴权：所有 `/api/*` 路由保护（除 auth/health/ping/docs）
- JWT SECRET 持久化到数据库，跨重启 token 有效

### 访客模式
- 内置 `demo / demo123` 账号（role='demo'）
- 登录页展示"访客模式：demo / demo123"
- 访客账号仅可查看，写操作（POST/PUT/DELETE）返回 403

### 数据库自动恢复
- 启动时 quick_check 检测 → VACUUM → 从备份恢复（三级修复链）
- 运行中健康检查检测到损坏时后台自动修复

---
## 2026-08-07 规则引擎组合表达式 + 日销支持

### 组合表达式（四则运算）
- `_resolve_value` 支持 + - * / 运算：可用+在途、安全线-可用（缺口）、可用/安全线（比例）、订单数量×单价
- 修复 max() 表达式解析 bug（字段×系数此前不被识别）
- 前端字段选择器扩展：可用+在途、可用+在途+锁定、缺口、比例、订单金额、可撑天数

### 日销支持
- 每日定时任务从快照注入 daily_sales，支持"可撑天数 = 可用/日销"类断货风险规则

### 告警口径统一
- 补货建议只管理自己生成（source=replenishment_engine）的告警，不误关规则引擎（rules_engine）告警
- 规则引擎紧急补货条件考虑在途：可用≤安全线30% 且 可用+在途≤安全线 才告警（真紧急）

---
# SupplyKit 更新日志

## 2026-08-07 性能优化 + 渠道隔离 + 可靠性根治（44 个提交）

### 性能优化（10 万单量级）
- 统一日销数据源：快照历史 + 当天 orders，消除重复计算
- 5 个核心接口 17-27s → 2-7s（补货 3.6s / 采购 2.6s / 滞销 3.9s / 进销存 2.6s / 看板 4.4s）
- 一键填充 12 分钟 → 2.5 分钟（订单 executemany 5.4x，规则引擎批量 1000x）
- 告警批量处理（2000 次查询 → 3 次）、预计算日期、with-sales 30s 缓存

### 渠道隔离（jd/other 全链路）
- 告警/规则/供应商/已下单/出入库全部按 channel 隔离
- evaluate() 按 channel 过滤规则，sku_to_channel() 从 products 主表推断
- 修复 other 渠道告警为 0、供应商 upsert 互相覆盖
- 清洗页渠道标记与全局渠道联动 + UI 明确导入目标

### 可靠性根治
- **存储配额**：40 个备份撑爆 512MB → 备份保留 7 个 + 每日磁盘自检 + WAL checkpoint
- **任务状态持久化**：sync_tasks 表，跨重启恢复 status/result/steps
- 健康检查 integrity quick_check + WAL 监控
- 启动时自动 WAL checkpoint；数据归档惰性兜底

### 稳定性
- 骨架屏防卡死（3 处 seq 竞态）、任务轮询 not_found 容错
- 欢迎页"开始体验"与一键填充联动修复

### 代码质量
- 裸 except 全部处理、Pydantic Schema（9 个）、localStorage 安全化
- 恢复 purchase_router 注册（清理临时路由时误删）

### 种子数据增强
- 12% SKU 全仓低库存（含自有仓触发采购场景）、供应商渠道后缀
- 填充后立即构建快照、seed 前 requires_reset 保护

---
# SupplyKit 更新日志

## 2026-08-06 种子数据重构 + CSS 系统 + 全局任务轮询

### 种子数据
- 分步执行（6 步独立 try-catch），失败跳过继续，断点续传
- 异步 + APScheduler 后台运行，前端 SeedProgress 组件显示步骤进度
- 品类拓展到 70 种（调味品+零食+日化），价格分层，退货场景
- 供应商 10 家，SKU 1000/渠道（200 共享），订单量 ~10 万条
- 补货参数按渠道写入，规则按渠道隔离

### 全局任务轮询
- 种子填充和清洗导入任务存 localStorage → App.tsx 全局轮询
- 跨页面/挂后台/关闭后重开均有效，完成时自动刷新
- 防重复提交 + 无效任务 ID 自动清理

### CSS 系统
- 引入 iOS 18 风格多级毛玻璃（4 级 blur + 4 级材料背景）
- 阴影系统（card/sheet/alert/control）
- 高光渐变（card::before），文字层级（text-secondary/tertiary）
- 分段控件（hammer-segmented + hammer-segment）
- 材料类（material-thin/regular/thick），header 按钮改用毛玻璃
- 表格嵌套容器（外上下内左右，互不干扰）

### 新增列
- 订单页：数量列、单价列
- 进销存页：单价列、在库金额列（含页脚合计）
- 库存 API 联表查询商品价格

### 列配置渠道隔离
- 进销存/建议页/锤子数据/已下单/健康度 tab 全部按渠道隔离

### 修复
- SettingsPage 缺少 API 变量导致连接检测失败
- 构建失败（overflow-y/x 语法、重复 className、esbuild 正则歧义）
- 种子填充 NOT NULL 约束失败、`_stock_risk_cache` 未初始化
- 缺货列表标签区分 B/C 仓/自有/平台
- 健康卡维度切换（自有/BC/C仓）
- 页面滚动偏移 + 水平滑动不可用

## P0 Bug 修复（Code Review）
| 问题 | 修复 |
|------|------|
| import_orders 调用未定义函数 | 删除该端点 |
| QueryBuilder 缺 ilike/single/or_ | 加上三个方法 |
| broadcast asyncio 同步线程 | get_event_loop().create_task |
| slow-moving 缺 level | 返回 level 字段 |
| 规则引擎 ctx 缺 db | or get_db() 兜底 |
| products 写 unit 列 | 改为 spec |
| cleansing success 负数 | 直接 return error |

## 基础设施修复
- CORS: allow_origins=origins or ["*"]
- 备份防重复: 24h 内不重复备份
- 日志清理: 50 条一批 DELETE
- WS 重连: 断开 10s 自动重连
- Chart 不渲染: 去掉 window.echarts 检查 + setTimeout + try/catch
- Chart 闪烁: getInstanceByDom -> chartRef + dispose
- 库存更新 500: .single().execute() 调用顺序修复

## 功能新增
### 清洗页
- 订单/库存目标切换
- 智能列名匹配（24 组别名）
- 字段映射保存为模板
- 自定义字段（名称/类型/删除）
- 预览表头中文标签
- 异常数据池（cleansing_errors 表）
- 格式校验 + 业务校验 + 补全推断

### 规则引擎
- 可视化条件编辑（字段+比较符+值下拉）
- 补货参数 tab（前置期/安全线/周转上限）
- 活动系数管理（自定义名称/系数/开关/增删）

### 补货建议
- 基于近 30 天日销计算
- 含前置期 + 安全线 + 在途库存
- 按可撑天数排序
- 活动系数调整（618/双11/年货节）
- 补货参数前端配置化

### 模板
- 清洗映射模板保存/加载
- 按目标类型过滤

### 库存
- 库存系统字段完整
- 清洗写入 inventory 表
- 清洗后自动触发库存同步

## 样式/UX
- Toast 通知替代 alert
- 颜色 token 集中管理
- 键盘快捷键（Cmd+B/Esc）
- 空状态引导组件
- 商品/供应商页加搜索
- 导入后自动跳转
- 错误边界展示错误信息
- 规则页双 tab 设计

## 2026-08-02 全面 UI/UX 重构
| 模块 | 改动 |
|------|------|
| **看板页** | 4小卡信息密度提升（日均GMV/严重度/总SKU/B仓/C仓/危急分层/缺货SKU列表），告警列表文字溢出修复，骨架屏7行 |
| **规则页** | 条件编辑器加仓库主体（全部/B仓/C仓/自有仓）+补货模式过滤（全部/BBCC/传统多仓），百分比溢出修复，列表/编辑/参数页面间距触控优化，emoji→SVG图标 |
| **清洗页** | 导入类型细化（自有仓/平台仓/B仓库存），分组排序，字段映射/自定义字段间距触控优化，去装饰元素 |
| **设置页** | iOS风格分组卡片，刷新连接加载态，清除缓存确认弹窗，无缓存toast提示 |
| **ConfirmDialog** | 重构毛玻璃风格（glass-bg+backdropFilter），圆角32，按钮并排（蓝底白字取消+红底白字确认），安全区适配，关闭过渡优化 |
| **变更历史弹窗** | 独立HistorySheet组件（React.memo），毛玻璃风格，骨架屏加载，不干扰锤子菜单关闭 |
| **漏斗转化率** | 修复超过100%问题（上限控制） |
| **内置规则** | 双渠道支持（jd/other各4条） |
| **种子数据** | 新增B仓（platform_b）仓库类型 |
| **清洗联动** | 清洗导入库存后触发规则引擎生成告警 |
| **全局点击态** | 新增`.clickable:active{opacity:0.7}`，按钮`.btn:active{transform:scale(0.96)}` |
| **emoji替换** | 全项目emoji图标（⚠️🔴💡➕✓）替换为SVG |
| **性能** | 变更弹窗抽离为独立组件，避免App大范围重渲染 |

## 2026-08-03 全面重构与优化
| 模块 | 改动 |
|------|------|
| **App.tsx 拆分** | 1098→391行，10个Hammer组件+HistorySheet抽离到`components/hammer/` |
| **ECharts 按需加载** | 全量导入→按需导入(BarChart/LineChart/CanvasRenderer)，减少~200KB |
| **冷启动修复** | UptimeRobot 每5分钟ping保活，消除首次打开5-33s等待 |
| **补货建议缓存** | 5分钟TTL，持久化到DB，数据变更自动失效，首次后即时返回 |
| **订单页服务端分页** | 30条/页，搜索/状态传递到服务端，`orderLoading`骨架屏 |
| **操作撤销** | 规则/订单软删除→toast 5秒撤销窗口→永久删除 |
| **回收站** | 设置页入口，查看恢复已删除规则/订单，iOS风格布局 |
| **规则页搜索** | 锤子菜单搜索框，按规则名称过滤 |
| **页面过渡动画** | `@keyframes fadeIn 0.2s`，`<main key={page}>` 触发 |
| **PWA 离线支持** | sw.js升级，网络优先+缓存兜底，API不缓存 |
| **欢迎页** | 首次全屏引导，4入口卡片，一键填充种子数据 |
| **侧边栏图标重设计** | 10个SVG图标全部重绘 |
| **告警底部弹窗** | 看板"还有N条"可点击展开毛玻璃弹窗 |
| **设置页分组** | 操作(含回收站)/界面(重置欢迎页)/种子数据 重新归类 |
| **导出按钮** | 统一点击态+loading spinner+toast反馈 |
| **Toast 安全区** | 适配灵动岛 `env(safe-area-inset-top)` |

## 当前已知问题
1. Chart 组件 ECharts 初始化偶发失败
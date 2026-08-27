## 2026-08-27 订单消失根治 + 看板实时性重构 + 监控防护
| 模块 | 改动 |
|------|------|
| **🔴 订单消失根治** | `_task_cleanup_recycle` 的 `deleted_at IS NOT NULL` 匹配 `''`(active)——每天 04:30 删光所有 active 订单（rules 同款 bug）。修复：`deleted_at != ''`（只删真软删超 30 天）。本地复现+验证。**这是 8-27 凌晨 12 万订单消失的根因** |
| **归档保护** | daily_stats INSERT 有任何失败 → ABORT 不删除 orders（防再次数据丢失）；归档执行写 quality_logs（数量/ABORT 原因） |
| **reset 提速** | orders 分批 DELETE 5000×36 次 commit（PA 卡死 10 分钟）→ **一次性 DELETE**（35s）；保留历史 journal_mode=DELETE 切换（防卡机制） |
| **看板实时性重构** | 静默刷新**绕过前端缓存**（`?t=`，之前命中缓存失效）；首次加载同绕过；次级合并（summary 独立 + aux 聚合 alerts/stockRisk/stockOverview，4→2 请求）；有旧数据不骨架（无感刷新） |
| **规则操作增量** | 规则启用/停用**增量修正看板 active_alerts**（替代 invalidate_dashboard 触发 summary 重建 14.6s）→ 回看板 **2.7s**（5 倍提速） |
| **批次主体隔离** | `/api/batches` 加 `warehouse_type` 参数（实际业务清洗导入按目标标记），各维度展开态不再混其他主体批次 |
| **看板缺货 SQL 聚合** | `/api/inventory/stock-overview`（SQL 一次查缺货列表+低库存/总数），替代全量 inventory（33s→轻量）；缺货列表修复（stockOverview.items 无 avail 字段导致 filter 失败） |
| **数据变更即时新** | 订单/商品/进销存/供应商**进入清缓存**（导入后立即显示新数据，不命中前端 30s 缓存） |
| **监控补强** | main.py **全局异常捕获**（未捕获异常→quality_logs 堆栈+友好 500）；归档/recycle 执行日志；静默刷新防堆积（busy 标志） |
| **清洗导入** | execute-async 改 postHeavy（90s）；**阈值防护**（<400 行同步直接结果，≥400 行异步 submit_task+WS 进度推送）；WS 按类型分发（cleansing_progress 不触发全局 loadAll） |
| **seed 场景** | 低库存 SKU 在途=0 + C 仓 avail 0-5（7 仓汇总 < 需求）→ **补货/采购必触发**（bbcc/传统 20/20 需补） |
| **UX** | 看板空白兜底（summary data 异常也显示 ErrorRetry）；清洗页冲突处理标题居中+间距；欢迎页触发 seed 填充期间友好提示 |

## 2026-08-25/26 数据库异常防治 + 大数据分页 + 四维一致性核验
| 模块 | 改动 |
|------|------|
| **备份机制 P0** | `backup_db` 从 VACUUM INTO（PA 静默失败→0字节）改 **sqlite3 在线备份 API**（`src.backup`）；生成后 gzip 解压+SQLite 查询验证；`/api/backup` 手动备份端点进程内恢复验证；备份 24.6MB 有效可恢复（18.5万订单） |
| **写操作锁重试** | `_write_execute` 锁冲突指数退避重试 3 次；`busy_timeout` 5000→15000 |
| **认证 P1** | PBKDF2-HMAC-SHA256（32字节 salt + 100k 迭代），`_verify_hash` 兼容旧 SHA256；JWT secret 改动态读取（修复登录成功立即 401） |
| **软删除全链路** | orders/products/rules/alerts 77 处查询统一过滤（补 10 处）；迁移 v16 统一 deleted_at NULL→'' |
| **看板性能** | OR 条件→单条件（4.4s→1.3s）；增量更新 `adjust_dashboard_for_order`（删单即时修正，不被异步重建覆盖）；改回**同步重建**（消除 10s 窗口） |
| **归档** | 60天→90天（对齐看板/滞销窗口，消除 60-90 天数据缺口） |
| **删单联动** | `adjust_snapshot_for_order` 即时扣减日销快照（修复历史订单删除后补货日销偏高） |
| **大数据分页** | 进销存/商品页真分页（只算当前页 SKU）+ 前端 IntersectionObserver 滚动懒加载 + 搜索走后端；`load_daily_sales` 加 `skus` 参数 |
| **进销存批次** | 汇总按 `warehouse_type` 主体隔离 + `ROW_NUMBER` 取最早过期完整批次；单批次不展开；超3/1列优化 |
| **规则页缓存** | suppliers 加缓存；rules/config/suppliers 缓存 TTL 30→180s；DB 版本号（跨 worker 兼容） |
| **with-sales** | 缓存 300s + `_replen_version` 校验；预热（已移除，占满 GIL 导致进程挂） |
| **数据库迁移** | v13 `alerts.related_rule_id`；v14 `rules.deleted_at`；v15 `orders.deleted_at`；v16 NULL→''；v17 `warehouse_registry` |
| **bug 修复** | 进销存 TDZ（`const s` 在 useEffect 后定义）；批次效期时区（aware/naive）；调试面板 JSX 位置（被当代码块丢弃）；`useToast` 在异步回调调用；`DeleteBuilder` 缺 `in_`；清洗 `task_id`/`conflict_mode`/N+1 |
| **开发规范 15.7** | 大数据分页 + 滚动懒加载 + 显示交互（IntersectionObserver 哨兵 + 条数列数提示） |

## 2026-08-26 下午：滞销/补货分页 + 告警即时失效 + 自愈 + 加载失败区分
| 模块 | 改动 |
|------|------|
| **滞销建议** | SQL 聚合套用 detect_slow_moving 方案（首次 35s→4.2s）；后端分页 + 前端懒加载（套 15.7）；**版本号校验恢复**（SKU 产生销量后即时降级/移出闭环）；**滞销参数联动**（PUT 递增 _replen_version） |
| **补货建议** | 后端分页 + 前端懒加载（传输 1000 条全量→每页 100）；**load_daily_sales 全量回退**（补货必须算所有 SKU 含缺货，不能只算库存 SKU） |
| **严重 bug 修复** | `invalidate_cache` 写错 key（写 `_cache_version` 应写 `_replen_version`）→ 补货缓存永不失效，数据变更后最长 15 分钟旧数据 |
| **告警** | 300s 缓存 + limit 200（7-19s→3-5s）；**双版本号校验**（`_rules_version` + `_replen_version`）——规则操作即时失效（200→127→200 验证）；rules.py 写操作统一递增 `_rules_version` |
| **前端性能** | 切页不再全量 loadAll（原每次切页 6 请求含 /api/inventory 33s）；建议页按 tab 加载（4 请求→1-2）；pageVersion 回退只保留看板 |
| **库存** | /api/inventory 分页（33.8s→2s） |
| **加载失败区分** | 8 页面（看板/商品/进销存/规则/建议/订单/供应商/任务）统一 ErrorRetry 组件：加载失败显示错误+重试，不误显示"暂无数据" |
| **自愈体系** | GitHub Actions self-heal.yml 每 10 分钟检查 health + 自动 reload（挂后 ≤10 分钟恢复）；UptimeRobot 保活 ping（已有） |
| **部署** | Reload 重试 5 次 30s→10 次 45s（PA slow_startup 409 容忍，部署最终 success） |
| **数据流澄清** | 在途=库存 in_transit_qty（库存变更更新）；采购订单=BBCC 已下单标记+入库时间监控 B 仓超储；删除订单直接影响日销（load_daily_sales 过滤 + 快照扣减） |

## 2026-08-24 配额管理全面修复 + 批量操作联动

### 配额管理（彻底解决爆库问题）
- **根因**：`backup_db` 外层 except 降级路径 `shutil.copy2(DB_PATH, bak_path)` 创建未压缩备份（无 `.gz` 后缀），清理逻辑只匹配 `.bak.*.gz` → 未压缩备份永远不会被删除 → 累积撑爆 512MB 配额
- **修复**：外层 except 降级也做 gzip 压缩（所有备份路径都输出 `.gz` 文件）
- **备份前清理非 `.gz` 文件**：`.bak.tmp` / `.bak.*.raw` / 无后缀 `.bak.YYYYMMDD`
- **磁盘自检补充**：清理 `.bak.tmp` / `.bak.*.raw` / 所有非 `.gz` 的 `.bak.*` / 旧导出文件（保留 10 个）/ quality_logs（保留 1000 条）
- 经验：备份文件不压缩 + 清理逻辑不匹配 = 死循环配额爆

### 规则页/商品页批量操作
- 规则卡片点击进入编辑（去除独立编辑/删除按钮）
- 锤子菜单恢复横排布局（撤销竖排，删除多余 CSS）
- 按钮 2×2 布局 + 间距优化
- 侧边栏改为"规则与参数"
- 批量勾选修复：setSelIds 传函数给 store 导致 prodSelIds 被设为函数（Zustand set 不支持函数参数）

### 其他
- seed 填充分批写入 + 内存优化（避免 PA OOM）
- 回退 seed 填充优化（因 PA 资源受限，分批写入反而慢）

---
## 2026-08-24 规则页批量适配+布局优化+批量勾选修复+PA磁盘配额排查

### 规则页批量操作适配
- 规则卡片改为点击进入编辑页（去除编辑/删除按钮）
- 批量操作面板统一由锤子菜单管理（与商品页一致）
- 批量启用/停用/删除根据页面可操作项适配
- 批量勾选报错修复：`setSelIds(prev=>...)` 传函数给 store 导致 `prodSelIds` 被设为函数

### 布局优化
- 规则页 tab 缩短为 2 字：`规则/补货/采购/滞销`（参考看板页）
- 按钮改为 2×2 布局：`新建+搜索` / `变更历史+批量操作`（`hammer-row-2`）
- 按钮间距优化（`marginBottom:8` + 批量面板间距对齐商品页）
- 侧边栏菜单"规则搭建" → "规则与参数搭建"（中英文 locale 同步更新）
- 锤子菜单恢复横排布局（撤销竖排），删除多余 CSS（hm-group/hm-tab/hm-btn/hm-sub）

### 商品页同步修复
- 批量勾选同样问题（`setSelIds(prev=>...)` 传函数给 store）
- 排查所有批量操作页面：仅商品页+规则页涉及，安全

### PA 磁盘配额排查
- 日志确认 `OSError: write error`——PA 的 512MB 磁盘配额超限
- 不是代码 bug（之前回滚的 seed 优化与 500 无关，已恢复）
- 需手动登录 PA 控制台清理磁盘空间后 Reload

### 提交
8-24: 20e47c5(规则卡片编辑) / d31f68c(商品页批量修复) / 2bb4f49(间距优化) / 77b557b(横排恢复) / a5cf593(侧边栏改名)

---

## 2026-08-23 批次效期管理 + 品牌列全链路 + 进出库记录批次化 + 锤子菜单竖排重构

### 批次效期管理（迁移 v8，核心）
- **batches 表**：sku/warehouse/warehouse_type/channel/prod_date/exp_date/qty（多批次维度）
- **效期状态**：已消耗 ≥1/3→✗否 / 入仓时(已消耗+transit)>1/3→⚠️临近 / ≤→✓正常 / 过期→⚫过期
- **物流在途**：滞销参数页配置 transit_days（默认 3，独立于采购前置期）
- **进销存页**：生产日期/截止日期/总效期/效期状态/超1/3/备注/品牌 7 列
- **展开行多 tr**：每批次一行显示 visCols 所有列，出入库量细分到批次
- **主行备注**：消耗%+状态+执行建议（如"92% 已超1/3 → 尽快清仓/退供"）
- **批次展开交互**：子表格（生产/截止/数量/消耗%/备注），含已出完批次自动清理

### 品牌列全链路（迁移 v9）
- products/suppliers 加 brand 列，按品类 15 个真实品牌池（海天/乐事/蓝月亮等）
- 供应商每品牌单行（多品牌拆为多行，结构化便于导入导出）
- 5 页面加品牌列：商品页（平台右侧）/ 供应商页（编号左侧）/ 建议页 3tab（SKU 左侧）

### 入库/出库记录批次化（迁移 v10/v11/v12）
- inbound_records/outbound_records 加 prod_date/exp_date/warehouse 列
- 唯一约束：sku+warehouse+channel+prod_date+exp_date+date（六列去重求和）
- 冲突处理：累加求和/覆盖（清洗页锤子菜单可选，默认累加）
- 仅限自有仓（`warehouse_type='own'`）
- 清洗导入时自动累加 inventory.month_inbound/month_outbound
- 出库导入时自动扣减 batches.qty（出完自动删除）

### 锤子菜单竖排布局重构
- 新增 CSS 类：hm-group/hm-tab/hm-btn/hm-sub（全竖排列表）
- 规则页：tab 竖排 + 功能按钮竖排（4tab+4 按钮）
- 商品页：按钮竖排（列配置/搜索/批量操作）
- 批量操作面板统一由锤子菜单管理（不再页面顶部内联）
- 规则页批量只保留删除（按页面可操作项适配）
- max-height + safe-area 适配（iOS 底部安全区）

### 去重逻辑改进
- 库存导入去重：sku+仓库+批次复合 key（同批次合并，不同批次放行，round-trip 覆盖）
- 入库/出库记录：六列唯一约束（同日期同仓同SKU同批次自动合并）

### 批量操作重构
- 商品页：批量启用/停用/删除（保留商品页可操作项）
- 规则页：批量删除（仅适配规则页特性）
- 面板从页面顶部移到锤子菜单（列选择器同风格）

### 种子数据调优
- 滞销场景：3% 真滞销 + 2% 低动销 + 临期批次
- 批次分布：94%ok / 5%warn / 1%真过期（避免全 black 演示）
- 品牌分配：按品类真实品牌池（供应商 1~3 个品牌）
- 期初同步：公式反推使汇总态=各批次之和
- 效期调长：食品 150~270 天/家清 200~365 天（避免固定月数临期线误判）

### 经验教训
- **seed 小概率坏批次被多仓×多批放大**→坏批次集中在少量 SKU 上（10%），其余全正常
- **临期线是固定月数**（食品 3 月/家清 6 月），商品总效期必须明显大于月线×30
- **useEffect 依赖数组在渲染阶段同步求值**，变量必须定义在 useEffect 之前（TDZ 根因）
- **sqlite3.Row 对象的 str() 陷阱**：get_conn() 设置 row_factory=Row，r[0] 是 Row 对象不是列值（需 str(r[0])）
- **锤子菜单竖排布局**：横排按钮在 240px 宽内文字截断，竖排 44px 高度易点击

### 提交
8-23: d715adb(去重复合key) / 52ce3a5(期初同步) / e486bfa(COALESCE) / 24b8d98(备注列) / 104d04a(竖排布局) / 0090998(规则批量适配)

---

## 2026-08-22 种子填充提速 + 任务系统稳定性 + 规则编辑页修复 + 启动加速

### 性能优化（PA 资源受限日 生成订单 630s→36s）
- **batch_size 500→5000**：`_seed_orders` 每批 500→5000 条 commit，fsync 360 次→36 次
- **流式写入**：`_seed_orders` 边生成边 flush（5000/批），内存峰值 18 万→5000 条，防 OOM
- **快照 UPSERT 分批 5000/commit**：`build_daily_sales_snapshot` 16 万行单事务→33 小批，防单事务 commit 过慢/线程被杀
- **cache_size + temp_store**：seed 期间 PRAGMA cache_size=-64000 + temp_store=MEMORY
- 实测：生成订单 630.5s→36.0s，全流程约 1min21s

### 任务系统稳定性
- **并发保护 `_check_busy`**：seed/reset 提交时检测存活任务（25 分钟内有更新=活着），拒绝并发提交；卡死任务（超 25 分钟无更新）自动标记 error 放行新任务
- **get_tasks 卡死自愈**：running 超 30 分钟无更新自动标记 error
- **get_tasks 锁容错**：database is locked 时返回 `database_busy` 标记而非 500，前端继续轮询
- **reset 补全漏表**：`_do_reset` 表列表增加 `daily_sales_snapshot`/`daily_stats`/`inbound_records`/`outbound_records`

### 规则编辑页修复（3 个问题）
- **mode 列迁移**：线上 `rules` 表缺 `mode` 列（SQLite 静默忽略），`init_db` 加 `ALTER TABLE rules ADD COLUMN mode` 迁移
- **后端 CRUD 持久化**：`rules.py` 创建/更新规则 payload 加 `mode` 字段，`schemas.py` RuleCreate/RuleUpdate 加 `mode` 字段
- **其他渠道隐藏 BBCC**：补货模式选择器加 `filter(m => m.v !== 'bbcc' || globalChannel === 'jd')`
- **保存反馈**：`save()` 加 loading 状态 + toast 成功/失败提示 + 错误处理
- **缓存清除**：后端 `_rules_cache` 全部 CRUD 操作清缓存（create/update/delete/restore/permanent-delete），前端 `save` 后调 `clearCache()`
- **本地即时更新**：`save` 后直接 `setRules(prev => prev.map(...))` 更新 mode，不等 API 返回

### 启动加速
- **移除启动 `backup_db`**：后台线程 VACUUM INTO 在 GIL 下阻塞所有请求数分钟（health 30s+ timeout），scheduler 已有每日 02:00 备份，启动备份冗余
- PA reload 恢复 HTTP 200（不再 409 slow_startup）

### 前端体验优化
- **TaskPage 轮询 5s→3s**：步骤进度更及时
- **步骤进行中显示**：running 步骤显示"进行中"+spinner 文字，而非仅 spinner
- **删除死代码**：`SeedProgress.tsx`/`ExportProgress.tsx`（已迁移任务管理页）
- **TaskPage 错误友好化**：401 → "登录已失效"；库忙/网络异常 → "数据正在处理中/自动重试中"
- **TaskPage 移除 AbortController 15s 超时**：3s 轮询本身在重试，超时反导致 seed 运行时请求被掐断报"网络异常"

### 诊断方法更新
- 获取 admin token（`admin/admin123`），直接调 API 诊断，不再下载 134MB 数据库
- 验证：实测 health 响应 1.5-2.3s（正常）

### 已知问题
- 规则保存后 `load()` 的冗余 API 调用可去掉（数据已写入后端），可简化为纯本地更新

---

## 2026-08-22 P2 完成：Sentry/规则调试/回收站/告警推送/批量操作联动

### Sentry 接入（EU 区坑多）
- DSN: de.sentry.io（欧盟区）；**sentryVitePlugin 默认连美区 → sourcemap 上传失败**，需环境变量 `SENTRY_URL=https://de.sentry.io/`
- **CF 账户 ID 修正**：实际 `4c3178949cce0a3db4f993a3e14712a6`（此前记忆截断错误导致 Authentication error，token 权限其实够用）
- sourcemap 上传为 artifact bundle 新格式，不走 release files API；验证看构建日志 "[sentry-vite-plugin] Info: Successfully uploaded source maps"
- filesToDeleteAfterUpload 未生效 → vite closeBundle 钩子删除本地 .map（防源码泄露）
- CF Pages 环境变量：SENTRY_AUTH_TOKEN / SENTRY_ORG=canopies / SENTRY_PROJECT=supplykit / SENTRY_URL / VITE_API_BASE_URL

### 规则引擎可视化调试
- 后端 `POST /api/rules/{id}/test`：传模拟 inv/order 数据 → 返回 triggered + 左右值计算明细（left_value/right_value/op）
- 前端规则列表每条约"测试"按钮 → 底部 sheet 输入可用量/安全线/在途/滞销天数/订单数/仓库主体 → 显示 ✓触发/✗未触发 + 告警内容

### 回收站增强
- RecycleBin 改勾选模式：checkbox + 全选 + 批量恢复/批量永久删除（confirm 确认），规则/订单分组操作
- scheduler `_task_cleanup_recycle` 每日 04:30 永久删除软删除超 30 天的 orders/rules

### 告警推送（Webhook）
- scheduler `_task_push_alerts` 每 30 分钟推送最近 60 分钟新增且未推送（pushed=0）的 active 告警
- 钉钉/企业微信兼容（POST JSON msgtype:text）；alerts 表加 pushed 列（迁移 v4）
- 设置页"告警推送"分组配置 webhook（存 replenishment_config.webhook_url），留空不推送

### 批量操作 + 建议页联动闭环（核心）
- **products 软删除**：迁移 v5 加 deleted_at；products.py 重构（软删除/restore/permanent-delete/批量 `POST /api/products/batch`，action: delete/restore/active/inactive/purge）
- **联动链**：products.changed 事件 → `_invalidate_all_caches`（补货+采购+看板缓存全失效）+ replenishment/purchase/insights 查 products 过滤 `deleted_at=''`
- 效果：删商品 → 建议页秒级去除；回收站恢复 → 即时回来；库存表不连带删（实物可能在库需盘点）
- rules 批量接口 `POST /api/rules/batch`（delete/restore/active/inactive）
- 前端：锤子菜单"批量操作"按钮（store `prodBatch` 全局复用）→ checkbox 多选 + 全选 + 批量启用/停用/删除 + 退出

### 已确认不做
- 看板卡片自定义（拖拽排序）：收益低风险高，如需要只做显隐开关（30 分钟）
- 定时导出：单用户场景价值低

### 提交
P2: 447dc49(Sentry DSN) / 3a925d0(规则测试) / e9447b8(回收站) / 717265f(告警推送) / 56917c5(批量+联动) / 32c2d95(sourcemap清理) / 2b0c177(迁移v3)

---

### 数据库崩溃恢复（存储配额第三次超限）
- **根因链**：备份策略漏洞（`backup_db` 降级路径只生成未压缩版 125MB → 不删除 → 两次累积撑爆 512MB 配额）→ WAL 写不了 → `disk I/O error` 启动崩溃 → 删 WAL 文件导致数据库损坏 → 备份文件也在 I/O 错误期间生成同样损坏
- **恢复**：清空所有损坏文件 + 备份，重建空库，重建账号（setup）
- **`backup_db` 降级路径加固**：VACUUM INTO 失败时复制原始文件后立即 gzip 压缩，删除未压缩版（`ba1942b`，后端已部署）
- **scheduler 清理只认压缩版**：glob 从 `.bak.*` 改为 `.bak.*.gz`，不再把未压缩版算进配额（`ba1942b`）
- **WAL 失败自动降级 DELETE**：`PRAGMA journal_mode=WAL` 加 try/except，配额满时自动切 DELETE 模式，启动不崩溃（`ba1942b`，后端已部署）

### 补货 other 渠道超时修复
- **前端超时 30s → 90s**：PA 单 worker 排队 + 其他渠道首次无缓存计算 > 30s（`40bca78`，CF 已部署）
- **后端传统模式 7 次独立 SQL 合并为 1 次批量加载**：传统模式对每个仓库独立调 `load_daily_sales`（7 次 SQL 查询），合并为 1 次 `warehouse IN (...)` + 内存分组，计算时间从 15s+ 降至 5s 内（`b6ca6cb`，后端已部署）
- **错误可见化**：已部署（`3fdda9e`），之前静默"库存健康暂无补货建议"现在显示具体错误原因

### 种子填充 / 清洗导入 WAL 加固
- **seed 清空前强制恢复 WAL**：`_clear_all` 开头 `PRAGMA journal_mode=WAL`（`b6ca6cb`，后端已部署）
- **清洗导入主函数开头强制恢复 WAL**：`_run_cleansing` 开头 `PRAGMA journal_mode=WAL` + 补全 `get_conn` 导入（`b6ca6cb`，后端已部署）
- 原因：配额满时 WAL 降级为 DELETE，此时批量写入极慢（10 万订单在 DELETE 模式下写入远超 PA 进程回收超时）

### 验证
- 后端 48 个测试逐文件通过（组合跑受 DB_PATH 多文件污染干扰，pre-existing）
- 线上：health 正常，db 0.2MB（空库待填充），WAL 模式已恢复
- 备份策略：`db_size_mb` 检查正常，VACUUM 阈值 150MB

---## 2026-08-21 补货建议根因修复 + 渠道隔离完整闭环（6 个提交）

### 补货建议"无数据"双根因修复（bdf8593，后端已部署）
- **当天订单日销静默丢失**：`daily_by_sku.setdefault(key,{})[dt] = daily_by_sku[key].get(dt,0) + qty` 的 RHS 先于 setdefault 求值 → KeyError 被 except 吞掉（sales_utils.py 两处）→ 当天订单销量从不计入日销 → 无快照覆盖的 SKU 日销=0、建议补=0
- **建议结果未按需补优先排序**：48 条有效建议排在 6900+ 条"库存充足"之后，首屏全是"建议补 -"被误解为无数据 → 排序规则：suggested_qty>0（或 b_suggested>0）最前 → 建议量降序 → 日销降序 → SKU 稳定
- 新增 tests/test_replenish_order.py（2）：需补排前 + 全 0 稳定

### 共享 SKU 渠道隔离 + products 搜索修复（d53b436，后端已部署）
- **根因链**：seed 共享 SKU 复用 jd 的 `-J` 字符串 → products.sku 单一 UNIQUE + upsert(INSERT OR REPLACE) 两渠道互相覆盖，200 个共享 SKU 只剩 1 行（channel=other 后写胜出）→ jd 渠道搜不到自己商品、sku_to_channel 恒判 other
- **三层修复**：
  1. products 约束升级 `UNIQUE(sku)` → `UNIQUE(sku, channel)`（新库建表直接新结构，旧库 `_ensure_products_composite_unique` 幂等重建）
  2. 启动自愈 `_heal_shared_products`：跨渠道同 SKU 缺行时从已有行复制 + supplier_code 渠道后缀替换（幂等）
  3. seed make_skus 共享 SKU 独立命名（-O/-J 各归各渠道，内容复制共享）→ 下次填充彻底无跨渠道同名
- **搜索回归修复**：products.py `q.ilike(name).or_(q.ilike(sku))` 链式调用把 channel 与两个 LIKE 全部 AND → 按 SKU/名称搜索永远空（8-07 修过再次回归）→ 独立构造 q1/q2 再 or_
- 新增 tests/test_shared_sku.py（4）+ test_products_search.py（3）

### 仓储维护
- 移除 db 文件跟踪（8e16cf8）：app/supplykit.db 146MB 不入版本库（git rm --cached，本地文件保留）

### 补货加载失败错误可见化（3fdda9e，前端已部署）
- loadReplen catch 不再静默置空：失败显示具体原因（网络/token/超时/格式），空态区分"加载失败"与"库存健康暂无补货建议"
- 防双重包装兜底：r.data 非数组时尝试再解一层 data

### 采购建议 B 仓跨渠道隔离（b42122f，前后端已部署）
- **问题**：seed 对两个渠道都生成 '京东B仓'(platform_b) 库存行，purchase 汇总 sys_total 无条件累加 → 其他渠道采购建议出现 B 仓数据（线上 963/1000 行）
- 修复：purchase.py 其他渠道 platform_b 行完全跳过（总库存/安全库存/b_available 全不含）；seed 不为 other 生成 B 仓；前端采购列"B仓x"段仅京东渲染
- 新增 tests/test_purchase_channel.py（2）：other 排除 B 仓(sys_total=150) / jd 保留(b=20)

### 渠道隔离收尾：其余 B 仓渗透点清空（e63da40，前后端已部署）
- inventory.py：`channel != 'jd'` 强制排除 platform_b（显式查 B 仓也返空）
- RulesPage：条件仓库筛选"B仓"选项仅京东渠道渲染
- useAppStore：hammerWhType 对非 jd 渠道残留 platform_b 时回退 'own'（初始化 + setChannel 两处）
- 看板健康卡片确认无需改（other 本来就只有 自有/平台）
- 新增 tests/test_inventory_channel.py（3）

### 验证
- 48 个后端测试逐文件单独跑全过（组合跑受多文件共用 DB_PATH 的 pre-existing 基建问题干扰，不可用）
- 线上验证：补货首屏 50 条全有建议（修复前 0）；other 采购 b_available>0 963→0；other 查 B 仓 0 行 / jd 1000 行保留；SKU-0130-J 双渠道各自可查
- PA 存储配额超限清理（未压缩备份 + tmp 残留 + 调试文件，第二次发生）
- 本地一次性重置+填充全流程跑通（单进程直调 seed 函数，iSH 下 uvicorn HTTP 全链路会被系统 kill）

---## 2026-08-21 变更历史修复 + 全流程重测通过

### 修复
- 变更历史（replenishment_config_history）3 处 insert 缺 `.execute()` → 历史从未写入
- 影响：补货参数/采购参数/活动系数修改无历史记录，规则页"变更历史"弹窗无数据
- 修复后：保存记录 key: 旧值 → 新值 + 时间，正常显示
- 全面排查其他 insert 调用（B仓告警/滞销告警/重名告警/模板/业务数据）均有 execute，无误报

### 验证
- 一键重置 + 一键填充全流程 8/8 步成功（含此前失败的"构建日销快照"）
- 采购参数保存 history 正常：moq: 500 → 88
- WAL 模式下填充期间任务页正常可读（读写并发）

---
## 2026-08-21 任务系统重构 + 数据库并发治理 + 规则页优化

### 任务系统（一键重置/填充全流程）
- 一键重置改异步（submit_task），前端轮询等待完成，不阻塞 worker
- 重置/填充任务 `channel='all'`（全局任务），jd/other 渠道都能看到
- 任务列表过滤内部维护任务（vacuum/health_/inv_sync）
- TaskPage 识别 reset 类型（显示"数据重置"，不再误显示"清洗导入"）
- 任务卡片显示后端执行步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）
- 任务管理页切渠道立即清空旧数据 + loading
- 页面回前台即时刷新任务进度（visibilitychange + focus 事件）
- TaskPage 错误处理：区分"暂无任务"与"加载失败(具体错误)"

### 数据库并发治理（核心）
- **恢复 WAL 模式**：seed 填充写 12 万订单期间读操作不被写锁阻塞（DELETE 模式读写互斥导致任务页/其他页面全卡）
- **线程池 2→4**：减少卡死任务占满 worker 的影响
- **启动清理卡死任务**：running 超 10 分钟标记 error，释放线程池
- **`_seed_builtin_rules` row_factory 污染修复**：改用 get_conn()（之前直接 sqlite3.connect 无 row_factory → 主线程 dict(r) 报错 "cannot convert..." → 日销快照构建失败）
- 任务查询独立连接 + busy_timeout=10000（避免写锁冲突）
- 日销快照构建成功（seed 8/8 步全部通过）

### 规则页优化
- 首屏加载 5 请求→3 请求（flat 合并 mode/seasons，PA 单 worker 排队从 8.5s→5.1s）
- rules / replenishment-config 加 30s 内存缓存（保存时自动失效）
- loadSeasons 复用 cfg 缓存，tab 切换少 1 请求（3.2s→1.6s）

### 修复
- tasks.py 缺少 `import sqlite3` 导致任务列表空
- API 恢复环境变量配置（VITE_API_BASE_URL）
- TaskPage 模块级 IconUndo 未导入导致 JS 加载失败页面空白

---
## 2026-08-21 规则页加载优化 + 任务列表修复

### 性能优化
- 规则页首屏加载 5 请求→3 请求（flat 合并 mode/seasons，PA 单 worker 排队从 8.5s→5.1s）
- rules 接口加 30s 内存缓存（创建/更新/删除规则时自动失效）
- replenishment-config 接口加 30s 内存缓存（配置保存时自动失效）
- loadSeasons 复用 cfg 缓存，tab 切换少 1 请求（3.2s→1.6s）

### 修复
- tasks.py 缺少 `import sqlite3` 导致任务列表返回空（已修复：`sqlite3.Row` 未定义被 catch 静默）
- 任务管理页切渠道时立即清空旧数据 + 显示 loading（避免旧数据残留）
- 任务列表过滤内部维护任务（vacuum/health_/inv_sync 不显示给用户）

### 体验
- 智能落地页（landing.html）跳转地址修正：后端 API → 前端页面

---
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

## 2026-08-24 全面性能优化与联动缺陷修复
| 模块 | 改动 |
|------|------|
| **数据库层** | 写操作统一 `_write_execute`（database is locked 自动指数退避重试 3 次）；`busy_timeout` 5000→15000ms；`DeleteBuilder` 补 `in_` 方法 |
| **迁移 v13-v15** | `alerts.related_rule_id`、`rules.deleted_at`、`orders.deleted_at` |
| **规则↔看板联动** | 停用/删除规则时按 `alert_type` 整类关闭告警（兼容历史遗留 `related_rule_id=0`）；恢复规则同步恢复。`_cleanup_orphan_alerts` 每日兜底清理，`replenishment_engine` 告警不误伤 |
| **订单软删除全链路** | `list_orders` / `dashboard_cache` 4 处 SQL / `dashboard.py` / `load_daily_sales` / `build_daily_sales_snapshot` / 传统模式日销 / 采购 / 导出 / 库存同步 / 归档 / 清洗去重 —— 统一过滤 `deleted_at` |
| **用户定时规则** | scheduler 新增 `_eval_daily_user_rules`，遍历有库存 SKU 调 `evaluate('scheduled.daily')`；滞销识别先检查规则启用状态 |
| **Dashboard 重建提速** | 5 遍订单扫描 → 3 遍（去掉 `_agg`/`_pstore`/`_pfunnel` 独立查询）；`invalidate()` 不再清空 `_cache_by_channel`（保留旧缓存供异步降级）；有旧缓存时一律异步重建不阻塞；`time.sleep(0.001)` 每 2000 行让出 GIL |
| **缓存优化** | 滞销识别 10s 内存缓存（5.8s→0.01s）；采购建议版本号缓存（2.0s→0.01s，共享 `_replen_version`）；版本号分离：`_replen_version` 与 `_cache_version` 独立，规则停用不再使补货缓存失效 |
| **WS 广播** | `ws.py` 新增 `broadcast_sync`；`products.changed`/`dashboard.updated` 广播；`orders`/`rules` 写操作广播；异步重建完成 → `bus.emit('dashboard.updated')` → 前端自动刷新 |
| **前端规则页刷新** | `load` 改用原生 `fetch` 绕过 `api.get` 缓存/在途去重；`rules-changed` 自定义事件；`save`/`del`/`runBatch` 统一 `await load`；`cancelEdit` 重置 `hammerRuleNewVersion`（修复自动展开新建表单） |
| **前端建议页自动刷新** | store 加 `dataVersion`+`bumpDataVersion`，WS 广播后递增，`InsightsPage` 监听自动刷新当前 tab |
| **前端批量操作超时** | 新增 `api.postHeavy`（timeout 90s），批量操作/撤销恢复改用 |
| **前端回收站** | 批量永久删除改走单请求 `POST /api/rules/batch purge`；`toast` 传 props 替代闭包；`try/catch` 降级 `window.alert`；`loadData` 成功后从 API 重新拉取 |
| **前端调试面板** | 规则页 `localStorage.setItem('c_debug_rules','1')` 启用，追踪 `load`/`save`/`del` 每步数据流转 |
| **OrdersPage** | 删除撤销 5s 定时器加入 `timersRef`，组件卸载时清理 |
| **测试重构** | 全部 DB 测试改 `setup_module` 模式（collection 阶段无副作用）；每文件独立 DB；`test_e2e`/`test_more` 补 `build_daily_sales_snapshot`；新增 `test_alert_sync` 5 测试；93/93 组合跑通过（之前 26 fail + 2 error） |
| **文档** | `DEVELOPMENT.md` 去重（61 倍重复，189KB→18KB）+ CI/CD 章节；`SUPPLYKIT_SKILL_REFERENCE.md` 删除；`vercel.json` 删除；`.test_*.db` 入 `.gitignore` |
| **部署** | 4 次后端部署 success；`create_rule`/`delete_rule` 加错误捕获写入 `quality_logs`；启动预热移 scheduler 90s 延迟（避免饿死 CI health） |

## 当前已知问题
1. Chart 组件 ECharts 初始化偶发失败
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
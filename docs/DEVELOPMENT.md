# SupplyKit 开发规范

## 一、项目定位

SupplyKit 是**电商供应链数据清洗与补货决策看板**，定位为 ERP 与 Excel 之间的"中间层工具"——不做 ERP 的流程管理，也不替代 Excel 的灵活性。

### 核心原则
- 看板 + 补货决策为最主要核心
- 数据经过清洗、规则引擎、补货建议，最终输出决策
- 不替代 ERP 的核心流程管理
- 不与 Excel 竞争，而是互补——SupplyKit 做自动化，Excel 做灵活性

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 二、技术栈

| 层级 | 技术 | 版本 |
|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|
| 前端框架 | React | 18 |
| 语言 | TypeScript | — |
| 构建工具 | Vite | 5 |
| 状态管理 | Zustand | — |
| 图表 | ECharts | 5（按需导入） |
| 后端框架 | FastAPI | — |
| 数据库 | SQLite（WAL 模式） | — |
| 前端部署 | Cloudflare Pages | — |
| 后端部署 | PythonAnywhere | — |
| 定时任务 | APScheduler（调度）+ threading（后台任务） | 后台任务状态持久化到 sync_tasks 表 |
| 国际化 | 自建 i18n（无外部依赖） | — |

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 三、项目结构

```
Supplykit/
├── frontend/                    # 前端
│   ├── src/
│   │   ├── App.tsx              # 主入口（391 行，从 1098 拆分）
│   │   ├── main.tsx             # 挂载点
│   │   ├── locale.ts            # 国际化翻译（150+ 键，中英双语）
│   │   ├── types.ts             # 全局类型定义
│   │   ├── theme.ts             # 主题配置（深色/浅色模式）
│   │   ├── version.ts           # 版本信息
│   │   ├── api/
│   │   │   └── client.ts        # API 客户端（缓存+在途去重+console.debug日志）
│   │   ├── store/
│   │   │   └── useAppStore.ts   # Zustand 全局状态
│   │   ├── pages/               # 10 个页面组件
│   │   ├── components/          # 通用组件
│   │   │   ├── Card.tsx          # 支持 borderRadius/valueColor 属性
│   │   │   ├── Chart.tsx         # 自动注入深色模式 tooltip/label 颜色
│   │   │   ├── Toast.tsx         # 玻璃态模糊背景
│   │   │   ├── Sidebar.tsx      # 页面内渲染（非 position:fixed overlay）
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Icons.tsx
│   │   │   └── hammer/          # 锤子菜单组件（8 个）
│   │   └── styles.css           # 全局样式 + CSS 变量 + 玻璃态 + 横屏适配
│   ├── vite.config.js
│   └── package.json
│
├── backend/                     # 后端
│   ├── app/
│   │   ├── main.py              # API 请求日志中间件（>500ms 标 warning）
│   │   ├── core/
│   │   │   ├── database.py      # SQLite ORM + TableRef（DB_LOG 环境变量控制日志）
│   │   │   ├── dashboard_cache.py  # 看板内存缓存 15s
│   │   │   ├── replenishment_cache.py  # 补货建议持久化缓存 3min
│   │   │   ├── sales_utils.py   # 日销计算（三窗口 3σ 剔除 + 趋势加权）
│   │   │   ├── rules.py         # 规则引擎
│   │   │   ├── scheduler.py     # APScheduler 定时任务 + 磁盘自检/备份保留7个
│   │   │   ├── database.py     # SQLite ORM + 任务持久化 + 索引 + 渠道迁移
│   │   │   └── sales_utils.py  # 日销计算 + sku_to_channel 渠道推断
│   │   └── api/routes/          # 19 个路由模块
│   └── tests/                   # 80+ 个后端测试
│
└── docs/
    └── DEVELOPMENT.md
```

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 四、代码规范

### 4.1 TypeScript

- **组件 Props 接口**：`interface XxxProps { ... }`
- **避免 `any` 类型**：优先使用具体类型或泛型
- **Store 状态有接口定义**：`AppState` / `AppActions`
- **全文件覆盖 100%**：31 个 TS 文件均已添加类型定义
- 核心类型：`ColumnDef`、`WarehouseType`、`ToastItem`、`OrderItem`、`ChartProps` 等

### 4.2 React 组件

```tsx
export default function ComponentName({ prop1, prop2 }: { prop1: string; prop2?: number }) {
  // ...
}
```

- **函数组件**，不使用 class 组件（ErrorBoundary 除外）
- **默认导出**：`export default function Xxx()`

### 4.3 CSS 规范

**CSS 变量（魔法数字抽取）**
```css
--radius-sm: 12px;   --radius-md: 16px;   --radius-lg: 32px;   --radius-full: 99px;
--space-xs: 4px;     --space-sm: 10px;    --space-md: 12px;    --space-lg: 16px;    --space-xl: 20px;
--font-xs: 11px;     --font-sm: 12px;     --font-md: 14px;     --font-lg: 16px;
--h-btn: 30px;       --h-btn-lg: 36px;    --h-btn-xl: 48px;
```

**CSS 工具类（50+ 个）**

| 类别 | 类名 | 说明 |
|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|
| 布局 | `.flex` `.flex-center` `.flex-between` `.flex-1` `.flex-col` `.flex-wrap` | Flex 布局 |
| 间距 | `.gap-4/6/8` `.mb-4/8/12/16` `.mt-8/12` `.p-4/8/12/16` | 边距 |
| 文字 | `.text-10/11/12/13/14/15/16` `.font-400/500/600/700` | 字号/字重 |
| 颜色 | `.muted` `.muted2` `.bg-card` `.bg-bg` | 文字/背景色 |
| 圆角 | `.rounded-12/16/32/99` | 圆角 |
| 通用 | `.w-full` `.truncate` `.nowrap` `.border-none` `.cursor-pointer` | 常用 |
| 锤子菜单 | `.hammer-header` `.hammer-btn` `.hammer-tab` `.hammer-panel` `.hammer-input` `.col-drag` | 菜单组件 |
| 锤子布局 | `.hammer-row-2` `.hammer-row-2x2` `.hammer-row-3` | 标准行布局 |
| 锤子通用 | `.hammer-spinner` `.hammer-clear` `.hammer-icon-btn` | 动画/清除/触发按钮 |
| 列选择器 | `.cols-group-title` `.cols-top-bar` | 分组标题/顶部操作栏 |

**圆角统一**
- 卡片/弹窗/面板：`var(--radius-lg)` = `32px`
- 搜索框/输入框：`var(--radius-lg)` = `16px`
- 胶囊按钮：`var(--radius-full)` = `99px`
- 骨架屏：`8px`
- 列拖拽行：`6px`

**按钮统一**
- 锤子菜单按钮：`btn-ghost hammer-btn`（不用 `btn` 类）
- `btn` 类有 `padding: 8px 20px` 和 `min-height: 36px`，比锤子按钮大
- 锤子按钮标准：`min-height: var(--h-btn)`（30px），`padding: 2px var(--space-sm)`（10px），`white-space: nowrap`
- 2 个按钮一排用 `hammer-btn-row`，4 个按钮用 2×2 布局（`hammer-row-2x2`）
- 3 种标准行布局：A型（`hammer-row-2` 2按钮均分）、B型（`hammer-row-2x2` 2行×2按钮）、C型（`hammer-row-3` 3按钮均分）

**玻璃态变量**
```css
--glass-bg: rgba(255,255,255,0.5);
--glass-blur: 40px;
--glass-border: rgba(255,255,255,0.6);
```

**横屏适配**
- `@media(orientation:landscape) and (max-height:550px)` 触发
- header 缩小、容器 padding 优化、卡片网格 4 列

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 五、数据流规范

### 5.1 API 缓存

- **dashboard**：内存缓存 15s
- **补货建议**：持久化缓存 5min + 数据版本号
- **日销快照**：`daily_sales_snapshot` 表，每天凌晨 3:30 构建
- **在途去重**：同一请求未完成时复用

### 5.2 数据归档

- 订单超 90 天自动聚合为 `daily_stats` 行，删除原始订单
- 每天凌晨 1 点执行

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 六、部署规范

### 6.1 前端部署

```bash
git push origin main → Cloudflare Pages 自动构建
```

### 6.2 后端部署

```bash
cp backend/app/api/routes/file.py /tmp/file.py
curl -X POST -H "Authorization: Token $PYTHONANYWHERE_TOKEN" \
  -F "content=@/tmp/file.py" \
  "https://www.pythonanywhere.com/api/v0/user/Overtrees/files/path/home/Overtrees/Supplykit/backend/app/..."
curl -X POST -H "Authorization: Token $PYTHONANYWHERE_TOKEN" \
  "https://www.pythonanywhere.com/api/v0/user/Overtrees/webapps/overtrees.pythonanywhere.com/reload/"
```

### 6.3 冷启动保活

UptimeRobot 每 5 分钟 ping `https://overtrees.pythonanywhere.com/api/insights/ping`

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 七、测试规范（严格标准）

### 7.0 核心原则：测试先于代码

```
改代码前 → 先写测试 → 确认测试失败 → 改代码 → 确认测试通过
```

所有功能修改、bug 修复、重构，必须遵循此流程。

### 7.1 测试覆盖要求

| 变更类型 | 必须覆盖的测试 | 最低要求 |
|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

-|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|
| 新增功能 | 单元测试 + 集成测试 | 核心路径 100% 覆盖 |
| Bug 修复 | 先写复现测试 → 再修 bug | 修复后测试通过 |
| 重构 | 已有测试全部通过 | 新增测试覆盖重构逻辑 |
| 国际化 | 无 | 手动验证即可 |

### 7.2 后端测试

```bash
cd backend && python -m pytest tests/ -v
```

当前 80+ 个测试用例。新增后端路由或修改现有路由时，必须添加对应测试。

### 7.3 前端测试

```bash
cd frontend && npm test
```

当前 15 个测试用例（Vitest + React Testing Library）：

| 文件 | 测试内容 | 数量 |
|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|
| `configs.test.ts` | 列配置完整性验证（商品/订单/进销存/BBCC/传统等） | 8 |
| `Toast.test.tsx` | Toast 显示/自动消失/撤销按钮 | 3 |
| `utils.test.ts` | 默认列选择/仓库标签/订单状态 | 4 |

新增前端组件或修改现有组件逻辑时，必须添加对应测试。

### 7.4 测试验收标准

```
✅ 通过：新功能/修复有对应测试覆盖，且测试全部通过
⚠️ 警告：功能正常但无测试覆盖（需在 commit 中说明原因）
❌ 不通过：功能正常但有测试失败
```

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 八、提交前自动化检查（严格标准）

### 8.1 必须配置的自动化检查

以下检查必须在每次提交前自动运行，**不允许手动跳过**：

```bash
# 1. 括号匹配检查（防止 JSX 语法错误）
find src -name '*.tsx' -o -name '*.ts' | while read f; do
  node -e "const fs=require('fs');const s=fs.readFileSync('$f','utf8');const po=(s.match(/\(/g)||[]).length,pc=(s.match(/\)/g)||[]).length;const bo=(s.match(/\{/g)||[]).length,bc=(s.match(/\}/g)||[]).length;if(po!==pc||bo!==bc){console.log('❌ 括号不匹配: $f');process.exit(1)}" 2>/dev/null
done

# 2. import.meta.env 拼写检查
grep -rn "import.meta\.einv" src/ && echo "❌ import.meta.env 被误改" && exit 1

# 3. t() 引号包裹检查
grep -rn "'{t(\"" src/ && echo "❌ t() 在字符串中" && exit 1

# 4. height/borderRadius 不带 px 单位
grep -rn "height:[0-9]\+px\|borderRadius:[0-9]\+px" src/ --include='*.tsx' && echo "❌ 数字值带 px 单位" && exit 1

# 5. 重复导入检查
grep -rn "import.*from.*locale" src/ | sort | uniq -d && echo "❌ 重复导入" && exit 1

echo "✅ 全部检查通过"
```

### 8.2 建议配置的自动化检查

```bash
# 6. 前端测试
cd frontend && npm test || exit 1

# 7. 后端测试
cd backend && python -m pytest tests/ -v || exit 1

# 8. TypeScript 类型检查
cd frontend && npx tsc --noEmit || exit 1
```

### 8.3 提交前核对清单

```bash
# 一键执行全部检查
echo "=== 1. 括号匹配 ==="
find src -name '*.tsx' -o -name '*.ts' | while read f; do
  node -e "const fs=require('fs');const s=fs.readFileSync('$f','utf8');const po=(s.match(/\(/g)||[]).length,pc=(s.match(/\)/g)||[]).length;const bo=(s.match(/\{/g)||[]).length,bc=(s.match(/\}/g)||[]).length;if(po!==pc||bo!==bc)console.log('FAIL: $f')" 2>/dev/null
done

echo "=== 2. import.meta.env ==="
grep -rn "import.meta\.einv" src/ && echo "❌" || echo "✅"

echo "=== 3. t() 在字符串中 ==="
grep -rn "'{t(\"" src/ && echo "❌" || echo "✅"

echo "=== 4. height/borderRadius 单位 ==="
grep -rn "height:[0-9]\+px\|borderRadius:[0-9]\+px" src/ --include='*.tsx' && echo "❌" || echo "✅"

echo "=== 5. 重复导入 ==="
grep -rn "import.*from.*locale" src/ | sort | uniq -d && echo "❌" || echo "✅"

echo "=== 6. 未提交文件 ==="
git status --short
```

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 九、代码审查（严格标准）

### 9.1 审查流程

```
提交 PR → 至少 1 人审查 → 通过 → 合并到 main
```

### 9.2 审查 checklist

| 审查项 | 必须通过 |
|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

--|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|
| 功能正确性 | 功能按预期工作 |
| 测试覆盖 | 新功能/修复有对应测试 |
| 国际化 | 所有新增文本使用 `t()` |
| 样式 | 使用 CSS 类而非内联样式 |
| 类型 | 新增 Props 有接口定义 |
| 兼容性 | 深色/浅色模式正常 |
| 构建 | `npm run build` 通过 |
| 测试 | `npm test` + `pytest` 通过 |

### 9.3 单人项目替代方案

当前项目为单人开发，没有审查者。替代方案：

```
改代码前 → 写好测试 → 自审查（对照 9.2 checklist）
         → 提交前跑自动化检查
         → 提交后等 Cloudflare 构建通过
         → 构建失败则立即修复
```

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 十、国际化规范

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---




## 十一、版本控制

### 12.1 Commit 格式

```
<type>: <description>
feat: 新功能 | fix: Bug | refactor: 重构 | docs: 文档 | test: 测试 | style: 样式 | chore: 杂项
```

### 12.2 分支策略

- `main` 分支直接部署到生产环境
- 推送到 `main` 自动触发 Cloudflare Pages 构建

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 十二、提交前核对清单（手动备用）

> 自动化检查尚未完全实现时，手动执行以下命令作为替代。

### 12.1 JSX 内联样式常见错误

| 错误写法 | 正确写法 | 报错 |
|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|
| `height:26px` | `height:26` 或 `height:'26px'` | `Syntax error "p"` |
| `borderRadius:32px` | `borderRadius:32` 或 `borderRadius:'32px'` | 同上 |
| `padding:'0 2px'` | 字符串值正确，注意引号 | 无 |
| `color:''` | 空字符串会被 React 忽略，回退到 CSS 类 | 无 |

### 12.2 手动检查命令

```bash
# 1. 检查 t() 引号包裹
grep -rn "'{t(\"" src/
grep -rn "'t(" src/

# 2. 检查 CSS class 同名冲突
grep -o '\.[a-zA-Z][a-zA-Z0-9_-]*{' src/*.css | sed 's/{//' | sort | uniq -c | sort -rn | head -10

# 3. 检查未提交文件
git status --short

# 4. 检查括号平衡
find src -name '*.tsx' | while read f; do
  node -e "const fs=require('fs');const s=fs.readFileSync('$f','utf8');const po=(s.match(/\(/g)||[]).length,pc=(s.match(/\)/g)||[]).length;const bo=(s.match(/\{/g)||[]).length,bc=(s.match(/\}/g)||[]).length;if(po!==pc||bo!==bc)console.log('FAIL: $f')" 2>/dev/null
done

# 5. 检查 height/borderRadius 不带 px 单位
grep -rn "height:[0-9]\+px" src/ --include='*.tsx'
grep -rn "borderRadius:[0-9]\+px" src/ --include='*.tsx'

# 6. 检查 import.meta.env 拼写
grep -rn "import.meta\.einv" src/

# 7. 检查重复导入
grep -rn "import.*from.*locale" src/ | sort | uniq -d
```

### 12.3 最常踩的 5 个坑

1. **`height:26px` 语法错误** → 数字值不带 px，字符串值要加引号
2. **JSX 花括号不匹配** → 修改 JSX 后运行括号检查
3. **`t()` 被引号包裹** → `'{t("key")}'` 显示原文，改为 `{t("key")}`
4. **CSS class 同名冲突** → 两个不同用途的类撞名时属性互相污染
5. **`backdrop-filter` 只写了标准属性** → 必须同时写 `-webkit-backdrop-filter` 兼容 Safari

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 十三、常见问题

| 问题 | 原因 | 解决 |
|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---

|
| 页面空白 | `import.meta.env` 被 sed 误改 | 检查 `import.meta.env` |
| API 500 错误 | 后端 `import os` 缺失 | 加 `import os` |
| 深色模式文字看不清 | Chart series label 未注入颜色 | Chart 组件已自动处理 |
| 横屏菜单按钮被遮挡 | 缺少 `safe-area-inset-left` | header 已加 padding |
| 按钮高度不一致 | `box-sizing` 不一致 | 统一 `box-sizing:border-box` |
| 玻璃态模糊不生效 | 缺少 `-webkit-backdrop-filter` | 同时写两个属性 |
---

## 十、开发经验总结（2026-08-21）

### 数据库
1. **WAL vs DELETE 模式**：WAL 读写并发（seed 填充写 12 万订单期间读不阻塞），DELETE 读写互斥（页面全卡）。PA 环境 WAL 有文件损坏风险，用启动自检 + .gz 备份自动恢复兜底。
2. **auto_vacuum=INCREMENTAL**：DELETE 后空间自动回收，不需要独占锁（规避 VACUUM 被锁问题）。
3. **VACUUM 阈值**：数据库真实大小 99MB，阈值设 80MB 太小会导致反复触发 VACUUM 锁死所有接口。应设 > 数据库真实大小（如 150MB）。
4. **线程池 `max_workers`**：`max_workers=2` 太小，1 个卡死任务就堵死。应设 4+，配合启动时清理 running 超 10 分钟的任务。
5. **`_seed_builtin_rules` 必须用 `get_conn()`**：直接 `sqlite3.connect` 无 `row_factory`，污染主线程连接导致 `dict(r)` 报错（"cannot convert dictionary update sequence element #0 to a sequence"）。
6. **压缩备份**：VACUUM INTO + gzip，备份体积减半，防止撑爆 PA 配额。

### ORM / Builder 模式
7. **`insert({...})` 必须调 `.execute()`**：`db.table().insert({...})` 只创建 Builder，不执行 INSERT。必须 `.execute()`（3 处变更历史 insert 缺 execute 导致从未写入）。

### 任务系统
8. **任务类型 `channel='all'`**：全局任务（seed/reset）不区分渠道，标记 `channel='all'`，查询时 `WHERE channel=? OR channel='all'`。
9. **任务卡片步骤可视化**：`/api/tasks` 返回 steps 字段（`result` 中解析），前端卡片显示步骤明细（✓ 完成/… 进行中/✗ 失败 + 耗时）。
10. **页面回前台即时刷新**：`visibilitychange` + `focus` 事件触发数据刷新，不等 setInterval（挂后台回来时立即看到最新进度）。

### 缓存
11. **缓存命中与 miss 返回格式必须一致**：后端缓存命中返回 `ok(cached['data'])` 统一格式；前端缓存命中也要解包 `{ok,data}`（与拦截器一致），否则 `Array.isArray` 判断失败。
12. **内存缓存注意保存时失效**：rules/replenishment-config 加 30s 内存缓存，创建/更新/删除时清空缓存。

### 前端
13. **模块级代码不能引用未导入的变量**：`TYPE_LABEL` 引用未 import 的 `IconUndo` → 模块加载时抛 ReferenceError → 整个 JS bundle 加载失败 → 页面空白（连登录页都不显示）。
14. **API 变量用 `import.meta.env`**：不要硬编码，保持与所有文件一致的环境变量配置。

### PA 环境
15. **免费版 512MB 配额 + 不稳定文件系统**：WAL 损坏、write error 是环境问题，非代码 bug。需要启动自检 + 自动恢复 + 压缩备份兜底。长期建议升级付费版或迁移轻量服务器。

---



## 十四、2026-08-07 关键改进记录

### 14.1 性能优化（10 万单量级）
- 统一日销数据源：`load_daily_sales`（快照历史 + 当天 orders），消除重复计算
- SQL 级过滤 + 8 个索引，补货/滞销/进销存查询大幅提速
- `calc_sales_from_daily` 预计算日期列表，消除 8 万次 datetime 调用
- 告警批量处理：2000 次独立查询 → 3 次（executemany）
- 一键填充：12 分钟 → 2.5 分钟（订单 executemany 5.4x，规则引擎批量 1000x）
- with-sales 结果缓存 30s（版本号校验）

### 14.2 渠道隔离（jd/other 全链路）
- 告警/规则/供应商/已下单/出入库全部按 channel 隔离
- `evaluate()` 按 channel 过滤规则；`sku_to_channel()` 从 products 主表推断渠道
- 供应商 code 加渠道后缀，避免两渠道 upsert 互相覆盖
- 清洗页渠道标记与全局渠道联动 + UI 明确导入目标

### 14.3 可靠性（存储配额 + 任务持久化）
- **存储配额根治**：40 个每日备份（2-3GB）撑爆 512MB → 备份只保留 7 个 + 每日磁盘自检 + WAL checkpoint
- **任务状态持久化**：sync_tasks 表（task_id 列），跨重启可恢复 status/result/steps
- 健康检查加 integrity quick_check + WAL 监控
- 启动时自动 WAL checkpoint；seed 后 WAL checkpoint
- 数据归档惰性兜底（with-sales 请求时每天检查一次）

### 14.4 加载/骨架屏防卡死
- `loadReplen` 独立 seq（不再与外层 useEffect 共享 reqSeq）
- InventoryPage/DashboardPage 竞态丢弃时关闭 loading
- 前端任务轮询 not_found 容错（重试 3 次）
- 欢迎页"开始体验"与一键填充联动修复（task_id 存储 + requires_reset 处理）

### 14.5 规则引擎组合表达式
- 四则运算支持：可用+在途 / 安全线-可用 / 可用/日销（可撑天数）/ 订单数量×单价
- 定时任务注入日销，支持断货风险类规则
- 告警按 source 区分（replenishment_engine / rules_engine），口径统一不误关
- 规则引擎紧急补货考虑在途（可用+在途≤安全线才算真紧急）

### 14.7 APM 监控
- 内存聚合请求统计（总请求/平均耗时/错误率/慢接口 TOP10）
- 慢请求（>5s）持久化到 quality_logs
- 公开接口 `GET /api/monitor`

### 14.8 认证系统
- 纯标准库 JWT（HMAC-SHA256），零外部依赖
- users 表（username/password_hash/role），预留多用户
- 后端正中件强制鉴权，访客模式只读
- JWT SECRET 持久化到数据库（启动时自动生成/恢复）

### 14.8 代码质量
- 裸 except 全部处理：ALTER TABLE 精确捕获 OperationalError，业务路径带日志
- products.py 搜索 `|` 运算符 → `or_()` 方法
- Pydantic Schema 入参校验（9 个）
- 前端 localStorage 全部 try-catch（store 18 处 safeGet）

### 14.6 种子数据增强
- 12% SKU 全仓低库存（含自有仓，触发采购场景）
- 填充后立即构建日销快照
- seed 前检测已有数据（requires_reset 保护）
- 供应商 code 渠道后缀

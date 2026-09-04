# 真实数据上线 Checklist（2026-09-04 沉淀）

> 背景：本项目为生产环境（当前最后阶段测试，使用 seed 数据）。若切真实数据，以下为必做防护——本次事故（代码语法→全 500、误删库、JWT 失效）在真实数据下后果放大数倍。

## 1. 代码层（本次已修复 ✅）
- [x] seed.py 批量写入改用 `%s` 拼接（**Python 3.11 兼容**——本地 3.12 测试会漏检 3.11 语法，本次事故根因）
- [x] main.py JWT_SECRET 前置到 auth import 前（重启后 token 不再失效）
- [x] 自愈钩子覆盖"db 缺失/过小"场景（不只 quick_check）
- [x] init_db 失败落盘日志（不再静默 0 表）
- [x] health 快照判定容差 1 天（快照到昨天即新鲜）
- [x] WAL checkpoint 按需（>15MB）+ 互斥锁（防阻塞）
- [x] 冗余 `backend/main.py` 已删（唯一入口 `backend/app/main.py`）
- [x] 数据库碎片监控（health 只读 PRAGMA，零阻塞；freelist>2000 页才提示手动 VACUUM——**不做定时回收防请求阻塞**）

## 2. 上线前必做（新）
- [x] **部署门禁**：CI `deploy-backend.yml` 已加 Python 语法门禁——目标版本参数化
  - `env.BACKEND_PY_VERSION: "3.11"`（PA 运行版本），上传前 `py_compile` 全项目
  - **防"本地 3.12 测试通过/线上 3.11 崩"**（本次 root cause 若早期拦截可免全 500）
- [x] **异地备份**：`.github/workflows/backup-offsite.yml` 每日 02:30 UTC 拉取 PA 最新 `.bak.gz` → GitHub Release（保留 7 份，幂等 + gzip 校验 + 自动清理）——**GitHub 与 PA 完全异地**，线上链路已验证（下载 25.9MB OK）
- [ ] **误删防护**：移除任何"直接删 supplykit.db"的运维操作；新增 `diag-orders?action=backup_now` 手动备份入口
- [ ] **真实数据演练**：切数据前用真实数据副本做 1 次全链路回归（12 接口 + 前端页面）

## 3. 上线后监控（新）
- [ ] quota ≥70% 预警（已有 80/90 阈值，建议调低）
- [x] health 自动 checkpoint 已生效（每请求检查 WAL>15MB 才触发）
- [ ] 告警：scheduler 每 6h 快照新鲜度自检（已有）+ 每日备份成功日志

## 3.5 备份恢复演练（每月，正式上线前必做 1 次）
- [ ] **下载**：从 GitHub Release 下载最新 `backup-YYYYMMDD` 资产（`gh release download backup-<date>`）
- [ ] **校验**：`gzip -t backup.gz` + 解压后 `PRAGMA integrity_check` + 抽样核对 orders 总数（对照 CHANGELOG 记录值）
- [ ] **重建**：停 PA app → 上传解压的 db 至 `supplykit.db` → 重启 → 验证 health ok + 关键业务（orders/summary/补货/采购）全 200
- [ ] **记录**：演练日期/耗时/结果记录到 CHANGELOG，异常则排查备份链路（PA 本地备份 → 拉取 → Release）

## 4. 后端迁移 Checklist（Python 版本/平台变更时）

> CI 门禁已参数化（`BACKEND_PY_VERSION`），迁移不阻碍——按下面三步走：

- [ ] **1. 改门禁目标版本**：`.github/workflows/deploy-backend.yml` 顶层 `env.BACKEND_PY_VERSION` 改为迁移目标版本（如 `"3.12"`）——门禁自动用新版本验证，允许新语法且仍能捕获真实语法错误
- [ ] **2. 目标版本全量测试**：门禁只 `py_compile`（语法层），迁移后用目标版本跑完整测试套件（`pytest tests/` 117 用例）确认运行期兼容——重点核查 `datetime.UTC`/typing 泛型等 3.9+ API 差异
- [ ] **3. 依赖兼容确认**：`requirements.txt` 全部依赖在目标版本有轮子/兼容（尤其 PA 免费版仅 3.11——迁移到其他平台前先确认其 Python 版本支持）
- [ ] （可选）利用新版本特性时注意：门禁校验的是"能在目标版本编译"，不代表能在旧的 3.11 编译——若需双版本兼容，`BACKEND_PY_VERSION` 保持较低版本即可当"最低兼容底线"
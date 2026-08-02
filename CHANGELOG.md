# SupplyKit 更新日志

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

## 当前已知问题
1. Chart 组件 ECharts 初始化偶发失败
# SupplyKit 开发规范

## 一、项目定位

SupplyKit 是**电商供应链数据清洗与补货决策看板**，定位为 ERP 与 Excel 之间的"中间层工具"——不做 ERP 的流程管理，也不替代 Excel 的灵活性。

### 核心原则
- 看板 + 补货决策为最主要核心
- 数据经过清洗、规则引擎、补货建议，最终输出决策
- 不替代 ERP 的核心流程管理
- 不与 Excel 竞争，而是互补——SupplyKit 做自动化，Excel 做灵活性

---

## 二、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 18 |
| 语言 | TypeScript | — |
| 构建工具 | Vite | 5 |
| 状态管理 | Zustand | — |
| 图表 | ECharts | 5（按需导入） |
| 后端框架 | FastAPI | — |
| 数据库 | SQLite（WAL 模式） | — |
| 前端部署 | Cloudflare Pages | — |
| 后端部署 | PythonAnywhere | — |
| 定时任务 | APScheduler | — |
| 国际化 | 自建 i18n（无外部依赖） | — |

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
│   │   │   ├── replenishment_cache.py  # 补货建议持久化缓存 5min
│   │   │   ├── sales_utils.py   # 日销计算（三窗口 3σ 剔除 + 趋势加权）
│   │   │   ├── rules.py         # 规则引擎
│   │   │   └── scheduler.py     # APScheduler 定时任务
│   │   └── api/routes/          # 19 个路由模块
│   └── tests/                   # 80+ 个后端测试
│
└── docs/
    └── DEVELOPMENT.md
```

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
|------|------|------|
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

## 七、测试规范（严格标准）

### 7.0 核心原则：测试先于代码

```
改代码前 → 先写测试 → 确认测试失败 → 改代码 → 确认测试通过
```

所有功能修改、bug 修复、重构，必须遵循此流程。

### 7.1 测试覆盖要求

| 变更类型 | 必须覆盖的测试 | 最低要求 |
|---------|-------------|---------|
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
|------|---------|------|
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

## 九、代码审查（严格标准）

### 9.1 审查流程

```
提交 PR → 至少 1 人审查 → 通过 → 合并到 main
```

### 9.2 审查 checklist

| 审查项 | 必须通过 |
|--------|---------|
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

## 十、国际化规范

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

## 十二、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 页面空白 | `import.meta.env` 被 sed 误改 | 检查 `import.meta.env` |
| API 500 错误 | 后端 `import os` 缺失 | 加 `import os` |
| 深色模式文字看不清 | Chart series label 未注入颜色 | Chart 组件已自动处理 |
| 横屏菜单按钮被遮挡 | 缺少 `safe-area-inset-left` | header 已加 padding |
| 按钮高度不一致 | `box-sizing` 不一致 | 统一 `box-sizing:border-box` |
| 玻璃态模糊不生效 | 缺少 `-webkit-backdrop-filter` | 同时写两个属性 |
# SupplyKit 开发规范

## 一、项目定位

SupplyKit 是**电商供应链数据清洗与补货决策看板**，定位为 ERP 与 Excel 之间的"中间层工具"——不做 ERP 的流程管理，专注看板展示和补货决策。

### 核心原则
- 看板 + 补货决策为最主要核心
- 数据经过清洗、规则引擎、补货建议，最终输出决策
- 不替代 ERP 的核心流程管理

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
│   │   ├── App.tsx              # 主入口
│   │   ├── main.tsx             # 挂载点
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
│   │   │   ├── database.py      # SQLiteDB（DB_LOG 环境变量控制日志）
│   │   │   ├── dashboard_cache.py
│   │   │   ├── rules.py
│   │   │   └── scheduler.py
│   │   └── api/routes/          # 路由模块
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

### 4.2 React 组件

```tsx
export default function ComponentName({ prop1, prop2 }: { prop1: string; prop2?: number }) {
  // ...
}
```

- **函数组件**，不使用 class 组件（ErrorBoundary 除外）
- **默认导出**：`export default function Xxx()`

### 4.3 CSS 规范

**圆角统一**
- 全局 `.card` 圆角 `32px`
- 搜索框/下拉框/输入框圆角 `32px`
- 胶囊按钮 `border-radius: 99px`
- 骨架屏 `border-radius: 8px`（保持小圆角）
- 特殊卡片（GMV/库存健康度/待处理）通过 `borderRadius` 属性覆盖

**玻璃态变量**
```css
--glass-bg: rgba(255,255,255,0.5);         /* 浅色模式 */
--glass-blur: 40px;
--glass-border: rgba(255,255,255,0.6);
/* 深色模式自动切换 */
```

**横屏适配**
- `@media(orientation:landscape) and (max-height:550px)` 触发
- 适配内容包括：header 缩小、容器 padding 优化、卡片网格 4 列、dashboard-body flex 自适应布局
- `env(safe-area-inset-left/right)` 适配横屏安全区

**CSS 变量**：使用 `var(--text)` / `var(--muted)` / `var(--primary)` 等，避免硬编码颜色
- `--text`: 正文色（浅色 `#0f172a`，深色 `#f1f5f9`）
- `--muted`: 辅助文字色
- `--primary`: 主色（选中态文字用 `#007AFF` iOS 蓝）
- `--sidebar`: 侧边栏背景
- `--glass-bg/blur/border`: 玻璃态

**按钮统一**
- 通用按钮：`btn-ghost` 类（半透明背景 + 玻璃态模糊）
- 选中态：`rgba(128,128,128,0.2)` 灰色背景 + `#007AFF` 蓝色文字 + 加粗
- 胶囊切换器：外容器 `display:flex; gap:6; background:var(--glass-bg); border-radius:99; padding:6`

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

## 七、测试规范

### 7.1 后端测试

```bash
cd backend && python -m pytest tests/ -v
```

### 7.2 前端测试

```bash
cd frontend && npm test
```

---

## 八、国际化规范

项目使用自建轻量级 i18n 方案，无外部依赖，中英双语，自动检测系统语言。

### 8.1 翻译键命名

```
模块.具体描述
├── app.name              # 应用名称
├── nav.dash              # 导航
├── common.search         # 通用
├── dash.funnel           # 看板
└── rules.new             # 规则
```

### 8.2 使用方式

```tsx
import { t } from '../locale'

// 正确：在 JSX 表达式中使用
<div>{t('common.search')}</div>

// 错误：在字符串中使用
<div>'{t("common.search")}'</div>  // ❌

// 正确：字符串拼接
<EmptyState title={t('order.empty')} />
```

### 8.3 添加新翻译

1. 在 `locale.ts` 的 `zh` 和 `en` 对象中添加键值对
2. 在代码中使用 `t('key')` 调用
3. 保持中英文键名一致
4. 所有用户可见文本必须使用 `t('key')` 调用

### 8.4 国际化检查

```bash
# 检查 t() 是否在字符串中（错误用法）
grep -rn "'{t(" src/
grep -rn "'t(" src/

# 检查所有 t() 键是否在 locale.ts 中存在
grep -rn "t(\"" src/ | grep -oP 't\("[a-z_]+\.[a-z_]+"\)' | sort -u | while read k; do
  key=$(echo "$k" | sed 's/t("//;s/")//')
  if ! grep -q "'$key'" src/locale.ts; then
    echo "MISSING: $key"
  fi
done
```

---

| 位置 | 触发方式 | 内容 |
|------|---------|------|
| API 请求日志（main.py） | 默认开启 | `[API] GET /api/xxx 123ms 200`，>500ms 标 warning |
| 数据库查询（database.py） | 环境变量 `DB_LOG=1` | `[DB] query orders → 28 rows` |
| 日销计算（insights.py） | 环境变量 `SALES_LOG=1` | `[SALES] cutoff=28d wh=None → 5 SKU有销量` |
| 前端 API 调用（client.ts） | DevTools Verbose | `[API] GET /api/xxx → 200` |

---

## 九、版本控制

### 9.1 Commit 格式

```
<type>: <description>
feat: 新功能 | fix: Bug | refactor: 重构 | docs: 文档 | test: 测试 | style: 样式 | chore: 杂项
```

### 9.2 分支策略

- `main` 分支直接部署到生产环境
- 推送到 `main` 自动触发 Cloudflare Pages 构建

---

## 十、提交前代码检查清单

### 10.1 JSX 内联样式常见错误

| 错误写法 | 正确写法 | 报错 |
|---------|---------|------|
| `height:26px` | `height:26` 或 `height:'26px'` | `Syntax error "p"` |
| `borderRadius:32px` | `borderRadius:32` 或 `borderRadius:'32px'` | 同上 |
| `padding:'0 2px'` | 字符串值正确，注意引号 | 无 |
| `color:''` | 空字符串会被 React 忽略，回退到 CSS 类 | 无 |

### 10.2 构建前检查

```bash
# 1. height 语法错误
grep -rn "height:[0-9]\+px" src/pages/ src/components/ --include='*.tsx'

# 2. borderRadius 带单位
grep -rn "borderRadius:[0-9]\+px" src/pages/ src/components/ --include='*.tsx'

# 3. 括号匹配
find src -name '*.tsx' | while read f; do
  node -e "const fs=require('fs');const s=fs.readFileSync('$f','utf8');const po=(s.match(/\(/g)||[]).length,pc=(s.match(/\)/g)||[]).length;const bo=(s.match(/\{/g)||[]).length,bc=(s.match(/\}/g)||[]).length;if(po!==pc||bo!==bc)console.log('FAIL: $f')" 2>/dev/null
done

# 4. import.meta.env 完整性
grep -rn "import.meta\.einv" src/
```

### 10.3 常见报错及原因

| 构建错误 | 最常见原因 | 检查方法 |
|---------|-----------|---------|
| `Syntax error "p"` | `height:26px` 等无效 JS 语法 | `grep "height:[0-9]\+px" src/` |
| `The character "}" is not valid inside a JSX element` | 多余花括号 | 括号匹配检查 |
| `Cannot find module` | 导入路径错误 | 检查相对路径 `../` 层级 |
| 页面空白无报错 | `import.meta.env` 被 sed 误改 | `grep "import.meta.einv" src/` |

### 10.4 最常踩的 5 个坑

1. **`height:26px` 语法错误** → 数字值不带 px，字符串值要加引号
2. **JSX 花括号不匹配** → 修改 JSX 后运行括号检查
3. **`import os` 缺失** → 后端新增 `os.getenv()` 调用时记得加 `import os`
4. **`borderRadius:32` 跟 `borderRadius: 32` 不一致** → sed 替换时注意空格
5. **`backdrop-filter` 只写了标准属性** → 必须同时写 `-webkit-backdrop-filter` 兼容 Safari

---

## 十一、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 页面空白 | `import.meta.env` 被 sed 误改 | 检查 `import.meta.env` |
| API 500 错误 | 后端 `import os` 缺失 | 加 `import os` |
| 深色模式文字看不清 | Chart series label 未注入颜色 | Chart 组件已自动处理 |
| 横屏菜单按钮被遮挡 | 缺少 `safe-area-inset-left` | header 已加 padding |
| 按钮高度不一致 | `box-sizing` 不一致 | 统一 `box-sizing:border-box` |
| 玻璃态模糊不生效 | 缺少 `-webkit-backdrop-filter` | 同时写两个属性 |
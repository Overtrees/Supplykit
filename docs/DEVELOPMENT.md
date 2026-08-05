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
│   │   ├── App.tsx              # 主入口（391 行）
│   │   ├── main.tsx             # 挂载点
│   │   ├── locale.ts            # 国际化翻译（150+ 键）
│   │   ├── types.ts             # 全局类型定义
│   │   ├── theme.ts             # 主题配置
│   │   ├── version.ts           # 版本信息
│   │   ├── api/
│   │   │   └── client.ts        # API 客户端（缓存+在途去重）
│   │   ├── store/
│   │   │   └── useAppStore.ts   # Zustand 全局状态
│   │   ├── pages/               # 页面组件（10 个）
│   │   ├── components/          # 通用组件
│   │   │   ├── Chart.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Loading.tsx
│   │   │   ├── Icons.tsx
│   │   │   └── hammer/          # 锤子菜单组件（8 个）
│   │   ├── tests/               # 前端测试
│   │   └── styles.css           # 全局样式 + CSS 变量
│   ├── vitest.config.ts
│   └── public/
│       ├── sw.js
│       └── manifest.json
│
├── backend/                     # 后端
│   ├── app/
│   │   ├── main.py
│   │   ├── core/                # 10 个核心模块
│   │   └── api/routes/          # 19 个路由模块
│   └── tests/                   # 80 个后端测试
│
└── docs/
    └── DEVELOPMENT.md
```

---

## 四、代码规范

### 4.1 TypeScript

- **所有组件必须有 Props 接口**：`interface XxxProps { ... }`
- **避免 `any` 类型**：优先使用具体类型或泛型
- **函数参数和返回值必须标注类型**
- **Store 状态必须有接口定义**：`AppState` / `AppActions`

### 4.2 React 组件

```tsx
interface ComponentNameProps {
  prop1: string
  prop2?: number
}

export default function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  // ...
}
```

- **函数组件**，不使用 class 组件（ErrorBoundary 除外）
- **默认导出**：`export default function Xxx()`
- **Props 解构**在函数参数中

### 4.3 国际化

```tsx
import { t } from '../locale'

// 正确：在 JSX 表达式中使用
<div>{t('common.search')}</div>

// 错误：在字符串中使用
<div>'{t("common.search")}'</div>  // ❌

// 正确：字符串拼接
<EmptyState title={t('order.empty')} />
```

- 所有用户可见文本必须使用 `t('key')` 调用
- 翻译键命名：`模块.描述`（如 `dash.healthy`、`common.search`）
- 中英文键必须同时维护

### 4.4 CSS

- **优先使用 CSS 工具类**，减少 `style={{}}` 内联样式
- 可用工具类：布局（`.flex` `.flex-center` `.flex-between`）、间距（`.gap-4` `.mb-8`）、文字（`.text-12` `.font-600`）、颜色（`.muted` `.bg-card`）、圆角（`.rounded-32`）、锤子菜单（`.hammer-header` `.hammer-btn` `.hammer-tab` `.hammer-panel`）
- **CSS 变量**：使用 `var(--radius-lg)` 而非 `32px` 等魔法数字
- **按钮统一**：`btn-ghost hammer-btn`（不用 `btn` 类，`btn` 有 `padding: 8px 20px` 更大）

---

## 五、数据流规范

### 5.1 渠道隔离

所有数据按 `channel`（jd/other）隔离：
- API 自动注入 `?channel=` 参数
- 缓存 key 包含 `channel` 参数
- 切换渠道时调用 `clearCache()` + `clearInflight()`

### 5.2 API 缓存

- **dashboard**：内存缓存 15s + 渠道隔离
- **补货建议**：持久化缓存 5min + 数据版本号
- **日销快照**：`daily_sales_snapshot` 表，每天凌晨 3:30 构建
- **在途去重**：同一请求未完成时复用

### 5.3 数据归档

- 订单超 90 天自动聚合为 `daily_stats` 行，删除原始订单
- 每天凌晨 1 点执行
- 归档后数据总量稳定在 90 万行以内

---

## 六、部署规范

### 6.1 前端部署

```bash
git push origin main → Cloudflare Pages 自动构建
```

### 6.2 后端部署

```bash
curl -X POST -H "Authorization: Token $PYTHONANYWHERE_TOKEN" \
  -F "content=@file" \
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

80 个测试用例，覆盖规则引擎、日销计算、数据库 CRUD。

### 7.2 前端测试

```bash
cd frontend && npm test
```

12 个测试用例（Vitest + React Testing Library），覆盖列配置、Toast 组件、工具函数。

---

## 八、国际化规范

### 8.1 翻译键命名

```
模块.具体描述
├── common.search        # 通用
├── nav.dash             # 导航
├── dash.funnel          # 看板
├── settings.connection  # 设置
└── rules.new            # 规则
```

### 8.2 添加新翻译

1. 在 `locale.ts` 的 `zh` 和 `en` 对象中添加键值对
2. 在代码中使用 `t('key')` 调用
3. 保持中英文键名一致

---

## 九、版本控制

### 9.1 Commit 格式

```
<type>: <description>
feat: 新功能 | fix: Bug | refactor: 重构 | docs: 文档 | test: 测试 | style: 样式
```

### 9.2 分支策略

- `main` 分支直接部署到生产环境
- 推送到 `main` 自动触发 Cloudflare Pages 构建

---

## 十、提交前代码检查清单

### 10.1 sed 安全原则（最常踩坑）

| sed 操作 | 踩过的坑 | 正确做法 |
|---------|---------|---------|
| `s/nv\./inv./g` | 匹配了 `import.meta.env.VITE` → `einv`，页面空白 | 优先用 `node -e` 脚本做精确替换 |
| `s/ash\./dash./g` | `dash.healthy` 含 `ash.` → `ddash.healthy` | 替换前确认不匹配子串 |
| `s/ules/rules/g` | `filteredRules` → `filteredRrules` | 加单词边界 `\bules\b` |
| `s/ommon\./common./g` | `common.` → `ccommon.` | 同上 |

**原则**：先 `grep` 确认匹配范围，再执行 sed；替换后 `grep` 确认没有意外修改。

### 10.2 国际化检查

```bash
# 检查 t() 是否在字符串中（错误用法）
grep -rn "'{t(" src/
grep -rn "'t(" src/

# 检查所有 t() 键是否在 locale.ts 中存在
node -e "
const fs=require('fs');
const loc = fs.readFileSync('src/locale.ts','utf8');
const keys = new Set((loc.match(/'([a-z_]+\.[a-z_]+)'/g)||[]).map(k=>k.replace(/'/g,'')));
const files = [];
const walk=(d)=>{fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{const p=d+'/'+e.name;if(e.isDirectory()&&!['node_modules','.git'].includes(e.name))walk(p);else if(e.name.endsWith('.tsx')||e.name.endsWith('.ts'))files.push(p)})};
walk('src');
files.forEach(f=>{
  const s=fs.readFileSync(f,'utf8');
  (s.match(/t\(\"([a-z_]+)\.([a-z_]+)\"\)/g)||[]).forEach(c=>{
    const k=c.replace(/t\(\"/,'').replace(/\"\)/,'');
    if(!keys.has(k)) console.log('MISSING: '+k+' in '+f.replace('src/',''));
  })
})
"

# 检查 import.meta.env 是否被误改
grep -rn "import.meta.einv" src/
```

### 10.3 构建前检查

```bash
# 重复导入
grep -rn "import.*from.*locale" src/ | sort | uniq -d

# import.meta.env 完整性
grep -rn "import.meta\." src/ | grep -v "import.meta.env"

# CSS 类名拼写
grep -rn "className=" src/ | grep -oP 'className="([^"]*)"' | sort -u | while read c; do
  cls=$(echo "$c" | grep -oP '"[^"]*"' | tr -d '"')
  for cl in $cls; do
    if ! grep -q "\.$cl" src/styles.css 2>/dev/null; then
      echo "UNKNOWN CSS CLASS: $cl"
    fi
  done
done
```

### 10.4 常见报错及原因

| 构建错误 | 最常见原因 | 检查方法 |
|---------|-----------|---------|
| `Expected ":" but found "channel"` | `t()` 在字符串内 | `grep "'{t(" src/` |
| `Duplicate key in object literal` | locale.ts 中重复键 | `grep -n "'key'" src/locale.ts` |
| `Cannot find module` | 导入路径错误 | 检查相对路径 `../` 层级 |
| `Can't find variable: xxx` | sed 误改变量名 | `grep -rn "xxx" src/` |
| 页面空白无报错 | `import.meta.einv` | `grep -rn "import.meta.einv" src/` |
| `Unexpected closing fragment tag` | `</>` 不匹配 `<>` | 检查 `return <>` 和 `</>` 配对 |

### 10.5 提交前快速检查命令

```bash
echo "=== 1. import.meta.env ==="
grep -rn "import.meta\.einv" src/ && echo "❌ 有误" || echo "✅ 通过"

echo "=== 2. t() 在字符串中 ==="
grep -rn "'{t(" src/ && echo "❌ 有误" || echo "✅ 通过"

echo "=== 3. 括号匹配 ==="
find src -name "*.tsx" -o -name "*.ts" | while read f; do
  node -e "const fs=require('fs');const s=fs.readFileSync('$f','utf8');const po=(s.match(/\(/g)||[]).length,pc=(s.match(/\)/g)||[]).length;const bo=(s.match(/\{/g)||[]).length,bc=(s.match(/\}/g)||[]).length;if(po!==pc||bo!==bc)console.log('FAIL: $f')" 2>/dev/null
done
echo "✅ 完成"

echo "=== 4. 重复导入 ==="
grep -rn "import.*from.*locale" src/ | sort | uniq -d && echo "❌ 有误" || echo "✅ 通过"
```

### 10.6 最常踩的 5 个坑

1. **sed 替换** → 永远优先用 `node -e` 脚本，不要用 sed 做模糊匹配
2. **t() 在字符串中** → 加新翻译时检查 `t("key")` 是否在 `{}` 内
3. **import.meta.env** → 任何修改 `env` 相关文件后检查
4. **CSS 类名拼写** → 新增 className 后确认 CSS 文件中存在
5. **括号配对** → 修改 JSX 后运行括号检查脚本

---

## 十一、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 页面空白 | `import.meta.einv` 被 sed 误改 | 检查 `import.meta.env` |
| `t("key")` 显示为字面文本 | `t()` 在字符串内未包裹 JSX `{}` | 改为 `{t("key")}` |
| 显示 `key` 本身（如 `dash.healthy`） | locale.ts 找不到对应键 | 检查 locale.ts 中键名 |
| 按钮换行溢出 | 缺少 `white-space: nowrap` | 加 `white-space: nowrap` |
| 按钮大小不一致 | 混用 `btn` 和 `hammer-btn` 类 | 统一用 `btn-ghost hammer-btn` |
| SQLite 写入慢 | 超过 10 万行 | 迁移 PostgreSQL |
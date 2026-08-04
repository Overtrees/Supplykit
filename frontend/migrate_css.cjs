// 自动迁移内联样式到 CSS 类的脚本 - 仅替换安全模式
const fs = require('fs');

const replacements = [
  // 安全的样式替换：不影响布局的纯视觉样式
  [/\bstyle=\{\{fontSize:(\d+),color:'var\(--muted2\)'\}\}/g, (m, size) => `className="text-${size} muted2"`],
  [/\bstyle=\{\{fontSize:(\d+),color:'var\(--muted\)'\}\}/g, (m, size) => `className="text-${size} muted"`],
  [/\bstyle=\{\{fontSize:(\d+),color:'var\(--text\)'\}\}/g, (m, size) => `className="text-${size}"`],
  [/\bstyle=\{\{fontSize:(\d+),fontWeight:(\d+),color:'var\(--text\)'\}\}/g, (m, size, weight) => `className="text-${size} font-${weight}"`],
  [/\bstyle=\{\{fontSize:(\d+),fontWeight:(\d+)\}\}/g, (m, size, weight) => `className="text-${size} font-${weight}"`],
  [/\bstyle=\{\{fontWeight:(\d+),fontSize:(\d+)\}\}/g, (m, weight, size) => `className="font-${weight} text-${size}"`],
  [/\bstyle=\{\{color:'var\(--muted2\)'\}\}/g, 'className="muted2"'],
  [/\bstyle=\{\{color:'var\(--muted\)'\}\}/g, 'className="muted"'],
  [/\bstyle=\{\{background:'var\(--card\)'\}\}/g, 'className="bg-card"'],
  [/\bstyle=\{\{background:'var\(--bg\)'\}\}/g, 'className="bg-bg"'],
  [/\bstyle=\{\{whiteSpace:'nowrap'\}\}/g, 'className="nowrap"'],
  [/\bstyle=\{\{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'\}\}/g, 'className="truncate"'],
  [/\bstyle=\{\{overflow:'hidden'\}\}/g, 'className="overflow-hidden"'],
  [/\bstyle=\{\{accentColor:'var\(--primary\)'\}\}/g, 'className="accent-primary"'],
  [/\bstyle=\{\{border:'none'\}\}/g, 'className="border-none"'],
  [/\bstyle=\{\{boxSizing:'border-box'\}\}/g, 'className="box-border"'],
  [/\bstyle=\{\{userSelect:'none',WebkitUserSelect:'none'\}\}/g, 'className="user-select-none"'],
  // 安全的 flex 布局（不影响按钮排列）
  [/\bstyle=\{\{display:'flex',justifyContent:'space-between',alignItems:'center'\}\}/g, 'className="flex-between"'],
  [/\bstyle=\{\{flex:1\}\}/g, 'className="flex-1"'],
  [/\bstyle=\{\{width:'100%'\}\}/g, 'className="w-full"'],
  [/\bstyle=\{\{textAlign:'center'\}\}/g, 'className="text-center"'],
  [/\bstyle=\{\{textAlign:'right'\}\}/g, 'className="text-right"'],
  [/\bstyle=\{\{overflowX:'auto'\}\}/g, 'className="overflow-x-auto"'],
  [/\bstyle=\{\{overflowY:'auto'\}\}/g, 'className="overflow-auto"'],
  [/\bstyle=\{\{cursor:'pointer'\}\}/g, 'className="cursor-pointer"'],
  [/\bstyle=\{\{flexDirection:'column'\}\}/g, 'className="flex-col"'],
  [/\bstyle=\{\{flexWrap:'wrap'\}\}/g, 'className="flex-wrap"'],
];

const files = [
  'src/pages/InsightsPage.tsx', 'src/pages/RulesPage.tsx', 'src/pages/CleansingPage.tsx',
  'src/pages/SettingsPage.tsx', 'src/pages/OrdersPage.tsx', 'src/pages/ProductPage.tsx',
  'src/pages/SupplierPage.tsx', 'src/pages/QualityPage.tsx', 'src/pages/InventoryPage.tsx',
  'src/components/Sidebar.tsx', 'src/components/ConfirmDialog.tsx',
  'src/components/ErrorBoundary.tsx', 'src/components/Card.tsx',
];

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of replacements) {
    const newS = s.replace(pattern, replacement);
    if (newS !== s) {
      s = newS;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, s);
    console.log('Fixed:', file.replace('src/', ''));
  }
}
console.log('Done!');
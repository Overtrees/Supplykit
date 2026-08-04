// 自动迁移内联样式到 CSS 类的脚本
const fs = require('fs');

const replacements = [
  // 常见内联样式 → CSS 类映射
  [/\bstyle=\{\{fontSize:(\d+),color:'var\(--muted2\)'\}\}/g, (m, size) => `className="text-${size} muted2"`],
  [/\bstyle=\{\{fontSize:(\d+),color:'var\(--muted\)'\}\}/g, (m, size) => `className="text-${size} muted"`],
  [/\bstyle=\{\{fontSize:(\d+),color:'var\(--text\)'\}\}/g, (m, size) => `className="text-${size}"`],
  [/\bstyle=\{\{fontSize:(\d+),fontWeight:(\d+),color:'var\(--text\)'\}\}/g, (m, size, weight) => `className="text-${size} font-${weight}"`],
  [/\bstyle=\{\{fontSize:(\d+),fontWeight:(\d+)\}\}/g, (m, size, weight) => `className="text-${size} font-${weight}"`],
  [/\bstyle=\{\{fontWeight:(\d+),fontSize:(\d+)\}\}/g, (m, weight, size) => `className="font-${weight} text-${size}"`],
  [/\bstyle=\{\{textAlign:'center',padding:(\d+)\}\}/g, (m, pad) => `className="text-center p-${pad}"`],
  [/\bstyle=\{\{display:'flex',gap:(\d+)\}\}/g, (m, gap) => `className="flex gap-${gap}"`],
  [/\bstyle=\{\{display:'flex',alignItems:'center',gap:(\d+)\}\}/g, (m, gap) => `className="flex items-center gap-${gap}"`],
  [/\bstyle=\{\{display:'flex',justifyContent:'space-between',alignItems:'center'\}\}/g, 'className="flex-between"'],
  [/\bstyle=\{\{flex:1\}\}/g, 'className="flex-1"'],
  [/\bstyle=\{\{width:'100%'\}\}/g, 'className="w-full"'],
  [/\bstyle=\{\{textAlign:'center'\}\}/g, 'className="text-center"'],
  [/\bstyle=\{\{textAlign:'right'\}\}/g, 'className="text-right"'],
  [/\bstyle=\{\{marginBottom:(\d+)\}\}/g, (m, n) => `className="mb-${n}"`],
  [/\bstyle=\{\{marginTop:(\d+)\}\}/g, (m, n) => `className="mt-${n}"`],
  [/\bstyle=\{\{padding:(\d+)\}\}/g, (m, n) => `className="p-${n}"`],
  [/\bstyle=\{\{whiteSpace:'nowrap'\}\}/g, 'className="nowrap"'],
  [/\bstyle=\{\{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'\}\}/g, 'className="truncate"'],
  [/\bstyle=\{\{borderRadius:(\d+)\}\}/g, (m, r) => `className="rounded-${r}"`],
  [/\bstyle=\{\{background:'var\(--card\)'\}\}/g, 'className="bg-card"'],
  [/\bstyle=\{\{background:'var\(--bg\)'\}\}/g, 'className="bg-bg"'],
  [/\bstyle=\{\{color:'var\(--muted2\)'\}\}/g, 'className="muted2"'],
  [/\bstyle=\{\{color:'var\(--muted\)'\}\}/g, 'className="muted"'],
  [/\bstyle=\{\{overflow:'hidden'\}\}/g, 'className="overflow-hidden"'],
  [/\bstyle=\{\{overflowY:'auto'\}\}/g, 'className="overflow-auto"'],
  [/\bstyle=\{\{accentColor:'var\(--primary\)'\}\}/g, 'className="accent-primary"'],
  [/\bstyle=\{\{border:'none'\}\}/g, 'className="border-none"'],
  [/\bstyle=\{\{cursor:'pointer'\}\}/g, 'className="cursor-pointer"'],
  [/\bstyle=\{\{cursor:'default'\}\}/g, 'className="cursor-default"'],
  [/\bstyle=\{\{boxSizing:'border-box'\}\}/g, 'className="box-border"'],
  [/\bstyle=\{\{userSelect:'none',WebkitUserSelect:'none'\}\}/g, 'className="user-select-none"'],
  [/\bstyle=\{\{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:(\d+)\}\}/g, (m, gap) => `className="inline-flex items-center justify-center gap-${gap}"`],
  [/\bstyle=\{\{flexDirection:'column'\}\}/g, 'className="flex-col"'],
  [/\bstyle=\{\{flexWrap:'wrap'\}\}/g, 'className="flex-wrap"'],
  [/\bstyle=\{\{overflowX:'auto'\}\}/g, 'className="overflow-x-auto"'],
];

const files = [
  'src/components/hammer/HammerInsights.tsx',
  'src/components/hammer/HammerInventory.tsx',
  'src/components/hammer/HammerRules.tsx',
  'src/components/hammer/HammerCleansing.tsx',
  'src/components/hammer/HistorySheet.tsx',
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
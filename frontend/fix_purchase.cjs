const fs = require('fs');
let s = fs.readFileSync('src/pages/InsightsPage.tsx', 'utf8');

// 采购表：状态行移到标题
s = s.replace(
  '<div className="section-title" style={{display:\'flex\',flexWrap:\'wrap\',gap:6}}>\n            <span>采购建议</span>\n          </div>',
  '<div className="section-title" style={{display:\'flex\',flexWrap:\'wrap\',gap:6,alignItems:\'center\'}}>\n            <span>采购建议</span>\n            <span className="muted2" style={{fontSize:11,fontWeight:400}}>显示 ' + '{purchaseVisCols.length}/{PURCHASE_COLS.length}' + ' 列 · 已加载 ' + '{Math.min(purchaseLimit, filteredPurchase.length)}/{filteredPurchase.length}' + ' 条' + '{insightSearch ? ` · "${insightSearch}"` : \'\'}' + '</span>\n          </div>'
);

// 采购表：删除内部的旧状态行
s = s.replace(
  '<div style={{fontSize:11,color:\'var(--muted2)\',marginBottom:4}}>显示 ' + '{purchaseVisCols.length}/{PURCHASE_COLS.length}' + ' 列 · 点击"列"按钮切换' + '{insightSearch ? ` · 搜索 "${insightSearch}"` : \'\'}' + '</div>',
  ''
);

// 滞销表：标题同步
s = s.replace(
  '<div className="section-title" style={{display:\'flex\',flexWrap:\'wrap\',gap:6}}>\n            <span>滞销预警</span>\n          </div>',
  '<div className="section-title" style={{display:\'flex\',flexWrap:\'wrap\',gap:6,alignItems:\'center\'}}>\n            <span>滞销预警</span>\n            <span className="muted2" style={{fontSize:11,fontWeight:400}}>共 ' + '{filteredSlow.length}' + ' 条</span>\n          </div>'
);

fs.writeFileSync('src/pages/InsightsPage.tsx', s);
console.log('done');
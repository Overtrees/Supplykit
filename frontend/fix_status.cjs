const fs = require('fs');
let s = fs.readFileSync('src/pages/InsightsPage.tsx', 'utf8');

// Replace section title with status line
const oldTitle = '<div className="section-title" style={{display:\'flex\',flexWrap:\'wrap\',gap:6}}>\n            <span>\n              补货建议{replen.length > 0 && <span className="small muted" style={{ marginLeft: 8 }}></span>}\n            </span>\n          </div>';

const newTitle = '<div className="section-title" style={{display:\'flex\',flexWrap:\'wrap\',gap:6,alignItems:\'center\'}}>\n            <span>补货建议</span>\n            <span className="muted2" style={{fontSize:11,fontWeight:400}}>已加载 ' + '{Math.min(replenLimit, filteredReplen.length)}/{filteredReplen.length}' + ' 条 · 显示 ' + '{visCols.length}/{currentCols.length}' + ' 列' + '{insightSearch ? ` · "${insightSearch}"` : \'\'}' + '</span>\n            {replenMode===\'bbcc\' && orderedKeys.length > 0 && <span className="pill success" style={{fontSize:10}}>已下单 ' + '{orderedKeys.length}' + ' 项</span>}\n          </div>';

s = s.replace(oldTitle, newTitle);

// Remove the old status line inside the scrollable container
const oldStatus = '<div style={{fontSize:11,color:\'var(--muted2)\',marginBottom:4,display:\'flex\',gap:8,alignItems:\'center\'}}>\n                <span>已加载 ' + '{Math.min(replenLimit, filteredReplen.length)}/{filteredReplen.length}' + ' 条 · 显示 ' + '{visCols.length}/{currentCols.length}' + ' 列' + '{insightSearch ? ` · "${insightSearch}"` : \'\'}' + '</span>\n                {replenMode===\'bbcc\' && orderedKeys.length > 0 && <span className="pill success" style={{fontSize:10}}>已下单 ' + '{orderedKeys.length}' + ' 项</span>}\n              </div>\n              ';

s = s.replace(oldStatus, '');

fs.writeFileSync('src/pages/InsightsPage.tsx', s);
console.log('done');
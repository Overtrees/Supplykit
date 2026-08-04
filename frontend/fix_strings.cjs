// 修复字符串中的 t() 调用
const fs = require('fs');

const files = [
  'src/pages/OrdersPage.tsx', 'src/pages/InsightsPage.tsx', 'src/pages/RulesPage.tsx',
  'src/pages/ProductPage.tsx', 'src/pages/SupplierPage.tsx', 'src/pages/InventoryPage.tsx',
  'src/pages/CleansingPage.tsx', 'src/pages/DashboardPage.tsx',
  'src/components/ConfirmDialog.tsx', 'src/components/EmptyState.tsx'
];

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Fix 1: '{t("key")}' → t("key")
  s = s.replace(/'(t\("[^"]+"\))'/g, (match, p1) => {
    changed = true;
    return p1; // Remove quotes
  });
  
  // Fix 2: '{t("key")}text' → t("key") + 'text'
  s = s.replace(/'(t\("[^"]+"\))([^']*)'/g, (match, p1, p2) => {
    changed = true;
    if (p2 === '') return p1;
    return p1 + " + '" + p2 + "'";
  });
  
  // Fix 3: 'text{t("key")}text2' → 'text' + t("key") + 'text2'
  // This is more complex, handle specific cases
  // label:'{t("key")}text'  →  label: t("key") + 'text'
  s = s.replace(/label:'{t\("([^"]+)"\)}([^']*)'/g, (match, key, suffix) => {
    changed = true;
    if (suffix) return 'label: t("' + key + '") + \'' + suffix + '\'';
    return 'label: t("' + key + '")';
  });
  
  // Fix 4: title: '{t("key")}' → title: t("key")
  s = s.replace(/title: 't\("([^"]+)"\)'/g, (match, key) => {
    changed = true;
    return 'title: t("' + key + '")';
  });
  
  if (changed) {
    fs.writeFileSync(file, s);
    console.log('Fixed:', file.replace('src/', ''));
  }
}
console.log('Done!');
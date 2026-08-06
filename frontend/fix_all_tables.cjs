const fs = require('fs');
const pages = ['OrdersPage.tsx', 'InventoryPage.tsx', 'ProductPage.tsx', 'SupplierPage.tsx', 'QualityPage.tsx', 'CleansingPage.tsx'];

for (const file of pages) {
  let s = fs.readFileSync('src/pages/' + file, 'utf8');
  let changed = false;

  // 1. Replace overflowX:"auto" with overflow:"auto" + maxHeight
  s = s.replace(/style={{overflowX:"auto"}}/g, 'style={{overflow:"auto",maxHeight:"calc(100vh - 180px)"}}');
  s = s.replace(/style={{overflowX:'auto'}}/g, 'style={{overflow:"auto",maxHeight:"calc(100vh - 180px)"}}');

  // 2. Add sticky header to thead tr
  s = s.replace(/<thead><tr>/g, '<thead><tr style={{position:"sticky",top:0,background:"var(--card)",zIndex:1}}>');

  if (s.includes('overflow:"auto"')) {
    fs.writeFileSync('src/pages/' + file, s);
    console.log('Fixed: ' + file);
  }
}
console.log('done');
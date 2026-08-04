// 国际化迁移第三阶段 - 页面组件+欢迎页
const fs = require('fs');

function migrate(file, replacements) {
  let s = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const [from, to] of replacements) {
    if (s.includes(from)) {
      s = s.replace(from, to);
      count++;
    }
  }
  if (count > 0) fs.writeFileSync(file, s);
  return count;
}

console.log('第三阶段迁移开始...');

// 1. 欢迎页 (App.tsx)
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace('>SupplyKit<', '>{t("welcome.title")}<');
app = app.replace('>电商供应链数据清洗与补货决策看板<', '>{t("app.desc")}<');
app = app.replace('>看数据<', '>{t("welcome.dash")}<');
app = app.replace('>看补货<', '>{t("welcome.insights")}<');
app = app.replace('>导数据<', '>{t("welcome.cleansing")}<');
app = app.replace('>设规则<', '>{t("welcome.rules")}<');
app = app.replace('>开始体验<', '>{t("welcome.start")}<');
app = app.replace('>跳过，直接进入<', '>{t("welcome.skip")}<');
app = app.replace('>多维看板总览<', '>{t("welcome.dash_desc")}<');
app = app.replace('>补货/采购建议<', '>{t("welcome.insights_desc")}<');
app = app.replace('>数据清洗导入<', '>{t("welcome.cleansing_desc")}<');
app = app.replace('>规则引擎配置<', '>{t("welcome.rules_desc")}<');
fs.writeFileSync('src/App.tsx', app);
console.log('1. App.tsx (欢迎页) done');

// 2. locale.ts 补充新键
let loc = fs.readFileSync('src/locale.ts', 'utf8');
const zhKeys = `\n  'welcome.dash_desc': '多维看板总览',
  'welcome.insights_desc': '补货/采购建议',
  'welcome.cleansing_desc': '数据清洗导入',
  'welcome.rules_desc': '规则引擎配置',`;
loc = loc.replace("'welcome.rules': '设规则',", "'welcome.rules': '设规则'," + zhKeys);
const enKeys = `\n  'welcome.dash_desc': 'Dashboard Overview',
  'welcome.insights_desc': 'Replenishment & Purchase',
  'welcome.cleansing_desc': 'Data Import & Cleaning',
  'welcome.rules_desc': 'Rule Engine Config',`;
loc = loc.replace("'welcome.rules': 'Rules',", "'welcome.rules': 'Rules'," + enKeys);
fs.writeFileSync('src/locale.ts', loc);
console.log('2. locale.ts 补充键 done');

// 3. 供应商页面
migrate('src/pages/SupplierPage.tsx', [
  ['供应商管理', 't("nav.suppliers")'],
  ['共', 't("common.total")'],
  ['个', 't("common.items")'],
  ['无匹配供应商', 't("supplier.empty_matched")'],
  ['暂无供应商', 't("supplier.empty")'],
  ['显示', 't("common.showing")'],
  ['列', 't("common.columns")'],
]);
console.log('3. SupplierPage done');

// 4. 商品页面
migrate('src/pages/ProductPage.tsx', [
  ['商品管理', 't("nav.products")'],
  ['共', 't("common.total")'],
  ['个', 't("common.items")'],
  ['无匹配商品', 't("product.empty_matched")'],
  ['暂无商品', 't("product.empty")'],
  ['显示', 't("common.showing")'],
  ['列', 't("common.columns")'],
]);
console.log('4. ProductPage done');

// 5. 订单页面
migrate('src/pages/OrdersPage.tsx', [
  ['订单', 't("nav.orders")'],
  ['共', 't("common.total")'],
  ['条', 't("common.items")'],
  ['无匹配订单', 't("order.empty_matched")'],
  ['暂无订单', 't("order.empty")'],
  ['显示', 't("common.showing")'],
  ['列', 't("common.columns")'],
  ['已删除', 't("undo.deleted")'],
  ['撤销', 't("undo.undo")'],
  ['导出失败', 't("export.failed")'],
  ['订单导出完成', 't("export.order_success")'],
]);
console.log('5. OrdersPage done');

// 6. 库存页面
migrate('src/pages/InventoryPage.tsx', [
  ['进销存台账', 't("nav.inv")'],
  ['共', 't("common.total")'],
  ['条', 't("common.items")'],
  ['无匹配', 't("inv.empty_matched")'],
  ['暂无数据', 't("common.empty")'],
  ['显示', 't("common.showing")'],
  ['列', 't("common.columns")'],
  ['导出失败', 't("export.failed")'],
  ['库存导出完成', 't("export.inv_success")'],
]);
console.log('6. InventoryPage done');

// 7. locale.ts 补充页面相关键
loc = fs.readFileSync('src/locale.ts', 'utf8');
const zhPage = `\n  'common.total': '共',
  'common.items': '条',
  'common.showing': '显示',
  'export.failed': '导出失败',
  'export.order_success': '订单导出完成',
  'export.inv_success': '库存导出完成',
  'supplier.empty': '暂无供应商',
  'supplier.empty_matched': '无匹配供应商',
  'product.empty': '暂无商品',
  'product.empty_matched': '无匹配商品',
  'order.empty': '暂无订单',
  'order.empty_matched': '无匹配订单',
  'inv.empty_matched': '无匹配库存',`;
loc = loc.replace("'welcome.rules_desc': '规则引擎配置',", "'welcome.rules_desc': '规则引擎配置'," + zhPage);
const enPage = `\n  'common.total': 'Total',
  'common.items': 'items',
  'common.showing': 'Showing',
  'export.failed': 'Export failed',
  'export.order_success': 'Orders exported',
  'export.inv_success': 'Inventory exported',
  'supplier.empty': 'No suppliers',
  'supplier.empty_matched': 'No matching suppliers',
  'product.empty': 'No products',
  'product.empty_matched': 'No matching products',
  'order.empty': 'No orders',
  'order.empty_matched': 'No matching orders',
  'inv.empty_matched': 'No matching inventory',`;
loc = loc.replace("'welcome.rules_desc': 'Rule Engine Config',", "'welcome.rules_desc': 'Rule Engine Config'," + enPage);
fs.writeFileSync('src/locale.ts', loc);
console.log('7. locale.ts 补充页面键 done');

console.log('第三阶段迁移完成!');
// 第四阶段迁移脚本
const fs = require('fs');

function migrate(file, replacements) {
  let s = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const [from, to] of replacements) {
    const idx = s.indexOf(from);
    if (idx !== -1) {
      s = s.substring(0, idx) + to + s.substring(idx + from.length);
      count++;
    }
  }
  if (count > 0) fs.writeFileSync(file, s);
  return count;
}

console.log('第四阶段迁移开始...');

// 1. DashboardPage 看板
migrate('src/pages/DashboardPage.tsx', [
  ['本月 GMV', 't("period.month") + " " + t("dash.gmv")'],
  ['今日 GMV', 't("period.today") + " " + t("dash.gmv")'],
  ['本周 GMV', 't("period.week") + " " + t("dash.gmv")'],
  ['自定义 GMV', 't("period.custom") + " " + t("dash.gmv")'],
  ['待处理', 't("dash.pending")'],
  ['库存健康度', 't("dash.health")'],
  ['濒临断货 TOP 10', 't("dash.risk")'],
  ['订单阶段分布', 't("dash.funnel")'],
  ['店铺 GMV', 't("dash.store_gmv")'],
  ['低库存告警', 't("dash.low_stock")'],
  ['补货告警', 't("dash.replenish_alert")'],
  ['暂无告警', 't("dash.no_alerts")'],
  ['最短', 't("dash.min_days")'],
  ['天断货', 't("dash.days_out")'],
  ['紧急', 't("dash.critical")'],
  ['预警', 't("dash.warning")'],
  ['库存充足', 't("dash.stock_ok")'],
  ['警告', 't("dash.alert_warning")'],
  ['超储', 't("dash.alert_overstock")'],
  ['补货', 't("dash.replenish")'],
  ['分', 't("dash.score_unit")'],
  ['健康', 't("dash.healthy")'],
  ['偏低', 't("dash.low")'],
  ['缺货', 't("dash.out_of_stock")'],
  ['SKU', 't("dash.sku")'],
  ['自有', 't("dash.own")'],
]);
console.log('1. DashboardPage done');

// 2. locale.ts 补充看板键
let loc = fs.readFileSync('src/locale.ts', 'utf8');
const zhDash = `\n  'dash.no_alerts': '暂无告警',
  'dash.min_days': '最短',
  'dash.days_out': '天断货',
  'dash.critical': '紧急',
  'dash.warning': '预警',
  'dash.stock_ok': '库存充足',
  'dash.alert_warning': '警告',
  'dash.alert_overstock': '超储',
  'dash.replenish': '补货',
  'dash.score_unit': '分',
  'dash.healthy': '健康',
  'dash.low': '偏低',
  'dash.out_of_stock': '缺货',
  'dash.sku': 'SKU',
  'dash.own': '自有',`;
loc = loc.replace("'inv.empty_matched': '无匹配库存',", "'inv.empty_matched': '无匹配库存'," + zhDash);
const enDash = `\n  'dash.no_alerts': 'No alerts',
  'dash.min_days': 'Min',
  'dash.days_out': 'days to stockout',
  'dash.critical': 'Critical',
  'dash.warning': 'Warning',
  'dash.stock_ok': 'Stock OK',
  'dash.alert_warning': 'Warning',
  'dash.alert_overstock': 'Overstock',
  'dash.replenish': 'Replenish',
  'dash.score_unit': 'pts',
  'dash.healthy': 'Healthy',
  'dash.low': 'Low',
  'dash.out_of_stock': 'Out of stock',
  'dash.sku': 'SKU',
  'dash.own': 'Own',`;
loc = loc.replace("'inv.empty_matched': 'No matching inventory',", "'inv.empty_matched': 'No matching inventory'," + enDash);
fs.writeFileSync('src/locale.ts', loc);
console.log('2. locale.ts 补充键 done');

// 3. 通用组件
migrate('src/components/EmptyState.tsx', [
  ['暂无数据', 't("common.empty")'],
]);
console.log('3. EmptyState done');

// 4. ErrorBoundary
migrate('src/components/ErrorBoundary.tsx', [
  ['组件渲染错误', 't("error.component_render")'],
  ['重试', 't("common.retry")'],
]);
console.log('4. ErrorBoundary done');

// 5. locale.ts 补充通用键
loc = fs.readFileSync('src/locale.ts', 'utf8');
const zhCommon = `\n  'common.retry': '重试',
  'error.component_render': '组件渲染错误',`;
loc = loc.replace("'inv.empty_matched': '无匹配库存',", "'inv.empty_matched': '无匹配库存'," + zhCommon);
const enCommon = `\n  'common.retry': 'Retry',
  'error.component_render': 'Component Render Error',`;
loc = loc.replace("'inv.empty_matched': 'No matching inventory',", "'inv.empty_matched': 'No matching inventory'," + enCommon);
fs.writeFileSync('src/locale.ts', loc);
console.log('5. locale.ts 补充通用键 done');

console.log('第四阶段迁移完成!');
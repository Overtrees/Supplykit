// 国际化迁移第二阶段
const fs = require('fs');

console.log('第二阶段迁移开始...');

// 辅助函数：安全替换文本
function replaceInFile(filePath, replacements) {
  let s = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (s.includes(from)) {
      s = s.replace(from, to);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(filePath, s);
  return changed;
}

// 1. Toast 通知
console.log('1. Toast...');
replaceInFile('src/components/Toast.tsx', [
  ['import { ToastProvider }', 'import { t } from "../locale"\nimport { ToastProvider }'],
]);

// 2. HammerProducts
console.log('2. HammerProducts...');
let hp = fs.readFileSync('src/components/hammer/HammerProducts.tsx', 'utf8');
hp = hp.replace('import { useAppStore }', 'import { t } from "../../locale"\nimport { useAppStore }');
hp = hp.replace("京东' : '其他'} · 商品", "t('channel.jd') : t('channel.other')} · {t('nav.products')}");
hp = hp.replace('>列选择 (', '>{t("common.columns")} (');
hp = hp.replace('>搜索<', '>{t("common.search")}<');
hp = hp.replace('>清除<', '>{t("common.clear")}<');
hp = hp.replace('>全部<', '>{t("common.all")}<');
hp = hp.replace('>拖拽 ⠿ 调整列顺序<', '>{t("common.drag_hint")}<');
fs.writeFileSync('src/components/hammer/HammerProducts.tsx', hp);
console.log('   done');

// 3. HammerSuppliers
console.log('3. HammerSuppliers...');
let hs = fs.readFileSync('src/components/hammer/HammerSuppliers.tsx', 'utf8');
hs = hs.replace('import { useAppStore }', 'import { t } from "../../locale"\nimport { useAppStore }');
hs = hs.replace("京东' : '其他'} · 供应商", "t('channel.jd') : t('channel.other')} · {t('nav.suppliers')}");
hs = hs.replace('>列选择 (', '>{t("common.columns")} (');
hs = hs.replace('>搜索<', '>{t("common.search")}<');
hs = hs.replace('>清除<', '>{t("common.clear")}<');
hs = hs.replace('>全部<', '>{t("common.all")}<');
hs = hs.replace('>拖拽 ⠿ 调整列顺序<', '>{t("common.drag_hint")}<');
fs.writeFileSync('src/components/hammer/HammerSuppliers.tsx', hs);
console.log('   done');

// 4. HammerOrders
console.log('4. HammerOrders...');
let ho = fs.readFileSync('src/components/hammer/HammerOrders.tsx', 'utf8');
ho = ho.replace('import { useAppStore }', 'import { t } from "../../locale"\nimport { useAppStore }');
ho = ho.replace("京东' : '其他'} · 订单", "t('channel.jd') : t('channel.other')} · {t('nav.orders')}");
ho = ho.replace('>列选择 (', '>{t("common.columns")} (');
ho = ho.replace('>搜索<', '>{t("common.search")}<');
ho = ho.replace('>筛选', '>{t("common.filter")}');
ho = ho.replace('>导出<', '>{t("common.export")}<');
ho = ho.replace('>导出中...<', '>{t("common.exporting")}<');
ho = ho.replace('>清除<', '>{t("common.clear")}<');
ho = ho.replace('>全部<', '>{t("common.all")}<');
ho = ho.replace('>清除筛选<', '>{t("common.clear_filter")}<');
ho = ho.replace('>订单状态<', '>{t("common.order_status")}<');
ho = ho.replace('>拖拽 ⠿ 调整列顺序<', '>{t("common.drag_hint")}<');
fs.writeFileSync('src/components/hammer/HammerOrders.tsx', ho);
console.log('   done');

// 5. HammerInventory
console.log('5. HammerInventory...');
let hi = fs.readFileSync('src/components/hammer/HammerInventory.tsx', 'utf8');
hi = hi.replace('import { useAppStore }', 'import { t } from "../../locale"\nimport { useAppStore }');
hi = hi.replace("京东' : '其他'} · 进销存", "t('channel.jd') : t('channel.other')} · {t('nav.inv')}");
hi = hi.replace('>列选择 (', '>{t("common.columns")} (');
hi = hi.replace('>搜索<', '>{t("common.search")}<');
hi = hi.replace('>导出<', '>{t("common.export")}<');
hi = hi.replace('>导出中...<', '>{t("common.exporting")}<');
hi = hi.replace('>清除<', '>{t("common.clear")}<');
hi = hi.replace('>全部<', '>{t("common.all")}<');
hi = hi.replace('>拖拽 ⠿ 调整列顺序<', '>{t("common.drag_hint")}<');
// 仓库类型
hi = hi.replace('>自有仓<', '>{t("inv.own")}<');
hi = hi.replace('>平台仓<', '>{t("inv.platform")}<');
fs.writeFileSync('src/components/hammer/HammerInventory.tsx', hi);
console.log('   done');

// 6. HammerInsights
console.log('6. HammerInsights...');
let hins = fs.readFileSync('src/components/hammer/HammerInsights.tsx', 'utf8');
hins = hins.replace('import { useAppStore }', 'import { t } from "../../locale"\nimport { useAppStore }');
hins = hins.replace("京东' : '其他'} · 补货建议", "t('channel.jd') : t('channel.other')} · {t('nav.insights')}");
hins = hins.replace('>列选择 (', '>{t("common.columns")} (');
hins = hins.replace('>搜索<', '>{t("common.search")}<');
hins = hins.replace('>导出<', '>{t("common.export")}<');
hins = hins.replace('>导出中...<', '>{t("common.exporting")}<');
hins = hins.replace('>清除<', '>{t("common.clear")}<');
hins = hins.replace('>全部<', '>{t("common.all")}<');
hins = hins.replace('>默认<', '>{t("common.default")}<');
hins = hins.replace('>拖拽 ⠿ 调整列顺序<', '>{t("common.drag_hint")}<');
fs.writeFileSync('src/components/hammer/HammerInsights.tsx', hins);
console.log('   done');

// 7. locale.ts 补充翻译键
console.log('7. 补充缺失翻译键...');
let loc = fs.readFileSync('src/locale.ts', 'utf8');
const newKeys = `
  'common.columns': '列选择',
  'common.clear': '清除',
  'common.clear_filter': '清除筛选',
  'common.drag_hint': '拖拽 ⠿ 调整列顺序',
  'common.filter': '筛选',
  'common.order_status': '订单状态',
  'common.default': '默认',
  'common.start_date': '开始',
  'common.end_date': '结束',
  'inv.own': '自有仓',
  'inv.platform': '平台仓',`;

// 在 settings 后面添加
loc = loc.replace("'settings.seed_reset': '一键重置',", "'settings.seed_reset': '一键重置'," + newKeys);
fs.writeFileSync('src/locale.ts', loc);
console.log('   done');

// 英文翻译
loc = fs.readFileSync('src/locale.ts', 'utf8');
const enKeys = `
  'common.columns': 'Columns',
  'common.clear': 'Clear',
  'common.clear_filter': 'Clear Filter',
  'common.drag_hint': 'Drag to reorder',
  'common.filter': 'Filter',
  'common.order_status': 'Order Status',
  'common.default': 'Default',
  'common.start_date': 'Start',
  'common.end_date': 'End',
  'inv.own': 'Own Warehouse',
  'inv.platform': 'Platform Warehouse',`;

loc = loc.replace("'settings.seed_reset': 'Reset All Data',", "'settings.seed_reset': 'Reset All Data'," + enKeys);
fs.writeFileSync('src/locale.ts', loc);
console.log('   done');

console.log('第二阶段迁移完成!');
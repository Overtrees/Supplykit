// 第五阶段迁移脚本
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

console.log('第五阶段迁移开始...');

// 1. InsightsPage
migrate('src/pages/InsightsPage.tsx', [
  ['补货建议', 't("nav.insights")'],
  ['采购建议', 't("insights.purchase")'],
  ['滞销预警', 't("insights.slow")'],
  ['库存健康，暂无补货建议', 't("insights.no_replenish")'],
  ['暂无采购建议', 't("insights.no_purchase")'],
  ['暂无数据', 't("common.empty")'],
  ['导出成功', 't("export.success")'],
  ['导出失败', 't("export.failed")'],
  ['B仓', 't("inv.warehouse_b")'],
  ['C仓', 't("inv.warehouse_c")'],
  ['自有仓', 't("inv.own")'],
  ['标记操作', 't("insights.mark_action")'],
  ['撤销', 't("undo.undo")'],
  ['已标记', 't("insights.marked")'],
  ['无需采购', 't("insights.no_purchase_needed")'],
  ['暂无匹配', 't("insights.no_match")'],
]);
console.log('1. InsightsPage done');

// 2. RulesPage
migrate('src/pages/RulesPage.tsx', [
  ['规则搭建', 't("nav.rules")'],
  ['暂无规则', 't("rules.empty")'],
  ['新建规则', 't("rules.new")'],
  ['编辑规则', 't("rules.edit")'],
  ['规则名称', 't("rules.name")'],
  ['级别', 't("rules.severity")'],
  ['警告', 't("rules.severity_warning")'],
  ['紧急', 't("rules.severity_error")'],
  ['提示', 't("rules.severity_info")'],
  ['删除', 't("common.delete")'],
  ['保存', 't("common.save")'],
  ['取消', 't("common.cancel")'],
  ['已删除', 't("undo.deleted")'],
  ['撤销', 't("undo.undo")'],
  ['搜索规则名称...', 't("rules.search_placeholder")'],
  ['变更历史', 't("rules.history")'],
  ['新建', 't("rules.new_btn")'],
]);
console.log('2. RulesPage done');

// 3. QualityPage
migrate('src/pages/QualityPage.tsx', [
  ['数据异常', 't("nav.quality")'],
  ['暂无异常', 't("quality.empty")'],
  ['异常类型', 't("quality.type")'],
  ['相关SKU', 't("quality.related_sku")'],
  ['描述', 't("quality.description")'],
  ['时间', 't("quality.time")'],
]);
console.log('3. QualityPage done');

// 4. CleansingPage (部分关键文案)
migrate('src/pages/CleansingPage.tsx', [
  ['数据清洗及导入', 't("nav.cleansing")'],
  ['暂无记录', 't("cleansing.empty")'],
  ['导入失败', 't("cleansing.import_failed")'],
  ['导入成功', 't("cleansing.import_success")'],
  ['正在导入...', 't("cleansing.importing")'],
  ['选择文件', 't("cleansing.select_file")'],
  ['开始导入', 't("cleansing.start_import")'],
]);
console.log('4. CleansingPage done');

// 5. ConfirmDialog
migrate('src/components/ConfirmDialog.tsx', [
  ['确认', 't("common.confirm")'],
  ['取消', 't("common.cancel")'],
]);
console.log('5. ConfirmDialog done');

// 6. locale.ts 补充键
let loc = fs.readFileSync('src/locale.ts', 'utf8');
const zhKeys = `\n  'insights.purchase': '采购建议',
  'insights.slow': '滞销预警',
  'insights.no_replenish': '库存健康，暂无补货建议',
  'insights.no_purchase': '暂无采购建议',
  'insights.mark_action': '标记操作',
  'insights.marked': '已标记',
  'insights.no_purchase_needed': '无需采购',
  'insights.no_match': '暂无匹配',
  'insights.bbcc': 'BBCC送仓',
  'insights.traditional': '传统多仓',
  'export.success': '导出成功',
  'rules.empty': '暂无规则',
  'rules.new': '新建规则',
  'rules.edit': '编辑规则',
  'rules.name': '规则名称',
  'rules.severity': '级别',
  'rules.severity_warning': '警告',
  'rules.severity_error': '紧急',
  'rules.severity_info': '提示',
  'rules.search_placeholder': '搜索规则名称...',
  'rules.history': '变更历史',
  'rules.new_btn': '新建',
  'common.save': '保存',
  'quality.empty': '暂无异常',
  'quality.type': '异常类型',
  'quality.related_sku': '相关SKU',
  'quality.description': '描述',
  'quality.time': '时间',
  'cleansing.empty': '暂无记录',
  'cleansing.import_failed': '导入失败',
  'cleansing.import_success': '导入成功',
  'cleansing.importing': '正在导入...',
  'cleansing.select_file': '选择文件',
  'cleansing.start_import': '开始导入',
  'inv.warehouse_b': 'B仓',
  'inv.warehouse_c': 'C仓',`;
loc = loc.replace("'inv.empty_matched': '无匹配库存',", "'inv.empty_matched': '无匹配库存'," + zhKeys);
const enKeys = `\n  'insights.purchase': 'Purchase',
  'insights.slow': 'Slow Moving',
  'insights.no_replenish': 'Stock healthy, no replenishment needed',
  'insights.no_purchase': 'No purchase suggestions',
  'insights.mark_action': 'Mark Action',
  'insights.marked': 'Marked',
  'insights.no_purchase_needed': 'No purchase needed',
  'insights.no_match': 'No match',
  'insights.bbcc': 'BBCC',
  'insights.traditional': 'Traditional',
  'export.success': 'Export successful',
  'rules.empty': 'No rules',
  'rules.new': 'New Rule',
  'rules.edit': 'Edit Rule',
  'rules.name': 'Rule Name',
  'rules.severity': 'Severity',
  'rules.severity_warning': 'Warning',
  'rules.severity_error': 'Error',
  'rules.severity_info': 'Info',
  'rules.search_placeholder': 'Search rule name...',
  'rules.history': 'History',
  'rules.new_btn': 'New',
  'common.save': 'Save',
  'quality.empty': 'No quality logs',
  'quality.type': 'Type',
  'quality.related_sku': 'Related SKU',
  'quality.description': 'Description',
  'quality.time': 'Time',
  'cleansing.empty': 'No records',
  'cleansing.import_failed': 'Import failed',
  'cleansing.import_success': 'Import successful',
  'cleansing.importing': 'Importing...',
  'cleansing.select_file': 'Select File',
  'cleansing.start_import': 'Start Import',
  'inv.warehouse_b': 'Warehouse B',
  'inv.warehouse_c': 'Warehouse C',`;
loc = loc.replace("'inv.empty_matched': 'No matching inventory',", "'inv.empty_matched': 'No matching inventory'," + enKeys);
fs.writeFileSync('src/locale.ts', loc);
console.log('6. locale.ts 补充键 done');

console.log('第五阶段迁移完成!');
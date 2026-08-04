// 国际化迁移脚本
const fs = require('fs');

console.log('迁移开始...');

// 1. App.tsx - 导航栏
let s = fs.readFileSync('src/App.tsx', 'utf8');
s = s.replace('import { IconStatusOnline, IconStatusWarning, IconStatusOffline, IconExport }', 'import { t } from "./locale"\nimport { IconStatusOnline, IconStatusWarning, IconStatusOffline, IconExport }');
s = s.replace("{ id:'dash',label:'多维数据看板'}", "{ id:'dash',label:t('nav.dash')}");
s = s.replace("{id:'products',label:'货品信息'}", "{id:'products',label:t('nav.products')}");
s = s.replace("{id:'suppliers',label:'供应商管理'}", "{id:'suppliers',label:t('nav.suppliers')}");
s = s.replace("{id:'orders',label:'订单明细'}", "{id:'orders',label:t('nav.orders')}");
s = s.replace("{id:'inv',label:'进销存台账'}", "{id:'inv',label:t('nav.inv')}");
s = s.replace("{id:'insights',label:'货品供应建议'}", "{id:'insights',label:t('nav.insights')}");
s = s.replace("{id:'cleansing',label:'数据清洗及导入'}", "{id:'cleansing',label:t('nav.cleansing')}");
s = s.replace("{id:'rules',label:'规则搭建'}", "{id:'rules',label:t('nav.rules')}");
s = s.replace("{id:'quality',label:'操作异常记录'}", "{id:'quality',label:t('nav.quality')}");
s = s.replace("{id:'settings',label:'设置'}", "{id:'settings',label:t('nav.settings')}");
fs.writeFileSync('src/App.tsx', s);
console.log('App.tsx done');

// 2. Sidebar
s = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
s = s.replace('import { NAV }', 'import { t } from "../../locale"\nimport { NAV }');
s = s.replace("item.id === 'dash' && '数据概览'", "item.id === 'dash' && t('nav.dash')");
s = s.replace("item.id === 'insights' && '补货/采购建议'", "item.id === 'insights' && t('nav.insights')");
s = s.replace("item.id === 'orders' && '订单明细'", "item.id === 'orders' && t('nav.orders')");
s = s.replace("item.id === 'inv' && '进销存台账'", "item.id === 'inv' && t('nav.inv')");
s = s.replace("item.id === 'products' && '商品管理'", "item.id === 'products' && t('nav.products')");
s = s.replace("item.id === 'suppliers' && '供应商管理'", "item.id === 'suppliers' && t('nav.suppliers')");
s = s.replace("item.id === 'cleansing' && '数据清洗导入'", "item.id === 'cleansing' && t('nav.cleansing')");
s = s.replace("item.id === 'rules' && '规则与参数的配置'", "item.id === 'rules' && t('nav.rules')");
s = s.replace("item.id === 'quality' && '数据异常记录'", "item.id === 'quality' && t('nav.quality')");
s = s.replace("item.id === 'settings' && '系统设置与连接状态'", "item.id === 'settings' && t('nav.settings')");
fs.writeFileSync('src/components/Sidebar.tsx', s);
console.log('Sidebar done');

// 3. SettingsPage
s = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');
s = s.replace('import ConfirmDialog', 'import { t } from "../locale"\nimport ConfirmDialog');
s = s.replace('>连接状态<', '>{t("settings.connection")}<');
s = s.replace('>操作<', '>{t("settings.actions")}<');
s = s.replace('>系统信息<', '>{t("settings.system")}<');
s = s.replace('>界面<', '>{t("settings.interface")}<');
s = s.replace('>种子数据<', '>{t("settings.seed_data")}<');
s = s.replace('>刷新连接<', '>{t("settings.refresh")}<');
s = s.replace('>清除本地缓存<', '>{t("settings.clear_cache")}<');
s = s.replace('>回收站<', '>{t("settings.recycle_bin")}<');
s = s.replace('>版本号<', '>{t("settings.version")}<');
s = s.replace('>构建日期<', '>{t("settings.build_date")}<');
s = s.replace('>重置欢迎页<', '>{t("settings.reset_welcome")}<');
s = s.replace('>一键填充<', '>{t("settings.seed_fill")}<');
s = s.replace('>一键重置<', '>{t("settings.seed_reset")}<');
s = s.replace('>前端<', '>{t("settings.frontend")}<');
s = s.replace('>后端<', '>{t("settings.backend")}<');
s = s.replace('>已删除的规则<', '>{t("recycle.deleted_rules")}<');
s = s.replace('>已删除的订单<', '>{t("recycle.deleted_orders")}<');
s = s.replace('>暂无已删除的规则<', '>{t("recycle.empty_rules")}<');
s = s.replace('>暂无已删除的订单<', '>{t("recycle.empty_orders")}<');
s = s.replace('>恢复<', '>{t("common.restore")}<');
s = s.replace('>关闭<', '>{t("common.close")}<');
fs.writeFileSync('src/pages/SettingsPage.tsx', s);
console.log('SettingsPage done');

// 4. HammerDashboard
s = fs.readFileSync('src/components/hammer/HammerDashboard.tsx', 'utf8');
s = s.replace("import { useAppStore }", "import { t } from \"../../locale\"\nimport { useAppStore }");
s = s.replace("京东' : '其他'} · 看板", "t('channel.jd') : t('channel.other')} · " + "' + t('nav.dash') + '");
s = s.replace(">聚合时间维度<", ">{t('dash.period_label')}<");
s = s.replace(">开始<", ">{t('common.start_date')}<");
s = s.replace(">结束<", ">{t('common.end_date')}<");
s = s.replace(">确定<", ">{t('common.confirm')}<");
fs.writeFileSync('src/components/hammer/HammerDashboard.tsx', s);
console.log('HammerDashboard done');

console.log('迁移完成!');
/* smoke29（主程序）：护理计划点击名弹日历 + 饮食 filterbar 调整
   1) 护理计划名绑定 showPlanCalendar → 弹当月日历，标记做过该护理的天
   2) 饮食列表 filterbar：类型选框在猫咪选框右边；有「月度摄入」按钮 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom').JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="previewRoot"></div><div id="main"></div><nav id="sidenav"></nav><div id="navMask"></div><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history', 'Blob', 'URL', 'atob', 'btoa'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__renderPlanModule=renderPlanModule;window.__renderListPage=renderListPage;window.__showPlanCalendar=showPlanCalendar;window.__changeCalendarMonth=changeCalendarMonth;window.__today=today;');
const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
const td = w.__today();
const [y, m, d] = td.split('-').map(Number);
/* 护理计划 + 3 条记录（含当月） */
DB.carePlans.push({ id: 'cp1', catId: 'c1', createdDate: td, type: '梳毛', name: '每日梳毛', method: '针梳', continuous: true, startDate: td, schedType: '按间隔', intervalDays: '1', paused: false });
DB.careRecords.push(
  { id: 'r1', catId: 'c1', planId: 'cp1', date: td, time: '21:00', result: '已完成', notes: '' },
  { id: 'r2', catId: 'c1', planId: 'cp1', date: `${y}-${String(m).padStart(2,'0')}-15`, time: '20:00', result: '已完成', notes: '' },
  { id: 'r3', catId: 'c1', planId: 'cp1', date: `${y}-${String(m).padStart(2,'0')}-08`, time: '09:00', result: '拒绝', notes: '' }
);
w.render = function () {};

// 1. 护理列表：计划名绑定 showPlanCalendar
const el = w.document.createElement('div');
w.__renderPlanModule(el, 'care');
const phtml = el.innerHTML;
ok(/showPlanCalendar\('carePlans','careRecords','cp1'\)/.test(phtml), '护理计划名绑定 showPlanCalendar');
ok(/plan-name-link/.test(phtml), '计划名有可点击样式');

// 2. 打开日历弹窗
w.__showPlanCalendar('carePlans', 'careRecords', 'cp1');
const modal = w.document.getElementById('modalRoot').innerHTML;
ok(/每日梳毛 · 护理日历/.test(modal), '弹窗标题含计划名');
ok(/cal-grid/.test(modal), '日历网格渲染');
ok(/✓/.test(modal), '做过护理的天标记 ✓');
ok(/当月已完成 <b>3<\/b> 次/.test(modal), '副标题显示当月完成次数（3次）');

// 3. 日历格子：当月 3 天有标记
const hasDays = w.document.querySelectorAll('#modalRoot .cal-day.cal-has').length;
ok(hasDays === 3, `当月有 3 天标记（当前=${hasDays}）`);

// 4. 翻月：切到上月 → 应无标记（上月无记录）
// changeCalendarMonth(y, m0, delta)：m 为 0-based，delta=-1 翻上月
w.__changeCalendarMonth(y, m - 1, -1); // m-1 即 0-based 当前月，再 -1 翻到上月
const hasPrev = w.document.querySelectorAll('#modalRoot .cal-day.cal-has').length;
ok(hasPrev === 0, `翻到上月无护理标记（当前=${hasPrev}）`);

// 5. 饮食 filterbar：类型在猫咪右边，有月度摄入按钮
DB.foods.push({ id: 'f1', name: '罐头', category: '主食罐', kcal: 100, water: 80, protein: 10, fat: 5, phos: 100 });
DB.feedings.push({ id: 'fe1', catId: 'c1', date: td, time: '08:00', foodId: 'f1', foodName: '罐头', grams: 50, meal: '早餐' });
const fel = w.document.createElement('div');
w.__renderListPage(fel, 'feed');
const fhtml = fel.innerHTML;
const catPos = fhtml.indexOf('全部猫咪');
const typePos = fhtml.indexOf('全部类型');
const btnPos = fhtml.indexOf('月度摄入');
ok(catPos > -1 && typePos > -1 && typePos > catPos, `饮食 filterbar：类型选框在猫咪选框右边（猫=${catPos} 类型=${typePos}）`);
ok(btnPos > -1 && btnPos > typePos, `「月度摄入」按钮在类型选框右边（按钮=${btnPos} 类型=${typePos}）`);
ok(/showFeedMonthCalendar/.test(fhtml), '月度按钮绑定 showFeedMonthCalendar');

console.log(`\nsmoke29: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

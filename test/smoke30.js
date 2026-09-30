/* smoke30（主程序）：进食量按大类分别合计 + 月度摄入日历
   1) feedTotalsByCategory：按食物 category 分组合计，未关联归「未归类」
   2) dayFoot：按大类显示，不直接相加
   3) 月度摄入日历：每天显示总kcal+进食量，副标题显示当月合计与分类 */
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
w.eval(bundle + '\n;window.__DB=DB;window.__feedTotalsByCategory=feedTotalsByCategory;window.__feedTotals=feedTotals;window.__renderListPage=renderListPage;window.__showFeedMonthCalendar=showFeedMonthCalendar;window.__renderHome=renderHome;window.__today=today;');
const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
const td = w.__today();
const [y, m] = td.split('-').map(Number);

// 食物档案：3 个大类
DB.foods.push(
  { id: 'f1', name: '鸡肉罐', category: '主食罐', kcal: 100, water: 80, protein: 10, fat: 5, phos: 100 },
  { id: 'f2', name: '低敏粮', category: '干粮', kcal: 380, water: 8, protein: 38, fat: 16, phos: 900 },
  { id: 'f3', name: '鸡胸冻干', category: '生骨肉', kcal: 347, water: 5, protein: 75, fat: 8, phos: 700 }
);
// 今日记录：罐头100g + 干粮3g + 生骨肉20g（用户举例）
const todayList = [
  { foodId: 'f1', grams: 100, time: '08:00' },
  { foodId: 'f2', grams: 3, time: '12:00' },
  { foodId: 'f3', grams: 20, time: '18:00' }
];
todayList.forEach((r, i) => DB.feedings.push(Object.assign({ id: 'fe' + i, catId: 'c1', date: td, foodName: '' }, r)));

// 1. feedTotalsByCategory：按大类分组合计
const byCat = w.__feedTotalsByCategory(todayList);
ok(byCat.length === 3, `分 3 个大类（当前=${byCat.length}）`);
const map = {}; byCat.forEach(c => map[c.category] = c);
ok(map['主食罐'] && map['主食罐'].grams === 100, '主食罐 100g');
ok(map['干粮'] && map['干粮'].grams === 3, '干粮 3g');
ok(map['生骨肉'] && map['生骨肉'].grams === 20, '生骨肉 20g');
ok(map['主食罐'].kcal === 100, '主食罐 100kcal（100g×100kcal/100g）');

// 2. 未关联食物归「未归类」
const noFood = [{ foodId: 'xxx', grams: 10 }];
const nc = w.__feedTotalsByCategory(noFood);
ok(nc.length === 1 && nc[0].category === '未归类' && nc[0].grams === 10, '未关联食物归「未归类」');

// 3. dayFoot 按大类分别统计克重（不直接相加），并显示总水分、不写千焦
w.render = function () {};
const el = w.document.createElement('div');
w.__renderListPage(el, 'feed');
const dhtml = el.innerHTML;
ok(/分类克重/.test(dhtml), '日合计含「分类克重」标签');
ok(/主食罐 100g/.test(dhtml), '分类克重含「主食罐 100g」');
ok(/干粮 3g/.test(dhtml), '分类克重含「干粮 3g」');
ok(/生骨肉 20g/.test(dhtml), '分类克重含「生骨肉 20g」');
ok(!/当日合计：80g|当日合计 80g/.test(dhtml), '不再显示直接相加的总克重(80g)');
/* 总水分 = 食物含水量合计：罐头100g×80%=80 + 干粮3g×8%=0.24 + 生骨肉20g×5%=1.0 → 81.24g */
ok(/总水分81\.2g/.test(dhtml), '显示总水分(含食物含水量)=81.24g');
ok(!/kJ|千焦|≈/.test(dhtml), '不显示千焦(kJ)');

// 4. 水/热量/蛋白质后有目标值括号标注
DB.targets = DB.targets || {};
DB.targets['c1'] = { water: 200, kcal: 250, protein: 30 };
const el3 = w.document.createElement('div');
w.__renderListPage(el3, 'feed');
const t3 = el3.innerHTML;
ok(/总水分[^·]*（目标200）/.test(t3), '无饮水时：总水分81.2g（目标200）');
ok(/kcal（目标250kcal）/.test(t3), '热量后标注目标值（目标250kcal）');
ok(/蛋白[^·]*（目标30g）/.test(t3), '蛋白质后标注目标值（目标30g）');
ok(!/水分[^·]*（目标[^）]*g）[^·]*（目标/.test(t3), '每项目标值只标注一次');

// 4b. 有饮水时：总水分 = 食物水 + 饮水，格式「总水分Xg（其中食物含水量Yg，目标200）」
DB.water.push({ id: 'w1', catId: 'c1', date: td, amount: 18.8 });
const el4 = w.document.createElement('div');
w.__renderListPage(el4, 'feed');
const t4 = el4.innerHTML;
/* 食物水 81.24 + 饮水 18.8 = 100.04 → fmt=100 */
ok(/总水分100g（其中食物含水量81\.2g，目标200）/.test(t4), '有饮水：总水分100g（其中食物含水量81.2g，目标200）');

// 5. 月度摄入日历（去 kJ、分类克重）
w.__showFeedMonthCalendar('');
const modal = w.document.getElementById('modalRoot').innerHTML;
ok(/月度饮食摄入/.test(modal), '月度摄入弹窗标题');
ok(/cal-grid/.test(modal), '日历网格渲染');
ok(/当月分类克重/.test(modal), '副标题为「当月分类克重」');
ok(/主食罐 100g/.test(modal), '副标题含分类明细');
ok(!/kJ|≈/.test(modal), '月度弹窗不显示千焦');
const todayCells = w.document.querySelectorAll('#modalRoot .cal-day.cal-has');
ok(todayCells.length >= 1, `当月至少 1 天有摄入数据（当前=${todayCells.length}）`);
const cellHtml = todayCells[0] ? todayCells[0].innerHTML : '';
ok(/kcal/.test(cellHtml), '日历格子显示 kcal');
ok(/g</.test(cellHtml), '日历格子显示进食量(g)');

// 6. 首页「今日营养摄入」：进食量按大类、总水分含食物水、无 kJ
const hel = w.document.createElement('div');
w.__renderHome(hel);
const hh = hel.innerHTML;
ok(/进食量（按大类）/.test(hh), '首页显示「进食量（按大类）」');
ok(/主食罐 <b>100<\/b>g/.test(hh), '首页分类克重含主食罐 100g');
ok(/干粮 <b>3<\/b>g/.test(hh), '首页分类克重含干粮 3g');
ok(/总水分/.test(hh), '首页显示「总水分」');
ok(/含食物含水量|食物[\d.]+g \+ 饮水/.test(hh), '首页总水分标注构成（含食物含水量）');
ok(!/kJ|≈/.test(hh), '首页不显示千焦');

console.log(`\nsmoke30: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/* smoke25（主程序）：今日营养摄入面板「同进食时间视为一餐」 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__mealCountOf=mealCountOf;window.__renderHome=renderHome;window.__today=today;window.__feedTotals=feedTotals;');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
if (!DB.targets) DB.targets = {};
w.render = function () {}; // 桩：避免整页重渲染在测试环境出错
const td = w.__today();

// 1. mealCountOf：按进食时间(time)去重计数
ok(w.__mealCountOf([]) === 0, '无记录 → 0 餐');
ok(w.__mealCountOf([{ time: '08:00' }, { time: '08:00' }]) === 1, '两条同时间(08:00) → 1 餐');
ok(w.__mealCountOf([{ time: '08:00' }, { time: '12:00' }]) === 2, '两条不同时间 → 2 餐');
ok(w.__mealCountOf([{ time: '08:00' }, { time: '08:00' }, { time: '19:30' }]) === 2, '两同+一异 → 2 餐');

// 2. 首页面板：同一天 08:00 录两条不同餐食 → 显示「1 餐」
DB.foods.push({ id: 'f1', name: '鸡肉罐', kcal: 100, water: 10, protein: 10, fat: 5, phos: 100, catId: 'c1' });
DB.feedings.push({ id: 'fe1', catId: 'c1', date: td, time: '08:00', foodId: 'f1', grams: 50 });
DB.feedings.push({ id: 'fe2', catId: 'c1', date: td, time: '08:00', foodId: 'f1', grams: 30 });
let el = w.document.createElement('div'); w.__renderHome(el);
let html = el.innerHTML;
ok(/1 餐/.test(html), '首页面板「同一进食时间两条记录 → 1 餐」');
ok(!/2 餐/.test(html), '首页面板不显示 2 餐（未被错误计为两条）');

// 3. 再加一条不同时间 12:00 → 显示「2 餐」
DB.feedings.push({ id: 'fe3', catId: 'c1', date: td, time: '12:00', foodId: 'f1', grams: 20 });
el = w.document.createElement('div'); w.__renderHome(el);
html = el.innerHTML;
ok(/2 餐/.test(html), '首页面板「加一条不同时间 → 2 餐」');

// 4. 营养总量仍按全部记录累加（不受「视为一餐」影响）
const tt = w.__feedTotals(DB.feedings.filter(r => r.catId === 'c1' && r.date === td));
ok(tt.grams === 100, '总进食量仍为三条之和(50+30+20=100g)');

console.log(`\nsmoke25: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

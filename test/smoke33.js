/* smoke33（主程序）：饮食记录「一顿多食物」批量表单
   1) openForm('feed') 新增 → 弹出多行表单（食物行 + 再加一种 + 本餐加水）
   2) 多行 + 加水 → 保存生成 N 条 feedings + 1 条 water（method=随餐添加）
   3) 统计自动计入：feedTotals / feedTotalsByCategory / 首页 waterExtra
   4) 编辑已有记录 → 仍走原单条表单（不受影响）
   5) 增删行：feedAddRow / feedDelRow；空行被忽略；全空 → 拦截不保存 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom').JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="previewRoot"></div><div id="main"></div><nav id="sidenav"></nav><div id="navMask"></div><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://little-fish-ccc.github.io/catcare/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history', 'Blob', 'URL', 'atob', 'btoa'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__openForm=openForm;window.__openFeedForm=openFeedForm;window.__feedAddRow=feedAddRow;window.__feedDelRow=feedDelRow;window.__submitFeedForm=submitFeedForm;window.__getFeedRows=()=>_feedRows;window.__setFeedRows=a=>{_feedRows=a;};window.__feedTotals=feedTotals;window.__feedTotalsByCategory=feedTotalsByCategory;window.__DB=DB;window.__today=today;window.__renderHome=renderHome;');
const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
DB.foods.push(
  { id: 'f1', name: '鸡肉罐', category: '主食罐', kcal: 100, water: 80, protein: 10, fat: 5, phos: 100 },
  { id: 'f2', name: '低敏粮', category: '干粮', kcal: 380, water: 8, protein: 38, fat: 16, phos: 900 }
);
const td = w.__today();

/* 1. 新增 → 多行表单 */
w.__openForm('feed');
let mHtml = w.document.getElementById('modalRoot').innerHTML;
ok(/feedRows/.test(mHtml), '新增饮食弹出多行表单（#feedRows 容器）');
ok(/再加一种食物/.test(mHtml), '有「＋ 再加一种食物」按钮');
ok(/feedWater/.test(mHtml), '有「本餐加水」输入（#feedWater）');
ok(/feedDate/.test(mHtml) && /feedTimeH/.test(mHtml), '有日期/时间输入');
ok(/feedMeal/.test(mHtml) && /feedFinish/.test(mHtml), '有餐次类型/吃完情况');
ok((mHtml.match(/class="feed-row"/g) || []).length === 1, `初始 1 行（当前=${(mHtml.match(/class="feed-row"/g) || []).length}）`);

/* 2. 增删行 */
w.__feedAddRow(); w.__feedAddRow();
ok(w.__getFeedRows().length === 3, `加 2 行后共 3 行（当前=${w.__getFeedRows().length}）`);
w.__feedDelRow(1);
ok(w.__getFeedRows().length === 2, `删 1 行后剩 2 行（当前=${w.__getFeedRows().length}）`);
w.__feedDelRow(0); w.__feedDelRow(0);
ok(w.__getFeedRows().length === 1, '全删光后自动保留 1 空行');

/* 3. 空行 → 拦截 */
w.__setFeedRows([{ foodId: '', grams: '' }]);
w.__submitFeedForm();
ok(DB.feedings.length === 0, '空行保存被拦截（未生成记录）');

/* 4. 多行 + 加水 → 保存 */
w.__openFeedForm(); // 重开（modal 输入框就位）
w.__setFeedRows([
  { foodId: 'f1', grams: '100' },
  { foodId: 'f2', grams: '3' },
  { foodId: '', grams: '999' }   // 空食物行应被忽略
]);
const wEl = w.document.getElementById('feedWater');
if (wEl) wEl.value = '30';
const before = DB.feedings.length;
w.__submitFeedForm();
ok(DB.feedings.length - before === 2, `生成 2 条进食记录（当前新增=${DB.feedings.length - before}）`);
const saved = DB.feedings.slice(-2);
ok(saved[0].foodId === 'f1' && saved[0].grams === 100 && saved[0].foodName === '鸡肉罐', '第1条：主食罐 100g，食物名自动带出');
ok(saved[1].foodId === 'f2' && saved[1].grams === 3, '第2条：干粮 3g');
ok(saved[0].date === td && saved[1].date === td, '两条共享同一日期');
ok(saved[0].catId === 'c1' && saved[1].catId === 'c1', '两条共享同一猫咪');
ok(/:\d\d/.test(saved[0].time) && saved[0].time === saved[1].time, '两条共享同一时间');
const waterRec = DB.water[DB.water.length - 1];
ok(!!waterRec && waterRec.amount === 30, '生成 1 条饮水记录（30ml）');
ok(waterRec.method === '随餐添加', '饮水记录 method=随餐添加');
ok(waterRec.date === td, '饮水记录日期同步');

/* 5. 统计自动计入 */
const tt = w.__feedTotals(saved);
ok(tt.grams === 103 && tt.kcal > 0, `feedTotals 计入两行（总 ${tt.grams}g，${Math.round(tt.kcal)}kcal）`);
const byCat = w.__feedTotalsByCategory(saved);
ok(byCat.length === 2, '按大类统计正常分组（主食罐+干粮）');

/* 6. 编辑已有记录 → 原单条表单 */
w.__openForm('feed', saved[0]);
mHtml = w.document.getElementById('modalRoot').innerHTML;
ok(/dynForm/.test(mHtml), '编辑已有记录走原表单（#dynForm）');
ok(!/feedRows/.test(mHtml), '编辑不出现多行表单');

/* 7. 加水 0/空 → 不生成饮水记录 */
w.__openFeedForm();
w.__setFeedRows([{ foodId: 'f1', grams: '50' }]);
w.__submitFeedForm();
const wBefore = DB.water.length;
ok(DB.water.length === wBefore, '未填加水 → 不生成饮水记录');

console.log(`\nsmoke33: ${pass}/${pass + fail} 通过${fail ? '（失败 ' + fail + '）' : ''}`);
process.exit(fail ? 1 : 0);

/* smoke13：食物库「钾」改为非必填，且卡片摘要仅在有值时显示钾 */
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const fs = require('fs');
const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'setTimeout', 'clearTimeout', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
w.eval(fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8') + '\n;window.__E = ENTITIES.food;');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

const foodFields = w.__E.fields;
const pot = foodFields.find(f => f.k === 'potassium');

// 1. 钾不再必填
ok(pot && pot.req !== true, '钾(potassium)字段已改为非必填 (req !== true)');
// 2. 其余 6 项仍是必填
['kcal', 'water', 'protein', 'fat', 'calcium', 'phos'].forEach(k => {
  const f = foodFields.find(x => x.k === k);
  ok(f && f.req === true, `${k} 仍为必填`);
});
// 3. foodNutriLine 是顶层函数
ok(typeof w.foodNutriLine === 'function', 'foodNutriLine 函数已暴露');

// 4. 未填钾：摘要不含「钾」
const noK = w.foodNutriLine({ kcal: 100, water: 5, protein: 10, fat: 2, calcium: 50, phos: 40 });
ok(!/钾/.test(noK), '未填钾时摘要行不含「钾」 -> ' + noK);
// 5. 钾无论是否填写，都不出现在卡片主摘要（已移出卡片）
const withK = w.foodNutriLine({ kcal: 100, water: 5, protein: 10, fat: 2, calcium: 50, phos: 40, potassium: 300 });
ok(!/钾/.test(withK), '钾不出现在卡片主摘要（无论是否填写） -> ' + withK);
// 6. 空字符串钾也视为未填
const emptyK = w.foodNutriLine({ kcal: 100, water: 5, protein: 10, fat: 2, calcium: 50, phos: 40, potassium: '' });
ok(!/钾/.test(emptyK), '钾为空字符串时摘要不含「钾」');
// 7. 钾不在选填营养分组（不进卡片展开区），且未打 grp 标记
const optGrp = w.__E.fields.filter(f => f.grp === 'nutrient').map(f => f.k);
ok(!optGrp.includes('potassium'), '钾不在选填营养分组（不进卡片展开区）');
const potF = w.__E.fields.find(f => f.k === 'potassium');
ok(!potF.grp, '钾未打 grp 标记（编辑表单主区可见、卡片不可见）');

console.log(`\nsmoke13: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

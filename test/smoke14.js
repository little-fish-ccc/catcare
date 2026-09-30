/* smoke14：骨骼含量仅在食物类别为「生骨肉」时显示（表单+卡片） */
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const fs = require('fs');
const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'setTimeout', 'clearTimeout', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
w.eval(fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8') + '\n;window.__E = ENTITIES.food; window.__DB = DB;');
const E = w.__E, DB = w.__DB;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

const boneF = E.fields.find(f => f.k === 'bone');
// 1. show 条件
ok(typeof boneF.show === 'function', '骨骼含量字段带 show 条件');
ok(boneF.show({ category: '生骨肉' }) === true, '类别=生骨肉 → 显示骨骼含量');
ok(boneF.show({ category: '主食罐' }) === false, '类别=主食罐 → 不显示');
ok(boneF.show({ category: '干粮' }) === false, '类别=干粮 → 不显示');
ok(boneF.show({}) === false, '未选类别 → 不显示');

// 2. 卡片渲染：生骨肉含 bone 值 → 展开区显示；非生骨肉含 bone 值 → 不显示
DB.cats.length = 0; DB.cats.push({ id: 'c1', name: '布丁' });
DB.foods.length = 0;
DB.foods.push({ id: 'raw1', name: '生骨肉A', category: '生骨肉', kcal: 120, water: 70, protein: 18, fat: 10, phos: 200, calcium: 300, bone: 15 });
const t1 = w.document.createElement('div'); w.renderFoods(t1);
ok(/骨骼含量/.test(t1.innerHTML) && /15/.test(t1.innerHTML), '生骨肉食物(含bone:15)的卡片展开区显示「骨骼含量」');

DB.foods.length = 0;
DB.foods.push({ id: 'can1', name: '主食罐B', category: '主食罐', kcal: 91, water: 80, protein: 10, fat: 5, phos: 180, calcium: 220, bone: 5 });
const t2 = w.document.createElement('div'); w.renderFoods(t2);
ok(!/骨骼含量/.test(t2.innerHTML), '非生骨肉食物(含bone:5)的卡片不显示「骨骼含量」');

// 3. 钾不在卡片主摘要（回归，确保本次未把钾误加回卡片）
DB.foods.length = 0;
DB.foods.push({ id: 'k1', name: '鲜食样本', category: '鲜食', kcal: 100, water: 75, protein: 12, fat: 4, phos: 150, calcium: 200, potassium: 320 });
const t3 = w.document.createElement('div'); w.renderFoods(t3);
ok(!/钾/.test(t3.innerHTML), '含钾食物卡片整体不含「钾」（已移出卡片）');

console.log(`\nsmoke14: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

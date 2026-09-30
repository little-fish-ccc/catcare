let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const fs = require('fs');
const path = require('path');
const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const { window } = dom;
global.window = window; global.document = window.document; global.navigator = window.navigator;
['document','window','navigator','setTimeout','clearTimeout','HTMLElement','Node','getComputedStyle','customElements','location','history'].forEach(k => { try { global[k] = window[k]; } catch(e){} });
window.eval(fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8') + '\n;window.__E = ENTITIES.food; window.__DB = DB; window.__MAP = FOOD_FIELD_MAP;');
const w = window;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const E = w.__E; const DB = w.__DB;
const req = E.fields.filter(f => f.req).map(f => f.k);
const opt = E.fields.filter(f => !f.req && ['number','select','text','textarea','date','photo'].includes(f.type)).map(f => f.k);

// 1. 必填项内容正确
ok(req.includes('kcal') && req.includes('water') && req.includes('protein') && req.includes('fat') && req.includes('calcium') && req.includes('phos') && !req.includes('potassium'), '必填含 热量/水/蛋白/脂肪/钙/磷（钾已改为选填）');
ok(!req.includes('name') === false, 'name 仍为必填（合计9个必填：含名称/类别+7营养）');
ok(req.length === 8, '必填共8项（名称+类别+6营养，钾已改选填），实际=' + req.length);

// 2. 选填字段齐全
['bone','carb','choline','iron','copper','manganese','iodine','magnesium','sodium','va','vb','ve','vd','taurine','epa','dha','epaDha'].forEach(k => {
  ok(E.fields.some(f => f.k === k), '存在选填字段 ' + k);
});
// 旧字段已移除（fiber 已于本期新增为「更多营养」字段，不在此列）
['energy','ash'].forEach(k => ok(!E.fields.some(f => f.k === k), '旧字段已移除 ' + k));

// 3. kcal 单位
const kcalF = E.fields.find(f => f.k === 'kcal');
ok(kcalF.unit === 'kcal/100g', '热量单位=kcal/100g，实际=' + kcalF.unit);

// 4. calcNutrition 用 kcal 直接算
DB.foods.push({ id: 'fx', name: 'X', kcal: 100, water: 80, protein: 10, fat: 5, phos: 200 });
const n = w.calcNutrition('fx', 50);
ok(n.kcal === 50 && Math.abs(n.kj - 209.2) < 0.5, 'calcNutrition: 50g→50kcal≈209kJ（实际 kcal=' + n.kcal + ' kj=' + n.kj.toFixed(1) + '）');

// 5. 卡片 HTML 展示7个必填营养（renderFoods 写入临时元素）
DB.cats.push({ id: 'c1', name: '布丁' });
const fd = { id: 'fx2', name: '主食罐A', category: '主食罐', kcal: 91, water: 80, protein: 10.5, fat: 5.2, calcium: 220, phos: 180, potassium: 160, sodium: 90 };
DB.foods.push(fd);
const tmp = w.document.createElement('div');
w.renderFoods(tmp);
const card = tmp.innerHTML;
ok(/🔥91kcal/.test(card) && /钙220mg/.test(card) && !/钾/.test(card), '食物卡片主摘要含6必填营养且不含钾（钾已移出卡片）');
ok(!/钠/.test(card.split('nutri-more')[0]), '食物卡片摘要行不含选填（钠只在展开区）');

// 6. parseFoodText 映射到新字段并 kJ→kcal 转换
const m = w.parseFoodText('能量 418 kJ\n蛋白质 10 g\n脂肪 5 g\n钙 220 mg\n磷 180 mg\n钾 160 mg');
const kcalM = m.find(x => x.field === 'kcal');
ok(kcalM && Math.abs(parseFloat(kcalM.value) - 100) < 0.2 && kcalM.unit === 'kcal', 'parseFoodText: 能量418kJ→热量≈100kcal（实际 ' + (kcalM && kcalM.value) + ' ' + (kcalM && kcalM.unit) + '）');
ok(m.some(x => x.field === 'calcium') && m.some(x => x.field === 'phos') && m.some(x => x.field === 'potassium'), 'parseFoodText 解析出 钙/磷/钾');

// 8. 编辑表单：选填营养折叠分组
DB.cats.push({ id: 'c2', name: '汤圆' });
w.openForm('food');
const formHtml = w.document.getElementById('modalRoot').innerHTML;
ok(/f-group/.test(formHtml) && /更多营养/.test(formHtml), '食物编辑表单含「更多营养」折叠分组');
ok(/<details class="f-group">[\s\S]*骨骼含量/.test(formHtml), '折叠分组内含选填营养字段（骨骼含量）');

// 9. 食物卡片：展开看全部营养按钮
DB.foods.push({ id: 'fx3', name: '测试罐', category: '主食罐', kcal: 90, water: 78, protein: 11, fat: 5, phos: 170, calcium: 200, potassium: 150, sodium: 80, vd: 30 });
const tmp2 = w.document.createElement('div');
w.renderFoods(tmp2);
const card2 = tmp2.innerHTML;
ok(/nutri-more/.test(card2) && /钠/.test(card2) && /VD/.test(card2), '卡片含「展开看全部营养」按钮且展示选填（钠/VD）');
// 无选填值时不应出现按钮
DB.foods.push({ id: 'fx4', name: '简版', category: '干粮', kcal: 100, water: 8, protein: 38, fat: 16, phos: 900, calcium: 1200, potassium: 500 });
const tmp3 = w.document.createElement('div'); w.renderFoods(tmp3);
const afterFx4 = tmp3.innerHTML.split('fx4')[1] || '';
ok(!/nutri-more/.test(afterFx4), '无选填营养的食物不显示展开按钮');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');

// 7. 本次营养指标调整：骨骼含量单位%、新增锌、VB→VB1、VD单位改IU
const bone = E.fields.find(f => f.k === 'bone');
ok(bone.unit === '%', '骨骼含量单位=%，实际=' + bone.unit);
const zinc = E.fields.find(f => f.k === 'zinc');
ok(zinc && zinc.label === '锌' && zinc.unit === 'mg/100g', '新增指标 锌（mg/100g）');
ok(!E.fields.some(f => f.k === 'zinc' && f.req), '锌为选填');
const vb = E.fields.find(f => f.k === 'vb');
ok(vb.label === 'VB1', 'VB 已改为 VB1，实际=' + vb.label);
const vd = E.fields.find(f => f.k === 'vd');
ok(vd.unit === 'IU/100g', 'VD 单位改为 IU/100g，实际=' + vd.unit);
// OCR 映射同步
ok(w.__MAP.zinc && w.__MAP.zinc.alias.includes('锌'), 'OCR 映射含 锌');
ok(w.__MAP.vb.label.indexOf('VB1') >= 0 && w.__MAP.vb.alias.includes('维生素b1'), 'OCR 映射 VB→VB1 且认「维生素b1」');
ok(w.__MAP.vd.unit === 'IU', 'OCR 映射 VD 单位=IU');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

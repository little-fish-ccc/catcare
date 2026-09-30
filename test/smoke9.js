const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const files = ['js/core.js', 'js/schemas.js', 'js/pages.js', 'js/stats.js', 'js/main.js'];
const bundle = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
w.eval(bundle + '\n;window.openForm=openForm;window.submitForm=submitForm;window.openFoodCompareModal=openFoodCompareModal;window.applyFoodCompare=applyFoodCompare;window.parseFoodText=parseFoodText;window.DB=DB;window.__getForm=function(){return _formData;};window.__getFood=function(){return _formEntity;};');
if (typeof w.btoa !== 'function') w.btoa = s => Buffer.from(s, 'binary').toString('base64');
if (typeof w.atob !== 'function') w.atob = s => Buffer.from(s, 'base64').toString('binary');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('\u2713 ' + m); } else { fail++; console.log('\u2717 ' + m); } }

w.DB.cats.push({ id: 'c1', name: '布丁' });

// 场景A：新建食物，标签含类别+能量，确认后应直接落库生成记录
w.openForm('food');
const sampleA = '主食罐\n能量 950 kJ\n水分 80 g\n蛋白质 8.5 g\n脂肪 5.0 g\n磷 120 mg\n钙 220 mg\n钾 160 mg\n牛磺酸 50 mg\n碳水化合物 3.2 g';
const mA = w.parseFoodText(sampleA);
w.openFoodCompareModal(mA, sampleA);
const beforeA = w.DB.foods.length;
w.applyFoodCompare(mA.length);
ok(w.DB.foods.length === beforeA + 1, '★ 确认后新建食物直接落库（不再是“无记录”）');
const recA = w.DB.foods[w.DB.foods.length - 1];
ok(recA.water === '80' && recA.kcal === String(Math.round(950/4.184*10)/10) && recA.protein === '8.5' && recA.phos === '120', '保存的记录含解析出的营养值（热量已由kJ换算）');
ok(recA.name && /营养表/.test(recA.name), '自动补了食物名称（' + recA.name + '）');

// 场景B：标签缺能量（必填），确认后应退回表单、不落库，且营养已保留在 _formData
w.openForm('food');
const sampleB = '主食罐\n水分 80 g\n蛋白质 8.5 g\n脂肪 5.0 g\n磷 120 mg';
const mB = w.parseFoodText(sampleB);
w.openFoodCompareModal(mB, sampleB);
const beforeB = w.DB.foods.length;
w.applyFoodCompare(mB.length);
ok(w.DB.foods.length === beforeB, '缺必填项（能量）时不自动落库');
const fdB = w.__getForm();
ok(fdB && fdB.water === '80' && !fdB.kcal, '营养已写入 _formData，热量仍为空待补');
ok(/请填写|还差必填项/.test(w.document.getElementById('toastRoot').textContent) || /保存/.test(w.document.getElementById('modalRoot').innerHTML), '给出补填引导');

console.log('\n确认填入落库测试：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

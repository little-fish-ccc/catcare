const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const files = ['js/core.js', 'js/schemas.js', 'js/pages.js', 'js/stats.js', 'js/main.js'];
const bundle = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
w.eval(bundle + '\n;window.DB=DB;window.ENTITIESref=ENTITIES;window.parseFoodTextRef=parseFoodText;window.openFoodCompareModalRef=openFoodCompareModal;window.applyFoodCompareRef=applyFoodCompare;window.isFoodFormRef=isFoodForm;window.recognizeFoodPhotoRef=recognizeFoodPhoto;window.__setEntity=function(e){_formEntity=e;};window.__setFormData=function(v){_formData=v;};window.__getForm=function(){return _formData;};');
if (typeof w.btoa !== 'function') w.btoa = s => Buffer.from(s, 'binary').toString('base64');
if (typeof w.atob !== 'function') w.atob = s => Buffer.from(s, 'base64').toString('binary');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

// 1. parseFoodText：中文营养表 → 字段映射
const sample = `主食罐
水分 80 g
能量 950 kJ
蛋白质 8.5 g
脂肪 5.0 g
磷 120 mg
钙 220 mg
钾 160 mg
牛磺酸 50 mg
碳水化合物 3.2 g`;
const m = w.parseFoodTextRef(sample);
const byField = {};
m.forEach(x => byField[x.field] = x);
ok(byField.category && byField.category.value === '主食罐', '识别类别=主食罐');
ok(byField.water && byField.water.value === '80', '识别含水量=80');
ok(byField.kcal && Math.abs(parseFloat(byField.kcal.value) - 227) < 1, '识别能量950kJ→热量≈227kcal（实际 ' + (byField.kcal && byField.kcal.value) + '）');
ok(byField.protein && byField.protein.value === '8.5', '识别蛋白质=8.5');
ok(byField.fat && byField.fat.value === '5.0', '识别脂肪=5.0');
ok(byField.phos && byField.phos.value === '120', '识别磷=120');
ok(byField.taurine && byField.taurine.value === '50', '识别牛磺酸=50');
ok(byField.carb && byField.carb.value === '3.2', '识别碳水=3.2');
ok(byField.water.unit === 'g' && byField.phos.unit === 'mg', '单位被归一（g / mg）');

// 2. isFoodForm 反映实体（传入实体对象，与实际 openForm('food') 一致）
w.__setEntity(w.ENTITIESref.food);
w.__setFormData({});
ok(w.isFoodFormRef() === true, '食物表单 isFoodForm=true');
w.__setEntity(w.ENTITIESref.feed);
ok(w.isFoodFormRef() === false, '饮食表单 isFoodForm=false（不会误触发 OCR）');

// 3. openFoodCompareModal 渲染对比框
w.__setEntity(w.ENTITIESref.food);
w.openFoodCompareModalRef(m, sample);
const mb = w.document.getElementById('modalRoot').innerHTML;
ok(/核对照片识别结果/.test(mb), '对比框标题正确');
ok(/cmp_val_0/.test(mb) && /cmp_use_0/.test(mb), '对比框含可编辑数值与「采用」勾选');
ok(/蛋白质（每100g）/.test(mb), '对比框显示字段中文名（蛋白质）');
ok(/识别到：/.test(mb) && /class="cmp-source"/.test(mb) && !/class="cmp-tag"/.test(mb) && !/class="cmp-mid"/.test(mb), '对比框显示识别原文，去掉图/箭头');

// 4. applyFoodCompare：确认填入（按字段定位索引，修改一项、取消一项）
const waterIdx = m.findIndex(x => x.field === 'water');
const proteinIdx = m.findIndex(x => x.field === 'protein');
const catIdx = m.findIndex(x => x.field === 'category');
w.document.getElementById('cmp_val_' + waterIdx).value = '9.0';   // 改 water
w.document.getElementById('cmp_use_' + proteinIdx).checked = false; // 取消 protein
w.applyFoodCompareRef(m.length);
const f = w.__getForm();
ok(f.water == '9.0', '确认后含水量填入为修改值 9.0');
ok(f.protein === undefined, '取消勾选的蛋白未填入');
ok(f.fat === '5.0' && f.phos === '120' && f.taurine === '50', '其他勾选项已填入');
ok(f.category === '主食罐', '类别字段已填入');
ok(w.DB.foods.length === 0, 'protein 未勾选→缺失必填，未自动落库（退回表单）');
const mb2 = w.document.getElementById('modalRoot').innerHTML;
ok(/保存/.test(mb2), '退回并打开食物表单（含保存按钮）');
ok(f.water == '9.0' && f.protein === undefined && f.fat === '5.0' && f.calcium === '220' && f.potassium === '160' && f.category === '主食罐', '退回表单保留已填营养（含水/脂肪/钙/钾/类别），未勾选的蛋白为空');

// 5. recognizeFoodPhoto 无引擎时自动弹出粘贴框（不再静默 toast）
w.__setEntity(w.ENTITIESref.food);
w.__setFormData({});
let threw = false;
try { w.recognizeFoodPhotoRef('data:image/png;base64,AAA'); } catch (e) { threw = true; }
ok(!threw, '未加载 Tesseract 时 recognizeFoodPhoto 不报错');
const pm = w.document.getElementById('modalRoot').innerHTML;
ok(/粘贴照片文字识别营养/.test(pm), '无引擎时自动弹出「粘贴文字」识别框');
ok(/识别引擎未加载/.test(pm), '粘贴框给出未加载引擎的提示');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

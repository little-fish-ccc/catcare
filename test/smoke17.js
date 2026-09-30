/* smoke17（主程序）：营养摄入目标设定 + 首页达标小字提示（还差红 / 超出绿） */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
// 跳过应用的 DOMContentLoaded 整页初始化；本测试直接驱动目标相关函数。
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__getTargets=getTargets;window.__hint=nutritionTargetHint;window.__selId=selectedCatId;window.__openModal=openNutritionTargetModal;window.__save=saveNutritionTarget;window.__renderHome=renderHome;window.__today=today;');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
w.render = function () {}; // 桩：避免整页重渲染在测试环境出错

// 1. 数据模型：DB 含 targets，初始为空
ok('targets' in DB, 'DB 含 targets 字段（默认 {}）');
ok(Object.keys(w.__getTargets('c1')).length === 0, '初始 getTargets 为空');

// 2. 设定目标：必填 水/热量/蛋白质 + 选填 脂肪/磷
DB.targets['c1'] = { water: 600, kcal: 300, protein: 25, fat: 10, phos: 200 };
const t = w.__getTargets('c1');
ok(t.water === 600 && t.kcal === 300 && t.protein === 25, '必填 water/kcal/protein 已保存');
ok(t.fat === 10 && t.phos === 200, '选填 fat/phos 也已保存');

// 3. 首页达标提示：还差=红、超出=绿、达标=绿、无目标=空
const below = w.__hint('kcal', 250, 'kcal');
ok(/还差/.test(below) && /var\(--red\)/.test(below), '热量低于目标 → 红色「还差」');
const above = w.__hint('kcal', 350, 'kcal');
ok(/超出/.test(above) && /var\(--green\)/.test(above), '热量超出目标 → 绿色「超出」');
const equal = w.__hint('kcal', 300, 'kcal');
ok(/已达标/.test(equal) && /var\(--green\)/.test(equal), '热量恰好达标 → 绿色「已达标」');
ok(w.__hint('calcium', 5, 'g') === '', '无目标的指标（calcium 未设）返回空：首页小字不显示选填项');

// 4. 目标设定弹窗结构
w.__openModal();
const modal = w.document.getElementById('modalRoot').innerHTML;
ok(/营养摄入目标/.test(modal), '目标设定弹窗可打开');
ok(/必填/.test(modal) && /<b style="color:var\(--red\)">\*<\/b>/.test(modal), '弹窗标注必填项（红 *）');
ok(modal.includes('id="tgt_water"') && modal.includes('id="tgt_kcal"') && modal.includes('id="tgt_protein"'), '弹窗含 水/热量/蛋白质 输入框');
ok(modal.includes('id="tgt_fat"') && modal.includes('id="tgt_phos"'), '弹窗含选填 脂肪/磷 输入框');

// 5. 必填校验：缺必填时保存被拒
DB.targets['c1'] = {};
w.document.getElementById('tgt_water').value = '';
w.document.getElementById('tgt_kcal').value = '300';
w.document.getElementById('tgt_protein').value = '25';
w.__save();
ok(!DB.targets['c1'].water, '必填缺失（水为空）时保存被拒、未写入');

// 6. 全部填写后保存成功写入
w.document.getElementById('tgt_water').value = '600';
w.document.getElementById('tgt_kcal').value = '300';
w.document.getElementById('tgt_protein').value = '25';
w.document.getElementById('tgt_fat').value = '10';
w.document.getElementById('tgt_phos').value = '200';
w.__save();
ok(DB.targets['c1'].water === 600 && DB.targets['c1'].kcal === 300 && DB.targets['c1'].protein === 25, '全部填写后保存成功写入 DB.targets');

// 7. 首页「今日营养摄入」卡片：仅必填项显示达标小字（水/热量/蛋白质），选填不显示
DB.foods.push({ id: 'f1', name: '主粮', kcal: 300, water: 10, protein: 25, fat: 10, phos: 200, catId: 'c1' });
const td = w.__today();
DB.feedings.push({ id: 'fe1', catId: 'c1', date: td, foodId: 'f1', grams: 50 }); // kcal=150(还差), protein=12.5(还差)
DB.targets['c1'] = { water: 600, kcal: 300, protein: 25, fat: 10, phos: 200 };
const homeEl = w.document.createElement('div');
w.__renderHome(homeEl);
const homeHtml = homeEl.innerHTML;
ok(/还差/.test(homeHtml) && /var\(--red\)/.test(homeHtml), '首页卡片显示「还差」红色提示（热量未达标）');
ok(/设定目标/.test(homeHtml), '首页卡片含「设定目标」入口');
ok(/热量<\/div>/.test(homeHtml) && !/kJ/.test(homeHtml), '首页热量标签只显示千卡（已去除 kJ 近似）');
// 选填 fat/phos 不应有达标小字：仅 水/热量/蛋白质 三类必填项会输出「目标<数字>」提示
const tgtCount = (homeHtml.match(/目标\d/g) || []).length;
ok(tgtCount === 3, '首页恰好 3 处「目标<数字>」提示（水/热量/蛋白质），选填不显示 → 实际=' + tgtCount);

console.log(`\nsmoke17: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

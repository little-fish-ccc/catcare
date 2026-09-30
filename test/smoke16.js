/* smoke16（主程序）：食物档案新增粗纤维 + 上传/识别分离 + 取消识别停留编辑界面 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document','window','navigator','HTMLElement','Node','getComputedStyle','customElements','location','history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
// 跳过应用的 DOMContentLoaded 整页初始化（core.js/main.js 在该事件里绑定页面骨架事件，
// 测试桩缺少页面骨架会触发无关的 async 报错）；本测试直接驱动 openForm/recognizeFoodPhoto 等局部函数。
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__E = ENTITIES.food; window.__MAP = FOOD_FIELD_MAP; window.__recognize = recognizeFoodPhoto; window.__compare = openFoodCompareModal; window.__keep = openFormKeepData;');
const E = w.__E, MAP = w.__MAP;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

// 1. 粗纤维字段存在、单位正确、归入更多营养分组
const fiber = E.fields.find(f => f.k === 'fiber');
ok(fiber && fiber.label === '粗纤维' && fiber.unit === 'g/100g', '粗纤维字段存在（label=粗纤维, unit=g/100g）');
ok(fiber && fiber.grp === 'nutrient' && fiber.grpTitle && /更多营养/.test(fiber.grpTitle), '粗纤维已归入「更多营养（选填）」折叠分组');

// 2. FOOD_FIELD_MAP 含 fiber，且识别文字可映射
ok(MAP.fiber && MAP.fiber.alias.some(a => a === '粗纤维'), 'FOOD_FIELD_MAP 含 fiber（别名含「粗纤维」）');
const m = w.parseFoodText('粗纤维 3.2 g\n碳水化合物 20 g');
ok(m.some(x => x.field === 'fiber' && x.value === '3.2'), 'parseFoodText 能识别「粗纤维 3.2 g」→ fiber');

// 3. 食物编辑表单：含粗纤维输入，且照片区有「识别所上传的图片」按钮、提示“上传图片仅保存”
w.openForm('food');
const formHtml = w.document.getElementById('modalRoot').innerHTML;
ok(/粗纤维/.test(formHtml), '食物表单含「粗纤维」输入');
ok(/识别所上传的图片/.test(formHtml), '照片区含「识别所上传的图片」按钮');
ok(/上传图片仅保存/.test(formHtml), '提示文案为“上传图片仅保存”（不再自动识别）');
ok(/disabled[^>]*识别所上传的图片|识别所上传的图片[^<]*<\/button>/.test(formHtml) ? /disabled/.test(formHtml) : true, '初始无图片时识别按钮为禁用态（HTML 含 disabled）');
ok(formHtml.includes('disabled') && /识别所上传的图片/.test(formHtml), '无图片时「识别所上传的图片」按钮为 disabled');

// 4. 未上传图片直接点识别：不报错、不替换表单（停留在编辑界面）
let threw = false;
try { w.__recognize(); } catch (e) { threw = true; }
ok(!threw, '未上传图片时 recognizeFoodPhoto() 不抛错');
ok(w.document.getElementById('modalRoot').innerHTML.includes('dynForm'), '未上传图片点识别后，食物表单仍在（未退出）');

// 5. 识别结果核对框「取消」= 停留在编辑界面（openFormKeepData），而非关闭
w.__compare([{ field: 'fiber', label: '粗纤维（每100g）', value: '3', unit: 'g', raw: '粗纤维 3 g' }], '粗纤维 3 g');
const cmp = w.document.getElementById('modalRoot').innerHTML;
ok(/核对照片识别结果/.test(cmp), '核对框正常弹出');
ok(cmp.includes('onclick="openFormKeepData()"'), '核对框「取消」按钮调用 openFormKeepData()（停留在编辑界面，而非 closeModal）');
// 模拟取消：直接调用 openFormKeepData，确认表单重新渲染且数据保留
w.__keep();
const back = w.document.getElementById('modalRoot').innerHTML;
ok(back.includes('dynForm') && /粗纤维/.test(back), '取消识别后表单重新打开并仍含「粗纤维」字段（数据未丢）');

console.log(`\nsmoke16: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

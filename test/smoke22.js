/* smoke22（主程序）：健康档案报告类型自定义 + 按年/第几次折叠分组 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="previewRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document','window','navigator','HTMLElement','Node','getComputedStyle','customElements','location','history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__renderHA=renderHealthArchive;window.__openForm=openForm;window.__onSingleOther=onSingleOther;window.__getForm=()=>_formData;window.__submit=submitForm;window.__toggle=toggleHaSession;window.__haTitle=haTitle;');
const DB = w.__DB;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

// ===== 1. 报告类型「其他」→ 自定义输入 =====
DB.cats.push({ id: 'c1', name: '布丁' });
DB.healthArchives.length = 0;
w.__openForm('healthArchive');
const modal = w.document.getElementById('modalRoot');
ok(/<select name="reportType__sel"[^>]*>/.test(modal.innerHTML), '报告类型下拉使用 __sel 命名');
ok(/<option value="其他"[^>]*>其他<\/option>/.test(modal.innerHTML), '报告类型含「其他」选项');
ok(/name="reportType__other"/.test(modal.innerHTML), '存在自定义输入框 reportType__other');

// 模拟选「其他」并输入自定义类型
const sel = modal.querySelector('select[name="reportType__sel"]');
sel.value = '其他';
w.__onSingleOther('reportType', '其他');
const otherInput = modal.querySelector('input[name="reportType__other"]');
ok(otherInput && otherInput.style.display !== 'none', '选中「其他」后自定义输入框显示');
otherInput.value = 'CT检查';
w.__onSingleOther('reportType', '其他');
ok(w.__getForm().reportType === 'CT检查', '自定义报告类型写入 _formData（CT检查）');

// 切回普通选项应隐藏输入框并写回普通值
sel.value = 'DR';
w.__onSingleOther('reportType', '其他');
ok(w.__getForm().reportType === 'DR', '切回普通选项写回普通值（DR）');
ok(otherInput.style.display === 'none', '切回普通选项后输入框隐藏');

// ===== 2. 按年/第几次折叠分组 =====
DB.healthArchives.push(
  { id: 'a1', catId: 'c1', year: 2026, seq: 2, type: '体检', reportType: 'DR', date: '2026-03-01' },
  { id: 'a2', catId: 'c1', year: 2026, seq: 2, type: '体检', reportType: '病例报告', date: '2026-03-01' },
  { id: 'a3', catId: 'c1', year: 2026, seq: 1, type: '体检', reportType: '血常规', date: '2026-01-01' }
);
const html = (() => { const el = w.document.getElementById('main'); w.__renderHA(el); return el.innerHTML; })();
const headCount = (html.match(/ha-session-head/g) || []).length;
ok(headCount === 2, `折叠分组数为 2（第2次含2项 + 第1次含1项）→ 实际 ${headCount}`);
ok((html.match(/2026年 第2次 体检/g) || []).length === 1, '「2026年 第2次 体检」仅作为分组标题出现一次');
ok(/toggleHaSession\(/.test(html), '分组头带展开/折叠切换');
ok(/ha-session-body/.test(html) && html.includes('DR') && html.includes('病例报告'), '分组体内含 DR、病例报告多项条目');
ok(/2 项/.test(html), '分组显示条目数「2 项」');
ok(!/2026 年 ·/.test(html), '已不再使用旧的「年份」分行样式');

// ===== 3. 折叠/展开切换 =====
w.__toggle('ha_c1_0');
const body = w.document.getElementById('ha_c1_0');
ok(body && body.style.display !== 'none', 'toggleHaSession 可展开分组体');

console.log(`\nsmoke22: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

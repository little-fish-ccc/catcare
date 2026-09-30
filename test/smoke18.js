/* smoke18（主程序）：健康档案 + 养护小tips + 体检报告链接健康档案 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document','window','navigator','HTMLElement','Node','getComputedStyle','customElements','location','history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__haTitle=haTitle;window.__renderHA=renderHealthArchive;window.__renderTips=renderCareTips;window.__openPicker=openHealthArchivePicker;window.__link=linkHealthArchive;window.__openLinked=openLinkedReport;window.__reportHTML=reportFieldHTML;window.__renderCats=renderCats;window.__openForm=openForm;window.__getCat=getCat;');
const DB = w.__DB;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

// 0. 数据表存在
ok(Array.isArray(DB.healthArchives), 'DB.healthArchives 表存在');
ok(Array.isArray(DB.careTips), 'DB.careTips 表存在');

// 1. haTitle 格式
ok(w.__haTitle({ year: 2026, seq: 1, type: '体检' }) === '2026年 第1次 体检', 'haTitle 生成「2026年 第1次 体检」');
ok(w.__haTitle({ year: 2025, seq: 3, type: '复查' }) === '2025年 第3次 复查', 'haTitle 生成「2025年 第3次 复查」');

// 2. 准备一只猫 + 一条健康档案（含电子档）
DB.cats.push({ id: 'c1', name: '布丁' });
DB.healthArchives.push({ id: 'ha1', catId: 'c1', year: 2026, seq: 1, type: '体检', reportType: '血常规', date: '2026-07-25', files: [{ kind: 'image', data: 'data:image/png;base64,xx', name: 'x' }], summary: '正常' });

// 3. renderHealthArchive 包含该条目
const haHtml = (() => { const el = w.document.getElementById('main'); w.__renderHA(el); return el.innerHTML; })();
ok(/2026年 第1次 体检/.test(haHtml), '健康档案页含「2026年 第1次 体检」');
ok(/血常规/.test(haHtml), '健康档案页含报告类型「血常规」');
ok(/1 份电子档/.test(haHtml), '健康档案页显示电子档份数');
ok(/<h3>🐱 布丁/.test(haHtml), '健康档案按猫咪分组（布丁）');

// 4. 养护小tips
DB.careTips.push({ id: 't1', catId: '', category: '饮食', title: '化毛膏每周2-3次', content: '换毛季注意化毛', important: true });
const tipHtml = (() => { const el = w.document.getElementById('main'); w.__renderTips(el); return el.innerHTML; })();
ok(/化毛膏每周2-3次/.test(tipHtml), '养护tips页含 tip 标题');
ok(/<span class="chip">通用<\/span>/.test(tipHtml), '通用 tip 标记「通用」');
ok(/tip-item important/.test(tipHtml), '重要 tip 带 important 样式类');

// 5. report 字段：checkup 显示「从健康档案链接」按钮；healthArchive 不显示
w.__openForm('checkup');
const ckReport = w.__reportHTML({ k: 'reportFiles', label: '电子报告附件', type: 'report' });
ok(/从健康档案链接/.test(ckReport), '体检/复查的 report 字段含「从健康档案链接」按钮');
w.__openForm('healthArchive');
const haReport = w.__reportHTML({ k: 'files', label: '电子档', type: 'report' });
ok(!/从健康档案链接/.test(haReport), '健康档案的 report 字段不含链接按钮（避免循环引用）');

// 6. 链接逻辑：checkup 报告附件链接到健康档案
w.__openForm('checkup');
w._formData ? null : null;
// 通过内部 _formData 设置 catId（openForm 已选 c1）
const linkOk = (() => {
  try { w.__link('reportFiles', 'ha1'); return true; } catch (e) { console.log('  link err', e.message); return false; }
})();
ok(linkOk, 'linkHealthArchive 不抛错');
// 取回 _formData 中的 reportFiles（通过再次打开表单无法直接读，改用 openLinkedReport 验证引用存在）
const linkedHtml = (() => { try { w.__openLinked('ha1'); return w.document.getElementById('modalRoot').innerHTML; } catch (e) { return ''; } })();
ok(/布丁/.test(linkedHtml) && /血常规/.test(linkedHtml), '打开关联健康档案可展示其猫咪与报告类型');

// 7. 猫咪档案卡片含「健康档案 (N)」入口
const catsHtml = (() => { const el = w.document.getElementById('main'); w.__renderCats(el); return el.innerHTML; })();
ok(/健康档案 \(1\)/.test(catsHtml), '猫咪档案卡片含「健康档案 (1)」入口按钮');

console.log(`\nsmoke18: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

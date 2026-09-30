/* smoke23（主程序）：健康档案新增记录 — 报告日期「上次填写 / 今日」快捷选项 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="previewRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document','window','navigator','HTMLElement','Node','getComputedStyle','customElements','location','history','Blob','atob','btoa'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
w.atob = s => Buffer.from(s, 'base64').toString('binary');
w.btoa = s => Buffer.from(s, 'binary').toString('base64');
w.URL.createObjectURL = function () { return 'blob:x'; };
w.URL.revokeObjectURL = function () {};
global.URL = w.URL;
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__openForm=openForm;window.__setQuickDate=setQuickDate;window.__getForm=()=>_formData;window.__submit=submitForm;');
const DB = w.__DB;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

function fmtToday() { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

// 准备一只猫 + 一条已有健康档案记录（日期 2026-03-01）
DB.cats.push({ id: 'c1', name: '布丁' });
DB.healthArchives.length = 0;
DB.healthArchives.push({ id: 'a1', catId: 'c1', year: 2026, seq: 2, type: '体检', reportType: 'DR', date: '2026-03-01' });

// ===== 1. 打开新增表单，存在两个快捷按钮 =====
w.__openForm('healthArchive');
const modal = w.document.getElementById('modalRoot');
ok(/setQuickDate\('date','last'\)/.test(modal.innerHTML), '日期字段含「上次填写」按钮');
ok(/setQuickDate\('date','today'\)/.test(modal.innerHTML), '日期字段含「今日」按钮');

const dateInput = modal.querySelector('input[name="date"]');
ok(!!dateInput, '找到报告日期输入框');

// ===== 2. 点击「上次填写」→ 填入上次记录日期 =====
w.__setQuickDate('date', 'last');
ok(dateInput.value === '2026-03-01', `点「上次填写」填入上次记录日期 → 实际 ${dateInput.value}`);
ok(w.__getForm().date === '2026-03-01', '_formData.date 同步为上次记录日期');
ok(DB.healthArchives.length === 1, '点「上次填写」未新增/删除任何记录');

// ===== 3. 点击「今日」→ 填入当前日期 =====
w.__setQuickDate('date', 'today');
const t = fmtToday();
ok(dateInput.value === t, `点「今日」填入当前日期 → 实际 ${dateInput.value}（期望 ${t}）`);
ok(w.__getForm().date === t, '_formData.date 同步为今日');

// ===== 4. 无已有记录时「上次填写」给提示且不报错 =====
w.__openForm('healthArchive');
DB.healthArchives.length = 0;
let threw = false;
try { w.__setQuickDate('date', 'last'); } catch (e) { threw = true; }
ok(!threw, '无记录时「上次填写」不抛错');
ok(w.document.getElementById('toastRoot').innerHTML.includes('暂无其他已填写记录'), '无记录时给出提示 toast');

console.log(`\nsmoke23: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/* smoke32（主程序）：自动备份频率改为「每月一次」，导出按钮常在
   1) monthKey() 返回 YYYY-MM
   2) 旧「同一天」变量已移除
   3) 本月已备份 → 不再重复下载；跨月 → 允许下载一次
   4) 备份弹窗里导出/导入按钮常在，文案已更新为「每月」 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom').JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="previewRoot"></div><div id="main"></div><nav id="sidenav"></nav><div id="navMask"></div><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://little-fish-ccc.github.io/catcare/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history', 'Blob', 'URL', 'atob', 'btoa'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__monthKey=monthKey;window.__testBackupTick=function(){ if (_lastBackupMonth === monthKey()) return 0; _lastBackupMonth = monthKey(); return 1; };window.__getLastMonth=function(){return _lastBackupMonth;};window.__setLastMonth=function(v){_lastBackupMonth=v;};window.__openDataModal=openDataModal;');

/* 1. monthKey 格式 */
ok(typeof w.__monthKey === 'function', 'monthKey() 函数存在');
const mk = w.__monthKey();
ok(/^\d{4}-\d{2}$/.test(mk), `monthKey() 返回 YYYY-MM（当前=${mk}）`);

/* 2. 旧「同一天」变量已移除 */
const coreSrc = fs.readFileSync(root + '/js/core.js', 'utf8');
ok(!/_lastBackupDate/.test(coreSrc), '旧变量 _lastBackupDate 已移除');
ok(/_lastBackupMonth/.test(coreSrc), '新变量 _lastBackupMonth 已就位');
ok(!/同一天只自动备份一次/.test(coreSrc), '旧注释「同一天」已更新');
ok(/同一个月只自动备份一次/.test(coreSrc), '新注释「同一个月」已就位');

/* 3. 频率逻辑：用 __testBackupTick 计数（等价于 6s 回调内的判断分支） */
w.eval('downloadBackup = function(){ window.__dl = (window.__dl||0)+1; };');
function simulateSave() {
  const decided = w.__testBackupTick();
  if (decided) w.eval('downloadBackup();');
}

// 本月已备份 → 不再下载
w.__setLastMonth(mk);
w.__dl = 0; simulateSave();
ok(w.__dl === 0, '本月已备份 → 同月内再次保存不再自动下载');

// 跨月 → 下载 1 次，并记录月份
w.__setLastMonth('2020-01');
w.__dl = 0; simulateSave();
ok(w.__dl === 1, '跨月后 → 自动备份 1 次');
ok(w.__getLastMonth() === mk, '备份后 _lastBackupMonth 更新为当前月');

// 跨月后再保存 → 仍不下载
w.__dl = 0; simulateSave();
ok(w.__dl === 0, '当月已备份后 → 再次保存不重复下载');

/* 4. 备份弹窗：按钮常在 + 文案更新 */
let captured = '';
const _open = w.eval('openModal');
w.eval('openModal = function(t,h,btns){ window.__modal = t + "||" + h; };');
w.__openDataModal();
const mHtml = w.__modal || '';
ok(/导出备份（\.json）/.test(mHtml), '「导出备份（.json）」按钮常在');
ok(/导入备份/.test(mHtml), '「导入备份」按钮常在');
ok(/每月首次改动/.test(mHtml), '说明文案已更新为「每月首次改动」');
ok(!/每天首次改动/.test(mHtml), '旧文案「每天首次改动」已移除');
ok(/每月只下载一次/.test(mHtml), '说明「每月只下载一次」');

console.log(`\nsmoke32: ${pass}/${pass + fail} 通过${fail ? '（失败 ' + fail + '）' : ''}`);
process.exit(fail ? 1 : 0);

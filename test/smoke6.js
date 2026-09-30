const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.com/' });
const w = dom.window;
// 沙箱里 jsdom 可能无 URL.createObjectURL，补桩以避免下载报错（应被 try/catch 吞掉）
if (typeof w.URL.createObjectURL !== 'function') w.URL.createObjectURL = () => 'blob:stub';
if (typeof w.URL.revokeObjectURL !== 'function') w.URL.revokeObjectURL = () => {};

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

const files = ['js/core.js', 'js/schemas.js', 'js/pages.js', 'js/stats.js', 'js/main.js'];
let bundle = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
w.eval(bundle + '\n;window.DBref=DB;window.dbHasDataRef=dbHasData;window.dbSaveRef=dbSave;window.showRecoverModalRef=showRecoverModal;window.openModalRef=openModal;');

// 1. 空库判定
ok(w.dbHasDataRef() === false, '空库时 dbHasData() 返回 false');

// 2. 有数据时判定为 true
w.DBref.cats.push({ id: 'x', name: '测试猫' });
ok(w.dbHasDataRef() === true, '加入猫咪后 dbHasData() 返回 true');

// 3. dbSave 触发自动备份不抛错（定时器不会立即执行，仅验证同步路径安全）
let threw = false;
try { w.dbSaveRef(); } catch (e) { threw = true; }
ok(!threw, 'dbSave() 调用 scheduleAutoBackup 不抛错');

// 4. showRecoverModal 已定义且调用不抛错（openModal 已被 stub 暴露）
let recoverThrew = false;
try { typeof w.showRecoverModalRef === 'function' && w.showRecoverModalRef(); } catch (e) { recoverThrew = true; console.log('   err:', e.message); }
ok(typeof w.showRecoverModalRef === 'function', 'showRecoverModal() 已定义');
ok(!recoverThrew, 'showRecoverModal() 调用不抛错（空库恢复弹窗可正常弹出）');

// 5. dbHasData 不误判：清掉猫咪后回到 false
w.DBref.cats.length = 0;
ok(w.dbHasDataRef() === false, '清空猫咪后 dbHasData() 回到 false（避免空库也弹“恢复”）');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

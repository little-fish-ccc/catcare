/* smoke21（主程序）：健康档案附件预览（PDF 用 blob URL + <object>，避免大体积 PDF 白屏） */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="previewRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document','window','navigator','HTMLElement','Node','getComputedStyle','customElements','location','history','Blob'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
/* jsdom 的 atob 在 w.eval 裸引用时会抛错，用 Buffer 垫片替代（仅测试环境，真实浏览器无此问题） */
w.atob = s => Buffer.from(s, 'base64').toString('binary');
w.btoa = s => Buffer.from(s, 'binary').toString('base64');
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
/* jsdom 未实现 URL.createObjectURL/revokeObjectURL，补桩 */
let _blobSeq = 0;
w.URL.createObjectURL = function () { return 'blob:https://x.test/obj' + (++_blobSeq); };
w.URL.revokeObjectURL = function () {};
global.URL = w.URL;

const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__openPdf=openPdf;window.__showBigImg=showBigImg;window.__openForm=openForm;window.__ENT=ENTITIES;');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const PDF = 'data:application/pdf;base64,SGVsbG8gd29ybGQ=';  /* 合法 base64（"Hello world"），仅用于验证预览渲染逻辑 */

// 1. 打开 PDF 预览不抛错，使用 blob URL + <object>（大体积 PDF 不再白屏）
let err = null;
try { w.__openPdf(PDF); } catch (e) { err = e; }
ok(!err, 'openPdf 不抛错' + (err ? ' → ' + err.message : ''));
const pRoot = w.document.getElementById('previewRoot');
ok(/<object[^>]+data="blob:/.test(pRoot.innerHTML), 'PDF 预览使用 <object data="blob:">（支持大体积，不再白屏）');
ok(!/iframe[^>]+src="data:application\/pdf/.test(pRoot.innerHTML), 'PDF 预览不再用 data:application/pdf 的 iframe（避免超长属性白屏）');
ok(/下载/.test(pRoot.innerHTML), 'PDF 预览含「下载」入口');
ok(/关闭/.test(pRoot.innerHTML), 'PDF 预览含「关闭」按钮');

// 2. 关闭预览层可清空
w.eval('closePreview()');
ok(w.document.getElementById('previewRoot').innerHTML.trim() === '', 'closePreview 清空预览层');

// 3. 空/异常数据优雅提示
w.document.getElementById('toastRoot').innerHTML = '';
try { w.__openPdf('not-a-pdf'); ok(/PDF 数据缺失|PDF 打开失败/.test(w.document.getElementById('toastRoot').innerHTML), '非 PDF 数据给出提示'); } catch (e) { ok(false, '非 PDF 数据应优雅处理，未抛错'); }

// 4. 图片预览用 data URL（showBigImg）
w.__showBigImg('data:image/png;base64,AAA');
ok(/<img src="data:image\/png/.test(pRoot.innerHTML), 'showBigImg 使用 data:image 预览（非 blob）');

console.log(`\nsmoke21: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

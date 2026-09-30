/* 主程序 smoke20：养护小tips 上传截图 + 识别文字 + 附件保留 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>',
  { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
// 跳过 app 的 DOMContentLoaded 自动初始化（测试桩缺少页面骨架）
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (t, fn, o) { if (t === 'DOMContentLoaded' || t === 'readystatechange') return _dae; return _dae(t, fn, o); };
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' +
  fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__E=ENTITIES;window.__openForm=openForm;window.__recognize=recognizeTipPhoto;window.__runOCR=runOCR;window.__openOCR=openTipOCRModal;window.__apply=applyTipOCR;window.__fail=openTipOCRFailModal;window.__tipHTML=tipItemHTML;window.__getForm=()=>_formData;window.__renderFields=renderFields;');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } }

(async function () {
  // 1. careTip 实体含 photo 字段
  ok(w.__E.careTip.fields.some(f => f.k === 'photo' && f.type === 'photo'), 'careTip 实体新增 photo（截图/附件）字段');

  // 2. OCR 相关函数均已定义
  ['recognizeTipPhoto', 'runOCR', 'openTipOCRModal', 'applyTipOCR', 'openTipOCRFailModal'].forEach(fn =>
    ok(typeof w[fn] === 'function', fn + ' 已定义'));

  // 3. 表单渲染：careTip 的 photo 字段含「识别图中文字」按钮（无图时禁用）
  w.__openForm('careTip');
  let html = w.document.getElementById('dynForm').innerHTML;
  ok(/id="tipOcrBtn"/.test(html), 'careTip 表单含「识别图中文字」按钮');
  ok(/id="tipOcrBtn"[^>]*disabled/.test(html), '无截图时该按钮为禁用态');

  // 4. 上传截图后按钮启用
  const fd = w.__getForm();
  fd.photo = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'];
  w.eval('refreshForm()');
  html = w.document.getElementById('dynForm').innerHTML;
  ok(/id="tipOcrBtn"/.test(html) && !/id="tipOcrBtn"[^>]*disabled/.test(html), '有截图后按钮启用');

  // 5. 无截图时调用 recognizeTipPhoto 不崩溃
  fd.photo = [];
  let threw = false;
  try { w.__recognize(); } catch (e) { threw = true; }
  ok(!threw, '无截图时 recognizeTipPhoto 安全（toast 提示，不抛错）');

  // 6. 模拟 OCR 成功：识别文字填入内容，截图仍作为附件保留
  w.Tesseract = { recognize: (dataUrl, lang, opts) => Promise.resolve({ data: { text: '化毛膏每周喂 2-3 次，饭后喂' } }) };
  fd.photo = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'];
  fd.content = '已有内容：';
  w.__recognize();
  await new Promise(r => setTimeout(r, 20)); // 等 OCR promise 完成
  const ta = w.document.getElementById('tipOcrText');
  ok(!!ta && /化毛膏每周喂/.test(ta.value), '识别结果出现在「采用并填入」弹窗文字框');
  if (ta) ta.value = '化毛膏每周喂 2-3 次，饭后喂';
  w.__apply();
  ok(/化毛膏每周喂/.test(fd.content) && /已有内容/.test(fd.content), 'applyTipOCR 将识别文字并入内容（保留原内容）');
  ok(fd.photo && fd.photo.length === 1, '截图仍作为附件保留在 _formData.photo');

  // 7. 卡片渲染：有截图显示缩略图，无截图不显示
  const withPhoto = w.__tipHTML({ id: 't1', title: 'T', content: 'C', photo: ['data:image/png;base64,AAA'] });
  ok(/class="rec-thumb"/.test(withPhoto) && /showBigImg/.test(withPhoto), 'tip 卡片在有截图时显示可放大的缩略图');
  const noPhoto = w.__tipHTML({ id: 't2', title: 'T2', content: 'C2' });
  ok(!/class="rec-thumb"/.test(noPhoto), 'tip 卡片在无截图时不显示缩略图');

  console.log(`\nsmoke20: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

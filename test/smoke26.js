/* smoke26（主程序）：修复 compressImage 手机拍照缩略图黑色（drawImage 须在 decode 后） */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="toastRoot"></div></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history', 'Blob', 'URL', 'atob', 'btoa'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

// 桩：图片解码（onload 后位图就绪；decode() 返回 Promise）
let decodeCalls = 0, drawCalls = 0;
w.Image = class {
  constructor() { this.width = 0; this.height = 0; this._src = ''; this.onload = null; this.onerror = null; }
  set src(v) { this._src = v; setTimeout(() => { this.width = 1200; this.height = 900; if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
  decode() { decodeCalls++; return Promise.resolve(); }
};
// 桩：FileReader 读成原图 dataUrl
w.FileReader = class {
  readAsDataURL() { setTimeout(() => { this.result = 'data:image/jpeg;base64,ORIGINAL'; if (this.onload) this.onload({ target: this }); }, 0); }
};
// 桩：canvas 2d 上下文
const origCreate = w.document.createElement.bind(w.document);
w.document.createElement = function (tag) {
  if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ({ drawImage: () => { drawCalls++; } }), toDataURL: () => 'data:image/jpeg;base64,COMPRESSED' };
  return origCreate(tag);
};

const bundle = fs.readFileSync(root + '/js/core.js', 'utf8');
w.eval(bundle + '\n;window.__compressImage=compressImage;');
const tick = () => new Promise(r => setTimeout(r, 30));

(async () => {
  // 1. 正常：等待 decode 后绘制，返回压缩图（而非透明→黑图）
  decodeCalls = 0; drawCalls = 0; let got = '?';
  w.__compressImage({ name: 'p.jpg', type: 'image/jpeg' }, d => { got = d; });
  await tick();
  ok(got === 'data:image/jpeg;base64,COMPRESSED', '正常图片 → 返回压缩后的 dataUrl（非黑图）');
  ok(drawCalls === 1, 'drawImage 被调用（绘制路径执行）');
  ok(decodeCalls === 1, '先调用 img.decode() 等待解码后再绘制（黑图根因修复）');

  // 2. decode 失败 → 回退原图，绝不产出透明/黑画布
  w.Image = class { set src(v) { setTimeout(() => { if (this.onload) this.onload(); }, 0); } get src() { return ''; } decode() { return Promise.reject(new Error('no decode')); } };
  let got2 = '?';
  w.__compressImage({ name: 'p.jpg', type: 'image/jpeg' }, d => { got2 = d; });
  await tick();
  ok(got2 === 'data:image/jpeg;base64,ORIGINAL', 'decode 失败 → 回退原图（不产出黑图）');

  console.log(`\nsmoke26: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

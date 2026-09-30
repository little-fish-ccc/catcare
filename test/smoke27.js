/* smoke27（主程序）：修复「健康事件表单上传图片后不显示」
   根因：refreshForm() 改为原地更新后，photo-box 不再重绘，
   上传成功 _formData 里有图，但视图不刷新 → 用户看到「上传后不显示」。
   本测试模拟：打开健康事件表单 → 选图 → 校验 photo-box 里立即出现新图（含多张）。 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom').JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="previewRoot"></div><div id="main"></div><nav id="sidenav"></nav><div id="navMask"></div><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history', 'Blob', 'URL', 'atob', 'btoa'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

/* 桩：Image（onload 后位图就绪 + decode 可用） */
w.Image = class {
  constructor() { this.width = 0; this.height = 0; this._src = ''; this.onload = null; this.onerror = null; }
  set src(v) { this._src = v; setTimeout(() => { this.width = 800; this.height = 600; if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
  decode() { return Promise.resolve(); }
};
/* 桩：FileReader 异步读出 dataUrl */
let fileSeq = 0;
w.FileReader = class {
  readAsDataURL(f) {
    const d = 'data:image/jpeg;base64,PHOTO' + (++fileSeq);
    setTimeout(() => { this.result = d; if (this.onload) this.onload({ target: this }); }, 0);
  }
};
/* 桩：canvas 2d */
const origCreate = w.document.createElement.bind(w.document);
w.document.createElement = function (tag) {
  if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,PHOTO' + fileSeq };
  return origCreate(tag);
};

const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__openForm=openForm;window.__formData=()=>_formData;');
const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
w.render = function () {};
const tick = () => new Promise(r => setTimeout(r, 50));

(async () => {
  /* 1. 打开健康事件表单，photo-box 初始无图 */
  w.__openForm('health');
  let box = w.document.querySelector('.photo-box[data-photo="photo"]');
  ok(!!box, '表单打开后存在 photo 字段');
  ok(box.querySelectorAll('img').length === 0, '初始无图');

  /* 2. 模拟选图：触发 file input change */
  const inp = box.querySelector('input[type=file]');
  const fakeFile = { name: 'p1.jpg', type: 'image/jpeg' };
  Object.defineProperty(inp, 'files', { value: [fakeFile], configurable: true });
  inp.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick();

  box = w.document.querySelector('.photo-box[data-photo="photo"]');
  const imgs1 = box ? box.querySelectorAll('img').length : -1;
  ok(imgs1 === 1, '上传第 1 张后立即显示（当前 photo-box img 数=' + imgs1 + '）');

  /* 3. 再传第 2 张（多图） */
  const inp2 = box.querySelector('input[type=file]');
  Object.defineProperty(inp2, 'files', { value: [fakeFile], configurable: true });
  inp2.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick();

  box = w.document.querySelector('.photo-box[data-photo="photo"]');
  const imgs2 = box ? box.querySelectorAll('img').length : -1;
  ok(imgs2 === 2, '上传第 2 张后累计显示 2 张（当前 img 数=' + imgs2 + '）');

  /* 4. 数据层正确性：_formData.photo 里确实有 2 张（数据没丢，只是视图问题） */
  const fd = w.__formData();
  ok(Array.isArray(fd.photo) && fd.photo.length === 2, '_formData.photo 数据层有 2 张');

  /* 5. 删除第 1 张后立即从视图消失 */
  const img0 = box.querySelector('img');
  if (img0) img0.dispatchEvent(new w.Event('click', { bubbles: true }));
  await tick();
  box = w.document.querySelector('.photo-box[data-photo="photo"]');
  const imgs3 = box ? box.querySelectorAll('img').length : -1;
  ok(imgs3 === 1, '删除 1 张后视图立即剩 1 张（当前 img 数=' + imgs3 + '）');

  console.log(`\nsmoke27: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

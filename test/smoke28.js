/* smoke28（主程序）：健康事件「点击跳详情 + 多图显示 + 详情补图」
   1) 列表页点击记录 → 打开详情弹窗（含字段行、图库、补充图片按钮）
   2) 详情图库点击 → 大图预览
   3) 详情内 ＋ 补充图片 → 追加保存并立即显示
   4) 首页：最近一次健康异常卡片点击 → 事件详情；快捷按钮「健康异常」→ 健康事件列表 */
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

/* 桩：Image / FileReader / canvas（同 smoke27） */
w.Image = class {
  constructor() { this.width = 0; this.height = 0; this._src = ''; this.onload = null; this.onerror = null; }
  set src(v) { this._src = v; setTimeout(() => { this.width = 800; this.height = 600; if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
  decode() { return Promise.resolve(); }
};
let fileSeq = 100;
w.FileReader = class {
  readAsDataURL(f) {
    const d = 'data:image/jpeg;base64,NEW' + (++fileSeq);
    setTimeout(() => { this.result = d; if (this.onload) this.onload({ target: this }); }, 0);
  }
};
const origCreate = w.document.createElement.bind(w.document);
w.document.createElement = function (tag) {
  if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,NEW' + fileSeq };
  return origCreate(tag);
};

const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__showRecordDetail=showRecordDetail;window.__addDetailPhoto=addDetailPhoto;window.__showBigImgAt=showBigImgAt;window.__renderListPage=renderListPage;window.__renderHome=renderHome;window.__today=today;');
const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
const td = w.__today();
/* 一条呕吐健康事件，带 2 张图 */
const P1 = 'data:image/jpeg;base64,AAA', P2 = 'data:image/jpeg;base64,BBB';
DB.health.push({ id: 'h1', catId: 'c1', date: td, time: '07:30', type: '呕吐', severity: '轻微', observe: true, visited: false, vomitTypes: ['毛球', '透明胃液'], vomitAmount: '少量', vomitPhoto: [P1, P2], notes: '吐完正常进食', photo: [] });
w.render = function () {};
const tick = () => new Promise(r => setTimeout(r, 50));

(async () => {
  /* 1. 列表页：记录可点击跳详情 */
  const el = w.document.createElement('div');
  w.__renderListPage(el, 'health');
  const html = el.innerHTML;
  ok(/showRecordDetail\('health','h1'\)/.test(html), '列表记录绑定 showRecordDetail');
  ok(/rec-thumb/.test(html), '列表缩略图渲染（首图）');

  /* 2. 打开详情弹窗 */
  w.__showRecordDetail('health', 'h1');
  const modal = w.document.getElementById('modalRoot').innerHTML;
  ok(/呕吐物类型/.test(modal), '详情显示呕吐物类型字段');
  ok(/毛球、透明胃液/.test(modal), '多选值以顿号连接显示');
  ok(/吐完正常进食/.test(modal), '详情显示备注');
  ok(/✓ 是否需要持续观察/.test(modal), '勾选的布尔项以 chip 显示');
  ok(!/是否已就医/.test(modal), '未勾选布尔项不显示（简练）');
  const galleryImgs = w.document.querySelectorAll('#modalRoot .detail-gallery img');
  ok(galleryImgs.length === 2, '详情图库显示 2 张呕吐物照片（当前=' + galleryImgs.length + '）');
  ok(/addDetailPhoto\('health','h1','vomitPhoto'\)/.test(modal), '详情内有「＋ 补充图片」按钮');

  /* 3. 点击图库图片 → 大图预览（outside-only 模式不执行内联 onclick，直接调用处理函数；
        绑定关系已由上面的 HTML 断言覆盖） */
  ok(/showBigImgAt\('vomitPhoto',0\)/.test(modal), '图库图片绑定 showBigImgAt 查看大图');
  w.__showBigImgAt('vomitPhoto', 0);
  const pv = w.document.getElementById('previewRoot').innerHTML;
  ok(/data:image\/jpeg;base64,AAA/.test(pv), '点击图片打开大图预览');

  /* 4. 详情内补充图片：模拟 addDetailPhoto 创建的 input change */
  w.__addDetailPhoto('health', 'h1', 'vomitPhoto');
  const dinp = w.document.getElementById('detailPhotoInput');
  ok(!!dinp, '补充图片创建了文件选择器');
  Object.defineProperty(dinp, 'files', { value: [{ name: 'p3.jpg', type: 'image/jpeg' }], configurable: true });
  dinp.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick();
  const rec = DB.health.find(x => x.id === 'h1');
  ok(rec.vomitPhoto.length === 3, '补图后记录 vomitPhoto 有 3 张（当前=' + rec.vomitPhoto.length + '）');
  const imgs2 = w.document.querySelectorAll('#modalRoot .detail-gallery img');
  ok(imgs2.length === 3, '详情弹窗重渲染后图库显示 3 张（当前=' + imgs2.length + '）');
  /* localStorage 保存（无 IndexedDB 环境回退内联） */
  const saved = JSON.parse(w.localStorage.getItem('catcare_db_v1'));
  ok(saved && saved.health[0] && saved.health[0].vomitPhoto.length === 3, '补图已持久化到 localStorage');

  /* 5. 首页：最近一次健康异常卡片 → 事件详情；快捷按钮 → 健康事件列表 */
  const hel = w.document.createElement('div');
  w.__renderHome(hel);
  const hhtml = hel.innerHTML;
  ok(/showRecordDetail\('health','h1'\)/.test(hhtml), '首页「最近一次健康异常」点击直达事件详情');
  ok(/go\('health'\)/.test(hhtml) && !/openForm\('health'\)/.test(hhtml), '首页快捷按钮「健康异常」跳转健康事件列表');

  console.log(`\nsmoke28: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

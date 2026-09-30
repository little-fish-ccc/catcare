/* smoke19（主程序）：健康档案单独导出 / 合并导入（不影响其他模块） */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
const _dae = w.document.addEventListener.bind(w.document);
w.document.addEventListener = function (type, fn, opts) { if (type === 'DOMContentLoaded' || type === 'readystatechange') return _dae; return _dae(type, fn, opts); };
const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
w.eval(bundle + '\n;window.__DB=DB;window.__export=exportHealthArchive;window.__import=importHealthArchive;window.__renderHA=renderHealthArchive;window.__today=today;');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const DB = w.__DB;
DB.cats.push({ id: 'c1', name: '咪咪', photo: [] });
DB.settings.selectedCat = 'c1';
w.render = function () {};

// 准备数据：健康档案 2 条 + 其他模块 1 条喂食
DB.healthArchives.push({ id: 'h1', catId: 'c1', year: 2026, seq: 1, type: '体检', reportType: '血常规', date: '2026-07-25', files: [{ name: 'a.png', kind: 'image', data: 'data:image/png;base64,AAA' }], summary: '正常' });
DB.healthArchives.push({ id: 'h2', catId: 'c1', year: 2026, seq: 2, type: '复查', reportType: '生化全套', date: '2026-08-01', files: [], summary: '' });
DB.feedings.push({ id: 'fe1', catId: 'c1', date: w.__today(), foodId: 'f1', grams: 50 });
const otherBefore = DB.feedings.length;

(async function () {
  // 1. 导出：stub 下载，捕获 Blob 内容
  let captured = null;
  w.URL.createObjectURL = (b) => { captured = b; return 'blob:stub'; };
  w.URL.revokeObjectURL = () => {};
  const origCreate = w.document.createElement.bind(w.document);
  w.document.createElement = function (tag) { const el = origCreate(tag); if (tag === 'a') el.click = function () { }; return el; };
  w.__export();
  ok(captured != null, 'exportHealthArchive 触发了下载（构造了 Blob）');
  const txt = await new Promise((res, rej) => { const rd = new w.FileReader(); rd.onload = () => res(rd.result); rd.onerror = () => rej(rd.error); rd.readAsText(captured); });
  const payload = JSON.parse(txt);
  ok(payload.kind === 'healthArchive', '导出文件 kind=healthArchive');
  ok(Array.isArray(payload.data.healthArchives) && payload.data.healthArchives.length === 2, '导出含 2 条健康档案');
  const h1 = payload.data.healthArchives.find(x => x.id === 'h1');
  ok(h1 && h1._catName === '咪咪', '导出写入 _catName 快照（咪咪）');
  ok(h1.files && h1.files[0].data.startsWith('data:image'), '电子档附件（data URL）随档案一起导出');

  // 2. 模拟另一台设备导入：h1 重复 + h3 新增，不带 cats
  const importPayload = {
    app: '猫猫工作台', kind: 'healthArchive', version: 1, exportedAt: new Date().toISOString(),
    data: { healthArchives: [
      { id: 'h1', catId: 'c1', year: 2026, seq: 1, type: '体检', reportType: '血常规', date: '2026-07-25', files: [], summary: '正常' },
      { id: 'h3', catId: 'c1', year: 2026, seq: 3, type: '体检', reportType: 'DR', date: '2026-08-10', files: [], summary: '', _catName: '咪咪' }
    ] }
  };
  const fileText = JSON.stringify(importPayload);
  const fakeInput = { value: 'x', files: [{ name: 'ha.json' }] };
  w.FileReader = function () { const self = this; this.readAsText = function () { self.result = fileText; if (self.onload) self.onload(); }; };
  w.__import(fakeInput);
  await new Promise(r => setTimeout(r, 10));
  ok(DB.healthArchives.length === 3, '导入后健康档案 = 3 条（h1 重复跳过，h3 新增）→ 实际=' + DB.healthArchives.length);
  ok(DB.healthArchives.some(x => x.id === 'h3'), 'h3 已新增');
  ok(DB.feedings.length === otherBefore, '其他模块 feedings 未被改动 → 仍=' + DB.feedings.length);
  ok(DB.cats.length === 1, 'cats 未被导入改动（仍 1 只）→ 满足“不影响其他模块”');

  // 3. 猫名回退：删除该猫后渲染应使用 _catName 快照
  DB.cats.length = 0;
  const haEl = w.document.createElement('div');
  w.__renderHA(haEl);
  const html = haEl.innerHTML;
  ok(/咪咪/.test(html), '猫被删除后，健康档案卡片用 _catName 快照显示「咪咪」');
  ok(/导出备份/.test(html) && /导入备份/.test(html), '健康档案页含「导出备份」「导入备份」按钮');

  console.log(`\nsmoke19: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

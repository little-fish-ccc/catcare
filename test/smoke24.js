/* smoke24（主程序）：健康档案新增就医类型 + 大附件转存 IndexedDB 修复「本地存储空间不足」 */
const fs = require('fs');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const DB_KEY = 'catcare_db_v1';

/* ---- 共享的 fake IndexedDB（A、B 两个实例共用其底层 Map，模拟"刷新后再次加载"） ---- */
function makeFakeIDB() {
  const map = new Map();
  function Req() { this.result = undefined; this.onsuccess = null; this.onerror = null; this.oncomplete = null; this.onabort = null; }
  function fire(r, type, val) { if (r && r[type]) { r.result = val; r[type]({ target: { result: val } }); } }
  return {
    _map: map,
    open() {
      const openReq = new Req();
      setTimeout(() => {
        const db = {
          objectStoreNames: { contains: () => true },
          transaction: () => {
            const tx = new Req();
            tx.objectStore = () => ({
              put: (rec) => { map.set(rec.id, rec); const pr = new Req(); setTimeout(() => fire(pr, 'onsuccess', rec), 0); return pr; },
              get: (id) => { const pr = new Req(); setTimeout(() => fire(pr, 'onsuccess', map.get(id) || null), 0); return pr; },
              delete: (id) => { map.delete(id); const pr = new Req(); setTimeout(() => fire(pr, 'onsuccess', 1), 0); return pr; }
            });
            setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
            return tx;
          }
        };
        openReq.result = db; fire(openReq, 'onsuccess', db);
      }, 0);
      return openReq;
    }
  };
}
const fakeIDB = makeFakeIDB();

function makeHarness() {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="previewRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
  const w = dom.window;
  global.window = w; global.document = w.document; global.navigator = w.navigator;
  ['document', 'window', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
  global.indexedDB = fakeIDB; w.indexedDB = fakeIDB;
  const _dae = w.document.addEventListener.bind(w.document);
  w.document.addEventListener = function (t, fn, o) { if (t === 'DOMContentLoaded' || t === 'readystatechange') return _dae; return _dae(t, fn, o); };
  const bundle = fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8');
  w.eval(bundle + '\n;window.__DB=DB;window.__init=_initFiles;window.__ENTITIES=ENTITIES;window.__dbSave=dbSave;window.__register=registerFilesToIdb;window.__hydrate=hydrateFiles;window.__lean=leanClone;window.__FILE_FID=FILE_FID;window.__idbGet=idbGetFile;window.__dataUrlToBlob=dataUrlToBlob;window.__blobToDataUrl=blobToDataUrl;');
  return w;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

/* 模拟一张"大"PDF（base64 含唯一标记，便于断言是否被替换） */
const BIG_PDF = 'data:application/pdf;base64,' + 'UNIQUEMARKERXYZ' + 'A'.repeat(3000);

(async () => {
  // ===== 1. 健康档案类型新增「按计划就医」「临时就医」 =====
  const w0 = makeHarness();
  const typeField = w0.__ENTITIES.healthArchive.fields.find(f => f.k === 'type');
  ok(typeField && typeField.opts.includes('按计划就医'), '健康档案类型含「按计划就医」');
  ok(typeField && typeField.opts.includes('临时就医'), '健康档案类型含「临时就医」');

  // ===== 2. 旧内联大附件 → 保存时 localStorage 仅存引用（存储瘦身，修复超限） =====
  const wA = makeHarness();
  wA.__DB.cats.push({ id: 'c1', name: '布丁' });
  wA.__DB.healthArchives.push({ id: 'a1', catId: 'c1', year: 2026, seq: 1, type: '按计划就医', reportType: 'DR', date: '2026-03-01', files: [{ kind: 'pdf', name: '腹超.pdf', data: BIG_PDF }] });
  await wA.__register();                 // 迁移旧内联附件到 IndexedDB
  await sleep(10);
  wA.__dbSave();                        // 此时应写入"瘦身"后的 localStorage
  const storedA = wA.localStorage.getItem(DB_KEY);
  ok(/__ref/.test(storedA), '保存后 localStorage 含 {__ref} 引用');
  ok(!storedA.includes('UNIQUEMARKERXYZ'), '保存后 localStorage 不再内联完整 PDF（存储已瘦身，避免超限）');
  ok(fakeIDB._map.size >= 1, '附件二进制已写入 IndexedDB（' + fakeIDB._map.size + ' 条）');

  // ===== 3. 重新加载（读取瘦身后的数据）→ 附件还原为完整 dataUrl =====
  // 同一 realm 内模拟"刷新后再打开"：用已瘦身的 storedA 重建 DB，再 hydrate（避免跨 realm Blob）
  const parsed = JSON.parse(storedA);
  wA.__DB.healthArchives.length = 0;
  parsed.healthArchives.forEach(r => wA.__DB.healthArchives.push(r));
  await wA.__hydrate(); await sleep(10);
  const reloaded = wA.__DB.healthArchives.find(r => r.id === 'a1');
  ok(reloaded && reloaded.files && reloaded.files[0] && reloaded.files[0].data && reloaded.files[0].data.startsWith('data:application/pdf'), '重新加载后附件还原为完整 dataUrl（预览/导出可用）');
  ok(reloaded && reloaded.files && reloaded.files[0] && !('__ref' in reloaded.files[0]), '还原后不再是 {__ref} 引用');

  console.log(`\nsmoke24: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

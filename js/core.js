/* ================= 数据层 & 通用工具 & 表单引擎 ================= */
const DB_KEY = 'catcare_db_v1';
const DB_DEFAULT = {
  cats: [], foods: [], feedings: [], health: [], status: [], weights: [],
  medPlans: [], medRecords: [], carePlans: [], careRecords: [], deworm: [], excrete: [], water: [], vet: [], allergy: [], checkups: [], interactions: [], healthArchives: [], careTips: [],
  settings: { selectedCat: '', showKcal: true },
  targets: {}
};
let DB = dbLoad();
function dbLoad() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { const d = JSON.parse(raw); return Object.assign(JSON.parse(JSON.stringify(DB_DEFAULT)), d); }
  } catch (e) { console.warn(e); }
  return JSON.parse(JSON.stringify(DB_DEFAULT));
}
function dbSave() {
  try {
    /* 附件（图片/PDF）仅以 {__ref} 引用写入 localStorage；二进制已转存 IndexedDB（见下方 FileStore）。
       这样 localStorage 只存轻量文本，避免同源约 5MB 上限被大体积 PDF 撑爆导致保存失败。 */
    localStorage.setItem(DB_KEY, JSON.stringify(leanClone(DB)));
  }
  catch (e) { toast('保存失败：本地存储空间不足。附件已自动转存到浏览器 IndexedDB，请刷新页面后重试；仍失败可到「设置-导出备份」导出，再清理本机数据。'); throw e; }
  scheduleAutoBackup();
}

/* ================= 附件存储：大文件转存 IndexedDB，localStorage 仅存引用 =================
   根因：图片/PDF 以 base64 直接存进 localStorage（同源约 5MB 上限），一张多页腹超 PDF 就超限额。
   方案：附件二进制存入 IndexedDB（容量大得多），DB 中只保留 {__ref: fid}；内存里仍保留完整 dataUrl 供渲染/预览/导出。
   无 IndexedDB 的环境（含测试/极旧浏览器）自动回退为原内联存储，行为不变。 */
const FILE_FID = {};   /* 内存中完整 dataUrl -> fid，仅当 IndexedDB 可用时才填充 */
let _idbPromise = null;
function getFileDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise(resolve => {
    let req;
    try { req = indexedDB.open('catcare_files', 1); } catch (e) { return resolve(null); }
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (db.objectStoreNames && !db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });
  return _idbPromise;
}
function idbPutFile(fid, blob) {
  return getFileDb().then(db => {
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put({ id: fid, blob });
        tx.oncomplete = () => resolve(fid);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  });
}
function idbGetFile(fid) {
  return getFileDb().then(db => {
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction('files', 'readonly');
        const rq = tx.objectStore('files').get(fid);
        rq.onsuccess = () => resolve(rq.result ? rq.result.blob : null);
        rq.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  });
}
function dataUrlToBlob(dataUrl) {
  const m = ('' + dataUrl).match(/^data:([^;]*)[^,]*,(.*)$/s);
  if (!m) return null;
  let bin; try { bin = atob(m[2]); } catch (e) { return null; }
  const len = bin.length; const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] || 'application/octet-stream' });
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(rd.result);
    rd.onerror = () => reject(rd.error);
    rd.readAsDataURL(blob);
  });
}
function isFileDataUrl(s) { return typeof s === 'string' && /^data:(image\/|application\/pdf)/.test(s); }
function newFid() { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
/* 注册一个附件：写入 IndexedDB，成功则记录 dataUrl->fid。返回 Promise<fid|null> */
function registerFile(dataUrl, name, type) {
  const blob = dataUrlToBlob(dataUrl); if (!blob) return Promise.resolve(null);
  const fid = newFid();
  return idbPutFile(fid, blob).then(res => { if (res) { FILE_FID[dataUrl] = fid; return fid; } return null; });
}
/* 把 DB 中所有未注册的附件（旧版内联数据、导入的数据）写入 IndexedDB */
function registerFilesToIdb() {
  const pending = [];
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      for (const k in o) {
        const v = o[k];
        if (typeof v === 'string' && isFileDataUrl(v) && !FILE_FID[v]) pending.push(v);
        else if (typeof v === 'object' && v !== null) walk(v);
      }
    }
  })(DB);
  if (!pending.length) return Promise.resolve();
  return Promise.all(pending.map(du => {
    const blob = dataUrlToBlob(du); if (!blob) return Promise.resolve();
    const fid = newFid();
    return idbPutFile(fid, blob).then(res => { if (res) FILE_FID[du] = fid; });
  })).then(() => {});
}
/* 序列化时把文件 dataUrl 替换为 {__ref} 引用（无 fid 时原样保留，回退内联） */
function leanClone(value) {
  if (Array.isArray(value)) return value.map(leanClone);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k in value) {
      const v = value[k];
      if (typeof v === 'string' && isFileDataUrl(v)) out[k] = FILE_FID[v] ? { __ref: FILE_FID[v] } : v;
      else out[k] = leanClone(v);
    }
    return out;
  }
  if (typeof value === 'string' && isFileDataUrl(value)) return FILE_FID[value] ? { __ref: FILE_FID[value] } : value;
  return value;
}
/* 启动时把 {__ref} 还原为内存中的完整 dataUrl（供渲染/预览/导出） */
function hydrateFiles() {
  const tasks = [];
  (function walk(o, parent, key) {
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, o, i)); return; }
    if (o && typeof o === 'object') {
      if (typeof o.__ref === 'string') { tasks.push({ parent, key, fid: o.__ref }); return; }
      for (const k in o) walk(o[k], o, k);
    }
  })(DB, null, null);
  if (!tasks.length) return Promise.resolve();
  return Promise.all(tasks.map(async t => {
    const blob = await idbGetFile(t.fid);
    if (!blob) return;
    let dataUrl; try { dataUrl = await blobToDataUrl(blob); } catch (e) { return; }
    t.parent[t.key] = dataUrl; FILE_FID[dataUrl] = t.fid;
  })).then(() => {});
}
/* 启动：先迁移旧内联附件到 IndexedDB（释放 localStorage），再还原新格式引用 */
let _initFiles = registerFilesToIdb().then(() => hydrateFiles());

/* 自动备份：数据保存后静默下载带日期的备份文件（同一个月只下载一次，减少下载提示弹窗） */
let _autoBackupTimer = null, _lastBackupMonth = '';
/* 取当前年月，形如 2026-09（用于「每月只自动备份一次」判断） */
function monthKey() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function dbHasData() {
  const tables = ['cats', 'feedings', 'health', 'status', 'weights', 'medPlans', 'medRecords', 'carePlans', 'careRecords', 'deworm', 'excrete', 'water', 'vet', 'allergy', 'checkups', 'foods', 'interactions', 'healthArchives', 'careTips'];
  return tables.some(t => (DB[t] || []).length > 0);
}
function downloadBackup() {
  try {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '猫猫工作台自动备份_' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { /* 下载被浏览器拦截则忽略，下次保存再试 */ }
}
function scheduleAutoBackup() {
  if (!dbHasData()) return;                 // 空库不下载
  if (_autoBackupTimer) clearTimeout(_autoBackupTimer);
  _autoBackupTimer = setTimeout(() => {
    _autoBackupTimer = null;
    if (_lastBackupMonth === monthKey()) return; // 同一个月只自动备份一次，降低下载提示频率
    _lastBackupMonth = monthKey();
    downloadBackup();
  }, 6000);
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- 日期时间工具 ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function today() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function nowTime10() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(Math.floor(d.getMinutes() / 10) * 10); }
function addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
function fmtDateCN(s) { if (!s) return ''; const [y, m, d] = s.split('-'); return `${m}月${d}日`; }
function weekdayCN(s) { return '周' + '日一二三四五六'[new Date(s + 'T00:00:00').getDay()]; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmt(n, d = 1) { if (n == null || isNaN(n)) return '-'; return (+n).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }
function ageText(birth) {
  if (!birth) return '';
  const days = daysBetween(birth, today());
  if (days < 0) return '';
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30);
  return y > 0 ? `${y}岁${m > 0 ? m + '个月' : ''}` : `${m}个月`;
}
const MINUTES = ['00', '10', '20', '30', '40', '50'];
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));

/* ---------- PDF 文本提取（电子报告自动解析，需联网加载 pdf.js） ---------- */
if (typeof pdfjsLib !== 'undefined') {
  try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}
}
function extractPdfText(buf) {
  return new Promise((resolve, reject) => {
    if (typeof pdfjsLib === 'undefined') return reject(new Error('no-pdfjs'));
    try {
      pdfjsLib.getDocument({ data: buf }).promise.then(pdf => {
        const ps = [];
        for (let i = 1; i <= pdf.numPages; i++) ps.push(pdf.getPage(i).then(pg => pg.getTextContent()).then(c => (c.items || []).map(it => it.str || '').join(' ')));
        Promise.all(ps).then(arr => resolve(arr.join('\n'))).catch(reject);
      }).catch(reject);
    } catch (e) { reject(e); }
  });
}

/* ---------- 猫咪相关 ---------- */
function getCat(id) { return DB.cats.find(c => c.id === id); }
function catName(id) { const c = getCat(id); return c ? c.name : '未知猫咪'; }
function selectedCatId() {
  if (DB.settings.selectedCat && getCat(DB.settings.selectedCat)) return DB.settings.selectedCat;
  return DB.cats[0] ? DB.cats[0].id : '';
}
function getFood(id) { return DB.foods.find(f => f.id === id); }

/* ---------- 饮食营养计算 ---------- */
function calcNutrition(foodId, grams) {
  const f = getFood(foodId); const g = num(grams);
  if (!f || !g) return null;
  const r = k => num(f[k]) * g / 100;
  const kcal = r('kcal');
  return {
    water: r('water'), kcal, kj: kcal * 4.184,
    protein: r('protein'), fat: r('fat'), phos: r('phos')
  };
}
function feedTotals(list) {
  const t = { grams: 0, water: 0, kj: 0, kcal: 0, protein: 0, fat: 0, phos: 0, count: list.length };
  list.forEach(x => {
    t.grams += num(x.grams);
    const n = calcNutrition(x.foodId, x.grams);
    if (n) { t.water += n.water; t.kj += n.kj; t.kcal += n.kcal; t.protein += n.protein; t.fat += n.fat; t.phos += n.phos; }
  });
  return t;
}
/* 按食物大类分别合计：返回 [{ category, grams, kcal, count }]，按 grams 降序。
   未关联食物档案的记录归入「未归类」。用于列表日合计脚注与月度摄入日历。 */
function feedTotalsByCategory(list) {
  const map = {};
  list.forEach(x => {
    const f = getFood(x.foodId);
    const cat = (f && f.category) || '未归类';
    if (!map[cat]) map[cat] = { category: cat, grams: 0, kcal: 0, count: 0 };
    map[cat].grams += num(x.grams);
    map[cat].kcal += (calcNutrition(x.foodId, x.grams) || { kcal: 0 }).kcal;
    map[cat].count++;
  });
  return Object.values(map).sort((a, b) => b.grams - a.grams);
}
/* 餐数：同一「进食时间」(time) 视为同一餐，故按 time 去重计数。
   例如同一天 08:00 录了「鸡胸肉」和「猫粮」两条，应计为 1 餐而非 2 餐。 */
function mealCountOf(list) {
  const set = new Set();
  list.forEach(x => set.add(x.time || ''));
  return set.size;
}
/* 营养摄入目标：按猫分别保存（水/热量/蛋白质必填，其余选填） */
function getTargets(catId) { return ((DB.targets && DB.targets[catId]) || {}); }
function nutritionTargetHint(key, current, unit) {
  const tg = getTargets(selectedCatId())[key];
  if (!(tg > 0)) return '';
  const diff = tg - num(current);
  if (diff > 0.0001) return `<div class="tgt-hint" style="color:var(--red)">目标${fmt(tg)}${unit} · 还差${fmt(diff)}${unit}</div>`;
  const over = -diff;
  if (over < 0.0001) return `<div class="tgt-hint" style="color:var(--green)">已达标 ✓</div>`;
  return `<div class="tgt-hint" style="color:var(--green)">目标${fmt(tg)}${unit} · 超出${fmt(over)}${unit}</div>`;
}

/* ---------- 通用查询 ---------- */
function recordsOf(table, catId, from, to) {
  return (DB[table] || []).filter(r =>
    (!catId || r.catId === catId) &&
    (!from || (r.date || '') >= from) &&
    (!to || (r.date || '') <= to)
  ).sort((a, b) => (b.date + (b.time || '')) > (a.date + (a.time || '')) ? 1 : -1);
}

/* ---------- 用药/护理计划：用药日判定 & 计划选项 ---------- */
function isPlanDay(plan, date) {
  if (!plan || plan.paused) return false;
  if (!plan.continuous) {
    const single = plan.startDate || plan.createdDate;
    return !!single && date === single;
  }
  const sd = plan.startDate || '';
  if (!sd) return false;
  if (date < sd) return false;
  if (plan.endDate && date > plan.endDate) return false;
  const st = plan.schedType || '按间隔';
  if (st === '按星期') {
    const map = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };
    const sel = (Array.isArray(plan.weekdays) ? plan.weekdays : []).map(w => map[w]).filter(w => w !== undefined);
    return sel.includes(new Date(date + 'T00:00:00').getDay());
  }
  if (st === '按月') {
    const sel = (Array.isArray(plan.monthDays) ? plan.monthDays : []).map(s => parseInt(String(s).replace(/\D/g, ''), 10)).filter(n => n >= 1 && n <= 31);
    if (!sel.length) return false;
    const dd = new Date(date + 'T00:00:00');
    const day = dd.getDate();
    const ym = date.slice(0, 7);
    const lastDay = new Date(dd.getFullYear(), dd.getMonth() + 1, 0).getDate();
    // 当日及之前已到的每月执行日，若本月尚未记录完成 → 视为待办（逾期则每日持续提醒）
    for (const m of sel) {
      if (m > lastDay) continue;            // 当月没有这一天（如2月无30号）
      if (day >= m) {
        const occ = ym + '-' + pad2(m);
        const done = (DB.careRecords || []).some(r => r.planId === plan.id && r.date >= occ && r.date.slice(0, 7) === ym);
        if (!done) return true;
      }
    }
    return false;
  }
  const iv = parseInt(plan.intervalDays || '1', 10) || 1;
  const diff = daysBetween(sd, date);
  return Number.isFinite(diff) && diff % iv === 0;
}
function planOptionList(table, catId) {
  return (DB[table] || []).filter(p => p.catId === catId && !p.paused)
    .map(p => ({ v: p.id, label: p.name + (p.dose ? '（' + p.dose + (p.unit || '') + '）' : '') }));
}
function medPlanOptions() { return planOptionList('medPlans', _formData.catId || selectedCatId()); }
function carePlanOptions() { return planOptionList('carePlans', _formData.catId || selectedCatId()); }

/* ---------- Toast & Modal ---------- */
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.getElementById('toastRoot').appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function openModal(title, bodyHTML, footHTML) {
  closeModal();
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="mask" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body" id="modalBody">${bodyHTML}</div>
      ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
    </div></div>`;
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

/* ================= 独立预览层（不关闭表单弹窗） ================= */
let _previewUrl = null;  /* 保存 blob URL 以便关闭时释放 */
function openPreview(title, bodyHTML, footHTML) {
  closePreview();
  const root = document.getElementById('previewRoot');
  root.innerHTML = `<div class="preview-mask" onclick="if(event.target===this)closePreview()">
    <div class="preview-modal">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" onclick="closePreview()">✕</button></div>
      <div class="modal-body">${bodyHTML}</div>
      ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
    </div></div>`;
}
function closePreview() {
  if (_previewUrl) { try { URL.revokeObjectURL(_previewUrl); } catch(e){} _previewUrl = null; }
  document.getElementById('previewRoot').innerHTML = '';
}

/* ================= 表单引擎 ================= */
/* 字段类型: text/textarea/number/date/time/select/multiselect/bool/photo/catRef/foodRef */
/* ================= 一顿多食物：饮食批量表单（新增专用；编辑单条仍走原表单） ================= */
let _feedRows = [{ foodId: '', grams: '' }];
function feedRowHTML(row, i) {
  const opts = DB.foods.map(fd => `<option value="${fd.id}" ${row.foodId === fd.id ? 'selected' : ''}>${esc(fd.name)}${fd.brand ? '（' + esc(fd.brand) + '）' : ''}</option>`).join('');
  return `<div class="feed-row">
    <select onchange="_feedRows[${i}].foodId=this.value"><option value="">选择食物</option>${opts}</select>
    <input type="number" inputmode="decimal" step="any" placeholder="克重" value="${esc(row.grams)}" oninput="_feedRows[${i}].grams=this.value">
    <span class="feed-unit">g</span>
    <button type="button" class="btn btn-ghost btn-sm" onclick="feedDelRow(${i})">✕</button>
  </div>`;
}
function feedRenderRows() {
  const box = document.getElementById('feedRows');
  if (box) box.innerHTML = _feedRows.map(feedRowHTML).join('');
}
function feedAddRow() { _feedRows.push({ foodId: '', grams: '' }); feedRenderRows(); }
function feedDelRow(i) {
  _feedRows.splice(i, 1);
  if (!_feedRows.length) _feedRows.push({ foodId: '', grams: '' });
  feedRenderRows();
}
function feedFormHTML() {
  const cat = selectedCatId();
  const [h, m] = nowTime10().split(':');
  const MEALS = ['早餐', '午餐', '晚餐', '夜宵', '加餐', '零食', '自由采食', '其他'];
  const FINISH = ['吃完', '吃了大部分', '吃了一半', '只吃一点', '未吃'];
  return `<form id="feedForm" onsubmit="return false">
    <div class="f-row"><label class="f-label">猫咪<span class="req"> *</span></label>
      <select id="feedCat">${DB.cats.map(c => `<option value="${c.id}" ${c.id === cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="f-row"><label class="f-label">日期 / 时间</label>
      <div class="f-inline"><input type="date" id="feedDate" value="${today()}">
        <select id="feedTimeH">${HOURS.map(x => `<option ${x === h ? 'selected' : ''}>${x}</option>`).join('')}</select><span>时</span>
        <select id="feedTimeM">${MINUTES.map(x => `<option ${x === m ? 'selected' : ''}>${x}</option>`).join('')}</select><span>分</span></div></div>
    <div class="f-row"><label class="f-label">餐次类型</label>
      <select id="feedMeal">${MEALS.map(o => `<option>${o}</option>`).join('')}</select></div>
    <div class="f-row"><label class="f-label">食物与克重<span class="req"> *</span></label>
      <div id="feedRows">${_feedRows.map(feedRowHTML).join('')}</div>
      <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="feedAddRow()">＋ 再加一种食物</button>
      <div class="f-hint">一顿里吃了什么就都填进来，保存后全部计入统计</div></div>
    <div class="f-row"><label class="f-label">吃完情况</label>
      <select id="feedFinish">${FINISH.map(o => `<option>${o}</option>`).join('')}</select></div>
    <div class="f-row"><label class="f-label">本餐加水</label>
      <div class="f-inline"><input type="number" inputmode="decimal" step="any" id="feedWater" placeholder="0"><span class="feed-unit">ml（计入饮水记录）</span></div></div>
    <div class="f-row"><label class="f-label">备注</label><textarea id="feedNotes" placeholder="选填"></textarea></div>
  </form>`;
}
function openFeedForm() {
  _feedRows = [{ foodId: '', grams: '' }];
  openModal('新增 饮食记录', feedFormHTML(),
    `<button class="btn btn-ghost" onclick="closeModal()">取消</button>
     <button class="btn btn-primary" onclick="submitFeedForm()">保存</button>`);
}
function submitFeedForm() {
  const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const catId = val('feedCat') || selectedCatId();
  const date = val('feedDate') || today();
  const time = (val('feedTimeH') || '') + ':' + (val('feedTimeM') || '');
  const meal = val('feedMeal'); const finish = val('feedFinish'); const notes = val('feedNotes');
  const waterMl = parseFloat(val('feedWater')) || 0;
  const valid = _feedRows.filter(r => r.foodId && parseFloat(r.grams) > 0);
  if (!valid.length) { toast('请至少填写一行：选择食物并输入克重'); return; }
  const now = Date.now();
  valid.forEach((r, idx) => {
    const f = getFood(r.foodId);
    DB.feedings.push({ id: uid(), createdAt: now + idx, catId, date, time, meal, finish, notes,
      foodId: r.foodId, foodName: f ? f.name : '', grams: parseFloat(r.grams) });
  });
  if (waterMl > 0) {
    DB.water.push({ id: uid(), createdAt: now, catId, date, time, amount: waterMl, method: '随餐添加', notes: '随餐记录' });
  }
  dbSave(); closeModal(); toast(`已保存 ${valid.length} 条进食记录` + (waterMl > 0 ? ' + 1 条饮水' : '') + ' ✓');
  render();
}

let _formData = {}, _formEntity = null, _formEditId = null, _formOnSaved = null;

function openForm(entKey, record, onSaved) {
  /* 饮食「新增」走多食物批量表单；编辑已有记录仍用原单条表单 */
  if (entKey === 'feed' && !record) return openFeedForm();
  const ent = ENTITIES[entKey];
  _formEntity = ent; _formEditId = record ? record.id : null; _formOnSaved = onSaved || null;
  _formData = {};
  ent.fields.forEach(f => {
    if (record && record[f.k] !== undefined) _formData[f.k] = record[f.k];
    else _formData[f.k] = (typeof f.def === 'function') ? f.def() : (f.def !== undefined ? f.def : (f.type === 'multiselect' || f.type === 'photo' ? [] : (f.type === 'bool' ? false : '')));
  });
  if (!_formData.catId && ent.fields.some(f => f.type === 'catRef')) _formData.catId = selectedCatId();
  openModal((record ? '编辑' : '新增') + ent.name, '<form id="dynForm" onsubmit="return false">' + renderFields() + '</form>',
    `<button class="btn btn-ghost" onclick="closeModal()">取消</button>
     <button class="btn btn-primary" onclick="submitForm()">保存</button>`);
  bindFormEvents();
}
function onMultiOther(k, freeOn, optVals, val) {
  let arr = Array.isArray(_formData[k]) ? _formData[k].slice() : [];
  arr = arr.filter(x => optVals.indexOf(x) >= 0 && x !== freeOn);
  if (val && val.trim()) arr.push(val.trim());
  else arr.push(freeOn);
  _formData[k] = arr;
}
function renderFields() {
  const rows = _formEntity.fields.map(f => {
    const hidden = f.show && !f.show(_formData);
    return { f, html: `<div class="f-row" data-fk="${f.k}" style="${hidden ? 'display:none' : ''}">${fieldHTML(f)}</div>` };
  });
  // 把带 grp 的连续字段收进可折叠分组，让长表单更清晰
  let out = '', group = null, buf = [];
  const flush = () => {
    if (group) {
      out += `<details class="f-group"><summary>${esc(group.title)}</summary><div class="f-group-body">${buf.join('')}</div></details>`;
      group = null; buf = [];
    } else if (buf.length) {
      out += buf.join(''); buf = [];
    }
  };
  rows.forEach(({ f, html }) => {
    if (f.grp) {
      if (group && group.name === f.grp) buf.push(html);
      else { flush(); group = { name: f.grp, title: f.grpTitle || '更多' }; buf.push(html); }
    } else { flush(); buf.push(html); }
  });
  flush();
  out += (_formEntity.preview ? `<div id="formPreview">${_formEntity.preview(_formData)}</div>` : '');
  return out;
}
function fieldHTML(f) {
  const v = _formData[f.k];
  const label = `<label class="f-label">${esc(f.label)}${f.req ? '<span class="req"> *</span>' : ''}</label>`;
  switch (f.type) {
    case 'text': return label + `<input name="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
    case 'number': return label + `<div class="f-inline"><input type="number" inputmode="decimal" step="any" name="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">${f.unit ? `<span style="color:var(--ink-3);font-size:.8rem;white-space:nowrap">${f.unit}</span>` : ''}</div>`;
    case 'textarea': return label + `<textarea name="${f.k}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
    case 'date': {
      let html = label + `<input type="date" name="${f.k}" value="${esc(v)}">`;
      if (f.quickDate) {
        html += `<div class="f-quick">`
          + `<button type="button" class="btn btn-ghost btn-sm" onclick="setQuickDate('${f.k}','last')">↩️ 上次填写</button>`
          + `<button type="button" class="btn btn-ghost btn-sm" onclick="setQuickDate('${f.k}','today')">📅 今日</button>`
          + `</div>`;
      }
      return html;
    }
    case 'time': {
      const [h, m] = (v || nowTime10()).split(':');
      return label + `<div class="f-inline">
        <select name="${f.k}__h">${HOURS.map(x => `<option ${x === h ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <span>时</span>
        <select name="${f.k}__m">${MINUTES.map(x => `<option ${x === m ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <span>分</span></div><div class="f-hint">分钟仅支持 00 / 10 / 20 / 30 / 40 / 50</div>`;
    }
    case 'select': {
      const opts = typeof f.opts === 'function' ? f.opts() : f.opts;
      const norm = opts.map(o => (o && typeof o === 'object' && 'v' in o) ? o : { v: o, label: o });
      const freeOn = f.freeTextOn;
      if (norm.length <= 8 && !f.dropdown) {
        let html = label + `<div class="opt-chips" data-single="${f.k}">` + norm.map(o =>
          `<span class="opt-chip ${v === o.v ? 'on' : ''}" data-v="${esc(o.v)}">${esc(o.label)}</span>`).join('') + '</div>';
        if (freeOn) {
          const custom = (v && v !== freeOn && !norm.some(o => o.v === v)) ? v : '';
          const showOther = (v === freeOn) || !!custom;
          html += `<input class="f-other" name="${f.k}__other" value="${esc(custom)}" placeholder="请输入具体${esc(f.label)}" style="display:${showOther ? '' : 'none'}" oninput="onSingleOther('${f.k}','${esc(freeOn)}')">`;
        }
        return html;
      }
      /* 下拉路径：freeTextOn 时 select 用 __sel 名保存选中项，另加 __other 输入框 */
      const selVal = (v && !norm.some(o => o.v === v)) ? (freeOn || v) : v;
      const customText = (v && v !== freeOn && !norm.some(o => o.v === v)) ? v : '';
      const showOther = !!freeOn && (selVal === freeOn);
      let html = label + `<select name="${f.k}__sel" onchange="onSingleOther('${f.k}','${esc(freeOn || '')}')"><option value="">请选择</option>` +
        norm.map(o => `<option value="${esc(o.v)}" ${selVal === o.v ? 'selected' : ''}>${esc(o.label)}</option>`).join('') +
        (freeOn ? `<option value="${esc(freeOn)}" ${selVal === freeOn ? 'selected' : ''}>${esc(freeOn)}</option>` : '') + '</select>';
      if (freeOn) {
        html += `<input class="f-other" name="${f.k}__other" value="${esc(customText)}" placeholder="请输入具体${esc(f.label)}" style="display:${showOther ? '' : 'none'}" oninput="onSingleOther('${f.k}','${esc(freeOn)}')">`;
      }
      return html;
    }
    case 'multiselect': {
      const opts = typeof f.opts === 'function' ? f.opts() : f.opts;
      const norm = opts.map(o => (o && typeof o === 'object' && 'v' in o) ? o : { v: o, label: o });
      const arr = Array.isArray(v) ? v : [];
      const freeOn = f.freeTextOn;
      let otherVal = '';
      if (freeOn) { const custom = arr.filter(x => !norm.some(o => o.v === x)); if (arr.includes(freeOn)) otherVal = ''; else if (custom.length) otherVal = custom[0]; }
      const showInput = !!(freeOn && (arr.includes(freeOn) || otherVal));
      const optValsJson = norm.map(o => `'${String(o.v).replace(/'/g, "\\'")}'`).join(',');
      let html = label + `<div class="opt-chips" data-multi="${f.k}">` + norm.map(o =>
        `<span class="opt-chip ${arr.includes(o.v) || (freeOn && o.v === freeOn && otherVal) ? 'on' : ''}" data-v="${esc(o.v)}">${esc(o.label)}</span>`).join('') + '</div>';
      if (showInput) html += `<input class="f-other" name="${f.k}__other" value="${esc(otherVal)}" placeholder="请输入具体${esc(freeOn)}内容" oninput="onMultiOther('${f.k}','${freeOn}',[${optValsJson}],this.value)">`;
      return html;
    }
    case 'bool':
      return `<div class="switch-row"><label class="f-label">${esc(f.label)}</label>
        <label class="switch"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}><i></i></label></div>`;
    case 'photo': {
      const arr = Array.isArray(v) ? v : [];
      const isFood = _formEntity && _formEntity.table === 'foods';
      const isTip = _formEntity && _formEntity.table === 'careTips';
      const hasPhoto = arr.length > 0;
      const foodBtns = isFood ? `<div class="photo-ocr-actions">
        <button type="button" class="mini-btn" onclick="openFoodPasteModal()">📋 粘贴文字识别</button>
        <button type="button" class="mini-btn" id="foodOcrBtn" ${hasPhoto ? '' : 'disabled'} onclick="recognizeFoodPhoto()">🔍 识别所上传的图片</button>
        <span class="f-hint" style="display:inline">上传图片仅保存；点「识别所上传的图片」才会解析营养（需联网加载识别模型，不准时用粘贴文字）</span>
      </div>` : '';
      const tipBtns = isTip ? `<div class="photo-ocr-actions">
        <button type="button" class="mini-btn" id="tipOcrBtn" ${hasPhoto ? '' : 'disabled'} onclick="recognizeTipPhoto()">🔍 识别图中文字</button>
        <span class="f-hint" style="display:inline">上传截图仅保存为附件；点「识别图中文字」可提取文字填入内容（需联网加载识别模型）</span>
      </div>` : '';
      return label + `<div class="photo-box" data-photo="${f.k}">` +
        arr.map((p, i) => `<img src="${p}" data-i="${i}" title="点击删除">`).join('') +
        `<button type="button" class="photo-add">＋</button>
        <input type="file" accept="image/*" style="display:none"></div>
        <div class="f-hint">点击图片可删除${isFood ? '；上传图片仅保存，可点「识别所上传的图片」解析营养' : (isTip ? '；上传截图仅保存为附件，可点「识别图中文字」提取文字' : '')}</div>` + foodBtns + tipBtns;
    }
    case 'catRef':
      return label + `<select name="${f.k}">` + (DB.cats.length ? '' : '<option value="">（请先创建猫咪档案）</option>') +
        DB.cats.map(c => `<option value="${c.id}" ${v === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('') + '</select>';
    case 'foodRef':
      return label + `<select name="${f.k}"><option value="">请选择食物</option>` +
        DB.foods.map(fd => `<option value="${fd.id}" ${v === fd.id ? 'selected' : ''}>${esc(fd.name)}${fd.brand ? '（' + esc(fd.brand) + '）' : ''}</option>`).join('') +
        `</select><div class="f-hint">找不到？请先到「食物数据库」新增 <span class="link" onclick="closeModal();go('foods')">去添加</span></div>`;
    case 'metricRows':
      return metricRowsHTML(f);
    case 'report':
      return reportFieldHTML(f);
  }
  return '';
}
function bindFormEvents() {
  const form = document.getElementById('dynForm');
  if (!form) return;
  form.addEventListener('input', collectAndRefresh);
  form.addEventListener('change', collectAndRefresh);
  form.addEventListener('click', e => {
    if (!e.target || !e.target.closest) return;
    const chip = e.target.closest('.opt-chip');
    if (chip) {
      const box = chip.parentElement;
      const single = box.dataset.single, multi = box.dataset.multi;
      if (single !== undefined) {
        const val = chip.dataset.v;
        _formData[single] = (_formData[single] === val) ? '' : val;
        box.querySelectorAll('.opt-chip').forEach(c => c.classList.toggle('on', c.dataset.v === _formData[single]));
      } else if (multi !== undefined) {
        const val = chip.dataset.v;
        const arr = Array.isArray(_formData[multi]) ? _formData[multi].slice() : [];
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1); else arr.push(val);
        _formData[multi] = arr;
        chip.classList.toggle('on', arr.indexOf(val) >= 0);
      }
      afterFieldChange(single !== undefined ? single : multi);
      return;
    }
    const addBtn = e.target.closest('.photo-add');
    if (addBtn) { addBtn.parentElement.querySelector('input[type=file]').click(); return; }
    const img = e.target.closest('.photo-box img');
    if (img) {
      const k = img.parentElement.dataset.photo;
      _formData[k].splice(+img.dataset.i, 1); refreshForm(); return;
    }
  });
  form.querySelectorAll('input[type=file]').forEach(inp => {
    inp.addEventListener('change', () => {
      const file = inp.files[0]; if (!file) return;
      const k = inp.parentElement.dataset.photo;
      inp.value = '';   // 允许重复选择同一文件再次触发 change
      compressImage(file, dataUrl => {
        if (!dataUrl) { toast('图片读取失败，请重试'); return; }
        /* 先转存到 IndexedDB，再进入表单数据（确保保存时二进制已在 IndexedDB） */
        registerFile(dataUrl, file.name, file.type).then(() => {
          _formData[k].push(dataUrl); refreshForm();
        });
      });
    });
  });
  form.querySelectorAll('.metric-rows').forEach(box => {
    const k = box.dataset.k;
    const onCh = () => syncMetrics(k);
    box.addEventListener('input', onCh);
    box.addEventListener('change', onCh);
  });
}
function applyConditionals() {
  _formEntity.fields.forEach(f => {
    if (f.show) {
      const row = document.querySelector(`[data-fk="${f.k}"]`);
      if (row) row.style.display = f.show(_formData) ? '' : 'none';
    }
  });
}
function updatePreview() {
  const pv = document.getElementById('formPreview');
  if (pv && _formEntity.preview) pv.innerHTML = _formEntity.preview(_formData);
}
function afterFieldChange(key) {
  applyConditionals();
  updatePreview();
  if (_formEntity.onChange) _formEntity.onChange(_formData, key);
}
function collectAndRefresh(e) {
  const t = e.target; if (!t.name) return;
  if (t.name.endsWith('__h') || t.name.endsWith('__m')) {
    const base = t.name.replace(/__[hm]$/, '');
    const h = document.querySelector(`[name="${base}__h"]`).value;
    const m = document.querySelector(`[name="${base}__m"]`).value;
    _formData[base] = h + ':' + m;
  } else if (t.type === 'checkbox') _formData[t.name] = t.checked;
  else _formData[t.name] = t.value;
  applyConditionals();
  updatePreview();
  if (_formEntity.onChange) _formEntity.onChange(_formData, t.name);
}
function setQuickDate(key, which) {
  let val = '';
  if (which === 'today') {
    val = today();
  } else {
    /* 上次填写：取除当前编辑记录外，最近一次添加的健康档案记录的日期 */
    const recs = DB.healthArchives || [];
    let last = null;
    for (let i = recs.length - 1; i >= 0; i--) {
      if (_formEditId && recs[i].id === _formEditId) continue;
      last = recs[i];
      break;
    }
    if (!last || !last.date) { toast('暂无其他已填写记录'); return; }
    val = last.date;
  }
  const input = document.querySelector('#modalRoot [name="' + key + '"]');
  if (input) {
    input.value = val;
    collectAndRefresh({ target: input });
  }
}
/* 原地刷新所有 photo-box：上传/删除图片后立即显示，不重绘整个表单（避免输入交互丢失）。
   复用原 file input 元素，保留 bindFormEvents 绑定的 change 监听。 */
function refreshPhotoBoxes(scope) {
  (scope || document).querySelectorAll('.photo-box').forEach(box => {
    const k = box.dataset.photo;
    if (!k || !_formData || !Array.isArray(_formData[k])) return;
    const inp = box.querySelector('input[type=file]');
    box.innerHTML = _formData[k].map((p, i) => `<img src="${p}" data-i="${i}" title="点击删除">`).join('') +
      '<button type="button" class="photo-add">＋</button>';
    if (inp) box.appendChild(inp);
  });
}
function refreshForm() {
  // 已改为原地更新（避免整表重绘导致交互丢失），此处仅做兼容刷新
  applyConditionals(); updatePreview();
  refreshPhotoBoxes(document.getElementById('dynForm') || document);
  if (_formEntity && _formData && _formData.photo && _formData.photo.length) {
    const fb = document.getElementById('foodOcrBtn'); if (fb) fb.disabled = false;
    const tb = document.getElementById('tipOcrBtn'); if (tb) tb.disabled = false;
  }
}
function compressImage(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const img = new Image();
    const render = () => {
      try {
        const max = 900; let w = img.width, h = img.height;
        if (Math.max(w, h) > max) { const r = max / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if (!ctx) { cb(dataUrl); return; }   // 极少数环境无 2d 上下文，回退原图
        ctx.drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.72));
      } catch (err) { cb(dataUrl); }   // 压缩失败（如格式不支持）回退原图，确保有预览
    };
    img.onload = () => {
      /* 关键修复：onload 仅代表资源已加载，位图未必已解码完成。
         若此刻 drawImage 到画布，画布可能仍是透明（空）的；而 JPEG 无透明通道，
         toDataURL 会把透明像素编码成黑色 → 表现为「缩略图全黑」（手机拍照常见）。
         改用 img.decode() 等真正解码完成后再绘制。 */
      if (typeof img.decode === 'function') img.decode().then(render).catch(() => cb(dataUrl));
      else render();
    };
    img.onerror = () => cb(dataUrl);    // 图片解码失败回退原图，确保有预览
    img.src = dataUrl;
  };
  reader.onerror = () => cb(null);      // 读取失败（极少见）
  reader.readAsDataURL(file);
}
/* 单选 freeTextOn：选中“其他”时显示输入框，最终值取自定义文字 */
function onSingleOther(k, freeOn) {
  const selEl = document.querySelector(`[name="${k}__sel"]`);
  const otherEl = document.querySelector(`[name="${k}__other"]`);
  if (!selEl) return;
  const sv = selEl.value;
  const cv = otherEl ? otherEl.value : '';
  _formData[k] = (sv === freeOn) ? (cv.trim() || freeOn) : sv;
  if (otherEl) otherEl.style.display = (sv === freeOn) ? '' : 'none';
}
function submitForm() {
  const ent = _formEntity;
  ent.fields.forEach(f => { if (f.type === 'metricRows') syncMetrics(f.k); });
  for (const f of ent.fields) {
    const visible = !f.show || f.show(_formData);
    if (f.req && visible) {
      const v = _formData[f.k];
      if (v === '' || v == null || (Array.isArray(v) && !v.length)) { toast('请填写「' + f.label + '」'); return; }
    }
  }
  if (ent.beforeSave && ent.beforeSave(_formData) === false) return;
  /* 清理 freeTextOn 字段产生的临时键（__sel / __other），_formData[k] 已是最终值 */
  ent.fields.forEach(f => {
    if (f.freeTextOn) { delete _formData[f.k + '__sel']; delete _formData[f.k + '__other']; }
  });
  const list = DB[ent.table];
  if (_formEditId) {
    const i = list.findIndex(r => r.id === _formEditId);
    if (i >= 0) list[i] = Object.assign({}, list[i], _formData, { id: _formEditId });
  } else {
    list.push(Object.assign({ id: uid(), createdAt: Date.now() }, _formData));
  }
  dbSave(); closeModal(); toast('已保存 ✓');
  if (_formOnSaved) _formOnSaved(); else render();
}
function deleteRecord(table, id, cb) {
  if (!confirm('确定删除这条记录吗？')) return;
  DB[table] = DB[table].filter(r => r.id !== id);
  dbSave(); toast('已删除'); cb ? cb() : render();
}

/* ================= 指标明细表格（metricRows） ================= */
function computeAbnormal(m) {
  const v = parseFloat(m.value), lo = parseFloat(m.low), hi = parseFloat(m.high);
  if (isNaN(v)) return false;
  if (!isNaN(lo) && v < lo) return true;
  if (!isNaN(hi) && v > hi) return true;
  return false;
}
function renderMetricLineHTML(k, m, i) {
  m = m || {};
  const abn = computeAbnormal(m);
  return `<div class="metric-line ${abn ? 'abn' : ''} ${m.focus ? 'focus' : ''}" data-i="${i}">
    <input data-f="name" placeholder="指标名" value="${esc(m.name || '')}">
    <input data-f="value" placeholder="值" value="${esc(m.value || '')}">
    <input data-f="unit" placeholder="单位" value="${esc(m.unit || '')}">
    <input data-f="low" placeholder="低" value="${esc(m.low || '')}">
    <input data-f="high" placeholder="高" value="${esc(m.high || '')}">
    <label class="mfocus" title="重点关注"><input type="checkbox" data-f="focus" ${m.focus ? 'checked' : ''}>★</label>
    <button type="button" class="metric-del" title="删除" onclick="delMetricRow(this)">✕</button>
  </div>`;
}
function renderMetricRowsHTML(k) {
  const arr = Array.isArray(_formData[k]) ? _formData[k] : [];
  if (!arr.length) return '<div class="metric-empty">还没有指标，点下方「＋ 添加指标」或粘贴报告文字自动解析。</div>';
  return arr.map((m, i) => renderMetricLineHTML(k, m, i)).join('');
}
function metricRowsHTML(f) {
  const k = f.k;
  return `<label class="f-label">${esc(f.label)}</label>
  <div class="metric-rows" data-k="${k}">${renderMetricRowsHTML(k)}</div>
  <button type="button" class="btn btn-ghost btn-sm" style="margin:6px 0" onclick="addMetricRow('${k}')">＋ 添加指标</button>
  <details class="parse-box">
    <summary>📋 粘贴报告文字，自动识别指标</summary>
    <textarea id="rpText" placeholder="从电子报告复制文字粘贴到这里。格式示例：&#10;白蛋白 ALB 35 g/L 28-40&#10;红细胞 RBC 9.8 10^12/L 6.5-12.5"></textarea>
    <button type="button" class="btn btn-primary btn-sm" onclick="parseReportFromText('${k}')">解析并填入指标</button>
    <div class="f-hint">支持「指标名 数值 单位 参考范围(a-b)」格式；识别不出的可手动添加；超出参考范围的会自动标红。</div>
  </details>`;
}
function syncMetrics(k) {
  const box = document.querySelector(`.metric-rows[data-k="${k}"]`);
  if (!box) return;
  const rows = Array.from(box.querySelectorAll('.metric-line'));
  _formData[k] = rows.map(r => ({
    name: r.querySelector('[data-f=name]').value,
    value: r.querySelector('[data-f=value]').value,
    unit: r.querySelector('[data-f=unit]').value,
    low: r.querySelector('[data-f=low]').value,
    high: r.querySelector('[data-f=high]').value,
    focus: r.querySelector('[data-f=focus]').checked,
    abnormal: computeAbnormal({ value: r.querySelector('[data-f=value]').value, low: r.querySelector('[data-f=low]').value, high: r.querySelector('[data-f=high]').value })
  }));
  rows.forEach((r, idx) => { const m = _formData[k][idx]; r.classList.toggle('abn', !!m.abnormal); r.classList.toggle('focus', !!m.focus); });
}
function addMetricRow(k) {
  const box = document.querySelector(`.metric-rows[data-k="${k}"]`);
  if (!box) return;
  const empty = box.querySelector('.metric-empty'); if (empty) empty.remove();
  box.insertAdjacentHTML('beforeend', renderMetricLineHTML(k, {}, box.children.length));
  syncMetrics(k);
}
function delMetricRow(btn) {
  const line = btn.closest('.metric-line'); const box = line.parentElement; const k = box.dataset.k;
  line.remove(); syncMetrics(k);
}
function refreshMetricRows(k) {
  const box = document.querySelector(`.metric-rows[data-k="${k}"]`);
  if (box) box.innerHTML = renderMetricRowsHTML(k);
}
function parseReportFromText(k) {
  const ta = document.getElementById('rpText');
  const text = ta ? ta.value : '';
  if (!text || !text.trim()) { toast('请先粘贴报告文字'); return; }
  const parsed = parseReportText(text);
  if (!parsed.metrics.length) { toast('未能识别出指标，请检查格式或手动添加'); return; }
  _formData[k] = (_formData[k] || []).concat(parsed.metrics);
  refreshMetricRows(k);
  if (parsed.advice && !_formData.advice) { _formData.advice = parsed.advice; const a = document.querySelector('[name=advice]'); if (a) a.value = parsed.advice; }
  if (parsed.summary && !_formData.summaryText) { _formData.summaryText = parsed.summary; const s = document.querySelector('[name=summaryText]'); if (s) s.value = parsed.summary; }
  toast('已识别并填入 ' + parsed.metrics.length + ' 项指标' + (parsed.metrics.filter(m => m.abnormal).length ? '，其中 ' + parsed.metrics.filter(m => m.abnormal).length + ' 项异常' : ''));
}
function computeAbnormalNum(v, lo, hi) {
  const V = parseFloat(v), L = parseFloat(lo), H = parseFloat(hi);
  if (isNaN(V)) return false;
  if (!isNaN(L) && V < L) return true;
  if (!isNaN(H) && V > H) return true;
  return false;
}
function parseReportText(text) {
  const metrics = []; let advice = '', summary = '';
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const re = /^(.*?)\s+([0-9]+\.?[0-9]*)\s*([a-zA-Z%μ·\/^\s]*)\s*[（(]?\s*([0-9]+\.?[0-9]*)\s*[-~—]\s*([0-9]+\.?[0-9]*)\s*[）)]?\s*$/;
  const re2 = /^(.*?)\s+([0-9]+\.?[0-9]*)\s*[（(]?\s*([0-9]+\.?[0-9]*)\s*[-~—]\s*([0-9]+\.?[0-9]*)\s*[）)]?\s*$/;
  lines.forEach(line => {
    let m = line.match(re);
    if (m) { const name = m[1].replace(/[：:.\s]+$/, ''); metrics.push({ name, value: m[2], unit: m[3], low: m[4], high: m[5], abnormal: computeAbnormalNum(m[2], m[4], m[5]), focus: false }); return; }
    let m2 = line.match(re2);
    if (m2) { const name = m2[1].replace(/[：:.\s]+$/, ''); metrics.push({ name, value: m2[2], unit: '', low: m2[3], high: m2[4], abnormal: computeAbnormalNum(m2[2], m2[3], m2[4]), focus: false }); return; }
    if (/医嘱|建议|注意|复查|随访/.test(line) && line.length > 4) advice += (advice ? '\n' : '') + line;
    if (/结论|诊断|正常|未见|提示|考虑|建议/.test(line) && line.length > 4 && !advice.includes(line)) summary += (summary ? '\n' : '') + line;
  });
  return { metrics, advice: advice.trim(), summary: summary.trim() };
}

/* ================= 电子报告附件（report） ================= */
function reportBoxInner(k) {
  const arr = Array.isArray(_formData[k]) ? _formData[k] : [];
  const items = arr.map((p, i) => {
    if (p.kind === 'link') {
      return `<div class="report-thumb link-thumb" title="点击查看关联健康档案" onclick="openLinkedReport('${esc(p.refId)}')">
        <span class="link-ico">🔗</span><span class="link-label">${esc(p.label || '健康档案')}</span>
        <span class="thumb-x" title="取消链接" onclick="event.stopPropagation();delReportFile('${k}',${i})">×</span></div>`;
    }
    const inner = p.kind === 'image'
      ? `<img src="${p.data}" onclick="showBigImg('${p.data}')" title="点击查看">`
      : `<div class="pdf-ph" onclick="openPdf('${p.data}')" title="点击查看 PDF">📄<small>${esc(p.name || '报告')}</small></div>`;
    return `<div class="report-thumb">${inner}<span class="thumb-x" onclick="delReportFile('${k}',${i})" title="删除">×</span></div>`;
  }).join('');
  return items + `<label class="photo-add" title="上传图片或PDF">＋<input type="file" accept="image/*,application/pdf" style="display:none" onchange="handleReportFile(this,'${k}')"></label>`;
}

/* 健康档案：标题生成（年份 + 第几次 + 类型） */
function haTitle(r) { return `${r.year || ''}年 第${num(r.seq)}次 ${r.type || ''}`; }

/* 体检/复查电子报告附件：从健康档案链接已有报告 */
function openHealthArchivePicker(k) {
  const catId = _formData.catId || '';
  let list = (DB.healthArchives || []).filter(r => !catId || r.catId === catId);
  if (!list.length) { toast(catId ? '该猫咪还没有健康档案记录' : '还没有健康档案记录'); return; }
  list = list.slice().sort((a, b) => (b.date > a.date ? 1 : -1));
  const body = `<div class="ha-picker">${list.map(r => {
    const linked = Array.isArray(_formData[k]) && _formData[k].some(p => p.kind === 'link' && p.refId === r.id);
    return `<div class="ha-row">
      <div class="ha-info"><b>${esc(haTitle(r))}</b> <span class="chip">${esc(r.date)}</span> <span class="chip info">${esc(r.reportType || '')}</span>${r.files && r.files.length ? ` <span class="chip">${r.files.length}份电子档</span>` : ''}</div>
      <button class="btn btn-sm ${linked ? 'btn-ghost' : 'btn-primary'}" ${linked ? 'disabled' : ''} onclick="linkHealthArchive('${k}','${r.id}')">${linked ? '已链接' : '链接'}</button>
    </div>`;
  }).join('')}</div>`;
  openModal('🔗 从健康档案链接', body, `<button class="btn btn-primary" onclick="closeModal()">完成</button>`);
}
function linkHealthArchive(k, refId) {
  const r = (DB.healthArchives || []).find(x => x.id === refId); if (!r) return;
  if (!Array.isArray(_formData[k])) _formData[k] = [];
  if (_formData[k].some(p => p.kind === 'link' && p.refId === refId)) return;
  _formData[k].push({ kind: 'link', refId, label: haTitle(r) + ' · ' + r.date });
  refreshReportBox(k);
  toast('已链接：' + haTitle(r));
}
function openLinkedReport(refId) {
  const r = (DB.healthArchives || []).find(x => x.id === refId);
  if (!r) { toast('关联的健康档案记录不存在'); return; }
  const files = r.files || [];
  const gallery = files.length ? files.map(p => p.kind === 'image'
    ? `<img src="${p.data}" onclick="showBigImg('${p.data}')" style="max-width:100%;border-radius:10px;margin:4px">`
    : `<span class="pdf-ph" onclick="openPdf('${p.data}')" title="点击打开 PDF">📄 ${esc(p.name || '报告')}</span>`).join('')
    : '<div class="f-hint">该健康档案未上传电子档</div>';
  openModal(`📁 ${esc(haTitle(r))} · ${esc(r.date)}`, `
    <div class="chk-detail">
      <div class="row"><span class="k">猫咪</span><span>${esc(catName(r.catId))}</span></div>
      <div class="row"><span class="k">报告类型</span><span>${esc(r.reportType || '')}</span></div>
      ${r.summary ? `<div class="row"><span class="k">结论/摘要</span><span>${esc(r.summary)}</span></div>` : ''}
      <h4 class="mt">电子档（${files.length}）</h4>
      <div class="report-gallery">${gallery}</div>
      ${r.notes ? `<div class="note-box">${esc(r.notes)}</div>` : ''}
    </div>`,
    `<button class="btn btn-primary" onclick="closeModal()">关闭</button>`);
}
function reportFieldHTML(f) {
  const k = f.k;
  const isCheckup = _formEntity && _formEntity.table === 'checkups';
  const hint = isCheckup
    ? '支持图片或 PDF。上传 PDF 会自动提取文字并解析指标；图片请粘贴 OCR 文字，用上方「粘贴报告文字」解析。'
    : '支持图片或 PDF，上传后留档、点击即可查看。';
  const linkBtn = isCheckup ? `<button type="button" class="mini-btn" onclick="openHealthArchivePicker('${k}')">🔗 从健康档案链接</button>` : '';
  return `<label class="f-label">${esc(f.label)}</label>
  <div class="report-box" data-report="${k}">${reportBoxInner(k)}</div>
  ${linkBtn ? `<div class="report-actions">${linkBtn}</div>` : ''}
  <div class="f-hint">${hint}</div>`;
}
function refreshReportBox(k) {
  const box = document.querySelector(`.report-box[data-report="${k}"]`);
  if (box) box.innerHTML = reportBoxInner(k);
}
function delReportFile(k, i) {
  if (Array.isArray(_formData[k])) _formData[k].splice(i, 1);
  refreshReportBox(k);
}
function abToBase64(buf) {
  const bytes = new Uint8Array(buf); const len = bytes.byteLength;
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < len; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, len)));
  return btoa(binary);
}
function ensurePdfWorker() {
  try {
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  } catch (e) {}
}
function openPdf(dataUrl) {
  try {
    const b64 = ('' + dataUrl).split(',')[1] || '';
    if (!b64) { toast('PDF 数据缺失'); return; }
    const bin = atob(b64); const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    _previewUrl = url; /* 由 closePreview 统一释放，避免内存泄漏 */
    const footer = `<a class="btn btn-ghost" href="${url}" download="体检报告.pdf" target="_blank" rel="noopener">下载 / 打开</a>
       <button class="btn btn-primary" onclick="closePreview()">关闭</button>`;
    if (window.pdfjsLib) {
      /* 用 pdf.js 把每一页渲染成图片内嵌：手机 / 微信 / Safari 等均支持图片，
         且不会触发原生 PDF 查看器接管屏幕，关闭与保存都不受影响。 */
      openPreview('PDF 报告',
        `<div id="pdfRenderBox" style="text-align:center;padding:18px">
           <div class="f-hint">正在生成预览…</div>
         </div>`, footer);
      renderPdfToImages(bytes).catch(() => pdfFallbackToObject(url));
    } else {
      /* 无 pdf.js 时退回到 object 内嵌 + 下载（桌面 Chrome/Firefox 通常可用） */
      openPreview('PDF 报告',
        `<object data="${url}" type="application/pdf" style="width:100%;height:70vh;border:0;border-radius:10px;background:#fff">
           <div class="f-hint">当前浏览器无法内嵌预览，请点下方「下载 / 打开」在本地查看。</div>
         </object>`, footer);
    }
  } catch (e) { toast('PDF 打开失败'); }
}
function pdfFallbackToObject(url) {
  const box = document.getElementById('pdfRenderBox');
  if (box) box.outerHTML = `<object data="${url}" type="application/pdf" style="width:100%;height:70vh;border:0;border-radius:10px;background:#fff">
      <div class="f-hint">当前浏览器无法内嵌预览，请点下方「下载 / 打开」在本地查看。</div>
    </object>`;
}
function renderPdfToImages(bytes) {
  return new Promise((resolve, reject) => {
    const lib = window.pdfjsLib; if (!lib) return reject(new Error('no pdfjs'));
    ensurePdfWorker();
    lib.getDocument({ data: bytes }).promise.then(pdf => {
      const maxPages = Math.min(pdf.numPages, 20);
      const ps = [];
      for (let p = 1; p <= maxPages; p++) ps.push(renderPdfPage(lib, pdf, p));
      Promise.all(ps).then(imgs => {
        const box = document.getElementById('pdfRenderBox');
        if (box) box.innerHTML = imgs.join('');
        resolve();
      }).catch(reject);
    }).catch(reject);
  });
}
function renderPdfPage(lib, pdf, pageNum) {
  return pdf.getPage(pageNum).then(page => {
    const targetW = 760;
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(1, targetW / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    return page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise.then(() =>
      `<img src="${canvas.toDataURL('image/png')}" style="width:100%;border-radius:8px;margin-bottom:8px;background:#fff">`);
  });
}
function handleReportFile(input, k) {
  const file = input.files[0]; if (!file) return;
  if (file.type.startsWith('image/')) {
    compressImage(file, dataUrl => {
      if (!dataUrl) { toast('图片读取失败，请重试'); return; }
      if (!Array.isArray(_formData[k])) _formData[k] = [];
      registerFile(dataUrl, file.name, file.type).then(() => {
        _formData[k].push({ name: file.name, kind: 'image', data: dataUrl });
        refreshReportBox(k);
      });
    });
  } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const rd = new FileReader();
    rd.onload = () => {
      const buf = rd.result;
      const b64 = abToBase64(buf);
      const dataUrl = 'data:application/pdf;base64,' + b64;
      if (!Array.isArray(_formData[k])) _formData[k] = [];
      registerFile(dataUrl, file.name, 'application/pdf').then(() => {
        _formData[k].push({ name: file.name, kind: 'pdf', data: dataUrl });
        refreshReportBox(k);
        if (_formEntity && _formEntity.table === 'checkups') {
          extractPdfText(buf).then(txt => {
            if (txt && txt.trim()) fillMetricsFromText(txt);
            else toast('PDF 已保存，但未提取到文字，可用「粘贴报告文字」解析');
          }).catch(() => {
            toast('PDF 已保存，但解析组件未加载，用「粘贴报告文字」解析指标');
          });
        }
      });
    };
    rd.readAsArrayBuffer(file);
  } else { toast('仅支持图片或 PDF'); }
}
function fillMetricsFromText(txt) {
  const parsed = parseReportText(txt);
  if (parsed.metrics.length) {
    _formData.metrics = (_formData.metrics || []).concat(parsed.metrics);
    refreshMetricRows('metrics');
  }
  if (parsed.advice && !_formData.advice) { _formData.advice = parsed.advice; const a = document.querySelector('[name=advice]'); if (a) a.value = parsed.advice; }
  if (parsed.summary && !_formData.summaryText) { _formData.summaryText = parsed.summary; const s = document.querySelector('[name=summaryText]'); if (s) s.value = parsed.summary; }
  if (parsed.metrics.length) toast('PDF 已自动识别 ' + parsed.metrics.length + ' 项指标' + (parsed.metrics.filter(m => m.abnormal).length ? '，其中 ' + parsed.metrics.filter(m => m.abnormal).length + ' 项异常' : ''));
}

/* ================= 食物照片营养识别（端侧 OCR + 粘贴兜底） ================= */
const FOOD_FIELD_MAP = {
  kcal:      { label: '热量（每100g）',        unit: 'kcal', alias: ['热量', '能量', '卡路里', '千卡', '千焦', 'kcal', 'kj', 'cal'] },
  water:     { label: '含水量（每100g）',      unit: 'g',  alias: ['水分', '含水', '水份'] },
  protein:   { label: '蛋白质（每100g）',      unit: 'g',  alias: ['蛋白质', '蛋白', '粗蛋白'] },
  fat:       { label: '脂肪（每100g）',        unit: 'g',  alias: ['脂肪', '粗脂肪'] },
  calcium:   { label: '钙（每100g）',          unit: 'mg', alias: ['钙'] },
  phos:      { label: '磷（每100g）',          unit: 'mg', alias: ['磷', '磷含量'] },
  potassium: { label: '钾（每100g）',          unit: 'mg', alias: ['钾', '钾含量'] },
  bone:      { label: '骨骼含量（每100g）',    unit: 'g',  alias: ['骨骼', '骨含量', '带骨'] },
  carb:      { label: '碳水化合物（每100g）',  unit: 'g',  alias: ['碳水化合物', '碳水'] },
  fiber:     { label: '粗纤维（每100g）',       unit: 'g',  alias: ['粗纤维', '膳食纤维', '纤维', 'fiber'] },
  choline:   { label: '胆碱（每100g）',        unit: 'mg', alias: ['胆碱'] },
  iron:      { label: '铁（每100g）',          unit: 'mg', alias: ['铁', '铁含量'] },
  copper:    { label: '铜（每100g）',          unit: 'mg', alias: ['铜', '铜含量'] },
  manganese: { label: '锰（每100g）',          unit: 'mg', alias: ['锰'] },
  zinc:      { label: '锌（每100g）',           unit: 'mg', alias: ['锌', '锌含量'] },
  iodine:    { label: '碘（每100g）',          unit: 'μg', alias: ['碘'] },
  magnesium: { label: '镁（每100g）',          unit: 'mg', alias: ['镁', '镁含量'] },
  sodium:    { label: '钠（每100g）',          unit: 'mg', alias: ['钠', '钠含量'] },
  va:        { label: 'VA（每100g）',          unit: 'IU', alias: ['va', '维生素a', '维a', '维生素a'] },
  vb:        { label: 'VB1（每100g）',         unit: 'mg', alias: ['vb1', '维生素b1', '维b1', '硫胺素', 'vb', '维生素b', '维b', '维生素b族'] },
  ve:        { label: 'VE（每100g）',          unit: 'mg', alias: ['ve', '维生素e', '维e'] },
  vd:        { label: 'VD（每100g）',          unit: 'IU', alias: ['vd', '维生素d', '维d'] },
  taurine:   { label: '牛磺酸（每100g）',      unit: 'mg', alias: ['牛磺酸'] },
  epa:       { label: 'EPA（每100g）',         unit: 'mg', alias: ['epa'] },
  dha:       { label: 'DHA（每100g）',         unit: 'mg', alias: ['dha'] },
  epaDha:    { label: 'EPA&DHA（每100g）',     unit: 'mg', alias: ['epa+dha', 'epa&dha', 'epa dha', 'ω-3'] }
};
const FOOD_CATS = ['主食罐', '主食冻干', '干粮', '鲜食', '生骨肉', '零食', '营养品', '处方粮', '其他'];
function parseFoodText(text) {
  const lines = ('' + text).split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const matches = [];
  const used = {};
  for (const line of lines) {
    const low = line.toLowerCase();
    if (!used.category) {
      for (const c of FOOD_CATS) { if (low.indexOf(c.toLowerCase()) >= 0) { matches.push({ field: 'category', label: '食物类别', value: c, unit: '', raw: line }); used.category = true; break; } }
    }
    const nm = line.match(/([0-9]+\.?[0-9]*)/);
    if (!nm) continue;
    const val = nm[1];
    const rest = line.slice(nm.index + val.length);
    const um = rest.match(/[a-zA-Z%μ·\/^\s]{1,10}/);
    let unit = um ? um[0].trim() : '';
    if (/毫克|mg/i.test(rest)) unit = unit || 'mg';
    else if (/千焦|kj/i.test(rest)) unit = unit || 'kJ';
    else if (/千卡|kcal/i.test(rest)) unit = unit || 'kcal';
    else if (/克|\bg\b/i.test(rest)) unit = unit || 'g';
    for (const field in FOOD_FIELD_MAP) {
      if (used[field]) continue;
      if (FOOD_FIELD_MAP[field].alias.some(kw => low.indexOf(kw.toLowerCase()) >= 0)) {
        used[field] = true;
        let v = val, u = unit;
        if (field === 'kcal' && /千焦|kj/i.test(rest)) { v = String(Math.round(parseFloat(val) / 4.184 * 10) / 10); u = 'kcal'; }
        matches.push({ field, label: FOOD_FIELD_MAP[field].label, value: v, unit: u, raw: line });
        break;
      }
    }
  }
  return matches;
}
function isFoodForm() { return _formEntity && _formEntity.table === 'foods'; }
/* 通用 OCR：对图片跑 Tesseract，回调返回识别文字 / 失败 / 超时 */
function runOCR(dataUrl, cb) {
  if (!window.Tesseract) { cb.onFail && cb.onFail(); return; }
  openFoodOCRProgress();
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return; settled = true; closeModal();
    cb.onTimeout && cb.onTimeout();
  }, 28000);
  window.Tesseract.recognize(dataUrl, 'chi_sim+eng', { logger: m => updateFoodOCRProgress(m) })
    .then(({ data }) => {
      if (settled) return; settled = true; clearTimeout(timer); closeModal();
      cb.onDone((data.text || '').trim());
    })
    .catch(() => {
      if (settled) return; settled = true; clearTimeout(timer); closeModal();
      cb.onFail && cb.onFail();
    });
}
/* 养护小tips：识别截图文字并填入内容，截图仍作为附件保留 */
function recognizeTipPhoto() {
  const photos = (_formData.photo && _formData.photo.length) ? _formData.photo : null;
  if (!photos) { toast('请先上传截图，再点「识别图中文字」'); return; }
  const dataUrl = photos[photos.length - 1];
  runOCR(dataUrl, {
    onDone: (text) => {
      if (!text) { openTipOCRFailModal('未能从图片中识别出文字（可能图片不清晰或文字为艺术字体/表格扫描）。'); return; }
      openTipOCRModal(text);
    },
    onFail: () => openTipOCRFailModal('识别失败（当前环境可能限制了识别模型加载）。'),
    onTimeout: () => openTipOCRFailModal('识别超时（当前环境可能限制了识别模型加载）。')
  });
}
function openTipOCRModal(text) {
  openModal('识别到的文字',
    `<p class="f-hint">以下文字已提取，可修改后填入「tip 内容」；截图仍会作为附件保留。</p>
     <textarea id="tipOcrText" class="f-textarea" rows="7">${esc(text)}</textarea>`,
    `<button class="btn btn-primary" onclick="applyTipOCR()">采用并填入内容</button>
     <button class="btn btn-ghost" onclick="closeModal()">取消</button>`);
}
function applyTipOCR() {
  const txt = (document.getElementById('tipOcrText') || {}).value || '';
  const ta = document.querySelector('#dynForm [name="content"]');
  const cur = (ta ? ta.value : (_formData.content || '')).trim();
  const merged = (cur ? cur + '\n' + txt : txt).trim();
  _formData.content = merged;
  if (ta) ta.value = merged;
  closeModal();
  toast('已填入内容，截图仍作为附件保留');
}
function openTipOCRFailModal(msg) {
  openModal('识别未成功',
    `<p class="f-hint">${esc(msg)}</p><p>你可以手动在「tip 内容」里粘贴文字，截图仍会作为附件保留。</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">知道了</button>`);
}
function recognizeFoodPhoto(dataUrl) {
  if (!dataUrl) {
    const photos = (_formData.photo && _formData.photo.length) ? _formData.photo : null;
    if (!photos) { toast('请先上传图片，再点「识别所上传的图片」'); return; }
    dataUrl = photos[photos.length - 1];
  }
  if (!window.Tesseract) {
    openFoodPasteModal('识别引擎未加载（当前环境可能限制了外部识别模型加载）。请直接粘贴营养成分表文字：');
    return;
  }
  openFoodOCRProgress();
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return; settled = true;
    closeModal();
    openFoodPasteModal('图片识别超时（当前环境可能限制了识别模型加载）。请改用「粘贴文字」识别：');
  }, 28000);
  window.Tesseract.recognize(dataUrl, 'chi_sim+eng', { logger: m => updateFoodOCRProgress(m) })
    .then(({ data }) => {
      if (settled) return; settled = true; clearTimeout(timer);
      closeModal();
      const text = data.text || '';
      const matches = parseFoodText(text);
      if (!matches.length) {
        openFoodPasteModal('照片未识别出营养数据（可能图片不清晰或文字为图片/表格扫描）。请改用「粘贴文字」识别：');
        return;
      }
      openFoodCompareModal(matches, text);
    })
    .catch(() => {
      if (settled) return; settled = true; clearTimeout(timer);
      closeModal();
      openFoodPasteModal('图片识别失败（当前环境可能限制了识别模型）。请改用「粘贴文字」识别：');
    });
}
function openFoodOCRProgress() {
  openModal('正在识别营养表…',
    `<div class="ocr-box">
       <div class="spinner"></div>
       <div id="ocrStatus" class="f-hint">正在加载识别模型（首次较慢，需联网）…</div>
       <div class="ocr-bar"><div id="ocrBar" class="ocr-bar-fill"></div></div>
     </div>
     <p class="f-hint" style="margin-top:10px">若长时间无进展，可能是当前环境限制了识别模型加载。可点击下方改用「粘贴文字」。</p>`,
    `<button class="btn btn-ghost" onclick="closeModal();openFoodPasteModal()">改用粘贴文字</button>`);
}
function updateFoodOCRProgress(m) {
  const s = document.getElementById('ocrStatus');
  const b = document.getElementById('ocrBar');
  if (s && m && m.status) s.textContent = '进度：' + m.status + (typeof m.progress === 'number' ? ' ' + Math.round(m.progress * 100) + '%' : '');
  if (b && m && typeof m.progress === 'number') b.style.width = Math.max(6, Math.round(m.progress * 100)) + '%';
}
function openFoodCompareModal(matches, rawText) {
  window.__foodMatches = matches;
  const rows = matches.map((m, i) => `
    <div class="cmp-row">
      <div class="cmp-source">识别到：${esc(m.raw)}</div>
      <div class="cmp-main">
        <div class="cmp-fl">${esc(m.label)}</div>
        <input id="cmp_val_${i}" class="cmp-input" value="${esc(m.value)}">
        <span class="cmp-unit">${esc(m.unit || '')}</span>
        <label class="cmp-use"><input type="checkbox" id="cmp_use_${i}" checked> 采用</label>
      </div>
    </div>`).join('');
  openModal('核对照片识别结果',
    `<p class="f-hint">下方为从照片<b>读到的内容</b>与对应的<b>食物档案字段</b>。本档案营养按「每100g」计，请确认数值与单位无误（可修改）；取消勾选则不填入。</p>
     <div class="cmp-list">${rows}</div>
     <details style="margin-top:10px"><summary>原始识别文字</summary><pre class="cmp-rawtext">${esc(rawText || '')}</pre></details>`,
    `<button class="btn btn-primary" onclick="applyFoodCompare(${matches.length})">确认填入</button>
     <button class="btn btn-ghost" onclick="openFormKeepData()">取消</button>`);
}
function applyFoodCompare(n) {
  const matches = window.__foodMatches || [];
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    if (!matches[i]) continue;
    const use = document.getElementById('cmp_use_' + i);
    if (use && !use.checked) continue;
    const inp = document.getElementById('cmp_val_' + i);
    const val = inp ? inp.value.trim() : matches[i].value;
    if (val === '') continue;
    setFormFieldValue(matches[i].field, val);
    cnt++;
  }
  closeModal();
  // 对比框是用 openModal 直接覆盖在表单之上的，确认后表单已被替换关闭，
  // 数据只存在于内存 _formData。若不在此落库，用户就会“确认了却没有记录”。
  const ent = _formEntity;
  // 新建食物：自动补一个名称，保证可以落库
  if (!_formEditId && !_formData.name) {
    const cat = _formData.category || (matches.find(x => x.field === 'category') || {}).value;
    _formData.name = (cat && cat !== '其他' ? cat : '未命名食物') + '（营养表）';
  }
  const missing = ent.fields.filter(f => f.req && !f.show && (_formData[f.k] === '' || _formData[f.k] == null || (Array.isArray(_formData[f.k]) && !_formData[f.k].length)));
  if (!cnt) {
    toast('没有可填入的数据，已返回表单');
    openFormKeepData();
    return;
  }
  if (missing.length) {
    toast('已填入 ' + cnt + ' 项营养，还差必填项：' + missing.map(f => f.label).join('、') + '，请补填后点保存');
    openFormKeepData();
    focusFirstMissing(missing);
    return;
  }
  if (_formEditId) {
    // 编辑已有记录：重新打开表单让用户检查后再保存，避免无提示覆盖
    toast('已填入 ' + cnt + ' 项营养/类别数据，请检查后点保存');
    openFormKeepData();
    return;
  }
  // 新建食物：直接落库，生成记录
  const before = DB[ent.table].length;
  try { submitForm(); } catch (e) { /* 表单提交后 render 在测试环境可能缺元素，落库已完成则忽略 */ }
  if (DB[ent.table].length === before) {
    // submitForm 因仍有必填缺失而提前返回 → 重新打开表单，绝不留“空白消失”
    toast('已填入 ' + cnt + ' 项营养，请补填必填项后点保存');
    openFormKeepData();
    focusFirstMissing(ent.fields.filter(f => f.req && !f.show && (_formData[f.k] === '' || _formData[f.k] == null || (Array.isArray(_formData[f.k]) && !_formData[f.k].length))));
  }
}
function openFormKeepData() {
  const ent = _formEntity;
  openModal((_formEditId ? '编辑' : '新增') + ent.name, '<form id="dynForm" onsubmit="return false">' + renderFields() + '</form>',
    `<button class="btn btn-ghost" onclick="closeModal()">取消</button>
     <button class="btn btn-primary" onclick="submitForm()">保存</button>`);
  bindFormEvents();
}
function focusFirstMissing(list) {
  const f = list[0]; if (!f) return;
  const inp = document.querySelector('#dynForm [name="' + f.k + '"]');
  if (inp) { inp.focus(); try { inp.scrollIntoView({ block: 'center' }); } catch (e) {} }
}
function openFoodPasteModal(msg) {
  const hint = msg || '用手机/微信「提取文字」复制营养成分表文字，粘贴到下方，应用会自动解析并弹出核对框。';
  openModal('粘贴照片文字识别营养',
    `<p class="f-hint">${esc(hint)}</p>
     <textarea id="foodPaste" class="f-textarea" rows="8" placeholder="例如：&#10;蛋白质 8.5 g&#10;脂肪 5.0 g&#10;磷 120 mg&#10;牛磺酸 50 mg&#10;水分 80 g"></textarea>`,
    `     <button class="btn btn-primary" onclick="runFoodPaste()">识别</button>
     <button class="btn btn-ghost" onclick="openFormKeepData()">取消</button>`);
}
function runFoodPaste() {
  const ta = document.getElementById('foodPaste');
  const txt = ta ? ta.value : '';
  if (!txt || !txt.trim()) { toast('请先粘贴文字'); return; }
  const matches = parseFoodText(txt);
  if (!matches.length) { toast('未解析到营养数据'); return; }
  closeModal();
  openFoodCompareModal(matches, txt);
}
function setFormFieldValue(k, val) {
  _formData[k] = val;
  const inp = document.querySelector('#dynForm [name="' + k + '"]');
  if (inp) inp.value = val;
  if (typeof afterFieldChange === 'function') afterFieldChange(k);
}

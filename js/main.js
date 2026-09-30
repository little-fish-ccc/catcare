/* ================= 路由 / 导航 / 初始化 ================= */
let CUR_PAGE = 'home';

function go(page) {
  CUR_PAGE = page;
  location.hash = '#/' + page;
  render();
  document.getElementById('sidenav').classList.remove('open');
  document.getElementById('navMask').classList.remove('show');
  window.scrollTo(0, 0);
}

function render() {
  const el = document.getElementById('main');
  refreshCatSelector();
  if (CUR_PAGE === 'home') renderHome(el);
  else if (CUR_PAGE === 'stats') renderStats(el);
  else if (CUR_PAGE === 'cats') renderCats(el);
  else if (CUR_PAGE === 'foods') renderFoods(el);
  else if (CUR_PAGE === 'med' || CUR_PAGE === 'care') renderPlanModule(el, CUR_PAGE);
  else if (CUR_PAGE === 'checkup') renderCheckupModule(el);
  else if (CUR_PAGE === 'healthArchive') renderHealthArchive(el);
  else if (CUR_PAGE === 'careTip') renderCareTips(el);
  else if (LIST_CONFIG[CUR_PAGE]) renderListPage(el, CUR_PAGE);
  else renderHome(el);
  document.querySelectorAll('#sidenav .nav-item, #bottomnav a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === CUR_PAGE);
  });
}

function refreshCatSelector() {
  const sel = document.getElementById('globalCat');
  const cur = selectedCatId();
  sel.innerHTML = DB.cats.length
    ? DB.cats.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>🐱 ${esc(c.name)}</option>`).join('')
    : '<option value="">无猫咪</option>';
}

/* 快捷添加面板（移动端 ＋ 按钮） */
function openQuickAdd() {
  openModal('快捷记录', `
    <div class="quick-grid" style="grid-template-columns:repeat(3,1fr)">
      ${[['feed', '🍚', '记录饮食'], ['water', '💧', '记录饮水'], ['weight', '⚖️', '记录体重'],
      ['medRecord', '💊', '用药情况'], ['excrete', '💩', '排泄情况'], ['health', '🩺', '健康异常'],
      ['careRecord', '🧼', '日常护理'], ['status', '😺', '每日状态'], ['interaction', '💞', '今日互动']]
      .map(([k, i, l]) => `<button class="quick-btn" onclick="closeModal();openForm('${k}')"><span>${i}</span>${l}</button>`).join('')}
    </div>`);
}

/* ---------- 数据备份与恢复 ---------- */
function openDataModal() {
  openModal('⚙️ 数据备份与恢复', `
    <p class="f-hint">数据保存在本机浏览器中，与当前打开的网址绑定。若更换网址、清除浏览器缓存或用无痕模式，记录会丢失。已开启「保存后自动备份」：每月首次改动后会在本机下载一份带日期的备份 json（每月只下载一次，减少下载提示弹窗），可作为兜底。建议也定期手动导出备份文件。</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
      <button class="btn btn-primary" onclick="exportData()">⬇️ 导出备份（.json）</button>
      <label class="btn" style="cursor:pointer">⬆️ 导入备份<input id="importFile" type="file" accept="application/json,.json" style="display:none" onchange="importData(this)"></label>
      <button class="btn btn-danger" onclick="clearData()">🗑️ 清空本机数据</button>
    </div>
    <div id="dataInfo" class="f-hint"></div>
  `);
}
function exportData() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '猫猫工作台备份_' + today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('已导出备份文件，请妥善保存');
}
function importData(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result);
      if (!confirm('导入将覆盖当前本机数据，确定继续？建议先导出当前数据作为备份。')) return;
      Object.assign(DB, JSON.parse(JSON.stringify(DB_DEFAULT)), data);
      /* 导入的数据含完整附件，先写入 IndexedDB，保存时 localStorage 仅留引用 */
      registerFilesToIdb().then(() => { dbSave(); render(); closeModal(); toast('备份已导入'); });
    } catch (e) { toast('文件格式错误，导入失败'); }
  };
  rd.readAsText(f);
}
function clearData() {
  if (confirm('将清空本机所有猫咪与记录，且不可恢复！确定？')) {
    Object.keys(DB).forEach(k => delete DB[k]);
    Object.assign(DB, JSON.parse(JSON.stringify(DB_DEFAULT)));
    dbSave(); render(); closeModal(); toast('已清空本机数据');
  }
}
/* ---------- 仅健康档案：单独导出 / 合并导入（不影响其他模块） ---------- */
function exportHealthArchive() {
  const list = DB.healthArchives || [];
  if (!list.length) { toast('还没有健康档案可导出'); return; }
  const payload = {
    app: '猫猫工作台', kind: 'healthArchive', version: 1, exportedAt: new Date().toISOString(),
    data: { healthArchives: list.map(r => Object.assign({}, r, { _catName: (getCat(r.catId) || {}).name || r._catName || '' })) }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '健康档案备份_' + today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('已导出健康档案备份（含电子档附件）');
}
function importHealthArchive(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const payload = JSON.parse(rd.result);
      const arr = payload && payload.data && payload.data.healthArchives;
      if (!Array.isArray(arr)) { toast('文件格式不对，不是健康档案备份'); return; }
      if (!DB.healthArchives) DB.healthArchives = [];
      const have = new Set(DB.healthArchives.map(x => x.id));
      let added = 0, skip = 0;
      arr.forEach(r => {
        if (r && r.id && have.has(r.id)) { skip++; return; }
        DB.healthArchives.push(r); have.add(r.id); added++;
      });
      if (added) { registerFilesToIdb().then(() => { dbSave(); render(); }); }
      toast(`已导入 ${added} 条健康档案${skip ? '，跳过 ' + skip + ' 条重复' : ''}（其他模块不受影响）`);
    } catch (e) { toast('文件解析失败，导入未完成'); }
    input.value = '';
  };
  rd.readAsText(f);
}
/* ---------- 营养摄入目标设定 ---------- */
function openNutritionTargetModal() {
  const catId = selectedCatId();
  const cat = getCat(catId); if (!cat) return;
  const tg = getTargets(catId);
  const row = (k, label, unit, req) => `<label class="tgt-row"><span>${req ? '<b style="color:var(--red)">*</b> ' : ''}${label}<small>${unit}</small></span>
    <input type="number" id="tgt_${k}" value="${tg[k] != null ? tg[k] : ''}" placeholder="${req ? '必填' : '可选'}"></label>`;
  openModal('🎯 营养摄入目标', `
    <p class="f-hint">为 <b>${esc(cat.name)}</b> 设定每日营养摄入目标。<b style="color:var(--red)">*</b> 为必填项，会显示在首页「今日营养摄入」卡片并对比达标情况；其余为选填。</p>
    <div class="tgt-grid">
      ${row('water', '水（饮水 + 食物水分）', 'ml', true)}
      ${row('kcal', '总热量', 'kcal', true)}
      ${row('protein', '总蛋白质', 'g', true)}
      ${row('fat', '脂肪', 'g', false)}
      ${row('phos', '磷', 'mg', false)}
    </div>
    <div style="margin-top:14px;display:flex;gap:10px">
      <button class="btn btn-primary" onclick="saveNutritionTarget()">保存目标</button>
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
    </div>`);
}
function saveNutritionTarget() {
  const catId = selectedCatId();
  const keys = ['water', 'kcal', 'protein', 'fat', 'phos'];
  const obj = {};
  for (const k of keys) {
    const v = num(document.getElementById('tgt_' + k).value);
    if (v > 0) obj[k] = v;
  }
  if (!(obj.water > 0) || !(obj.kcal > 0) || !(obj.protein > 0)) {
    toast('水、总热量、总蛋白质为必填项'); return;
  }
  if (!DB.targets) DB.targets = {};
  DB.targets[catId] = obj;
  dbSave(); closeModal(); render(); toast('营养目标已保存');
}
/* 空库时提示从备份恢复（换网址/浏览器/无痕导致记录看不到了） */
function showRecoverModal() {
  openModal('📦 未检测到本地数据', `
    <p>本机还没有任何猫咪或记录。</p>
    <p class="f-hint">如果是换了网址、浏览器、或用无痕模式，导致之前的记录看不到了，可以从之前导出的备份文件恢复：</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
      <label class="btn btn-primary" style="cursor:pointer">⬆️ 选择备份文件导入<input id="recoverFile" type="file" accept="application/json,.json" style="display:none" onchange="importData(this)"></label>
      <button class="btn" onclick="closeModal()">稍后再说，先浏览</button>
    </div>
    <p class="f-hint">小提示：数据存在浏览器里、与打开的网址绑定。建议以后每次录完点右上角 ⚙️ 导出备份；本应用已开启「保存后自动备份」。</p>
  `);
}

/* ---------- 示例数据 ---------- */
function loadDemo() {
  if (DB.cats.length && !confirm('将追加一套示例数据（1只猫 + 食物 + 各类记录），继续？')) return;
  const t = today();
  const catId = uid();
  DB.cats.push({ id: catId, name: '布丁', gender: '公', birth: addDays(t, -820), neutered: '已绝育', breed: '中华田园猫', coat: '橘白', curWeight: 4.35, idealMin: 4.0, idealMax: 4.6, allergyNote: '疑似牛肉不耐受', history: '2025年秋季有过一次应激性软便', notes: '胆子小，怕陌生人', photo: [] });
  const f1 = uid(), f2 = uid(), f3 = uid();
  DB.foods.push(
    { id: f1, name: '鸡肉主食罐 85g', brand: '喵鲜厨', category: '主食罐', water: 80, kcal: 91, protein: 10.5, fat: 5.2, calcium: 220, phos: 180, potassium: 160, pack: '85g/罐', notes: '很爱吃，基本吃完', photo: [] },
    { id: f2, name: '低敏鸡肉干粮', brand: '康福猫', category: '干粮', water: 8, kcal: 380, protein: 38, fat: 16, calcium: 1100, phos: 900, potassium: 800, pack: '2kg/袋', openDate: addDays(t, -20), expiry: addDays(t, 160), notes: '接受度一般', photo: [] },
    { id: f3, name: '鸡胸肉冻干', brand: '纯萃', category: '零食', water: 5, kcal: 347, protein: 75, fat: 8, calcium: 40, phos: 700, potassium: 900, pack: '50g/袋', notes: '超爱，用于奖励', photo: [] }
  );
  // 近14天记录
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i);
    DB.feedings.push(
      { id: uid(), catId, date: d, time: '08:00', meal: '早餐', foodId: f1, foodName: '鸡肉主食罐 85g', grams: 85, finish: '吃完' },
      { id: uid(), catId, date: d, time: '19:30', meal: '晚餐', foodId: f1, foodName: '鸡肉主食罐 85g', grams: 85, finish: i % 5 === 0 ? '吃了大部分' : '吃完' },
      { id: uid(), catId, date: d, time: '13:00', meal: '加餐', foodId: f2, foodName: '低敏鸡肉干粮', grams: 20, finish: i % 3 === 0 ? '吃了一半' : '吃了大部分' }
    );
    if (i % 2 === 0) DB.water.push({ id: uid(), catId, date: d, time: '15:00', amount: 30 + (i % 3) * 10, method: '流动饮水机' });
    if (i % 2 === 0) DB.weights.push({ id: uid(), catId, date: d, time: '09:00', kg: +(4.42 - i * 0.006 + (i % 3) * 0.01).toFixed(2), method: '宠物秤', condition: '空腹' });
    DB.status.push({ id: uid(), catId, date: d, overall: i === 6 ? '一般' : '良好', appetite: i === 6 ? '略下降' : '正常', drink: '正常', activity: '正常', sleep: '正常', mood: i === 6 ? '躲藏' : '放松', stress: i === 6 ? '轻微' : '无', stressReason: i === 6 ? ['噪音'] : [], hasFear: false });
    DB.excrete.push({ id: uid(), catId, date: d, pooped: true, poopCount: 1, poopState: i === 6 ? '偏软' : '正常成形', poopColor: '正常褐色', poopHair: i % 4 === 0, straining: false, peeNormal: true, clumpCount: 3, clumpSize: '正常', frequentBox: false, peeDifficulty: false, peeColorAbn: false });
  }
  DB.health.push(
    { id: uid(), catId, date: addDays(t, -6), time: '07:30', type: '呕吐', severity: '轻微', observe: true, consulted: false, visited: false, vomitTypes: ['毛球', '透明胃液'], vomitAmount: '少量', vomitHairball: true, vomitAfterMeal: false, vomitMealGap: '6小时以上', vomitSpirit: '正常', vomitEatAfter: true, vomitNotes: '吐完后正常进食，疑似毛球', photo: [], vomitPhoto: [] },
    { id: uid(), catId, date: addDays(t, -2), time: '21:00', type: '打喷嚏', severity: '轻微', observe: false, consulted: false, visited: false, notes: '连打3个喷嚏，无其他症状', photo: [] }
  );
  const mp1 = uid(), cp1 = uid();
  DB.medPlans.push({ id: mp1, catId, createdDate: addDays(t, -6), type: '化毛产品', name: '化毛膏', dose: '3', unit: '泵', route: '直接喂', continuous: true, startDate: addDays(t, -6), endDate: addDays(t, 24), schedType: '按星期', weekdays: ['周三', '周日'], paused: false, notes: '呕吐毛球后开始，每周三、周日各一次' });
  DB.medRecords.push(
    { id: uid(), catId, planId: mp1, date: addDays(t, -6), time: '20:00', result: '已完成', notes: '' },
    { id: uid(), catId, planId: mp1, date: addDays(t, -3), time: '20:10', result: '部分完成', notes: '只舔了一半' }
  );
  DB.carePlans.push({ id: cp1, catId, createdDate: addDays(t, -10), type: '梳毛', name: '每日梳毛', method: '针梳', continuous: true, startDate: addDays(t, -10), endDate: addDays(t, 80), schedType: '按间隔', intervalDays: '1', paused: false, notes: '换毛期坚持每天梳' });
  DB.careRecords.push(
    { id: uid(), catId, planId: cp1, date: addDays(t, -1), time: '21:00', result: '已完成', notes: '' },
    { id: uid(), catId, planId: cp1, date: addDays(t, -2), time: '21:00', result: '拒绝', notes: '心情不好跑掉了' }
  );
  DB.deworm.push(
    { id: uid(), catId, date: addDays(t, -25), dtype: '外驱', product: '大宠爱', ingredient: '塞拉菌素', dose: '45mg', method: '滴剂', nextDate: addDays(t, 5), remindDays: '提前7天', reaction: '无', photo: [] },
    { id: uid(), catId, date: addDays(t, -40), dtype: '内驱', product: '海乐妙', dose: '14mg', method: '口服', nextDate: addDays(t, 50), remindDays: '提前7天', reaction: '无', photo: [] }
  );
  DB.vet.push({ id: uid(), catId, date: addDays(t, -90), hospital: '安心宠物医院', doctor: '王医生', reason: '年度体检', diagnosis: '整体健康，轻度牙结石', tests: '血常规、生化未见异常', advice: '建议日常刷牙，半年后复查口腔', revisitDate: addDays(t, 92), photo: [] });
  DB.allergy.push({ id: uid(), catId, category: '食物', name: '牛肉', confirm: '疑似', reaction: '进食牛肉罐头后当晚软便2次', severity: '轻微', date: addDays(t, -60) });
  // 体检 / 复查：两次，含异常指标与重点关注，形成趋势
  DB.checkups.push({
    id: uid(), catId, date: addDays(t, -90), type: '体检', hospital: '安心宠物医院', weight: '4.30',
    items: ['血常规', '生化全套', '腹部B超'],
    metrics: [
      { name: '白蛋白 ALB', value: '38', unit: 'g/L', low: '28', high: '40', focus: true, abnormal: false },
      { name: '肌酐 CREA', value: '185', unit: 'μmol/L', low: '62', high: '160', focus: true, abnormal: true },
      { name: '谷丙转氨酶 ALT', value: '78', unit: 'U/L', low: '10', high: '100', focus: false, abnormal: false }
    ],
    reportFiles: [], summaryText: '各项指标基本正常，肌酐轻度偏高需注意，建议复查肾功能', advice: '增加饮水，3个月后复查生化（肌酐、尿素氮）',
    nextDate: addDays(t, 92), nextItems: '生化（肌酐、尿素氮）、尿检', altItems: '肾脏超声（如肌酐持续升高）'
  });
  DB.checkups.push({
    id: uid(), catId, date: addDays(t, -10), type: '复查', hospital: '安心宠物医院', weight: '4.34',
    items: ['血常规', '生化全套'],
    metrics: [
      { name: '白蛋白 ALB', value: '37', unit: 'g/L', low: '28', high: '40', focus: true, abnormal: false },
      { name: '肌酐 CREA', value: '172', unit: 'μmol/L', low: '62', high: '160', focus: true, abnormal: true },
      { name: '谷丙转氨酶 ALT', value: '70', unit: 'U/L', low: '10', high: '100', focus: false, abnormal: false }
    ],
    reportFiles: [], summaryText: '肌酐较上次略降但仍偏高，继续观察', advice: '维持现饮食，1个月后复查',
    nextDate: addDays(t, 30), nextItems: '生化、尿比重', altItems: '肾脏超声'
  });
  DB.interactions.push({
    id: uid(), catId, date: addDays(t, -1), time: '20:30', type: '陪伴撸猫', mood: '粘人撒娇',
    title: '跳上腿陪加班', content: '布丁主动跳到腿上，发出满足的呼噜声，陪我加完班', memory: true, photo: [], notes: '第一次主动求摸'
  });
  DB.settings.selectedCat = catId;
  dbSave(); toast('示例数据已载入 🎉'); render();
}

/* ---------- 事件绑定 & 启动 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // 侧边导航
  document.querySelectorAll('#sidenav .nav-item').forEach(a => a.addEventListener('click', () => go(a.dataset.page)));
  document.querySelectorAll('#bottomnav a[data-page]').forEach(a => a.addEventListener('click', () => go(a.dataset.page)));
  document.getElementById('quickAddBtn').addEventListener('click', openQuickAdd);
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidenav').classList.toggle('open');
    document.getElementById('navMask').classList.toggle('show');
  });
  document.getElementById('navMask').addEventListener('click', () => {
    document.getElementById('sidenav').classList.remove('open');
    document.getElementById('navMask').classList.remove('show');
  });
  document.getElementById('globalCat').addEventListener('change', e => {
    DB.settings.selectedCat = e.target.value; dbSave(); render();
  });
  // 路由：每次刷新默认回到首页仪表盘（不沿用上次停留的模块）
  CUR_PAGE = 'home';
  if (location.hash !== '#/home') location.hash = '#/home';
  /* 先完成附件初始化（旧内联附件迁移到 IndexedDB + 还原引用），再首次渲染，避免图片空白 */
  _initFiles.then(() => {
    render();
    if (!dbHasData()) showRecoverModal();
  });
});

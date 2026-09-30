/* ================= 页面渲染 ================= */
let PAGE_FILTER = {};  // 每个列表页的筛选状态
let CHKUP_TREND_METRIC = '';  // 体检指标趋势当前选中的指标名

/* ---------- 首页仪表盘 ---------- */
function renderHome(el) {
  const catId = selectedCatId();
  const t = today();
  if (!DB.cats.length) {
    el.innerHTML = `<div class="card"><div class="empty"><span class="big">🐱</span>
      还没有猫咪档案，先给你的猫建一个档案吧！<br><br>
      <button class="btn btn-primary" onclick="openForm('cat')">＋ 创建猫咪档案</button>
      <div style="margin-top:12px"><span class="link" onclick="loadDemo()">或载入一份示例数据看看效果</span></div>
    </div></div>`;
    return;
  }
  const cat = getCat(catId);
  const feeds = recordsOf('feedings', catId, t, t);
  const tt = feedTotals(feeds);
  const byCat = feedTotalsByCategory(feeds);
  const waterExtra = recordsOf('water', catId, t, t).reduce((s, r) => s + num(r.amount), 0);
  const waterTotal = tt.water + waterExtra;

  /* 今日填写状态 */
  const filled = {
    '饮食': feeds.length > 0,
    '精神状态': recordsOf('status', catId, t, t).length > 0,
    '排便排尿': recordsOf('excrete', catId, t, t).length > 0,
    '体重': recordsOf('weights', catId, t, t).length > 0
  };
  /* 今日是否为用药日 / 护理日（有生效计划才列入待办） */
  const medDue = DB.medPlans.filter(p => p.catId === catId && isPlanDay(p, t));
  const careDue = DB.carePlans.filter(p => p.catId === catId && isPlanDay(p, t));
  const medDone = recordsOf('medRecords', catId, t, t);
  const careDone = recordsOf('careRecords', catId, t, t);

  /* 体重 */
  const ws = recordsOf('weights', catId).sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1);
  const lastW = ws[0], prevW = ws[1];
  const wDiff = lastW && prevW ? num(lastW.kg) - num(prevW.kg) : null;
  let weightAlert = '';
  const lastWDate = lastW ? lastW.date : null;
  const gap = lastWDate ? daysBetween(lastWDate, t) : 999;
  if (gap >= 3) weightAlert = `<div class="alert alert-warn">⚠️ <div><b>已连续${lastWDate ? gap : '多'}天未称体重，建议今天记录一次体重。</b>
    <div style="margin-top:6px"><button class="btn btn-orange btn-sm" onclick="openForm('weight')">现在记录体重</button></div></div></div>`;

  /* 最近异常事件 */
  const lastEvent = recordsOf('health', catId)[0];

  /* 提醒（驱虫/复诊/用药） */
  const reminders = buildReminders(catId);

  /* 体重迷你趋势 */
  const wpts = ws.slice(0, 15).reverse().map(w => ({ x: w.date, y: num(w.kg) }));

  el.innerHTML = `
  <div class="page-title">${cat.photo && cat.photo[0] ? `<img src="${cat.photo[0]}" class="cat-avatar" style="width:34px;height:34px;vertical-align:middle;margin-right:6px">` : '🐾'} ${esc(cat.name)}🐱的今日记录</div>
  <div class="page-sub">${t}（${weekdayCN(t)}）${cat.birth ? ' · ' + ageText(cat.birth) : ''}</div>
  ${weightAlert}

  <div class="card">
    <h3>⚡ 快捷记录</h3>
    <div class="quick-grid">
      <button class="quick-btn" onclick="openForm('feed')"><span>🍚</span>记录饮食</button>
      <button class="quick-btn" onclick="openForm('water')"><span>💧</span>记录饮水</button>
      <button class="quick-btn" onclick="openForm('weight')"><span>⚖️</span>记录体重</button>
      <button class="quick-btn" onclick="go('med')"><span>💊</span>用药情况</button>
      <button class="quick-btn" onclick="openForm('excrete')"><span>💩</span>排泄情况</button>
      <button class="quick-btn" onclick="go('health')"><span>🩺</span>健康异常</button>
      <button class="quick-btn" onclick="go('care')"><span>🧼</span>日常护理</button>
      <button class="quick-btn" onclick="openForm('status')"><span>😺</span>每日状态</button>
      <button class="quick-btn" onclick="openForm('interaction')"><span>💞</span>今日互动</button>
    </div>
  </div>

  <div class="card">
    <h3>🍽️ 今日营养摄入 <span style="margin-left:auto;display:flex;gap:8px;align-items:center"><span class="link" style="font-size:.78rem" onclick="openNutritionTargetModal()">🎯 设定目标</span><span class="chip info">${mealCountOf(feeds)} 餐</span></span></h3>
    <div class="grid3">
      <div><div class="stat-num" style="font-size:1rem;line-height:1.5">${byCat.length ? byCat.map(c => `${esc(c.category)} <b>${fmt(c.grams)}</b>g`).join('<br>') : '-'}</div><div class="stat-label">进食量（按大类）</div></div>
      <div><div class="stat-num">${fmt(waterTotal)}<span class="stat-unit"> g</span></div><div class="stat-label">总水分${waterExtra ? `（食物${fmt(tt.water)}g + 饮水${fmt(waterExtra)}ml）` : '（含食物含水量）'}</div>${nutritionTargetHint('water', waterTotal, 'ml')}</div>
      <div><div class="stat-num">${fmt(tt.kcal)}<span class="stat-unit"> kcal</span></div><div class="stat-label">热量</div>${nutritionTargetHint('kcal', tt.kcal, 'kcal')}</div>
      <div><div class="stat-num">${fmt(tt.protein)}<span class="stat-unit"> g</span></div><div class="stat-label">蛋白质</div>${nutritionTargetHint('protein', tt.protein, 'g')}</div>
      <div><div class="stat-num">${fmt(tt.fat)}<span class="stat-unit"> g</span></div><div class="stat-label">脂肪</div></div>
      <div><div class="stat-num">${fmt(tt.phos)}<span class="stat-unit"> mg</span></div><div class="stat-label">磷</div></div>
    </div>
  </div>

  <div class="card">
    <h3>📝 今日待办检查</h3>
    <div class="check-row">
      ${Object.entries(filled).map(([k, v]) => {
        const ent = ({ '饮食': 'feed', '精神状态': 'status', '排便排尿': 'excrete', '体重': 'weight' })[k];
        const act = v ? `go('${ent}')` : `openForm('${ent}')`;
        const tip = v ? '点击查看 / 补充' : '点击去记录';
        return `<span class="chip ${v ? 'ok' : 'warn'}" style="cursor:pointer" onclick="${act}" title="${tip}">${v ? '✓' : '○'} ${k}${v ? '已记录' : '未记录'}</span>`;
      }).join('')}
      ${medDue.length ? (() => {
        const done = medDue.every(p => medDone.some(r => r.planId === p.id));
        return `<span class="chip ${done ? 'ok' : 'warn'}" style="cursor:pointer" onclick="go('med')" title="${medDue.map(p => esc(p.name)).join('、')}">${done ? '✓ 今日用药已完成' : '💊 今天需要用药（' + medDue.length + '项）'}</span>`;
      })() : ''}
      ${careDue.length ? (() => {
        const done = careDue.every(p => careDone.some(r => r.planId === p.id));
        return `<span class="chip ${done ? 'ok' : 'warn'}" style="cursor:pointer" onclick="go('care')" title="${careDue.map(p => esc(p.name)).join('、')}">${done ? '✓ 今日护理已完成' : '🧼 今天需要护理（' + careDue.length + '项）'}</span>`;
      })() : ''}
    </div>
  </div>

  <div class="card">
    <h3>⚖️ 体重情况 <a class="link" style="margin-left:auto;font-size:.78rem" onclick="go('weight')">查看全部</a></h3>
    ${lastW ? `
      <div class="grid3">
        <div><div class="stat-num">${fmt(lastW.kg, 2)}<span class="stat-unit"> kg</span></div><div class="stat-label">最近体重（${fmtDateCN(lastW.date)}）</div></div>
        <div><div class="stat-num" style="color:${wDiff > 0 ? 'var(--red)' : wDiff < 0 ? '#4d7a5e' : 'var(--ink)'}">${wDiff == null ? '-' : (wDiff > 0 ? '+' : '') + fmt(wDiff, 2)}<span class="stat-unit"> kg</span></div><div class="stat-label">较上次变化</div></div>
        <div><div class="stat-num">${weightTrendText(catId, 7)}</div><div class="stat-label">近7天趋势（30天 ${weightTrendText(catId, 30)} / 90天 ${weightTrendText(catId, 90)}）</div></div>
      </div>
      ${wpts.length >= 2 ? `<div style="margin-top:10px">${svgLineChart(wpts, { h: 90, color: '#8fbf9f', unit: 'kg' })}</div>` : ''}
      ${cat.idealMin && cat.idealMax ? `<div class="f-hint" style="margin-top:6px">理想体重范围：${cat.idealMin} - ${cat.idealMax} kg</div>` : ''}`
      : `<div class="empty" style="padding:14px">还没有体重记录 <span class="link" onclick="openForm('weight')">立即记录</span></div>`}
  </div>

  <div class="card">
    <h3>🚨 最近一次健康异常</h3>
    ${lastEvent ? `<div class="rec-item" style="border:none;padding:4px 0;cursor:pointer" onclick="showRecordDetail('health','${lastEvent.id}')" title="点击查看详情">
      <div class="rec-main">
        <div class="rec-title">${esc(lastEvent.type)} <span class="chip ${sevClass(lastEvent.severity)}">${esc(lastEvent.severity || '')}</span>${lastEvent.observe ? ' <span class="chip warn">持续观察</span>' : ''}</div>
        <div class="rec-sub">${lastEvent.date} ${lastEvent.time || ''} · ${lastEvent.type === '呕吐' && lastEvent.vomitTypes && lastEvent.vomitTypes.length ? '呕吐物：' + lastEvent.vomitTypes.join('、') : esc(lastEvent.notes || '无备注')}</div>
      </div><span class="rec-date">${daysBetween(lastEvent.date, t)}天前</span></div>`
      : `<div class="f-hint">暂无健康异常记录，一切安好 🎉</div>`}
  </div>

  <div class="card">
    <h3>⏰ 健康提醒</h3>
    ${reminders.length ? reminders.map(r => `
      <div class="remind-item"><span>${r.icon} ${esc(r.label)}<small style="color:var(--ink-3)"> ${esc(r.detail)}</small></span>
      <span class="days-left ${r.days < 0 ? 'over' : r.soon ? 'soon' : ''}">${r.days < 0 ? '已逾期' + (-r.days) + '天' : r.days === 0 ? '就是今天' : '还有' + r.days + '天'}</span></div>`).join('')
      : `<div class="f-hint">暂无待提醒事项。记录驱虫、复诊或用药的"下次日期"后，会自动在这里倒计时提醒。</div>`}
  </div>`;
}

function weightTrendText(catId, days) {
  const t = today();
  const list = recordsOf('weights', catId, addDays(t, -days), t).sort((a, b) => (a.date > b.date ? 1 : -1));
  if (list.length < 2) return '—';
  const d = num(list[list.length - 1].kg) - num(list[0].kg);
  const arrow = d > 0.02 ? '↑' : d < -0.02 ? '↓' : '→';
  return `${arrow}${fmt(Math.abs(d), 2)}kg`;
}
function sevClass(s) { return { '轻微': 'ok', '一般': 'info', '明显': 'warn', '严重': 'bad', '紧急': 'bad' }[s] || 'info'; }

function buildReminders(catId) {
  const t = today(), out = [];
  const push = (icon, label, detail, dateStr, soonDays) => {
    if (!dateStr) return;
    const days = daysBetween(t, dateStr);
    if (days < -60) return;
    out.push({ icon, label, detail, days, soon: days <= soonDays });
  };
  // 驱虫：按类型取最近一条的下次日期
  ['外驱', '内驱'].forEach(tp => {
    const recs = DB.deworm.filter(r => r.catId === catId && r.nextDate && (r.dtype === tp || r.dtype === '内外同驱'))
      .sort((a, b) => b.date > a.date ? 1 : -1);
    if (recs[0]) {
      const rd = recs[0].remindDays === '提前3天' ? 3 : 7;
      push('🐛', `下次${tp}`, recs[0].product || '', recs[0].nextDate, rd);
    }
  });
  // 复诊
  DB.vet.filter(r => r.catId === catId && r.revisitDate && daysBetween(t, r.revisitDate) >= -30)
    .sort((a, b) => a.revisitDate > b.revisitDate ? 1 : -1).slice(0, 2)
    .forEach(r => push('🏥', '复诊', r.hospital + (r.reason ? '·' + r.reason : ''), r.revisitDate, 3));
  // 体检/复查：下次预计体检提醒
  DB.checkups.filter(r => r.catId === catId && r.nextDate && daysBetween(t, r.nextDate) >= -30)
    .sort((a, b) => a.nextDate > b.nextDate ? 1 : -1).slice(0, 2)
    .forEach(r => push('🧪', r.type === '复查' ? '复查' : '下次体检', r.hospital + (r.nextItems ? '·' + r.nextItems : ''), r.nextDate, 3));
  // 用药/护理计划：找每个计划从今天起最近的执行日（暂停的计划自动跳过）
  const nextPlanDay = plan => {
    for (let i = 0; i <= 60; i++) {
      const d = addDays(t, i);
      if (plan.endDate && plan.continuous && d > plan.endDate) return null;
      if (isPlanDay(plan, d)) return d;
    }
    return null;
  };
  DB.medPlans.filter(p => p.catId === catId && !p.paused).forEach(p => {
    const d = nextPlanDay(p);
    if (d) push('💊', d === t ? '今天需用药' : '下次用药', p.name + (p.dose ? '（' + p.dose + (p.unit || '') + '）' : ''), d, 1);
  });
  DB.carePlans.filter(p => p.catId === catId && !p.paused).forEach(p => {
    const d = nextPlanDay(p);
    if (d) push('🧼', d === t ? '今天需护理' : '下次护理', p.name, d, 1);
  });
  return out.sort((a, b) => a.days - b.days);
}

/* ---------- 通用列表页 ---------- */
const LIST_CONFIG = {
  feed: {
    title: '🍚 饮食记录', sub: '记录每餐饮食，自动计算营养摄入，并按天汇总',
    typeField: 'meal', typeOpts: ['早餐', '午餐', '晚餐', '夜宵', '加餐', '零食', '自由采食', '其他'],
    summary(r) {
      const n = calcNutrition(r.foodId, r.grams);
      return {
        title: `${esc(r.foodName || (getFood(r.foodId) || {}).name || '未知食物')} <span class="chip">${esc(r.meal || '')}</span> <span class="chip info">${fmt(num(r.grams))}g</span>${r.finish ? ` <span class="chip ${r.finish === '吃完' ? 'ok' : r.finish === '未吃' ? 'bad' : 'warn'}">${r.finish}</span>` : ''}`,
        sub: (n ? `💧${fmt(n.water)}g · 🔥${fmt(n.kcal)}kcal · 蛋白${fmt(n.protein)}g · 脂肪${fmt(n.fat)}g · 磷${fmt(n.phos)}mg` : '未关联食物档案，无法计算营养') + (r.notes ? ' · ' + esc(r.notes) : '')
      };
    },
    dayFoot(list, catId) {
      const tt = feedTotals(list);
      const byCat = feedTotalsByCategory(list);
      const tg = catId ? getTargets(catId) : {};
      /* 目标值标注：水/热量/蛋白质（用户设定才有） */
      const tgt = (key, unit) => (tg[key] > 0) ? `（目标${fmt(tg[key])}${unit}）` : '';
      /* 总克重按食物大类分别统计，不直接相加（50g 罐头 ≠ 50g 干粮） */
      const catText = byCat.length
        ? byCat.map(c => `${esc(c.category)} ${fmt(c.grams)}g`).join(' · ')
        : '无';
      const parts = [
        `分类克重：${catText}`,
        `水分${fmt(tt.water)}g${tgt('water', 'g')}`,
        `${fmt(tt.kcal)}kcal${tgt('kcal', 'kcal')}`,
        `蛋白${fmt(tt.protein)}g${tgt('protein', 'g')}`,
        `脂肪${fmt(tt.fat)}g`,
        `磷${fmt(tt.phos)}mg`
      ];
      return `当日合计：${parts.join(' · ')}`;
    }
  },
  health: {
    title: '🩺 健康事件', sub: '记录呕吐、腹泻等异常，一天可记录多次；点击记录可查看详情',
    typeField: 'type', typeOpts: ENTITIES.health.fields.find(f => f.k === 'type').opts,
    detail: true,
    summary(r) {
      let extra = '';
      if (r.type === '呕吐') {
        extra = [r.vomitTypes && r.vomitTypes.length ? '呕吐物：' + r.vomitTypes.join('、') : '',
        r.vomitAmount ? '量：' + r.vomitAmount : '', r.vomitHairball ? '含毛球' : '',
        r.vomitSpirit ? '吐后精神：' + r.vomitSpirit : ''].filter(Boolean).join(' · ');
      }
      return {
        title: `${esc(r.type)} <span class="chip ${sevClass(r.severity)}">${esc(r.severity || '未分级')}</span>${r.observe ? ' <span class="chip warn">持续观察</span>' : ''}${r.visited ? ' <span class="chip info">已就医</span>' : r.consulted ? ' <span class="chip info">已咨询</span>' : ''}`,
        sub: [extra, esc(r.vomitNotes || ''), esc(r.notes || '')].filter(Boolean).join(' · ') || '无更多信息'
      };
    }
  },
  status: {
    title: '😺 每日状态', sub: '每只猫每天填写一次精神与行为状态',
    summary(r) {
      return {
        title: `整体：${esc(r.overall || '-')} <span class="chip ${r.overall === '较差' || r.overall === '明显异常' ? 'bad' : 'ok'}">${esc(r.appetite ? '食欲' + r.appetite : '')}</span>${r.stress && r.stress !== '无' ? ` <span class="chip warn">应激${r.stress}</span>` : ''}`,
        sub: [r.drink ? '饮水' + r.drink : '', r.activity ? '活动' + r.activity : '', r.sleep ? '睡眠' + r.sleep : '', r.mood ? '情绪' + r.mood : '',
        r.stressReason && r.stressReason.length ? '应激原因：' + r.stressReason.join('、') : '',
        r.hasFear ? '害怕：' + esc(r.fearObject || '未注明') : '', esc(r.notes || '')].filter(Boolean).join(' · ')
      };
    }
  },
  weight: {
    title: '⚖️ 体重记录', sub: '不强制每天称重，连续3天未记录会在首页提醒', chart: 'weight',
    summary(r) {
      return { title: `${fmt(r.kg, 2)} kg <span class="chip">${esc(r.method || '')}</span>${r.condition ? ` <span class="chip info">${r.condition}</span>` : ''}`, sub: esc(r.notes || '') };
    }
  },
  deworm: {
    title: '🐛 驱虫管理', sub: '外驱 / 内驱 / 内外同驱，自动倒计时提醒',
    typeField: 'dtype', typeOpts: ['外驱', '内驱', '内外同驱'],
    summary(r) {
      const d = r.nextDate ? daysBetween(today(), r.nextDate) : null;
      return {
        title: `${esc(r.product)} <span class="chip ${r.dtype === '外驱' ? 'info' : r.dtype === '内驱' ? 'warn' : 'ok'}">${esc(r.dtype)}</span>${r.reaction && r.reaction !== '无' ? ` <span class="chip bad">不良反应${r.reaction}</span>` : ''}`,
        sub: [r.ingredient ? '成分：' + esc(r.ingredient) : '', r.dose ? '剂量：' + esc(r.dose) : '', r.method || '',
        r.nextDate ? `下次：${r.nextDate}（${d < 0 ? '已逾期' + (-d) + '天' : '还有' + d + '天'}）` : '', esc(r.reactionDesc || ''), esc(r.notes || '')].filter(Boolean).join(' · ')
      };
    }
  },
  excrete: {
    title: '💩 排泄记录', sub: '排便与排尿观察，泌尿健康早发现',
    summary(r) {
      const bad = !r.noFollow && (['软便', '腹泻', '带黏液', '带血'].includes(r.poopState) || r.peeDifficulty || r.peeColorAbn || !r.peeNormal || (!r.pooped));
      return {
        title: `${r.pooped ? '排便' + (r.poopCount || 1) + '次 <span class="chip ' + (['正常成形', '偏干'].includes(r.poopState) ? 'ok' : 'warn') + '">' + esc(r.poopState || '未记录状态') + '</span>' : '<span class="chip warn">未排便</span>'} ${r.peeNormal ? '<span class="chip ok">排尿正常</span>' : '<span class="chip bad">排尿异常</span>'}${bad ? ' <span class="chip bad">需关注</span>' : ''}${r.noFollow ? ' <span class="chip muted">已取消关注</span>' : ''}`,
        sub: [r.poopColor && r.poopColor !== '正常褐色' ? '颜色' + r.poopColor : '', r.poopHair ? '有毛发' : '', r.straining ? '用力排便' : '',
        r.clumpCount ? '尿团' + r.clumpCount + '个' + (r.clumpSize ? '(' + r.clumpSize + ')' : '') : '',
        r.frequentBox ? '频繁进出猫砂盆' : '', r.peeDifficulty ? '⚠️排尿困难/疑似尿闭' : '',
        r.peeColorAbn ? '尿色异常:' + esc(r.peeColorDesc || '') : '', esc(r.poopNotes || ''), esc(r.peeNotes || '')].filter(Boolean).join(' · ')
      };
    }
  },
  urine: {
    title: '🚽 尿比重记录', sub: '记录尿比重（SG），辅助判断泌尿与肾脏健康',
    summary(r) { return { title: `尿比重 <b>${esc(r.sg)}</b>${r.method ? ' <span class="chip info">' + esc(r.method) + '</span>' : ''}`, sub: [r.sg && (num(r.sg) < 1.035 || num(r.sg) > 1.050) ? '⚠️ 偏离常见区间' : '', esc(r.notes || '')].filter(Boolean).join(' · ') }; }
  },
  water: {
    title: '💧 饮水记录', sub: '主动饮水量，与食物水分分开统计',
    summary(r) { return { title: `${fmt(num(r.amount))} ml <span class="chip info">${esc(r.method || '')}</span>`, sub: esc(r.notes || '') }; },
    dayFoot(list) { return `当日主动饮水合计：${fmt(list.reduce((s, r) => s + num(r.amount), 0))} ml`; }
  },
  vet: {
    title: '🏥 就医与检查档案', sub: '医院、诊断、医嘱与复诊安排',
    summary(r) {
      return {
        title: `${esc(r.hospital)}${r.reason ? ' <span class="chip">' + esc(r.reason) + '</span>' : ''}${r.revisitDate ? ' <span class="chip warn">复诊 ' + r.revisitDate + '</span>' : ''}`,
        sub: [r.doctor ? '医生：' + esc(r.doctor) : '', r.diagnosis ? '诊断：' + esc(r.diagnosis) : '', r.advice ? '医嘱：' + esc(r.advice) : '', esc(r.notes || '')].filter(Boolean).join(' · ')
      };
    }
  },
  allergy: {
    title: '🚫 过敏 / 禁忌清单', sub: '疑似或确认的不耐受食物、药物、环境因素',
    typeField: 'category', typeOpts: ['食物', '药物', '环境因素', '其他'],
    summary(r) {
      return {
        title: `${esc(r.name)} <span class="chip ${r.confirm === '医生确认' ? 'bad' : 'warn'}">${esc(r.confirm || '疑似')}</span> <span class="chip">${esc(r.category || '')}</span>${r.severity ? ` <span class="chip ${r.severity === '严重' ? 'bad' : 'info'}">${r.severity}</span>` : ''}`,
        sub: [r.reaction ? '反应：' + esc(r.reaction) : '', esc(r.notes || '')].filter(Boolean).join(' · ')
      };
    }
  },
  interaction: {
    title: '💞 互动记录', sub: '记录与猫一起生活的点点滴滴，珍藏每一个温暖瞬间',
    typeField: 'type', typeOpts: ['玩耍逗猫', '陪伴撸猫', '撒娇求关注', '训练指令', '零食奖励', '一起休息晒太阳', '外出散步', '新发现趣事（猫猫版）', '新发现趣事（人版）', '其他'],
    summary(r) {
      return {
        title: `${esc(r.title || r.type || '互动记录')}${r.memory ? ' <span class="chip focus">★ 值得纪念</span>' : ''}${r.title && r.type ? ` <span class="chip">${esc(r.type)}</span>` : ''}`,
        sub: [r.mood ? '猫：' + esc(r.mood) : '', r.humanState ? '我：' + esc(r.humanState) : '', r.playMinutes ? '玩耍' + esc(r.playMinutes) + '分钟' : '', esc(r.content || ''), esc(r.notes || '')].filter(Boolean).join(' · ') || '没有更多描述'
      };
    }
  }
};

function renderListPage(el, page) {
  const cfg = LIST_CONFIG[page];
  const entKey = PAGE_ENTITY[page];
  const ent = ENTITIES[entKey];
  const f = PAGE_FILTER[page] = PAGE_FILTER[page] || { cat: '', range: 30, from: '', to: '', type: '' };
  const t = today();
  const from = f.range === 'custom' ? f.from : (f.range ? addDays(t, -f.range + 1) : '');
  const to = f.range === 'custom' ? f.to : t;

  let list = recordsOf(ent.table, f.cat || null, from || null, to || null);
  if (f.type && cfg.typeField) list = list.filter(r => r[cfg.typeField] === f.type);

  /* 按日期分组 */
  const groups = {};
  list.forEach(r => { (groups[r.date] = groups[r.date] || []).push(r); });
  const dates = Object.keys(groups).sort().reverse();

  el.innerHTML = `
  <div class="page-title">${cfg.title}</div>
  <div class="page-sub">${cfg.sub}</div>
  <div class="filterbar">
    <select onchange="PAGE_FILTER['${page}'].cat=this.value;render()">
      <option value="">全部猫咪</option>
      ${DB.cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    ${cfg.typeField ? `<select onchange="PAGE_FILTER['${page}'].type=this.value;render()">
      <option value="">全部类型</option>
      ${cfg.typeOpts.map(o => `<option ${f.type === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : ''}
    ${page === 'feed' ? `<button class="btn btn-sm" onclick="showFeedMonthCalendar('${f.cat || ''}')">📊 月度摄入</button>` : ''}
    <div class="seg">
      ${[[7, '7天'], [30, '30天'], [90, '90天'], ['', '全部'], ['custom', '自定义']].map(([v, l]) =>
        `<button class="${String(f.range) === String(v) ? 'on' : ''}" onclick="PAGE_FILTER['${page}'].range=${v === 'custom' ? `'custom'` : (v === '' ? `''` : v)};render()">${l}</button>`).join('')}
    </div>
    ${f.range === 'custom' ? `<input type="date" value="${f.from}" onchange="PAGE_FILTER['${page}'].from=this.value;render()">
      <span style="color:var(--ink-3)">至</span>
      <input type="date" value="${f.to || t}" onchange="PAGE_FILTER['${page}'].to=this.value;render()">` : ''}
    <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openForm('${entKey}')">＋ 新增</button>
  </div>
  ${page === 'weight' ? weightChartCard(f.cat || selectedCatId(), from, to) : ''}
  <div class="card">
    ${dates.length ? dates.map(d => {
      const g = groups[d];
      /* 目标值按猫设定：当天记录若来自同一只猫则取其目标；全部猫咪视图下取首条记录的猫作为参考 */
      const dayCat = (() => {
        const first = g[0] && g[0].catId;
        return (first && g.every(r => r.catId === first)) ? first : (first || '');
      })();
      return `<div class="day-head"><span>${d}（${weekdayCN(d)}）· ${g.length}条</span>${cfg.dayFoot ? `<small>${cfg.dayFoot(g, dayCat)}</small>` : ''}</div>` +
        g.sort((a, b) => (b.time || '') > (a.time || '') ? 1 : -1).map(r => recItemHTML(page, entKey, r, cfg)).join('');
    }).join('')
      : `<div class="empty"><span class="big">${ent.icon}</span>此筛选条件下暂无记录<br><br><button class="btn btn-primary" onclick="openForm('${entKey}')">＋ 添加第一条${ent.name}</button></div>`}
  </div>`;
}

function recItemHTML(page, entKey, r, cfg) {
  const s = cfg.summary(r);
  const photos = (r.photo || []).concat(r.vomitPhoto || []).concat(r.poopPhoto || []);
  const click = cfg.detail ? ` onclick="showRecordDetail('${entKey}','${r.id}')" style="cursor:pointer"` : '';
  return `<div class="rec-item">
    ${photos[0] ? `<img class="rec-thumb" src="${photos[0]}" onclick="showRecordDetail('${entKey}','${r.id}')" style="cursor:pointer">` : ''}
    <div class="rec-main"${click}>
      <div class="rec-title">${s.title}</div>
      <div class="rec-sub">${!PAGE_FILTER[page].cat ? `<b>${esc(catName(r.catId))}</b> · ` : ''}${r.time ? r.time + ' · ' : ''}${s.sub}</div>
    </div>
    <div class="rec-actions">
      <button class="btn btn-ghost btn-sm" onclick='openForm("${entKey}", DB["${ENTITIES[entKey].table}"].find(x=>x.id=="${r.id}"))'>编辑</button>
      <button class="btn btn-danger btn-sm" onclick='deleteRecord("${ENTITIES[entKey].table}","${r.id}")'>删</button>
    </div>
  </div>`;
}

/* ---------- 通用记录详情弹窗（点击记录查看，首期用于健康事件） ---------- */
let _detailPhotoMap = {};
function showBigImgAt(k, i) {
  const arr = _detailPhotoMap[k] || [];
  if (arr[i]) showBigImg(arr[i]);
}
function showRecordDetail(entKey, id) {
  const ent = ENTITIES[entKey];
  const r = DB[ent.table].find(x => x.id === id);
  if (!r) return;
  _detailPhotoMap = {};
  const chips = [], rows = [];
  ent.fields.forEach(f => {
    if (f.show && !f.show(r)) return;
    const v = r[f.k];
    if (f.type === 'photo') {
      const arr = Array.isArray(v) ? v : [];
      if (!arr.length) return;
      _detailPhotoMap[f.k] = arr;
      rows.push(`<div class="detail-row"><span class="detail-k">${esc(f.label)}</span>
        <div class="photo-box detail-gallery">
          ${arr.map((p, i) => `<img src="${p}" onclick="showBigImgAt('${f.k}',${i})" title="点击查看大图">`).join('')}
          <button type="button" class="photo-add" onclick="addDetailPhoto('${entKey}','${r.id}','${f.k}')" title="补充图片">＋</button>
        </div></div>`);
      return;
    }
    if (f.type === 'bool') { if (v) chips.push(esc(f.label)); return; }
    if (f.k === 'catId' || f.type === 'date' || f.type === 'time') return;  // 头部已展示
    if (v === '' || v == null || (Array.isArray(v) && !v.length)) return;
    let text;
    if (f.type === 'catRef') text = esc(catName(v));
    else if (f.type === 'foodRef') { const fd = getFood(v); text = esc(fd ? fd.name : '未知食物'); }
    else if (Array.isArray(v)) text = esc(v.join('、'));
    else text = esc(v);
    rows.push(`<div class="detail-row"><span class="detail-k">${esc(f.label)}</span><span class="detail-v">${text}</span></div>`);
  });
  const title = `${ent.icon} ${catName(r.catId)} · ${r.date || ''}${r.time ? ' ' + r.time : ''}`;
  const html = `<div class="detail-view">
    ${chips.length ? `<div class="detail-chips">${chips.map(c => `<span class="chip ok">✓ ${c}</span>`).join('')}</div>` : ''}
    ${rows.join('')}
    <div class="f-hint" style="margin-top:10px">点击图片可查看大图；点 ＋ 可直接补充图片</div>
  </div>`;
  openModal(title, html,
    `<button class="btn btn-ghost" onclick='openForm("${entKey}", DB["${ent.table}"].find(x=>x.id=="${r.id}"))'>编辑</button>
     <button class="btn btn-primary" onclick="closeModal()">关闭</button>`);
}
/* 详情内快速补充图片：不走表单，直接追加到记录并保存 */
function addDetailPhoto(entKey, id, k) {
  const ent = ENTITIES[entKey];
  const r = DB[ent.table].find(x => x.id === id);
  if (!r) return;
  if (!Array.isArray(r[k])) r[k] = [];
  let inp = document.getElementById('detailPhotoInput');
  if (inp) inp.remove();
  inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'detailPhotoInput';
  inp.style.display = 'none';
  inp.addEventListener('change', () => {
    const file = inp.files[0]; if (!file) return;
    inp.remove();
    compressImage(file, dataUrl => {
      if (!dataUrl) { toast('图片读取失败，请重试'); return; }
      registerFile(dataUrl, file.name, file.type).then(() => {
        r[k].push(dataUrl);
        dbSave();
        showRecordDetail(entKey, id);
        toast('已补充 1 张图片');
      });
    });
  });
  document.body.appendChild(inp);
  inp.click();
}

function weightChartCard(catId, from, to) {
  const list = recordsOf('weights', catId, from || null, to || null).sort((a, b) => a.date > b.date ? 1 : -1);
  if (list.length < 2) return '';
  const pts = list.map(w => ({ x: w.date, y: num(w.kg) }));
  const kgs = pts.map(p => p.y);
  return `<div class="card"><h3>📈 ${esc(catName(catId))} 体重趋势</h3>
    ${svgLineChart(pts, { h: 140, color: '#8fbf9f', unit: 'kg' })}
    <div class="legend"><span>最高 <b>${fmt(Math.max(...kgs), 2)}kg</b></span><span>最低 <b>${fmt(Math.min(...kgs), 2)}kg</b></span><span>平均 <b>${fmt(kgs.reduce((a, b) => a + b, 0) / kgs.length, 2)}kg</b></span></div></div>`;
}

/* ---------- 用药 / 日常护理 模块（计划 + 情况记录） ---------- */
const PLAN_MODULES = {
  med: {
    icon: '💊', title: '用药情况', planEnt: 'medPlan', recEnt: 'medRecord',
    planTable: 'medPlans', recTable: 'medRecords',
    planLabel: '用药计划', recLabel: '用药情况记录',
    sub: '先建立用药计划（可设定连续执行的频率），每次实际给药后在下方记录一笔完成情况',
    dueText: '今日需用药'
  },
  care: {
    icon: '🧼', title: '日常护理', planEnt: 'carePlan', recEnt: 'careRecord',
    planTable: 'carePlans', recTable: 'careRecords',
    planLabel: '护理计划', recLabel: '护理情况记录',
    sub: '先建立护理计划（如每周梳毛、刷牙的频率），每次实际护理后在下方记录一笔完成情况',
    dueText: '今日需护理'
  }
};

function planFreqText(p) {
  if (!p.continuous) return '单次执行' + ((p.startDate || p.createdDate) ? ' · ' + (p.startDate || p.createdDate) : '');
  const range = `${p.startDate || '?'} ~ ${p.endDate || '不限'}`;
  if (p.schedType === '按星期') {
    const wd = Array.isArray(p.weekdays) && p.weekdays.length ? '每' + p.weekdays.join('、') : '未选星期';
    return `${wd} · ${range}`;
  }
  if (p.schedType === '按月') {
    const md = Array.isArray(p.monthDays) && p.monthDays.length ? p.monthDays.join('、') : '未选日期';
    return `${md} · ${range}`;
  }
  const iv = parseInt(p.intervalDays || '1', 10) || 1;
  return `${iv === 1 ? '每天' : '每' + iv + '天'} · ${range}`;
}

function togglePlanPause(table, id) {
  const p = (DB[table] || []).find(x => x.id === id);
  if (!p) return;
  p.paused = !p.paused;
  dbSave(); toast(p.paused ? '已暂停「' + p.name + '」，将不再提醒、不列入待办' : '已恢复「' + p.name + '」');
  render();
}

function renderPlanModule(el, kind) {
  const M = PLAN_MODULES[kind];
  const f = PAGE_FILTER[kind] = PAGE_FILTER[kind] || { cat: '' };
  const t = today();
  const plans = (DB[M.planTable] || []).filter(p => !f.cat || p.catId === f.cat)
    .sort((a, b) => {
      const dueA = !a.paused && isPlanDay(a, t) && !(DB[M.recTable] || []).some(r => r.planId === a.id && r.date === t);
      const dueB = !b.paused && isPlanDay(b, t) && !(DB[M.recTable] || []).some(r => r.planId === b.id && r.date === t);
      if (dueA !== dueB) return dueB - dueA;             // 今日需护理/用药置顶
      if (a.paused !== b.paused) return a.paused ? 1 : -1;
      return (b.createdDate || '') > (a.createdDate || '') ? 1 : -1;
    });
  const recs = recordsOf(M.recTable, f.cat || null);
  const planOf = id => (DB[M.planTable] || []).find(p => p.id === id);

  /* 记录按日期分组 */
  const groups = {};
  recs.forEach(r => { (groups[r.date] = groups[r.date] || []).push(r); });
  const dates = Object.keys(groups).sort().reverse();

  el.innerHTML = `
  <div class="page-title">${M.icon} ${M.title}</div>
  <div class="page-sub">${M.sub}</div>
  <div class="filterbar">
    <select onchange="PAGE_FILTER['${kind}'].cat=this.value;render()">
      <option value="">全部猫咪</option>
      ${DB.cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openForm('${M.planEnt}')">＋ 新增${M.planLabel}</button>
  </div>

  <div class="card">
    <h3>📋 ${M.planLabel} <span class="chip info" style="margin-left:auto">${plans.length} 个</span></h3>
    ${plans.length ? plans.map(p => {
      const due = isPlanDay(p, t);
      const doneToday = (DB[M.recTable] || []).some(r => r.planId === p.id && r.date === t);
      const ended = p.continuous && p.endDate && p.endDate < t;
      const futureStart = p.continuous && p.startDate && p.startDate > t;
      const status = p.paused ? `<span class="chip" style="background:#eee;color:#888">⏸ 已暂停</span>`
        : ended ? `<span class="chip">已结束</span>`
        : futureStart ? `<span class="chip">📅 未开始（${esc(p.startDate)}起）</span>`
        : due ? (doneToday ? `<span class="chip ok">✓ 今日已完成</span>` : `<span class="chip warn">${M.dueText}</span>`)
        : `<span class="chip ok">进行中</span>`;
      return `<div class="plan-item ${p.paused ? 'paused' : ''}">
        <div class="rec-main">
          <div class="rec-title"><span class="plan-name-link" onclick="showPlanCalendar('${M.planTable}','${M.recTable}','${p.id}')" title="点击查看护理日历">${esc(p.name)}</span> <span class="chip info">${esc(p.type || '')}</span>${status}</div>
          <div class="rec-sub">${!f.cat ? `<b>${esc(catName(p.catId))}</b> · ` : ''}${[
            p.dose ? '剂量 ' + esc(p.dose) + esc(p.unit || '') : '',
            p.route ? esc(p.route) : (p.method ? esc(p.method) : ''),
            planFreqText(p)].filter(Boolean).join(' · ')}</div>
          ${p.notes ? `<div class="rec-sub">💬 ${esc(p.notes)}</div>` : ''}
        </div>
        <div class="plan-actions">
          ${!p.paused && !ended ? `<button class="btn btn-primary btn-sm" onclick='openForm("${M.recEnt}",{catId:"${p.catId}",planId:"${p.id}"})'>＋记录一次</button>` : ''}
          <button class="btn ${p.paused ? 'btn-orange' : 'btn-ghost'} btn-sm" onclick='togglePlanPause("${M.planTable}","${p.id}")'>${p.paused ? '▶ 恢复' : '⏸ 暂停'}</button>
          <button class="btn btn-ghost btn-sm" onclick='openForm("${M.planEnt}", DB["${M.planTable}"].find(x=>x.id=="${p.id}"))'>编辑</button>
          <button class="btn btn-danger btn-sm" onclick='deletePlan("${M.planTable}","${M.recTable}","${p.id}")'>删</button>
        </div>
      </div>`;
    }).join('')
      : `<div class="empty"><span class="big">${M.icon}</span>还没有${M.planLabel}<br><br><button class="btn btn-primary" onclick="openForm('${M.planEnt}')">＋ 建立第一个${M.planLabel}</button></div>`}
  </div>

  <div class="card">
    <h3>🗒️ ${M.recLabel} <span class="chip info" style="margin-left:auto">${recs.length} 条</span>
      <button class="btn btn-primary btn-sm" style="margin-left:8px" onclick="openForm('${M.recEnt}')">＋ 新增</button></h3>
    ${dates.length ? dates.map(d => `<div class="day-head"><span>${d}（${weekdayCN(d)}）· ${groups[d].length}条</span></div>` +
      groups[d].sort((a, b) => (b.time || '') > (a.time || '') ? 1 : -1).map(r => {
        const p = planOf(r.planId);
        return `<div class="rec-item">
          <div class="rec-main">
            <div class="rec-title">${p ? esc(p.name) : '（计划已删除）'} <span class="chip ${r.result === '已完成' ? 'ok' : r.result === '部分完成' ? 'warn' : 'bad'}">${esc(r.result || '')}</span></div>
            <div class="rec-sub">${!f.cat ? `<b>${esc(catName(r.catId))}</b> · ` : ''}${r.time ? r.time + ' · ' : ''}${p && p.dose ? '剂量 ' + esc(p.dose) + esc(p.unit || '') + ' · ' : ''}${esc(r.notes || '')}</div>
          </div>
          <div class="rec-actions">
            <button class="btn btn-ghost btn-sm" onclick='openForm("${M.recEnt}", DB["${M.recTable}"].find(x=>x.id=="${r.id}"))'>编辑</button>
            <button class="btn btn-danger btn-sm" onclick='deleteRecord("${M.recTable}","${r.id}")'>删</button>
          </div>
        </div>`;
      }).join('')).join('')
      : `<div class="empty">还没有${M.recLabel}。建立计划后，点击计划右侧「＋记录一次」即可快速记录。</div>`}
  </div>`;
}

function deletePlan(planTable, recTable, id) {
  const n = (DB[recTable] || []).filter(r => r.planId === id).length;
  if (!confirm(`删除该计划${n ? `将保留其 ${n} 条历史记录（记录中显示"计划已删除"）` : ''}，且不再提醒。确定删除？\n（如果只是暂时不用，建议用「暂停」）`)) return;
  DB[planTable] = DB[planTable].filter(p => p.id !== id);
  dbSave(); toast('计划已删除'); render();
}

/* ---------- 猫咪档案页 ---------- */
function renderCats(el) {
  el.innerHTML = `
  <div class="page-title">🐱 猫咪档案</div>
  <div class="page-sub">所有记录都会关联到猫咪档案，支持多猫管理</div>
  <div style="margin-bottom:14px;display:flex;gap:8px"><button class="btn btn-primary" onclick="openForm('cat')">＋ 新增猫咪</button>
  ${!DB.cats.length ? `<button class="btn btn-ghost" onclick="loadDemo()">载入示例数据</button>` : ''}</div>
  ${DB.cats.map(c => {
    const lastW = recordsOf('weights', c.id)[0];
    return `<div class="card" style="display:flex;gap:14px;align-items:flex-start">
      ${c.photo && c.photo[0] ? `<img src="${c.photo[0]}" class="cat-avatar">` : `<div class="cat-avatar">🐱</div>`}
      <div style="flex:1;min-width:0">
        <div class="rec-title" style="font-size:1.02rem">${esc(c.name)}
          ${c.gender ? `<span class="chip">${c.gender === '公' ? '♂ 公' : c.gender === '母' ? '♀ 母' : c.gender}</span>` : ''}
          ${c.neutered ? `<span class="chip ok">${esc(c.neutered)}</span>` : ''}</div>
        <div class="rec-sub">
          ${[c.breed, c.coat, c.birth ? ageText(c.birth) + '（' + c.birth + '生）' : c.ageNote,
      lastW ? '体重' + fmt(lastW.kg, 2) + 'kg' : (c.curWeight ? '体重' + c.curWeight + 'kg' : ''),
      c.idealMin && c.idealMax ? '理想' + c.idealMin + '-' + c.idealMax + 'kg' : '',
      c.chip ? '芯片' + esc(c.chip) : ''].filter(Boolean).join(' · ')}
        </div>
        ${c.allergyNote ? `<div class="rec-sub" style="color:var(--red)">🚫 过敏/禁忌：${esc(c.allergyNote)}</div>` : ''}
        ${c.history ? `<div class="rec-sub">📋 病史：${esc(c.history)}</div>` : ''}
        ${c.notes ? `<div class="rec-sub">备注：${esc(c.notes)}</div>` : ''}
      </div>
      <div class="rec-actions">
        <button class="btn btn-ghost btn-sm" onclick="PAGE_FILTER['healthArchive'].cat='${c.id}';go('healthArchive')">📁 健康档案 (${(DB.healthArchives || []).filter(r => r.catId === c.id).length})</button>
        <button class="btn btn-ghost btn-sm" onclick='openForm("cat", getCat("${c.id}"))'>编辑</button>
        <button class="btn btn-danger btn-sm" onclick='deleteCat("${c.id}")'>删</button>
      </div></div>`;
  }).join('') || `<div class="card"><div class="empty"><span class="big">🐱</span>还没有猫咪档案</div></div>`}`;
}
function deleteCat(id) {
  if (!confirm('删除猫咪档案不会删除历史记录，但记录将变为「未知猫咪」。确定删除？')) return;
  DB.cats = DB.cats.filter(c => c.id !== id);
  if (DB.settings.selectedCat === id) DB.settings.selectedCat = '';
  dbSave(); render();
}

/* ---------- 健康档案页（按年份/次数/类型留存检查报告） ---------- */
function renderHealthArchive(el) {
  const f = PAGE_FILTER['healthArchive'] = PAGE_FILTER['healthArchive'] || { cat: '' };
  const list = (DB.healthArchives || []).filter(r => !f.cat || r.catId === f.cat)
    .sort((a, b) => (b.year - a.year) || (b.seq - a.seq) || (b.date > a.date ? 1 : -1));
  const byCat = {};
  list.forEach(r => { (byCat[r.catId] = byCat[r.catId] || []).push(r); });
  const catIds = Object.keys(byCat);
  el.innerHTML = `
  <div class="page-title">📁 健康档案</div>
  <div class="page-sub">按「年份 + 第几次 + 类型（体检/复查/按计划就医/临时就医）」折叠分组，点开分组可查看其中的 DR、病例报告等各项报告（图片或 PDF）；体检/复查模块的电子报告附件可直接链接到这里</div>
  <div class="filterbar">
    <select onchange="PAGE_FILTER['healthArchive'].cat=this.value;render()">
      <option value="">全部猫咪</option>
      ${DB.cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    <button class="btn btn-sm" onclick="exportHealthArchive()">⬇️ 导出备份</button>
    <label class="btn btn-sm" style="cursor:pointer">⬆️ 导入备份<input id="haImportFile" type="file" accept="application/json,.json" style="display:none" onchange="importHealthArchive(this)"></label>
    <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openForm('healthArchive')">＋ 新增健康档案</button>
  </div>
  ${catIds.length ? catIds.map(cid => {
    const c = getCat(cid);
    const items = byCat[cid];
    /* 按「年份 + 第几次 + 体检/复查」折叠成可展开分组 */
    const sessions = {};
    items.forEach(r => { const key = r.year + '#' + (r.seq || 0) + '#' + (r.type || ''); (sessions[key] = sessions[key] || []).push(r); });
    const sKeys = Object.keys(sessions).sort((a, b) => {
      const [ay, aq, at] = a.split('#'); const [by, bq, bt] = b.split('#');
      return (by - ay) || (bq - aq) || (at < bt ? 1 : at > bt ? -1 : 0);
    });
    let si = 0;
    const sessionsHtml = sKeys.map(key => {
      const recs = sessions[key];
      const first = recs[0];
      const sid = 'ha_' + cid + '_' + (si++);
      return `<div class="ha-session">
        <div class="ha-session-head" onclick="toggleHaSession('${sid}')">
          <span class="caret">▸</span>
          <span class="ha-session-title">${esc(haTitle(first))}</span>
          <span class="chip info" style="margin-left:auto">${recs.length} 项</span>
        </div>
        <div class="ha-session-body" id="${sid}" style="display:none">${recs.map(r => haItemHTML(r)).join('')}</div>
      </div>`;
    }).join('');
    return `<div class="card">
      <h3>🐱 ${esc(c ? c.name : ((items.find(x => x._catName) || {})._catName || '未知猫咪'))} <span class="chip info" style="margin-left:auto">${items.length} 条</span></h3>
      ${sessionsHtml}
    </div>`;
  }).join('')
    : `<div class="card"><div class="empty"><span class="big">📁</span>还没有健康档案<br><br><button class="btn btn-primary" onclick="openForm('healthArchive')">＋ 添加第一条检查报告</button></div></div>`}`;
}
function toggleHaSession(sid) {
  const body = document.getElementById(sid);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  const head = body.parentElement.querySelector('.caret');
  if (head) head.style.transform = open ? '' : 'rotate(90deg)';
}
function haItemHTML(r) {
  const files = r.files || [];
  return `<div class="rec-item">
    <div class="rec-main">
      <div class="rec-title">${esc(r.reportType || '报告')} ${files.length ? `<span class="chip info">${files.length} 份电子档</span>` : ''}</div>
      <div class="rec-sub">${esc(r.date)}</div>
      ${r.summary ? `<div class="rec-sub">📋 ${esc(r.summary)}</div>` : ''}
      ${r.notes ? `<div class="rec-sub">备注：${esc(r.notes)}</div>` : ''}
    </div>
    <div class="rec-actions">
      <button class="btn btn-ghost btn-sm" onclick='openForm("healthArchive", DB.healthArchives.find(x=>x.id=="${r.id}"))'>编辑</button>
      <button class="btn btn-danger btn-sm" onclick='deleteRecord("healthArchives","${r.id}")'>删</button>
    </div>
  </div>`;
}

/* ---------- 养护小 tips 页 ---------- */
function renderCareTips(el) {
  const f = PAGE_FILTER['careTip'] = PAGE_FILTER['careTip'] || { cat: '' };
  const list = (DB.careTips || []).filter(r => !f.cat || !r.catId || r.catId === f.cat)
    .sort((a, b) => (b.important - a.important) || ((b.id || '') > (a.id || '') ? 1 : -1));
  const byCat = {};
  list.forEach(r => { (byCat[r.category] = byCat[r.category] || []).push(r); });
  const cats = Object.keys(byCat);
  el.innerHTML = `
  <div class="page-title">💡 养护小tips</div>
  <div class="page-sub">记录与猫养护相关的经验、提醒与小知识；可标记「重要/必看」，也可关联某只猫咪或留空设为通用</div>
  <div class="filterbar">
    <select onchange="PAGE_FILTER['careTip'].cat=this.value;render()">
      <option value="">全部猫咪 / 通用</option>
      ${DB.cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openForm('careTip')">＋ 新增 tip</button>
  </div>
  ${cats.length ? cats.map(cat => `<div class="card">
    <h3>🏷️ ${esc(cat)} <span class="chip info" style="margin-left:auto">${byCat[cat].length}</span></h3>
    ${byCat[cat].map(r => tipItemHTML(r)).join('')}
  </div>`).join('')
    : `<div class="card"><div class="empty"><span class="big">💡</span>还没有养护小tips<br><br><button class="btn btn-primary" onclick="openForm('careTip')">＋ 添加第一条 tip</button></div></div>`}`;
}
function tipItemHTML(r) {
  const photos = Array.isArray(r.photo) ? r.photo : [];
  return `<div class="rec-item tip-item ${r.important ? 'important' : ''}">
    <div class="rec-main">
      <div class="rec-title">${r.important ? '⭐ ' : ''}${esc(r.title)}${r.catId ? ` <span class="chip">${esc(catName(r.catId))}</span>` : ' <span class="chip">通用</span>'}</div>
      <div class="rec-sub">${esc(r.content)}</div>
      ${r.source ? `<div class="rec-sub">📚 来源：${esc(r.source)}</div>` : ''}
      ${r.notes ? `<div class="rec-sub">备注：${esc(r.notes)}</div>` : ''}
      ${photos.length ? `<div class="tip-photos">${photos.map(p => `<img src="${p}" class="rec-thumb" onclick="showBigImg('${p}')" title="点击放大附件">`).join('')}</div>` : ''}
    </div>
    <div class="rec-actions">
      <button class="btn btn-ghost btn-sm" onclick='openForm("careTip", DB.careTips.find(x=>x.id=="${r.id}"))'>编辑</button>
      <button class="btn btn-danger btn-sm" onclick='deleteRecord("careTips","${r.id}")'>删</button>
    </div>
  </div>`;
}

/* ---------- 食物数据库页 ---------- */
function foodNutriLine(fd) {
  const parts = [`🔥${fmt(fd.kcal)}kcal`, `💧${fmt(fd.water)}g`, `蛋白${fmt(fd.protein)}g`, `脂肪${fmt(fd.fat)}g`, `钙${fmt(fd.calcium)}mg`, `磷${fmt(fd.phos)}mg`];
  return parts.join(' · ');
}
function renderFoods(el) {
  const f = PAGE_FILTER.foods = PAGE_FILTER.foods || { cat: '' };
  const cats = ['主食罐', '主食冻干', '干粮', '鲜食', '生骨肉', '零食', '营养品', '处方粮', '其他'];
  let list = DB.foods.slice().sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  if (f.cat) list = list.filter(x => x.category === f.cat);
  el.innerHTML = `
  <div class="page-title">🥫 食物数据库</div>
  <div class="page-sub">录入每100g营养数据后，饮食记录将自动计算实际摄入</div>
  <div class="filterbar">
    <select onchange="PAGE_FILTER.foods.cat=this.value;render()">
      <option value="">全部类别</option>${cats.map(c => `<option ${f.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>
    <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openForm('food')">＋ 新增食物</button>
  </div>
  ${list.map(fd => {
    const t = today();
    const expWarn = fd.expiry && daysBetween(t, fd.expiry) <= 30;
    const useCount = DB.feedings.filter(r => r.foodId === fd.id).length;
    const optFields = (typeof ENTITIES !== 'undefined' && ENTITIES.food && ENTITIES.food.fields) ? ENTITIES.food.fields.filter(f => f.grp === 'nutrient') : [];
    const optHas = optFields.filter(f => fd[f.k] !== undefined && fd[f.k] !== '' && fd[f.k] !== null && !(f.k === 'bone' && (fd.category || '') !== '生骨肉'));
    const optHtml = optHas.length ? `<details class="nutri-more"><summary>展开看全部营养（${optHas.length}）</summary>
      <div class="nutri-more-body">${optHas.map(f => `<span class="nutri-item">${esc(f.label)}：<b>${esc(fd[f.k])}${f.unit ? ' ' + esc(f.unit) : ''}</b></span>`).join('')}</div></details>` : '';
    return `<div class="card" style="display:flex;gap:12px">
      ${fd.photo && fd.photo[0] ? `<img src="${fd.photo[0]}" class="rec-thumb" style="width:56px;height:56px">` : `<div class="cat-avatar" style="border-radius:12px">🥫</div>`}
      <div style="flex:1;min-width:0">
        <div class="rec-title">${esc(fd.name)} <span class="chip info">${esc(fd.category || '')}</span>${fd.brand ? `<span class="chip">${esc(fd.brand)}</span>` : ''}
        ${expWarn ? `<span class="chip bad">保质期${daysBetween(t, fd.expiry) < 0 ? '已过' : '仅剩' + daysBetween(t, fd.expiry) + '天'}</span>` : ''}</div>
        <div class="rec-sub">每100g：${foodNutriLine(fd)}</div>
        <div class="rec-sub">${[fd.pack ? '规格:' + esc(fd.pack) : '', fd.openDate ? '开封:' + fd.openDate : '', fd.expiry ? '保质期至:' + fd.expiry : '', fd.price ? '价格:' + esc(fd.price) : '', '已喂' + useCount + '次'].filter(Boolean).join(' · ')}</div>
        ${fd.notes ? `<div class="rec-sub">💬 ${esc(fd.notes)}</div>` : ''}
        ${optHtml}
      </div>
      <div class="rec-actions">
        <button class="btn btn-ghost btn-sm" onclick='openForm("food", getFood("${fd.id}"))'>编辑</button>
        <button class="btn btn-danger btn-sm" onclick='deleteRecord("foods","${fd.id}")'>删</button>
      </div></div>`;
  }).join('') || `<div class="card"><div class="empty"><span class="big">🥫</span>还没有食物档案<br><br><button class="btn btn-primary" onclick="openForm('food')">＋ 添加第一个食物</button></div></div>`}`;
}

/* ---------- 某猫某日完整记录 ---------- */
function showDayDetail(catId, date) {
  const planRecSummary = planTable => r => {
    const p = (DB[planTable] || []).find(x => x.id === r.planId);
    return {
      title: `${p ? esc(p.name) : '（计划已删除）'} <span class="chip ${r.result === '已完成' ? 'ok' : 'warn'}">${esc(r.result || '')}</span>`,
      sub: [p && p.dose ? '剂量 ' + esc(p.dose) + esc(p.unit || '') : '', esc(r.notes || '')].filter(Boolean).join(' · ')
    };
  };
  const secs = [
    ['🍚 饮食', 'feedings', 'feed'], ['🩺 健康事件', 'health', 'health'], ['😺 每日状态', 'status', 'status'],
    ['⚖️ 体重', 'weights', 'weight'],
    ['💊 用药情况', 'medRecords', null, planRecSummary('medPlans')],
    ['🧼 护理情况', 'careRecords', null, planRecSummary('carePlans')],
    ['🧪 体检/复查', 'checkups', null, r => ({
      title: `${esc(r.hospital || '体检')} <span class="chip">${esc(r.type || '')}</span>${(r.metrics || []).some(m => m.abnormal) ? ' <span class="chip bad">有异常</span>' : ''}`,
      sub: [r.weight ? ('体重' + r.weight + 'kg') : '', (r.items && r.items.length) ? ('项目:' + r.items.join('、')) : '', (r.metrics || []).length ? ((r.metrics || []).length + '项指标') : '', esc(r.summaryText || '')].filter(Boolean).join(' · ')
    })],
    ['💞 互动回忆', 'interactions', null, r => ({
      title: `${esc(r.title || r.type || '互动')}${r.memory ? ' <span class="chip focus">★ 值得纪念</span>' : ''}${r.type && r.title ? ' <span class="chip">' + esc(r.type) + '</span>' : ''}`,
      sub: [r.mood ? '猫：' + esc(r.mood) : '', r.humanState ? '我：' + esc(r.humanState) : '', r.playMinutes ? '玩耍' + esc(r.playMinutes) + '分钟' : '', esc(r.content || ''), esc(r.notes || '')].filter(Boolean).join(' · ') || '没有更多描述'
    })],
    ['💩 排泄', 'excrete', 'excrete'],
    ['🚽 尿比重', 'urine', 'urine'],
    ['💧 饮水', 'water', 'water'], ['🐛 驱虫', 'deworm', 'deworm']
  ];
  let html = '';
  secs.forEach(([label, table, page, sumFn]) => {
    const list = recordsOf(table, catId, date, date);
    if (!list.length) return;
    const cfg = page ? LIST_CONFIG[page] : null;
    const summary = sumFn || (cfg && cfg.summary.bind(cfg));
    html += `<div class="card" style="padding:12px"><h3>${label}</h3>` +
      list.map(r => { const s = summary(r); return `<div class="rec-item"><div class="rec-main"><div class="rec-title">${s.title}</div><div class="rec-sub">${r.time ? r.time + ' · ' : ''}${s.sub}</div></div></div>`; }).join('') + '</div>';
    if (table === 'feedings') html += `<div class="f-hint" style="margin:-8px 0 10px 4px">${cfg.dayFoot(list)}</div>`;
  });
  openModal(`${catName(catId)} · ${date}（${weekdayCN(date)}）完整记录`, html || '<div class="empty">这一天没有任何记录</div>',
    `<button class="btn btn-primary" onclick="closeModal()">关闭</button>`);
}

/* ---------- 体检 / 复查 模块 ---------- */
function renderCheckupModule(el) {
  const f = PAGE_FILTER['checkup'] = PAGE_FILTER['checkup'] || { cat: '' };
  const t = today();
  const list = recordsOf('checkups', f.cat || null);

  /* 趋势数据：按指标名归集 */
  const byName = {}, metricNames = [];
  list.forEach(r => (r.metrics || []).forEach(m => {
    if (!m.name) return;
    if (!byName[m.name]) { byName[m.name] = []; metricNames.push(m.name); }
    byName[m.name].push({ date: r.date, value: parseFloat(m.value), unit: m.unit, abnormal: !!m.abnormal });
  }));
  if (!CHKUP_TREND_METRIC || !byName[CHKUP_TREND_METRIC]) CHKUP_TREND_METRIC = metricNames.find(n => byName[n].some(p => p.abnormal)) || metricNames[0] || '';

  /* 按日期分组 */
  const groups = {};
  list.forEach(r => { (groups[r.date] = groups[r.date] || []).push(r); });
  const dates = Object.keys(groups).sort().reverse();

  el.innerHTML = `
  <div class="page-title">🧪 体检 / 复查</div>
  <div class="page-sub">记录每次体检/复查，上传电子报告自动解析指标；异常指标标红、重点关注加底色；可追踪指标变化趋势与下次计划</div>
  <div class="filterbar">
    <select onchange="PAGE_FILTER['checkup'].cat=this.value;render()">
      <option value="">全部猫咪</option>
      ${DB.cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openForm('checkup')">＋ 新增体检/复查</button>
  </div>

  ${metricNames.length ? `<div class="card">
    <h3>📊 指标趋势分析 <span class="chip info" style="margin-left:auto">${metricNames.length} 个指标</span></h3>
    <div class="filterbar" style="margin-bottom:10px">
      <select onchange="CHKUP_TREND_METRIC=this.value;render()">
        ${metricNames.map(n => `<option ${n === CHKUP_TREND_METRIC ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
    </div>
    ${checkupTrendChart(byName[CHKUP_TREND_METRIC])}
  </div>` : ''}

  <div class="card">
    <h3>🧪 体检 / 复查记录 <span class="chip info" style="margin-left:auto">${list.length} 次</span></h3>
    ${dates.length ? dates.map(d => `<div class="day-head"><span>${d}（${weekdayCN(d)}）· ${groups[d].length}次</span></div>` +
      groups[d].sort((a, b) => (b.time || '') > (a.time || '') ? 1 : -1).map(r => checkupCardHTML(r, t)).join('')).join('')
      : `<div class="empty"><span class="big">🧪</span>还没有体检/复查记录<br><br><button class="btn btn-primary" onclick="openForm('checkup')">＋ 添加第一次体检</button></div>`}
  </div>`;
}

function checkupCardHTML(r, t) {
  const ms = r.metrics || [];
  const abn = ms.filter(m => m.abnormal).length;
  const focus = ms.filter(m => m.focus).length;
  const nextDays = r.nextDate ? daysBetween(t, r.nextDate) : null;
  const reports = r.reportFiles || [];
  return `<div class="rec-item checkup-card" onclick="showCheckupDetail('${r.id}')">
    <div class="rec-main">
      <div class="rec-title">${esc(r.hospital || '未填医院')} <span class="chip">${esc(r.type || '')}</span>
        ${abn ? `<span class="chip bad">${abn} 项异常</span>` : (ms.length ? `<span class="chip ok">指标正常</span>` : '')}
        ${focus ? `<span class="chip focus">★ ${focus} 项重点关注</span>` : ''}</div>
      <div class="rec-sub">${!PAGE_FILTER['checkup'].cat ? `<b>${esc(catName(r.catId))}</b> · ` : ''}${r.weight ? '体重' + r.weight + 'kg · ' : ''}${(r.items && r.items.length) ? '项目:' + r.items.join('、') : ''}${ms.length ? ` · ${ms.length}项指标` : ''}</div>
      ${r.nextDate ? `<div class="rec-sub">📅 下次预计体检：${r.nextDate}（${nextDays < 0 ? '已逾期' + (-nextDays) + '天' : nextDays === 0 ? '就是今天' : '还有' + nextDays + '天'}）${r.nextItems ? ' · ' + esc(r.nextItems) : ''}</div>` : ''}
    </div>
    <div class="rec-side">
      ${reports.length ? `<div class="report-mini">${reports.slice(0, 4).map(p => {
        if (p.kind === 'link') return `<span class="link-mini" title="${esc(p.label || '健康档案')}" onclick="openLinkedReport('${esc(p.refId)}')">🔗</span>`;
        return p.kind === 'image' ? `<img src="${p.data}" title="${esc(p.name || '')}">` : `<span class="pdf-mini" title="${esc(p.name || '')}">📄</span>`;
      }).join('')}</div>` : ''}
      <span class="rec-date">${daysBetween(r.date, t)}天前</span>
    </div>
  </div>`;
}

function checkupTrendChart(series) {
  if (!series || series.length < 2) return '<div class="f-hint">该指标至少需要 2 次记录才能查看趋势</div>';
  const pts = series.slice().filter(p => !isNaN(p.value)).sort((a, b) => a.date > b.date ? 1 : -1).map(p => ({ x: p.date, y: p.value }));
  if (pts.length < 2) return '<div class="f-hint">该指标有效数值不足 2 条</div>';
  const unit = series[0].unit || '';
  let html = svgLineChart(pts, { h: 160, color: '#7aa6d6', unit });
  html += '<div class="trend-table">' + pts.map(p => {
    const orig = series.find(s => s.date === p.x && s.value === p.y);
    const abn = orig && orig.abnormal;
    return `<div class="trend-row ${abn ? 'abn' : ''}"><span>${p.x}</span><span>${fmt(p.y, 2)} ${esc(unit)}</span><span>${abn ? '⚠ 异常' : ''}</span></div>`;
  }).join('') + '</div>';
  return html;
}

function showCheckupDetail(id) {
  const r = DB.checkups.find(x => x.id === id); if (!r) return;
  const ms = r.metrics || [];
  const abn = ms.filter(m => m.abnormal).length;
  const rangeOf = m => (m.low || m.high) ? `${esc(m.low || '')} ~ ${esc(m.high || '')} ${esc(m.unit || '')}` : '—';
  const html = `<div class="chk-detail">
    <div class="row"><span class="k">类型</span><span>${esc(r.type || '')}</span></div>
    <div class="row"><span class="k">医院/机构</span><span>${esc(r.hospital || '')}</span></div>
    ${r.weight ? `<div class="row"><span class="k">当时体重</span><span>${esc(r.weight)} kg</span></div>` : ''}
    ${r.items && r.items.length ? `<div class="row"><span class="k">检查项目</span><span>${r.items.map(i => `<span class="chip">${esc(i)}</span>`).join(' ')}</span></div>` : ''}
    ${r.reportFiles && r.reportFiles.length ? `<div class="row"><span class="k">电子报告</span><span class="report-gallery">${r.reportFiles.map(p => {
      if (p.kind === 'link') return `<span class="link-ph" onclick="openLinkedReport('${esc(p.refId)}')" title="点击查看关联健康档案">🔗 ${esc(p.label || '健康档案')}</span>`;
      return p.kind === 'image' ? `<img src="${p.data}" onclick="showBigImg('${p.data}')" title="点击放大">` : `<span class="pdf-ph" onclick="openPdf('${p.data}')" title="点击打开 PDF">📄 ${esc(p.name || '报告')}</span>`;
    }).join('')}</span></div>` : ''}
    <h4 class="mt">指标明细 ${ms.length ? `(${ms.length})` : ''} ${abn ? `<span class="chip bad">${abn} 项异常</span>` : ''}</h4>
    ${ms.length ? `<div class="metric-table">${ms.map(m => `<div class="metric-row ${m.abnormal ? 'abn' : ''} ${m.focus ? 'focus' : ''}">
        <span class="mn">${esc(m.name)}</span>
        <span class="mv">${esc(m.value)}${m.unit ? ' ' + esc(m.unit) : ''}</span>
        <span class="mr">${rangeOf(m)}</span>
        <span class="mtags">${m.abnormal ? '<span class="chip bad">异常</span>' : ''}${m.focus ? '<span class="chip focus">★ 重点</span>' : ''}</span>
      </div>`).join('')}</div>` : '<div class="f-hint">未记录指标</div>'}
    ${r.summaryText ? `<h4 class="mt">报告结论 / 情况说明</h4><div class="note-box">${esc(r.summaryText)}</div>` : ''}
    ${r.advice ? `<h4 class="mt">医嘱</h4><div class="note-box advice">${esc(r.advice)}</div>` : ''}
    ${r.nextDate || r.nextItems || r.altItems ? `<h4 class="mt">下次计划</h4><div class="next-plan">
      ${r.nextDate ? `<div class="row"><span class="k">预计日期</span><span>${esc(r.nextDate)}</span></div>` : ''}
      ${r.nextItems ? `<div class="row"><span class="k">预计项目</span><span>${esc(r.nextItems)}</span></div>` : ''}
      ${r.altItems ? `<div class="row"><span class="k">备选项目</span><span>${esc(r.altItems)}</span></div>` : ''}
    </div>` : ''}
  </div>`;
  openModal(`${catName(r.catId)} · ${r.date} 体检详情`, html,
    `<button class="btn btn-ghost" onclick='openForm("checkup", DB.checkups.find(x=>x.id=="${r.id}"))'>编辑</button>
     <button class="btn btn-primary" onclick="closeModal()">关闭</button>`);
}
function showBigImg(data) {
  openPreview('报告图片', `<img src="${data}" style="max-width:100%;border-radius:10px">`,
    `<button class="btn btn-primary" onclick="closePreview()">关闭</button>`);
}

/* ---------- 通用详情行辅助 ---------- */
function metricRowHTML(m) {
  const range = (m.low || m.high) ? `${esc(m.low || '')} ~ ${esc(m.high || '')} ${esc(m.unit || '')}` : '—';
  return `<div class="metric-row ${m.abnormal ? 'abn' : ''} ${m.focus ? 'focus' : ''}">
    <span class="mn">${esc(m.name)}</span>
    <span class="mv">${esc(m.value)}${m.unit ? ' ' + esc(m.unit) : ''}</span>
    <span class="mr">${range}</span>
    <span class="mtags">${m.abnormal ? '<span class="chip bad">异常</span>' : ''}${m.focus ? '<span class="chip focus">★ 重点</span>' : ''}</span>
  </div>`;
}

/* ================= 月度日历弹窗（通用） =================
   两个场景共用同一日历网格：
   - 护理计划：点击计划名 → 标记当月哪些天做过该护理
   - 饮食摄入：点击「月度摄入」→ 每天显示总能量/进食量，按大类着色
   通过 dayContent(date) 返回格子内容（HTML），无返回则空格。 */
let _calState = { y: 0, m: 0, render: null };
function buildMonthCalendar(y, m, dayContent, title, sub) {
  _calState = { y, m, render: dayContent };
  const first = new Date(y, m, 1);
  const startDow = first.getDay();                 // 0=周日
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthName = `${y}年${m + 1}月`;
  const dows = ['日', '一', '二', '三', '四', '五', '六'];
  let cells = '';
  dows.forEach(d => cells += `<div class="cal-dow">${d}</div>`);
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const content = dayContent ? dayContent(ds, d) : '';
    cells += `<div class="cal-day ${content ? 'cal-has' : ''}">${content ? content : `<span class="cal-d">${d}</span>`}</div>`;
  }
  const prev = `changeCalendarMonth(${y},${m},-1)`;
  const next = `changeCalendarMonth(${y},${m},1)`;
  return `<div class="cal-wrap">
    <div class="cal-head"><button class="btn btn-ghost btn-sm" onclick="${prev}">‹</button>
      <b>${monthName}</b><button class="btn btn-ghost btn-sm" onclick="${next}">›</button></div>
    ${sub ? `<div class="cal-sub">${sub}</div>` : ''}
    <div class="cal-grid">${cells}</div>
  </div>`;
}
function changeCalendarMonth(y, m, delta) {
  let nm = m + delta, ny = y;
  if (nm < 0) { nm = 11; ny--; } else if (nm > 11) { nm = 0; ny++; }
  const root = document.getElementById('modalBody');
  if (!root || !_calState.render) return;
  const wrap = root.querySelector('.cal-wrap');
  if (!wrap) return;
  const first = new Date(ny, nm, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(ny, nm + 1, 0).getDate();
  const dows = ['日', '一', '二', '三', '四', '五', '六'];
  let cells = '';
  dows.forEach(d => cells += `<div class="cal-dow">${d}</div>`);
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const content = _calState.render(ds, d);
    cells += `<div class="cal-day ${content ? 'cal-has' : ''}">${content ? content : `<span class="cal-d">${d}</span>`}</div>`;
  }
  wrap.querySelector('.cal-grid').innerHTML = cells;
  wrap.querySelector('.cal-head b').textContent = `${ny}年${nm + 1}月`;
  _calState.y = ny; _calState.m = nm;
  // 更新翻月按钮 onclick
  const btns = wrap.querySelectorAll('.cal-head button');
  if (btns[0]) btns[0].setAttribute('onclick', `changeCalendarMonth(${ny},${nm},-1)`);
  if (btns[1]) btns[1].setAttribute('onclick', `changeCalendarMonth(${ny},${nm},1)`);
}

/* ---- 护理计划日历：点击计划名弹当月，标记做过该护理的天 ---- */
function showPlanCalendar(planTable, recTable, planId) {
  const p = (DB[planTable] || []).find(x => x.id === planId);
  if (!p) return;
  const recs = (DB[recTable] || []).filter(r => r.planId === planId);
  const doneDates = new Set(recs.map(r => r.date));
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const dayContent = (ds) => doneDates.has(ds)
    ? `<span class="cal-d">${+ds.slice(8)}</span><span class="cal-dot done" title="已护理">✓</span>` : '';
  const doneCount = recs.length;
  const sub = `「${esc(p.name)}」当月已完成 <b>${doneCount}</b> 次${doneCount ? `，最近：${esc(recs[recs.length - 1].date)}` : ''}`;
  openModal(`📅 ${esc(p.name)} · 护理日历`, buildMonthCalendar(y, m, dayContent, '', sub),
    `<button class="btn btn-ghost" onclick='openForm("${planTable === 'carePlans' ? 'carePlan' : 'medPlan'}", DB["${planTable}"].find(x=>x.id=="${planId}"))'>编辑计划</button>
     <button class="btn btn-primary" onclick="closeModal()">关闭</button>`);
}

/* ---- 饮食月度摄入日历：每天显示总能量 + 进食量，按大类着色 ---- */
function showFeedMonthCalendar(catId) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const render = (ds) => {
    const list = (DB.feedings || []).filter(r => r.date === ds && (!catId || r.catId === catId));
    if (!list.length) return '';
    const tt = feedTotals(list);
    const byCat = feedTotalsByCategory(list);
    /* 格子：能量（kcal）+ 分类克重（不直接相加） */
    const catLine = byCat.map(c => `${esc(c.category)}${fmt(c.grams)}g`).join(' ');
    return `<span class="cal-d">${+ds.slice(8)}</span>
      <span class="cal-kcal">${fmt(tt.kcal)}</span><span class="cal-unit">kcal</span>
      <span class="cal-cats" title="水分 ${fmt(tt.water)}g · ${esc(byCat.map(c => c.category + ' ' + fmt(c.grams) + 'g').join('、'))}">${catLine}</span>`;
  };
  const monthList = (DB.feedings || []).filter(r => {
    const d = r.date || '';
    return d.slice(0, 7) === `${y}-${String(m + 1).padStart(2, '0')}` && (!catId || r.catId === catId);
  });
  const mt = feedTotals(monthList);
  const byCat = feedTotalsByCategory(monthList);
  const tg = catId ? getTargets(catId) : {};
  const sub = `${catId ? esc(catName(catId)) + ' · ' : ''}当月分类克重：` +
    (byCat.length ? byCat.map(c => `<b>${esc(c.category)} ${fmt(c.grams)}g</b>`).join(' · ') : '无') +
    ` · 水分 ${fmt(mt.water)}g · ${fmt(mt.kcal)}kcal` +
    (tg.kcal > 0 ? `（目标${fmt(tg.kcal)}kcal）` : '');
  openModal('📊 月度饮食摄入', buildMonthCalendar(y, m, render, '', sub),
    `<button class="btn btn-primary" onclick="closeModal()">关闭</button>`);
}

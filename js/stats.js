/* ================= 统计分析中心 & SVG 图表 ================= */

/* 简易 SVG 折线图，pts: [{x:'YYYY-MM-DD', y:number, mark?:string}] */
function svgLineChart(pts, opt = {}) {
  if (!pts || pts.length < 2) return '<div class="f-hint">数据不足，至少需要2条记录才能绘制趋势图</div>';
  const W = 640, H = opt.h || 140, padL = 44, padR = 14, padT = 14, padB = 26;
  const ys = pts.map(p => p.y);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (ymax - ymin < 0.2) { ymin -= 0.15; ymax += 0.15; }
  const pad = (ymax - ymin) * 0.12; ymin -= pad; ymax += pad;
  const xs = pts.map(p => new Date(p.x + 'T00:00:00').getTime());
  const xmin = Math.min(...xs), xmax = Math.max(...xs) || xmin + 1;
  const X = t => padL + (xmax === xmin ? 0.5 : (t - xmin) / (xmax - xmin)) * (W - padL - padR);
  const Y = v => padT + (1 - (v - ymin) / (ymax - ymin)) * (H - padT - padB);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ');
  const area = line + ` L${X(xs[xs.length - 1]).toFixed(1)},${H - padB} L${X(xs[0]).toFixed(1)},${H - padB} Z`;
  const color = opt.color || '#8fbf9f';
  // y轴刻度
  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const v = ymin + (ymax - ymin) * i / 3, y = Y(v);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#eee8dd" stroke-width="1"/>
      <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#a8a196">${fmt(v, 2)}</text>`;
  }
  // x轴首尾日期
  const xlab = `<text x="${padL}" y="${H - 8}" font-size="10" fill="#a8a196">${pts[0].x.slice(5)}</text>
    <text x="${W - padR}" y="${H - 8}" text-anchor="end" font-size="10" fill="#a8a196">${pts[pts.length - 1].x.slice(5)}</text>`;
  const dots = pts.map((p, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="#fff" stroke="${color}" stroke-width="2"><title>${p.x}：${fmt(p.y, 2)}${opt.unit || ''}</title></circle>`).join('');
  // 事件标记
  const marks = (opt.marks || []).filter(m => {
    const t = new Date(m.date + 'T00:00:00').getTime(); return t >= xmin && t <= xmax;
  }).map(m => {
    const x = X(new Date(m.date + 'T00:00:00').getTime());
    return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="${m.color}" stroke-width="1.5" stroke-dasharray="3,3" opacity=".7"/>
      <text x="${x}" y="${padT - 2}" text-anchor="middle" font-size="10" fill="${m.color}">${m.icon}<title>${m.date} ${esc(m.label)}</title></text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${grid}
    <path d="${area}" fill="${color}" opacity=".12"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
    ${marks}${dots}${xlab}</svg>`;
}

function barRows(pairs, colorFn) {
  const max = Math.max(...pairs.map(p => p[1]), 1);
  return pairs.map(([label, v, extra]) => `<div class="bar-row">
    <span class="bl" title="${esc(label)}">${esc(label)}</span>
    <div class="bar" style="width:${Math.max(3, v / max * 55)}%;background:${colorFn ? colorFn(label) : 'var(--green)'}"></div>
    <span class="bv">${extra || v}</span></div>`).join('');
}

/* ---------- 统计页 ---------- */
let STAT_F = { cat: '', range: 30, from: '', to: '' };

function renderStats(el) {
  if (!STAT_F.cat || !getCat(STAT_F.cat)) STAT_F.cat = selectedCatId();
  const catId = STAT_F.cat;
  const t = today();
  const from = STAT_F.range === 'custom' ? (STAT_F.from || addDays(t, -29)) : addDays(t, -STAT_F.range + 1);
  const to = STAT_F.range === 'custom' ? (STAT_F.to || t) : t;
  const days = daysBetween(from, to) + 1;

  const head = `
  <div class="page-title">📊 统计分析中心</div>
  <div class="page-sub">按猫咪与日期范围回顾健康、饮食、体重与排泄数据</div>
  <div class="filterbar">
    <select onchange="STAT_F.cat=this.value;render()">
      ${DB.cats.map(c => `<option value="${c.id}" ${catId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    <div class="seg">
      ${[[7, '7天'], [30, '30天'], [60, '60天'], [90, '90天'], ['custom', '自定义']].map(([v, l]) =>
        `<button class="${String(STAT_F.range) === String(v) ? 'on' : ''}" onclick="STAT_F.range=${v === 'custom' ? `'custom'` : v};render()">${l}</button>`).join('')}
    </div>
    ${STAT_F.range === 'custom' ? `<input type="date" value="${from}" onchange="STAT_F.from=this.value;render()">
      <span style="color:var(--ink-3)">至</span><input type="date" value="${to}" onchange="STAT_F.to=this.value;render()">` : ''}
  </div>
  <div class="alert alert-info">📅 当前统计：<b>${esc(catName(catId))}</b> ｜ ${from} ~ ${to}（共${days}天）</div>`;

  if (!DB.cats.length) { el.innerHTML = head + '<div class="card"><div class="empty">请先创建猫咪档案</div></div>'; return; }

  el.innerHTML = head +
    statHealth(catId, from, to) +
    statFeed(catId, from, to, days) +
    statWeight(catId, from, to, days) +
    statExcrete(catId, from, to);
}

/* 1. 健康统计 */
function statHealth(catId, from, to) {
  const events = recordsOf('health', catId, from, to);
  const vomits = events.filter(e => e.type === '呕吐');
  // 呕吐物类型分布
  const vtDist = {};
  vomits.forEach(v => (v.vomitTypes || []).forEach(tp => vtDist[tp] = (vtDist[tp] || 0) + 1));
  // 其他异常次数
  const cnt = tp => events.filter(e => e.type === tp).length;
  const stressDays = recordsOf('status', catId, from, to).filter(s => s.stress && s.stress !== '无').length;
  const appetiteDown = cnt('食欲下降') + cnt('拒食') + recordsOf('status', catId, from, to).filter(s => ['略下降', '明显下降', '拒食'].includes(s.appetite)).length;

  return `<div class="card">
    <h3>🩺 健康统计</h3>
    <div class="grid4" style="margin-bottom:12px">
      <div class="stat-box" style="box-shadow:none;background:var(--red-bg)"><div class="stat-num">${vomits.length}</div><div class="stat-label">呕吐次数</div></div>
      <div class="stat-box" style="box-shadow:none;background:var(--orange-bg)"><div class="stat-num">${cnt('腹泻') + cnt('软便')}</div><div class="stat-label">腹泻/软便</div></div>
      <div class="stat-box" style="box-shadow:none;background:var(--blue-bg)"><div class="stat-num">${appetiteDown}</div><div class="stat-label">食欲下降/拒食</div></div>
      <div class="stat-box" style="box-shadow:none;background:var(--green-bg)"><div class="stat-num">${stressDays}</div><div class="stat-label">应激天数</div></div>
    </div>
    ${Object.keys(vtDist).length ? `<div class="f-label">呕吐物类型分布</div>${barRows(Object.entries(vtDist).sort((a, b) => b[1] - a[1]), () => 'var(--red)')}` : ''}
    ${vomits.length ? `<div class="f-label" style="margin-top:10px">呕吐明细（点击查看当天完整记录）</div>
      ${vomits.map(v => `<div class="rec-item" style="cursor:pointer" onclick="showDayDetail('${v.catId}','${v.date}')">
        <div class="rec-main"><div class="rec-title">${v.date} ${v.time || ''} <span class="chip ${sevClass(v.severity)}">${esc(v.severity || '')}</span></div>
        <div class="rec-sub">${[(v.vomitTypes || []).join('、'), v.vomitAmount ? '量:' + v.vomitAmount : '', v.vomitHairball ? '含毛球' : '', v.vomitSpirit ? '吐后精神' + v.vomitSpirit : '', esc(v.vomitNotes || v.notes || '')].filter(Boolean).join(' · ') || '无详情'}</div></div>
        <span class="rec-date">查看 ›</span></div>`).join('')}` : ''}
    ${events.length ? `<div class="f-label" style="margin-top:10px">其他健康事件（点击查看当天完整记录）</div>
      ${events.filter(e => e.type !== '呕吐').slice(0, 20).map(e => `<div class="rec-item" style="cursor:pointer" onclick="showDayDetail('${e.catId}','${e.date}')">
        <div class="rec-main"><div class="rec-title">${esc(e.type)} <span class="chip ${sevClass(e.severity)}">${esc(e.severity || '')}</span></div>
        <div class="rec-sub">${e.date} ${e.time || ''} · ${esc(e.notes || '无备注')}</div></div><span class="rec-date">查看 ›</span></div>`).join('') || '<div class="f-hint">无其他事件</div>'}`
      : '<div class="f-hint">所选时间段内没有健康事件记录 🎉</div>'}
  </div>`;
}

/* 2. 饮食统计 */
function statFeed(catId, from, to, days) {
  const feeds = recordsOf('feedings', catId, from, to);
  const tt = feedTotals(feeds);
  const waterExtra = recordsOf('water', catId, from, to).reduce((s, r) => s + num(r.amount), 0);
  // 按食物分组
  const byFood = {};
  feeds.forEach(r => {
    const key = r.foodId || r.foodName || '未知';
    const b = byFood[key] = byFood[key] || { name: (getFood(r.foodId) || {}).name || r.foodName || '未知食物', times: 0, grams: 0, finish: {} };
    b.times++; b.grams += num(r.grams);
    if (r.finish) b.finish[r.finish] = (b.finish[r.finish] || 0) + 1;
  });
  const foodRows = Object.values(byFood).sort((a, b) => b.grams - a.grams);
  const acceptance = f => {
    const done = (f.finish['吃完'] || 0), most = (f.finish['吃了大部分'] || 0), total = f.times;
    const rate = (done + most * 0.8) / total;
    if (rate >= 0.85) return '<span class="chip ok">常吃完</span>';
    if (rate >= 0.5) return '<span class="chip warn">偶尔剩</span>';
    return '<span class="chip bad">经常剩/拒</span>';
  };
  return `<div class="card">
    <h3>🍚 饮食统计</h3>
    ${feeds.length ? `
    <div class="grid3" style="margin-bottom:12px">
      <div><div class="stat-num">${fmt(tt.grams)}<span class="stat-unit"> g</span></div><div class="stat-label">总进食量（日均 ${fmt(tt.grams / days)}g）</div></div>
      <div><div class="stat-num">${fmt(tt.water)}<span class="stat-unit"> g</span></div><div class="stat-label">食物水分（日均 ${fmt(tt.water / days)}g${waterExtra ? '，另主动饮水' + fmt(waterExtra) + 'ml' : ''}）</div></div>
      <div><div class="stat-num">${fmt(tt.kj)}<span class="stat-unit"> kJ</span></div><div class="stat-label">总能量 ≈${fmt(tt.kcal)}kcal（日均 ${fmt(tt.kj / days)}kJ / ${fmt(tt.kcal / days)}kcal）</div></div>
      <div><div class="stat-num">${fmt(tt.protein)}<span class="stat-unit"> g</span></div><div class="stat-label">总蛋白质（日均 ${fmt(tt.protein / days)}g）</div></div>
      <div><div class="stat-num">${fmt(tt.fat)}<span class="stat-unit"> g</span></div><div class="stat-label">总脂肪（日均 ${fmt(tt.fat / days)}g）</div></div>
      <div><div class="stat-num">${fmt(tt.phos)}<span class="stat-unit"> mg</span></div><div class="stat-label">总磷（日均 ${fmt(tt.phos / days)}mg）</div></div>
    </div>
    <div class="f-label">各食物统计与接受度</div>
    <div class="tbl-wrap"><table class="tbl">
      <tr><th>食物</th><th>次数</th><th>总克数</th><th>占比</th><th>吃完情况</th><th>接受度</th></tr>
      ${foodRows.map(f => `<tr><td>${esc(f.name)}</td><td>${f.times}</td><td>${fmt(f.grams)}g</td>
        <td>${tt.grams ? fmt(f.grams / tt.grams * 100) : 0}%</td>
        <td style="font-size:.76rem;color:var(--ink-2)">${Object.entries(f.finish).map(([k, v]) => k + '×' + v).join(' ') || '-'}</td>
        <td>${acceptance(f)}</td></tr>`).join('')}
    </table></div>` : '<div class="f-hint">所选时间段内没有饮食记录</div>'}
  </div>`;
}

/* 3. 体重统计 */
function statWeight(catId, from, to, days) {
  const list = recordsOf('weights', catId, from, to).sort((a, b) => a.date > b.date ? 1 : -1);
  let inner = '<div class="f-hint">所选时间段内没有体重记录</div>';
  if (list.length) {
    const kgs = list.map(w => num(w.kg));
    const pts = list.map(w => ({ x: w.date, y: num(w.kg) }));
    // 上一时间段对比
    const prevFrom = addDays(from, -days), prevTo = addDays(from, -1);
    const prevList = recordsOf('weights', catId, prevFrom, prevTo);
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const curAvg = avg(kgs), prevAvg = avg(prevList.map(w => num(w.kg)));
    const diff = prevAvg != null ? curAvg - prevAvg : null;
    // 事件标记
    const marks = [];
    recordsOf('health', catId, from, to).forEach(e => marks.push({ date: e.date, icon: e.type === '呕吐' ? '🤮' : '⚠', label: e.type, color: '#e08a7a' }));
    recordsOf('vet', catId, from, to).forEach(e => marks.push({ date: e.date, icon: '🏥', label: '就医:' + (e.hospital || ''), color: '#8fb3c9' }));
    DB.medPlans.filter(r => r.catId === catId && r.continuous && r.startDate >= from && r.startDate <= to)
      .forEach(e => marks.push({ date: e.startDate, icon: '💊', label: '开始用药:' + e.name, color: '#f0a35e' }));
    // 换粮标记：某食物在该区间首次出现
    const seen = {};
    DB.feedings.filter(r => r.catId === catId).sort((a, b) => a.date > b.date ? 1 : -1).forEach(r => {
      if (r.foodId && !seen[r.foodId]) { seen[r.foodId] = r.date; }
    });
    Object.entries(seen).forEach(([fid, d]) => {
      if (d >= from && d <= to) marks.push({ date: d, icon: '🍽', label: '新食物:' + ((getFood(fid) || {}).name || ''), color: '#8fbf9f' });
    });
    inner = `
    <div class="grid4" style="margin-bottom:10px">
      <div><div class="stat-num">${fmt(Math.max(...kgs), 2)}<span class="stat-unit">kg</span></div><div class="stat-label">最高</div></div>
      <div><div class="stat-num">${fmt(Math.min(...kgs), 2)}<span class="stat-unit">kg</span></div><div class="stat-label">最低</div></div>
      <div><div class="stat-num">${fmt(curAvg, 2)}<span class="stat-unit">kg</span></div><div class="stat-label">平均</div></div>
      <div><div class="stat-num" style="color:${diff > 0 ? 'var(--red)' : diff < 0 ? '#4d7a5e' : 'var(--ink)'}">${diff == null ? '—' : (diff > 0 ? '+' : '') + fmt(diff, 2)}<span class="stat-unit">kg</span></div><div class="stat-label">较上一时段均值</div></div>
    </div>
    ${svgLineChart(pts, { h: 150, color: '#8fbf9f', unit: 'kg', marks })}
    <div class="legend"><span><i style="background:#e08a7a"></i>健康事件</span><span><i style="background:#8fb3c9"></i>就医</span><span><i style="background:#f0a35e"></i>开始用药</span><span><i style="background:#8fbf9f"></i>换粮/新食物</span><span style="color:var(--ink-3)">（悬停/点按标记与数据点可看详情）</span></div>`;
  }
  return `<div class="card"><h3>⚖️ 体重统计</h3>${inner}</div>`;
}

/* 4. 排泄统计 */
function statExcrete(catId, from, to) {
  const list = recordsOf('excrete', catId, from, to);
  const active = list.filter(r => !r.noFollow); // 已「取消继续关注」的往期记录不计入异常统计
  const softCnt = active.filter(r => ['偏软', '软便'].includes(r.poopState)).length;
  const diaCnt = active.filter(r => r.poopState === '腹泻').length;
  const constCnt = active.filter(r => ['偏干', '偏硬'].includes(r.poopState) || (!r.pooped)).length + active.filter(r => r.straining).length;
  const peeAbn = active.filter(r => !r.peeNormal || r.peeDifficulty || r.peeColorAbn || r.frequentBox).length;
  const healthAdd = recordsOf('health', catId, from, to);
  const abnormal = active.filter(r => ['偏软', '软便', '腹泻', '带黏液', '带血', '其他'].includes(r.poopState) || !r.pooped || !r.peeNormal || r.peeDifficulty || r.peeColorAbn || r.frequentBox || r.straining);
  return `<div class="card">
    <h3>💩 排泄统计</h3>
    <div class="grid4" style="margin-bottom:10px">
      <div class="stat-box" style="box-shadow:none;background:var(--orange-bg)"><div class="stat-num">${softCnt + healthAdd.filter(e => e.type === '软便').length}</div><div class="stat-label">软便</div></div>
      <div class="stat-box" style="box-shadow:none;background:var(--red-bg)"><div class="stat-num">${diaCnt + healthAdd.filter(e => e.type === '腹泻').length}</div><div class="stat-label">腹泻</div></div>
      <div class="stat-box" style="box-shadow:none;background:var(--blue-bg)"><div class="stat-num">${constCnt + healthAdd.filter(e => e.type === '便秘').length}</div><div class="stat-label">便秘/排便费力</div></div>
      <div class="stat-box" style="box-shadow:none;background:var(--green-bg)"><div class="stat-num">${peeAbn + healthAdd.filter(e => e.type === '尿量异常').length}</div><div class="stat-label">排尿异常</div></div>
    </div>
    ${abnormal.length ? `<div class="f-label">异常明细（点击查看当天完整记录）</div>
      ${abnormal.map(r => { const s = LIST_CONFIG.excrete.summary(r); return `<div class="rec-item" style="cursor:pointer" onclick="showDayDetail('${r.catId}','${r.date}')"><div class="rec-main"><div class="rec-title">${r.date} · ${s.title}</div><div class="rec-sub">${s.sub || ''}</div></div><span class="rec-date">查看 ›</span></div>`; }).join('')}`
      : '<div class="f-hint">所选时间段内排泄记录均正常 🎉</div>'}
  </div>`;
}

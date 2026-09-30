/* ================= 实体定义（数据库结构） ================= */
const ENTITIES = {

  /* 一、猫咪档案 */
  cat: {
    name: '猫咪档案', table: 'cats', icon: '🐱',
    fields: [
      { k: 'name', label: '猫咪名称', type: 'text', req: true, ph: '例如：布丁' },
      { k: 'photo', label: '照片', type: 'photo' },
      { k: 'gender', label: '性别', type: 'select', opts: ['公', '母', '未知'] },
      { k: 'birth', label: '出生日期（用于自动计算年龄）', type: 'date' },
      { k: 'ageNote', label: '年龄补充说明（出生日期不确定时填写）', type: 'text', ph: '例如：约2岁' },
      { k: 'neutered', label: '是否绝育', type: 'select', opts: ['已绝育', '未绝育', '未知'] },
      { k: 'breed', label: '品种', type: 'text', ph: '例如：中华田园猫 / 英短' },
      { k: 'coat', label: '毛色', type: 'text', ph: '例如：橘白 / 三花' },
      { k: 'chip', label: '芯片号（可选）', type: 'text' },
      { k: 'curWeight', label: '当前体重', type: 'number', unit: 'kg' },
      { k: 'idealMin', label: '理想体重下限（可选）', type: 'number', unit: 'kg' },
      { k: 'idealMax', label: '理想体重上限（可选）', type: 'number', unit: 'kg' },
      { k: 'allergyNote', label: '过敏/禁忌食物', type: 'textarea', ph: '例如：牛肉过敏、乳制品不耐受' },
      { k: 'history', label: '既往病史', type: 'textarea' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 四、食物数据库 */
  food: {
    name: '食物档案', table: 'foods', icon: '🥫',
    fields: [
      { k: 'name', label: '食物名称', type: 'text', req: true, ph: '例如：XX鸡肉主食罐 85g' },
      { k: 'brand', label: '品牌', type: 'text' },
      { k: 'category', label: '食物类别', type: 'select', req: true, dropdown: true, opts: ['主食罐', '主食冻干', '干粮', '鲜食', '生骨肉', '零食', '营养品', '处方粮', '其他'] },
      // —— 主要营养（展示在记录卡片；钾为选填）—— 单位均为每100g
      { k: 'kcal', label: '热量', type: 'number', unit: 'kcal/100g', req: true },
      { k: 'water', label: '含水量', type: 'number', unit: 'g/100g', req: true },
      { k: 'protein', label: '蛋白质', type: 'number', unit: 'g/100g', req: true },
      { k: 'fat', label: '脂肪', type: 'number', unit: 'g/100g', req: true },
      { k: 'calcium', label: '钙', type: 'number', unit: 'mg/100g', req: true },
      { k: 'phos', label: '磷', type: 'number', unit: 'mg/100g', req: true },
      { k: 'potassium', label: '钾', type: 'number', unit: 'mg/100g' },
      // —— 选填营养（仅记录详情/编辑可见）—— 单位均为每100g
      { k: 'bone', label: '骨骼含量', type: 'number', unit: '%', show: d => (d.category || '') === '生骨肉' },
      { k: 'carb', label: '碳水化合物', type: 'number', unit: 'g/100g' },
      { k: 'fiber', label: '粗纤维', type: 'number', unit: 'g/100g' },
      { k: 'choline', label: '胆碱', type: 'number', unit: 'mg/100g' },
      { k: 'iron', label: '铁', type: 'number', unit: 'mg/100g' },
      { k: 'copper', label: '铜', type: 'number', unit: 'mg/100g' },
      { k: 'manganese', label: '锰', type: 'number', unit: 'mg/100g' },
      { k: 'zinc', label: '锌', type: 'number', unit: 'mg/100g' },
      { k: 'iodine', label: '碘', type: 'number', unit: 'μg/100g' },
      { k: 'magnesium', label: '镁', type: 'number', unit: 'mg/100g' },
      { k: 'sodium', label: '钠', type: 'number', unit: 'mg/100g' },
      { k: 'va', label: 'VA', type: 'number', unit: 'IU/100g' },
      { k: 'vb', label: 'VB1', type: 'number', unit: 'mg/100g' },
      { k: 've', label: 'VE', type: 'number', unit: 'mg/100g' },
      { k: 'vd', label: 'VD', type: 'number', unit: 'IU/100g' },
      { k: 'taurine', label: '牛磺酸', type: 'number', unit: 'mg/100g' },
      { k: 'epa', label: 'EPA', type: 'number', unit: 'mg/100g' },
      { k: 'dha', label: 'DHA', type: 'number', unit: 'mg/100g' },
      { k: 'epaDha', label: 'EPA&DHA', type: 'number', unit: 'mg/100g' },
      // —— 其他档案信息 ——
      { k: 'pack', label: '包装规格', type: 'text', ph: '例如：85g/罐 × 24' },
      { k: 'openDate', label: '开封日期', type: 'date', def: '' },
      { k: 'expiry', label: '保质期至', type: 'date', def: '' },
      { k: 'price', label: '价格 / 每100g成本（可选）', type: 'text', ph: '例如：整箱120元，约5.9元/100g' },
      { k: 'photo', label: '食物照片', type: 'photo' },
      { k: 'notes', label: '食物接受度 / 备注', type: 'textarea', ph: '例如：很爱吃，每次都吃完' }
    ]
  },

  /* 三、每日饮食记录 */
  feed: {
    name: '饮食记录', table: 'feedings', icon: '🍚',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '进食时间', type: 'time', def: () => nowTime10() },
      { k: 'meal', label: '餐次类型', type: 'select', opts: ['早餐', '午餐', '晚餐', '夜宵', '加餐', '零食', '自由采食', '其他'] },
      { k: 'foodId', label: '食物档案（关联食物数据库）', type: 'foodRef', req: true },
      { k: 'foodName', label: '食物名称（可自动带出，也可修改）', type: 'text' },
      { k: 'grams', label: '食用克重', type: 'number', unit: 'g', req: true },
      { k: 'finish', label: '吃完情况', type: 'select', opts: ['吃完', '吃了大部分', '吃了一半', '只吃一点', '未吃'] },
      { k: 'notes', label: '备注', type: 'textarea' }
    ],
    onChange(data, changedKey) {
      if (changedKey === 'foodId') {
        const f = getFood(data.foodId);
        if (f && !data.foodName) {
          data.foodName = f.name;
          const inp = document.querySelector('[name="foodName"]'); if (inp) inp.value = f.name;
        }
      }
    },
    preview(data) {
      const n = calcNutrition(data.foodId, data.grams);
      if (!n) return `<div class="calc-preview">选择食物档案并输入克重后，将自动计算本餐营养摄入。</div>`;
      return `<div class="calc-preview"><b>本餐自动计算结果</b>（每100g营养 × ${fmt(num(data.grams))}g ÷ 100）：<br>
        💧 水分 <b>${fmt(n.water)} g</b> ｜ ⚡ 热量 <b>${fmt(n.kcal)} kcal</b>（≈ ${fmt(n.kj)} kJ）<br>
        🥩 蛋白质 <b>${fmt(n.protein)} g</b> ｜ 🧈 脂肪 <b>${fmt(n.fat)} g</b> ｜ 🦴 磷 <b>${fmt(n.phos)} mg</b></div>`;
    }
  },

  /* 五、健康事件 */
  health: {
    name: '健康事件', table: 'health', icon: '🩺',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '发生时间', type: 'time', def: () => nowTime10() },
      { k: 'type', label: '事件类型', type: 'select', req: true, dropdown: true, opts: ['呕吐', '腹泻', '软便', '便秘', '打喷嚏', '咳嗽', '流眼泪', '食欲下降', '拒食', '喝水异常', '尿量异常', '疼痛或跛行', '皮肤问题', '其他'] },
      { k: 'severity', label: '严重程度', type: 'select', opts: ['轻微', '一般', '明显', '严重', '紧急'] },
      { k: 'observe', label: '是否需要持续观察', type: 'bool' },
      { k: 'consulted', label: '是否已咨询医生', type: 'bool' },
      { k: 'visited', label: '是否已就医', type: 'bool' },
      /* —— 呕吐专属字段 —— */
      { k: 'vomitTypes', label: '呕吐物类型（可多选）', type: 'multiselect', show: d => d.type === '呕吐', opts: ['透明胃液', '黄色胆汁/胃液', '白色泡沫', '未消化食物', '半消化食物', '已消化食物', '毛发', '毛球', '异物', '不明'] },
      { k: 'vomitAmount', label: '呕吐物量', type: 'select', show: d => d.type === '呕吐', opts: ['少量', '中等', '大量'] },
      { k: 'vomitHairball', label: '是否含毛球', type: 'bool', show: d => d.type === '呕吐' },
      { k: 'vomitAfterMeal', label: '呕吐前是否刚进食', type: 'bool', show: d => d.type === '呕吐' },
      { k: 'vomitMealGap', label: '距离上次进食大约多久', type: 'select', show: d => d.type === '呕吐', opts: ['半小时内', '0.5-2小时', '2-6小时', '6小时以上', '不确定'] },
      { k: 'vomitSpirit', label: '呕吐后精神状态', type: 'select', show: d => d.type === '呕吐', opts: ['正常', '稍差', '明显差'] },
      { k: 'vomitEatAfter', label: '呕吐后是否继续吃喝', type: 'bool', show: d => d.type === '呕吐' },
      { k: 'vomitPhoto', label: '呕吐物照片', type: 'photo', show: d => d.type === '呕吐' },
      { k: 'vomitNotes', label: '呕吐详细备注', type: 'textarea', show: d => d.type === '呕吐' },
      /* —— 通用 —— */
      { k: 'notes', label: '备注', type: 'textarea' },
      { k: 'photo', label: '照片或视频截图附件', type: 'photo' }
    ]
  },

  /* 六、每日精神与行为状态 */
  status: {
    name: '每日状态记录', table: 'status', icon: '😺',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      { k: 'overall', label: '整体状态', type: 'select', req: true, opts: ['很好', '良好', '一般', '较差', '明显异常'] },
      { k: 'appetite', label: '食欲', type: 'select', opts: ['非常好', '正常', '略下降', '明显下降', '拒食'] },
      { k: 'drink', label: '饮水情况', type: 'select', opts: ['正常', '偏少', '偏多', '不确定'] },
      { k: 'activity', label: '活动量', type: 'select', opts: ['很活跃', '正常', '略少', '明显减少'] },
      { k: 'sleep', label: '睡眠情况', type: 'select', opts: ['正常', '偏多', '偏少', '不安稳'] },
      { k: 'mood', label: '情绪状态', type: 'select', opts: ['放松', '正常', '粘人', '烦躁', '躲藏', '警惕', '害怕'] },
      { k: 'stress', label: '是否存在应激', type: 'select', opts: ['无', '轻微', '中等', '明显'] },
      { k: 'stressReason', label: '应激原因（可多选）', type: 'multiselect', show: d => d.stress && d.stress !== '无', opts: ['陌生人', '陌生动物', '噪音', '外出', '就医', '洗澡', '搬家', '装修', '换粮', '换环境', '其他'] },
      { k: 'hasFear', label: '是否有害怕或回避对象', type: 'bool' },
      { k: 'fearObject', label: '害怕的对象或情境', type: 'text', show: d => !!d.hasFear },
      { k: 'notes', label: '备注', type: 'textarea' },
      { k: 'photo', label: '照片或视频截图', type: 'photo' }
    ],
    beforeSave(d) {
      const dup = DB.status.find(r => r.catId === d.catId && r.date === d.date && r.id !== _formEditId);
      if (dup) { toast(`${catName(d.catId)} 在 ${d.date} 已有状态记录，每天仅需填写一次`); return false; }
    }
  },

  /* 七、体重记录 */
  weight: {
    name: '体重记录', table: 'weights', icon: '⚖️',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '称重时间', type: 'time', def: () => nowTime10() },
      { k: 'kg', label: '体重', type: 'number', unit: 'kg', req: true },
      { k: 'method', label: '称重方式', type: 'select', opts: ['宠物秤', '人体秤抱猫', '医院称重', '其他'] },
      { k: 'condition', label: '称重条件', type: 'select', opts: ['空腹', '饭后', '排便后', '不确定'] },
      { k: 'notes', label: '备注', type: 'textarea' }
    ],
    beforeSave(d) {
      const cat = getCat(d.catId);
      if (cat) { cat.curWeight = d.kg; }  // 同步更新档案当前体重
    }
  },

  /* 八、用药与护理记录 */
  /* 八（上）、用药计划 */
  medPlan: {
    name: '用药计划', table: 'medPlans', icon: '💊',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'createdDate', label: '建立日期', type: 'date', req: true, def: () => today() },
      { k: 'type', label: '类型', type: 'select', req: true, dropdown: true, opts: ['处方药', '保健品', '益生菌', '化毛产品', '营养膏', '补液', '其他'] },
      { k: 'name', label: '药物名称', type: 'text', req: true },
      { k: 'dose', label: '剂量', type: 'text', ph: '例如：0.5' },
      { k: 'unit', label: '单位', type: 'select', opts: ['mg', '片', '粒', 'ml', '滴', '包', '泵', '其他'] },
      { k: 'route', label: '给药方式', type: 'select', opts: ['直接喂', '拌粮', '针筒', '滴耳', '外用', '其他'] },
      { k: 'continuous', label: '是否需要连续执行', type: 'bool' },
      { k: 'startDate', label: '开始日期', type: 'date', show: d => !!d.continuous, def: () => today() },
      { k: 'endDate', label: '结束日期', type: 'date', show: d => !!d.continuous, def: () => addDays(today(), 30) },
      { k: 'schedType', label: '频率方式', type: 'select', opts: ['按间隔', '按星期'], def: '按间隔', show: d => !!d.continuous },
      { k: 'intervalDays', label: '执行频率', type: 'select', def: '1', opts: [{ v: '1', label: '每天' }, { v: '2', label: '每2天' }, { v: '3', label: '每3天' }, { v: '4', label: '每4天' }, { v: '5', label: '每5天' }, { v: '7', label: '每7天' }], show: d => !!d.continuous && d.schedType === '按间隔' },
      { k: 'weekdays', label: '每周用药日', type: 'multiselect', opts: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], show: d => !!d.continuous && d.schedType === '按星期' },
      { k: 'paused', label: '已暂停', type: 'bool' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },
  /* 八（下）、用药情况记录 */
  medRecord: {
    name: '用药情况', table: 'medRecords', icon: '💊',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'planId', label: '对应用药计划', type: 'select', req: true, opts: () => medPlanOptions() },
      { k: 'date', label: '用药日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '给药时间', type: 'time', def: () => nowTime10() },
      { k: 'result', label: '完成情况', type: 'select', req: true, opts: ['已完成', '部分完成', '吐出', '拒绝', '漏服'], def: '已完成' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },
  /* 八（续）、护理计划 */
  carePlan: {
    name: '护理计划', table: 'carePlans', icon: '🧼',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'createdDate', label: '建立日期', type: 'date', req: true, def: () => today() },
      { k: 'type', label: '护理类型', type: 'select', req: true, dropdown: true, opts: ['梳毛', '刷牙', '剪指甲', '清洁耳朵', '洗澡', '清洁眼睛', '口腔护理', '其他'] },
      { k: 'name', label: '护理名称', type: 'text', req: true, ph: '例如：每日梳毛' },
      { k: 'method', label: '护理方式', type: 'text', ph: '例如：针梳' },
      { k: 'continuous', label: '是否定期执行', type: 'bool' },
      { k: 'startDate', label: '开始日期', type: 'date', show: d => !!d.continuous, def: () => today() },
      { k: 'endDate', label: '结束日期', type: 'date', show: d => !!d.continuous, def: () => addDays(today(), 30) },
      { k: 'schedType', label: '频率方式', type: 'select', opts: ['按间隔', '按星期', '按月'], def: '按间隔', show: d => !!d.continuous },
      { k: 'intervalDays', label: '执行频率', type: 'select', def: '1', opts: [{ v: '1', label: '每天' }, { v: '2', label: '每2天' }, { v: '3', label: '每3天' }, { v: '4', label: '每4天' }, { v: '5', label: '每5天' }, { v: '7', label: '每7天' }], show: d => !!d.continuous && d.schedType === '按间隔' },
      { k: 'weekdays', label: '每周护理日', type: 'multiselect', opts: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], show: d => !!d.continuous && d.schedType === '按星期' },
      { k: 'monthDays', label: '每月执行日', type: 'multiselect', opts: ['每月1号', '每月15号', '每月30号'], show: d => !!d.continuous && d.schedType === '按月' },
      { k: 'paused', label: '已暂停', type: 'bool' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },
  /* 护理情况记录 */
  careRecord: {
    name: '护理情况', table: 'careRecords', icon: '🧼',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'planId', label: '对应护理计划', type: 'select', req: true, opts: () => carePlanOptions() },
      { k: 'date', label: '护理日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '护理时间', type: 'time', def: () => nowTime10() },
      { k: 'result', label: '完成情况', type: 'select', req: true, opts: ['已完成', '部分完成', '拒绝', '漏做'], def: '已完成' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 九、驱虫记录 */
  deworm: {
    name: '驱虫记录', table: 'deworm', icon: '🐛',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '驱虫日期', type: 'date', req: true, def: () => today() },
      { k: 'dtype', label: '驱虫类型', type: 'select', req: true, opts: ['外驱', '内驱', '内外同驱'] },
      { k: 'product', label: '产品名称', type: 'text', req: true, ph: '例如：大宠爱 / 海乐妙' },
      { k: 'ingredient', label: '有效成分（可选）', type: 'text', ph: '例如：塞拉菌素' },
      { k: 'dose', label: '使用剂量或规格', type: 'text', ph: '例如：45mg（2.6-7.5kg装）' },
      { k: 'method', label: '使用方式', type: 'select', opts: ['滴剂', '口服', '喷剂', '其他'] },
      { k: 'nextDate', label: '下次驱虫日期', type: 'date', def: () => addDays(today(), 30) },
      { k: 'remindDays', label: '提前提醒天数', type: 'select', opts: ['提前3天', '提前7天'], def: '提前7天' },
      { k: 'reaction', label: '是否有不良反应', type: 'select', opts: ['无', '轻微', '明显'], def: '无' },
      { k: 'reactionDesc', label: '不良反应描述', type: 'textarea', show: d => d.reaction && d.reaction !== '无' },
      { k: 'notes', label: '备注', type: 'textarea' },
      { k: 'photo', label: '产品包装照片', type: 'photo' }
    ]
  },

  /* 十、排便与排尿记录 */
  excrete: {
    name: '排泄记录', table: 'excrete', icon: '💩',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      /* 排便 */
      { k: 'pooped', label: '今日是否排便', type: 'bool', def: true },
      { k: 'poopCount', label: '排便次数', type: 'number', unit: '次', show: d => !!d.pooped, def: 1 },
      { k: 'poopState', label: '粪便状态', type: 'select', dropdown: true, show: d => !!d.pooped, opts: ['正常成形', '偏干', '偏硬', '偏软', '软便', '腹泻', '带黏液', '带血', '其他'] },
      { k: 'poopColor', label: '粪便颜色', type: 'select', show: d => !!d.pooped, opts: ['正常褐色', '偏黑', '偏黄', '偏绿', '偏红', '其他'] },
      { k: 'poopHair', label: '粪便中是否有毛发', type: 'bool', show: d => !!d.pooped },
      { k: 'straining', label: '是否用力排便', type: 'bool', show: d => !!d.pooped },
      { k: 'poopPhoto', label: '粪便照片', type: 'photo', show: d => !!d.pooped },
      { k: 'poopNotes', label: '排便备注', type: 'textarea', show: d => !!d.pooped },
      /* 排尿 */
      { k: 'peeNormal', label: '是否正常排尿', type: 'bool', def: true },
      { k: 'clumpCount', label: '尿团数量', type: 'number', unit: '个' },
      { k: 'clumpSize', label: '尿团大小', type: 'select', opts: ['小', '正常', '大', '明显增多'] },
      { k: 'frequentBox', label: '是否频繁进出猫砂盆', type: 'bool' },
      { k: 'peeDifficulty', label: '是否存在排尿困难或疑似尿闭', type: 'bool' },
      { k: 'peeColorAbn', label: '尿液颜色是否异常', type: 'bool' },
      { k: 'peeColorDesc', label: '尿液颜色异常描述', type: 'text', show: d => !!d.peeColorAbn, ph: '例如：偏红 / 偏深' },
      { k: 'peeNotes', label: '排尿备注', type: 'textarea' },
      { k: 'noFollow', label: '取消继续关注（不再计入统计分析的异常状态）', type: 'bool', show: d => !d.date || d.date < today() }
    ]
  },

  /* 扩展：饮水记录 */
  water: {
    name: '饮水记录', table: 'water', icon: '💧',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '时间', type: 'time', def: () => nowTime10() },
      { k: 'amount', label: '主动饮水量', type: 'number', unit: 'ml', req: true },
      { k: 'method', label: '补水方式', type: 'select', opts: ['水碗', '流动饮水机', '针筒补水', '汤/羹', '皮下补液', '随餐添加', '其他'] },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 十二、互动记录（与猫生活的点点滴滴） */
  interaction: {
    name: '互动记录', table: 'interactions', icon: '💞',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '时间', type: 'time', def: () => nowTime10() },
      { k: 'type', label: '互动类型', type: 'select', req: true, opts: ['玩耍逗猫', '陪伴撸猫', '撒娇求关注', '训练指令', '零食奖励', '一起休息晒太阳', '外出散步', '新发现趣事（猫猫版）', '新发现趣事（人版）', '其他'] },
      { k: 'mood', label: '猫猫当时的状态', type: 'select', opts: ['开心满足', '放松慵懒', '好奇兴奋', '粘人撒娇', '调皮捣蛋', '安静陪伴', '迁就人类', '紧张害怕', '其他'] },
      { k: 'humanState', label: '人当时的状态', type: 'select', opts: ['猫好', '这个世界不能没有猫猫', '观察者', '被猫迁就', '被猫治愈', '内疚', '自责', '懊悔', '其他'] },
      { k: 'title', label: '一句话主题（可选）', type: 'text', ph: '例如：第一次跳上书架' },
      { k: 'content', label: '记录点点滴滴', type: 'textarea', ph: '例如：今天布丁主动跳到腿上，发出满足的呼噜声，陪我加完班' },
      { k: 'playMinutes', label: '玩耍时长', type: 'select', show: d => d.type === '玩耍逗猫', opts: [{ v: '5', label: '5 分钟' }, { v: '10', label: '10 分钟' }, { v: '15', label: '15 分钟' }, { v: '20', label: '20 分钟' }, { v: '25', label: '25 分钟' }, { v: '30', label: '30 分钟（上限）' }] },
      { k: 'memory', label: '值得纪念（加入精选）', type: 'bool' },
      { k: 'photo', label: '照片回忆', type: 'photo' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 扩展：尿比重记录 */
  urine: {
    name: '尿比重记录', table: 'urine', icon: '🚽',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '日期', type: 'date', req: true, def: () => today() },
      { k: 'time', label: '时间', type: 'time', def: () => nowTime10() },
      { k: 'sg', label: '尿比重', type: 'number', req: true, ph: '例如：1.045（正常范围约 1.001–1.060）' },
      { k: 'method', label: '检测方法', type: 'select', opts: ['尿比重仪', '试纸', '医院化验', '其他'] },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 扩展：就医与检查档案 */
  vet: {
    name: '就医与检查', table: 'vet', icon: '🏥',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '就诊日期', type: 'date', req: true, def: () => today() },
      { k: 'hospital', label: '医院', type: 'text', req: true },
      { k: 'doctor', label: '医生', type: 'text' },
      { k: 'reason', label: '就诊原因', type: 'text', ph: '例如：连续呕吐 / 年度体检' },
      { k: 'diagnosis', label: '诊断结果', type: 'textarea' },
      { k: 'tests', label: '检查项目与报告摘要', type: 'textarea', ph: '例如：血常规正常，B超见轻度…' },
      { k: 'advice', label: '医嘱', type: 'textarea' },
      { k: 'revisitDate', label: '复诊日期', type: 'date', def: '' },
      { k: 'photo', label: '检查报告 / 附件照片', type: 'photo' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 扩展：过敏/禁忌清单 */
  allergy: {
    name: '过敏/禁忌', table: 'allergy', icon: '🚫',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'category', label: '类别', type: 'select', req: true, opts: ['食物', '药物', '环境因素', '其他'] },
      { k: 'name', label: '过敏原/禁忌名称', type: 'text', req: true, ph: '例如：牛肉 / 阿莫西林 / 花粉' },
      { k: 'confirm', label: '确认程度', type: 'select', opts: ['疑似', '基本确认', '医生确认'], def: '疑似' },
      { k: 'reaction', label: '相关反应表现', type: 'textarea', ph: '例如：进食后2小时内呕吐、皮肤红疹' },
      { k: 'severity', label: '严重程度', type: 'select', opts: ['轻微', '中等', '严重'] },
      { k: 'date', label: '记录日期', type: 'date', def: () => today() },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 十一、体检 / 复查记录（含指标解析） */
  checkup: {
    name: '体检/复查', table: 'checkups', icon: '🧪',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'date', label: '体检/复查日期', type: 'date', req: true, def: () => today() },
      { k: 'type', label: '类型', type: 'select', req: true, opts: ['体检', '复查'] },
      { k: 'hospital', label: '医院/机构', type: 'text', req: true },
      { k: 'weight', label: '当时体重（可选）', type: 'number', unit: 'kg' },
      { k: 'items', label: '检查项目', type: 'multiselect', freeTextOn: '其他', opts: ['血常规', '生化全套', '血涂片', '尿常规', '粪便检查', 'UPC', '血气', '腹部B超', '心脏彩超', 'DR', '口腔检查', '眼压', '血压', '甲状腺T4', '抗体滴度', '内分泌', '其他'] },
      { k: 'metrics', label: '指标明细', type: 'metricRows' },
      { k: 'reportFiles', label: '电子报告附件', type: 'report' },
      { k: 'summaryText', label: '报告结论 / 情况说明', type: 'textarea', ph: '例如：各项指标基本正常，轻度牙结石，建议日常刷牙' },
      { k: 'advice', label: '医嘱', type: 'textarea', ph: '例如：半年后复查口腔，继续化毛' },
      { k: 'nextDate', label: '下次预计体检日期', type: 'date', def: '' },
      { k: 'nextItems', label: '预计检查项目', type: 'text', ph: '例如：血常规、生化、口腔检查' },
      { k: 'altItems', label: '备选检查项目', type: 'text', ph: '例如：心超（如有异常再加）' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 扩展：健康档案（按年份/次数/类型留存检查报告电子档） */
  healthArchive: {
    name: '健康档案', table: 'healthArchives', icon: '📁',
    fields: [
      { k: 'catId', label: '猫咪', type: 'catRef', req: true },
      { k: 'year', label: '年份', type: 'number', req: true, def: () => new Date().getFullYear(), ph: '例如：2026' },
      { k: 'seq', label: '本年第几次', type: 'number', unit: '次', req: true, def: 1, ph: '例如：第1次填 1' },
      { k: 'type', label: '类型', type: 'select', req: true, opts: ['体检', '复查', '按计划就医', '临时就医'] },
      { k: 'reportType', label: '报告类型', type: 'select', req: true, dropdown: true, freeTextOn: '其他', opts: ['血常规', '生化全套', '血涂片', '尿常规', '粪便检查', 'UPC', '血气', '腹部B超', '心脏彩超', 'DR', '口腔检查', '眼压', '血压', '甲状腺T4', '抗体滴度', '内分泌', '病例报告', '其他'] },
      { k: 'date', label: '报告日期', type: 'date', req: true, def: () => today(), quickDate: true },
      { k: 'files', label: '电子档（报告图片 / PDF）', type: 'report' },
      { k: 'summary', label: '报告结论 / 摘要', type: 'textarea', ph: '例如：血常规正常，建议半年后复查' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  },

  /* 扩展：养护小 tips（录入与猫养护相关的经验 / 提醒） */
  careTip: {
    name: '养护小tips', table: 'careTips', icon: '💡',
    fields: [
      { k: 'catId', label: '关联猫咪（留空为通用）', type: 'select', opts: () => [{ v: '', label: '通用 / 全部' }].concat(DB.cats.map(c => ({ v: c.id, label: c.name }))) },
      { k: 'title', label: 'tip 标题', type: 'text', req: true, ph: '例如：化毛膏每周喂 2-3 次' },
      { k: 'category', label: '分类', type: 'select', req: true, dropdown: true, opts: ['饮食', '清洁美容', '健康护理', '行为训练', '安全防护', '居家环境', '其他'] },
      { k: 'content', label: 'tip 内容', type: 'textarea', req: true, ph: '例如：换粮需 7 天逐步过渡，每天替换 1/4…' },
      { k: 'source', label: '来源 / 出处（可选）', type: 'text', ph: '例如：医生建议 / 科普文章' },
      { k: 'photo', label: '截图 / 附件（可选）', type: 'photo', ph: '可上传截图，点「识别图中文字」提取文字并作为附件留档' },
      { k: 'important', label: '重要 / 必看', type: 'bool' },
      { k: 'notes', label: '备注', type: 'textarea' }
    ]
  }
};

/* 食物：可选营养字段分组（编辑表单折叠 + 卡片展开） */
['bone','carb','fiber','choline','iron','copper','manganese','zinc','iodine','magnesium','sodium','va','vb','ve','vd','taurine','epa','dha','epaDha'].forEach(k => {
  const f = ENTITIES.food.fields.find(x => x.k === k);
  if (f) { f.grp = 'nutrient'; f.grpTitle = '更多营养（选填）'; }
});

/* 页面(page key) → 实体(entity key) 映射 */
const PAGE_ENTITY = {
  feed: 'feed', health: 'health', status: 'status', weight: 'weight',
  deworm: 'deworm', excrete: 'excrete', water: 'water', interaction: 'interaction',
  vet: 'vet', allergy: 'allergy', cats: 'cat', foods: 'food', urine: 'urine',
  healthArchive: 'healthArchive', careTip: 'careTip'
};

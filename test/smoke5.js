const fs = require('fs'); const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const root = __dirname + '/..';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
global.localStorage = { _d: {}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
const dom = new JSDOM(html, { runScripts:'outside-only', url:'https://x.test/', pretendToBeVisual:true });
const { window } = dom;
Object.defineProperty(window, 'localStorage', { value: global.localStorage });
window.alert = ()=>{}; window.confirm = ()=>true; window.scrollTo = ()=>{};
const bundle = ['js/core.js','js/schemas.js','js/pages.js','js/stats.js','js/main.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
window.eval(bundle + '\n;window.DBref=DB;window.isPlanDayRef=isPlanDay;window.planFreqTextRef=planFreqText;window.ENTITIESref=ENTITIES;window.todayRef=today;window.addDaysRef=addDays;window.getFormDataRef=function(){return _formData;};window.setFormDataRef=function(v){_formData=v;};');

let pass = 0, fail = 0;
function ok(c, m){ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ '+m);} }

const T = window.todayRef();
const DB = window.DBref;

// 1. 两个“每天+持续”护理计划，今天都应判为执行日（用户报的 bug）
const pA = { id:'a', catId:'c1', name:'梳毛A', type:'梳毛', continuous:true, startDate:T, endDate:'', schedType:'按间隔', intervalDays:'1' };
const pB = { id:'b', catId:'c1', name:'梳毛B', type:'洗澡', continuous:true, startDate:T, endDate:'', schedType:'按间隔', intervalDays:'1' };
ok(window.isPlanDayRef(pA, T) === true, '计划A（每天/持续）今天=执行日');
ok(window.isPlanDayRef(pB, T) === true, '计划B（每天/持续）今天=执行日');

// 2. 间隔='3'、起始日=今天：第1天是执行日，第2天不是
const p3 = { id:'c', catId:'c1', name:'Q3', continuous:true, startDate:T, endDate:'', schedType:'按间隔', intervalDays:'3' };
ok(window.isPlanDayRef(p3, T) === true, '每3天计划：第1天=执行日');
ok(window.isPlanDayRef(p3, window.addDaysRef(T, 1)) === false, '每3天计划：第2天≠执行日');

// 3. 健壮性：startDate 为空 / 非法日期不应抛错或误判
const pEmpty = { id:'e', catId:'c1', continuous:true, startDate:'', schedType:'按间隔', intervalDays:'1' };
const pBad = { id:'f', catId:'c1', continuous:true, startDate:'not-a-date', schedType:'按间隔', intervalDays:'1' };
ok(window.isPlanDayRef(pEmpty, T) === false, '空 startDate → 安全返回 false（不崩）');
ok(window.isPlanDayRef(pBad, T) === false, '非法 startDate → 安全返回 false（不崩）');

// 4. 间隔选项已改为 {v,label} 清晰文案
const iv = window.ENTITIESref.carePlan.fields.find(f => f.k === 'intervalDays');
ok(Array.isArray(iv.opts) && iv.opts[0].v === '1' && iv.opts[0].label === '每天', 'intervalDays 首选项 = {v:"1",label:"每天"}');
ok(iv.opts[2].v === '3' && iv.opts[2].label === '每3天', 'intervalDays 第三选项 = {v:"3",label:"每3天"}');
ok(iv.def === '1', 'intervalDays 默认值为 "1"（每天）');
const st = window.ENTITIESref.carePlan.fields.find(f => f.k === 'schedType');
ok(st.def === '按间隔', 'schedType 默认值为 "按间隔"');

// 5. planFreqText 文案
ok(window.planFreqTextRef({ continuous:true, startDate:T, endDate:'', schedType:'按间隔', intervalDays:'1' }).startsWith('每天'), 'planFreqText(每天) 显示“每天”');
ok(window.planFreqTextRef({ continuous:true, startDate:T, endDate:'', schedType:'按间隔', intervalDays:'3' }).startsWith('每3天'), 'planFreqText(每3天) 显示“每3天”');

// 6. 未来开始日期 → 不是执行日（应显示“未开始”而非“进行中”）
const future = window.addDaysRef(T, 5);
const pFuture = { id:'g', catId:'c1', continuous:true, startDate:future, endDate:'', schedType:'按间隔', intervalDays:'1' };
ok(window.isPlanDayRef(pFuture, T) === false, '开始日期在未来的每天计划：今天≠执行日（状态应为“未开始”）');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

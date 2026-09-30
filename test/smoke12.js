let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const fs = require('fs');
const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const { window } = dom;
global.window = window; global.document = window.document; global.navigator = window.navigator;
['document','window','navigator','setTimeout','clearTimeout','HTMLElement','Node','getComputedStyle','customElements','location','history'].forEach(k => { try { global[k] = window[k]; } catch(e){} });
window.eval(fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8') + '\n;window.__ENT=ENTITIES; window.__LC=LIST_CONFIG; window.__DB=DB; window.__today=today; window.__addDays=addDays;');
const w = window;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const ENT = w.__ENT, DB = w.__DB, today = w.__today, addDays = w.__addDays;
const T = today();
DB.cats.push({ id: 'c1', name: '布丁' });
const sd = addDays(T, -60), ed = addDays(T, 60);

// 1. schema
const cp = ENT.carePlan;
const stF = cp.fields.find(f => f.k === 'schedType');
ok(stF.opts.includes('按月'), '频率方式含「按月」选项');
const mdF = cp.fields.find(f => f.k === 'monthDays');
ok(!!mdF && mdF.type === 'multiselect', '存在 monthDays 多选字段');
ok(mdF && mdF.show({ continuous: true, schedType: '按月' }) === true, 'monthDays 仅在「按月」频率下显示');
ok(mdF && mdF.show({ continuous: true, schedType: '按间隔' }) === false, '「按间隔」下不显示 monthDays');

// 2. 基础待办判定（无任何完成记录）
const plan = { id: 'pM', catId: 'c1', continuous: true, startDate: sd, endDate: ed, schedType: '按月', monthDays: ['每月1号', '每月15号', '每月30号'], paused: false, name: '月度护理' };
DB.carePlans.push(plan);
ok(w.isPlanDay(plan, addDays(T, 0)) === true, '月底(已过1/15/30号且无记录)→ 待办（持续提醒）');
ok(w.isPlanDay(plan, addDays(T, -21)) === true, '月中之前(已过1号无记录)→ 待办');

// 3. 逐步完成 → 每日提醒直到全部完成
// 用当月真实的调度日（避免依赖「今天几号」，如 9/30 环境下 addDays 推算会错位）
const ym = T.slice(0, 7);
const lastDayD = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
const d1 = ym + '-01';
const d15 = ym + '-15';
const d30 = ym + '-' + String(Math.min(30, lastDayD)).padStart(2, '0');
DB.careRecords.push({ id: 'r1', catId: 'c1', planId: 'pM', date: d1 }); // 完成本月1号
ok(w.isPlanDay(plan, T) === true, '完成1号后，15/30未完成仍待办');
DB.careRecords.push({ id: 'r2', catId: 'c1', planId: 'pM', date: d15 }); // 完成本月15号
ok(w.isPlanDay(plan, T) === true, '完成15号后，30号未完成仍待办');
DB.careRecords.push({ id: 'r3', catId: 'c1', planId: 'pM', date: d30 }); // 完成本月30号
ok(w.isPlanDay(plan, T) === false, '1/15/30全部完成后，本月不再待办');

// 4. 提前记录(早于调度日)不计入当月该日完成
const plan2 = { id: 'pM2', catId: 'c1', continuous: true, startDate: sd, endDate: ed, schedType: '按月', monthDays: ['每月15号'], paused: false, name: '半月护理' };
DB.carePlans.push(plan2);
const T2 = '2026-08-20';
DB.careRecords.push({ id: 'r4', catId: 'c1', planId: 'pM2', date: '2026-08-05' }); // 早于本月15号
ok(w.isPlanDay(plan2, T2) === true, '早于调度日记录不视为当月完成 → 仍待办');
DB.careRecords.push({ id: 'r5', catId: 'c1', planId: 'pM2', date: '2026-08-25' }); // 本月15号之后
ok(w.isPlanDay(plan2, T2) === false, '调度日之后完成 → 不再待办');

// 5. 未选日期 / 暂停 / 未开始
const plan3 = { id: 'pM3', catId: 'c1', continuous: true, startDate: sd, endDate: ed, schedType: '按月', monthDays: [], paused: false };
DB.carePlans.push(plan3);
ok(w.isPlanDay(plan3, T) === false, '按月但没选日期 → 不待办');
plan3.paused = true;
ok(w.isPlanDay(plan3, T) === false, '已暂停 → 不待办');

// 6. 频率文案
ok(/每月1号、每月15号、每月30号/.test(w.planFreqText(plan)), '频率文案显示「每月1号、每月15号、每月30号」');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

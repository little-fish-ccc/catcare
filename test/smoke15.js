/* smoke15：本轮7项改动核心逻辑验证 */
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }
const fs = require('fs');
const root = __dirname + '/..';
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
['document', 'window', 'navigator', 'setTimeout', 'clearTimeout', 'HTMLElement', 'Node', 'getComputedStyle', 'customElements', 'location', 'history'].forEach(k => { try { global[k] = w[k]; } catch (e) {} });
w.eval(fs.readFileSync(root + '/js/core.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/schemas.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/pages.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/stats.js', 'utf8') + '\n' + fs.readFileSync(root + '/js/main.js', 'utf8') + '\n;window.__E = ENTITIES; window.__LIST = LIST_CONFIG; window.__DB = DB; window.__PE = PAGE_ENTITY;');
const E = w.__E, LIST = w.__LIST, DB = w.__DB;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

/* 1. 互动类型拆分 */
const typeF = E.interaction.fields.find(f => f.k === 'type');
ok(typeF.opts.includes('新发现趣事（猫猫版）'), '互动类型含「新发现趣事（猫猫版）」');
ok(typeF.opts.includes('新发现趣事（人版）'), '互动类型含「新发现趣事（人版）」');
ok(!typeF.opts.includes('新发现趣事'), '旧的「新发现趣事」已拆分为两项');

/* 2. 猫状态新增「迁就人类」 + 人状态字段 */
ok(E.interaction.fields.find(f => f.k === 'mood').opts.includes('迁就人类'), '猫猫状态含「迁就人类」');
const hs = E.interaction.fields.find(f => f.k === 'humanState');
ok(hs && hs.type === 'select', '「人当时的状态」字段存在');
['猫好', '这个世界不能没有猫猫', '观察者', '被猫迁就', '被猫治愈', '内疚', '自责', '懊悔'].forEach(o => ok(hs.opts.includes(o), '人状态含「' + o + '」'));

/* 3. 玩耍逗猫的游戏时间选框 */
const pm = E.interaction.fields.find(f => f.k === 'playMinutes');
ok(pm && typeof pm.show === 'function', '「玩耍时长」含 show 条件');
ok(pm.show({ type: '玩耍逗猫' }) === true, '类型=玩耍逗猫 → 显示玩耍时长');
ok(pm.show({ type: '陪伴撸猫' }) === false, '类型=陪伴撸猫 → 不显示');
ok(pm.opts.length === 6 && pm.opts[0].v === '5' && pm.opts[5].v === '30', '玩耍时长6档(5~30分钟)');

/* 4. 尿比重记录 */
ok(E.urine && E.urine.table === 'urine', 'urine 实体存在(table=urine)');
ok(w.__PE.urine === 'urine', 'PAGE_ENTITY.urine 已登记');
ok(LIST.urine && LIST.urine.title.indexOf('尿比重') >= 0, 'LIST_CONFIG.urine 存在');
ok(E.urine.fields.some(f => f.k === 'sg' && f.req), '尿比重含必填「尿比重(sg)」字段');
ok(!E.urine.fields.some(f => f.k === 'photo'), '尿比重不含照片字段(简洁)');

/* 5. 首页文案：小鱼干🐱的今日记录 + 不显示已绝育 */
DB.cats.length = 0; DB.cats.push({ id: 'c1', name: '小鱼干', neutered: '已绝育' });
DB.settings = { selectedCat: 'c1' };
['feedings', 'status', 'excrete', 'weights', 'medPlans', 'carePlans', 'medRecords', 'careRecords', 'health', 'water', 'deworm'].forEach(t => { if (!DB[t]) DB[t] = []; });
const home = w.document.createElement('div'); w.renderHome(home);
const h = home.innerHTML;
ok(/🐱的今日记录/.test(h) && !/ 的今日记录/.test(h), '首页标题为「小鱼干🐱的今日记录」（干和的中间为猫头，无空格）');
ok(!/已绝育/.test(h), '首页副标题不显示「已绝育」');

/* 6. 护理计划：今日需护理置顶 */
DB.carePlans = [
  { id: 'p1', catId: 'c1', name: '需护理A', continuous: true, startDate: '2026-01-01', endDate: '2026-12-31', schedType: '按间隔', intervalDays: '1', type: '梳毛' },
  { id: 'p2', catId: 'c1', name: '普通B', continuous: true, startDate: '2026-01-01', endDate: '2026-12-31', schedType: '按间隔', intervalDays: '1', type: '刷牙', paused: true }
];
DB.careRecords = [];
const cp = w.document.createElement('div'); w.renderPlanModule(cp, 'care');
ok(cp.innerHTML.indexOf('需护理A') < cp.innerHTML.indexOf('普通B'), '今日需护理的计划(需护理A)排在前，已暂停(普通B)沉底');

console.log(`\nsmoke15: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

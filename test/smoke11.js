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

const ENT = w.__ENT, LC = w.__LC, DB = w.__DB, today = w.__today, addDays = w.__addDays;
const T = today();
DB.cats.push({ id: 'c1', name: '布丁' });

// 1. excrete 实体含 noFollow 字段，且只对往期记录显示
const exF = ENT.excrete.fields.find(f => f.k === 'noFollow');
ok(!!exF, 'excrete 实体含 noFollow 字段');
ok(exF && exF.type === 'bool', 'noFollow 为布尔类型');
ok(exF && exF.show({ date: addDays(T, -3) }) === true, '往期记录(今前)显示「取消继续关注」开关');
ok(exF && exF.show({ date: T }) === false, '今日记录不显示该开关');

// 2. 列表 summary：noFollow 时不再显示「需关注」，改为「已取消关注」
const d1 = addDays(T, -5), d2 = addDays(T, -6);
const e1 = { id: 'e1', catId: 'c1', date: d1, pooped: true, poopState: '软便', peeNormal: false };
const e2 = { id: 'e2', catId: 'c1', date: d2, pooped: true, poopState: '软便', peeNormal: false, noFollow: true };
const s1 = LC.excrete.summary(e1);
const s2 = LC.excrete.summary(e2);
ok(/需关注/.test(s1.title), '未取消关注：往期异常记录显示「需关注」');
ok(!/需关注/.test(s2.title) && /已取消关注/.test(s2.title), '已取消关注：不再显示「需关注」，显示「已取消关注」');

// 3. 统计分析：noFollow 记录不计入异常（按日期区分）
DB.excrete.push(e1, e2);
const html = w.statExcrete('c1', addDays(T, -30), T);
ok(html.includes(d1) && !html.includes(d2), '统计分析异常明细：已取消关注的 ' + d2 + ' 被排除，' + d1 + ' 仍计入');
ok(/需关注/.test(html), '仍计入的异常记录(e1)在统计中显示「需关注」');

// 4. 自动备份函数仍存在（代码未破损）
ok(typeof w.scheduleAutoBackup === 'function', 'scheduleAutoBackup 函数存在');
ok(typeof w.downloadBackup === 'function', 'downloadBackup 函数存在');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

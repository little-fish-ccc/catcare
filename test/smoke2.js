/* jsdom 冒烟测试：用药/护理模块重构 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
w.confirm = () => true;
w.alert = () => {};

let fails = 0;
const ok = (cond, name) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fails++; };

// 合并为一次 eval（浏览器中多个 <script> 共享全局词法作用域，eval 需模拟）
const bundle = ['js/core.js', 'js/schemas.js', 'js/pages.js', 'js/stats.js', 'js/main.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
w.eval(bundle + '\n;window.DBref = DB; window.getFD = () => _formData; window.setFD = (k,v) => { _formData[k] = v; };');
w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

// 1. 载入示例数据
w.eval('loadDemo()');
ok(w.eval('DBref.medPlans.length') === 1, '示例数据含1个用药计划');
ok(w.eval('DBref.carePlans.length') === 1, '示例数据含1个护理计划');
ok(w.eval('DBref.medRecords.length') === 2 && w.eval('DBref.careRecords.length') === 2, '示例含用药/护理记录各2条');

// 2. isPlanDay：按星期
const r1 = w.eval(`
  (function(){
    var t = today();
    var p = { continuous:true, startDate:addDays(t,-14), endDate:addDays(t,14), schedType:'按星期', weekdays:['周三','周日'] };
    var hit = [];
    for (var i=0;i<7;i++){ var d = addDays(t,i); if (isPlanDay(p,d)) hit.push(weekdayCN(d)); }
    return hit.join(',');
  })()
`);
ok(r1.split(',').length === 2 && r1.includes('周三') && r1.includes('周日'), '按星期：一周内仅命中周三、周日 → ' + r1);

// 3. isPlanDay：按间隔（每2天一次）
const r2 = w.eval(`
  (function(){
    var t = today();
    var p = { continuous:true, startDate:t, endDate:addDays(t,9), schedType:'按间隔', intervalDays:'2' };
    var n=0; for (var i=0;i<10;i++){ if (isPlanDay(p, addDays(t,i))) n++; }
    return n;
  })()
`);
ok(r2 === 5, '按间隔2天：10天内命中5次 → ' + r2);

// 4. 范围外 / 暂停不命中
const r3 = w.eval(`
  (function(){
    var t = today();
    var p = { continuous:true, startDate:t, endDate:addDays(t,5), schedType:'按间隔', intervalDays:'1' };
    var before = isPlanDay(p, addDays(t,-1)), after = isPlanDay(p, addDays(t,6));
    p.paused = true;
    var paused = isPlanDay(p, t);
    return !before && !after && !paused;
  })()
`);
ok(r3 === true, '范围外与暂停均不算用药日');

// 5. 用药模块页
w.eval("go('med')");
let mainHTML = w.document.getElementById('main').innerHTML;
ok(mainHTML.includes('用药计划') && mainHTML.includes('用药情况记录'), '用药模块分上下两区');
ok(mainHTML.includes('化毛膏'), '计划列表显示示例计划');
ok(mainHTML.includes('暂停') && mainHTML.includes('删'), '计划右侧有暂停/删除按钮');
ok(mainHTML.includes('每周三、周日'), '计划显示按星期频率文本');

// 6. 护理模块页
w.eval("go('care')");
mainHTML = w.document.getElementById('main').innerHTML;
ok(mainHTML.includes('护理计划') && mainHTML.includes('护理情况记录'), '护理模块分上下两区');
ok(mainHTML.includes('每日梳毛') && mainHTML.includes('每天'), '护理计划显示每天频率');

// 7. 暂停 / 恢复
const planId = w.eval('DBref.carePlans[0].id');
w.eval(`togglePlanPause('carePlans','${planId}')`);
ok(w.eval('DBref.carePlans[0].paused') === true, '点击暂停后 paused=true');
w.eval("go('home')");
mainHTML = w.document.getElementById('main').innerHTML;
ok(!mainHTML.includes('今天需要护理'), '暂停后首页待办不出现护理提示');
w.eval(`togglePlanPause('carePlans','${planId}')`);
ok(w.eval('DBref.carePlans[0].paused') === false, '再次点击恢复 paused=false');

// 8. 首页待办：每天护理计划 → 今天应是护理日
w.eval("go('home')");
mainHTML = w.document.getElementById('main').innerHTML;
ok(mainHTML.includes('今天需要护理') || mainHTML.includes('今日护理已完成'), '首页待办出现护理提示（每天计划）');

// 9. 待办跳转 bug 修复：不再出现 openForm('meds')
ok(!mainHTML.includes("openForm('meds')") && !mainHTML.includes('openForm("meds")'), '待办不再指向已废弃的 meds 表单');
ok(mainHTML.includes("go('care')") || mainHTML.includes('go(&#39;care&#39;)') || mainHTML.includes("go('med')"), '待办 chip 点击为页面跳转');

// 10. 用药情况表单：计划下拉选项
w.eval("openForm('medRecord')");
const modalHTML = w.document.getElementById('modalRoot').innerHTML;
ok(modalHTML.includes('对应用药计划') && modalHTML.includes('化毛膏'), '用药情况表单可选择对应计划');
w.eval('closeModal()');

// 11. 从计划卡「＋记录一次」预填 planId 并提交
const mp = w.eval('DBref.medPlans[0].id');
w.eval(`openForm('medRecord',{catId: DBref.medPlans[0].catId, planId:'${mp}'})`);
ok(w.eval('getFD().planId') === mp, '「＋记录一次」预填对应计划');
w.eval("setFD('result','已完成'); submitForm()");
ok(w.eval('DBref.medRecords.length') === 3, '提交用药情况成功（共3条）');

// 12. 健康提醒含用药倒计时
w.eval("go('home')");
mainHTML = w.document.getElementById('main').innerHTML;
ok(mainHTML.includes('需用药') || mainHTML.includes('下次用药'), '健康提醒含用药计划倒计时');

// 13. 日详情弹窗
const catId = w.eval('DBref.cats[0].id');
const d = w.eval('DBref.medRecords[0].date');
w.eval(`showDayDetail('${catId}','${d}')`);
const dd = w.document.getElementById('modalRoot').innerHTML;
ok(dd.includes('用药情况'), '日详情包含用药情况段');
w.eval('closeModal()');

// 14. 删除计划保留记录
w.eval(`deletePlan('medPlans','medRecords','${mp}')`);
ok(w.eval('DBref.medPlans.length') === 0 && w.eval('DBref.medRecords.length') === 3, '删除计划后记录保留');
w.eval("go('med')");
mainHTML = w.document.getElementById('main').innerHTML;
ok(mainHTML.includes('计划已删除'), '孤儿记录显示「计划已删除」');

console.log(fails === 0 ? '\n全部通过 ✅' : `\n${fails} 项失败 ❌`);
process.exit(fails === 0 ? 0 : 1);

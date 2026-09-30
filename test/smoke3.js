/* jsdom 冒烟测试：用药改名 + 体检/复查模块 */
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

const bundle = ['js/core.js', 'js/schemas.js', 'js/pages.js', 'js/stats.js', 'js/main.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
w.eval(bundle + '\n;window.DBref = DB; window.ENTITIESref = ENTITIES;');
w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

// 1. 用药模块改名
w.eval("go('med')");
let h = w.document.getElementById('main').innerHTML;
ok(h.includes('用药情况'), '用药模块标题已改为「用药情况」');

// 2. 实体与表
ok(w.eval("typeof ENTITIESref.checkup === 'object' && ENTITIESref.checkup.table === 'checkups'"), 'checkup 实体存在且表为 checkups');

// 3. 载入示例数据含两次体检
w.eval('loadDemo()');
ok(w.eval('DBref.checkups.length') === 2, '示例含 2 次体检/复查');
ok(w.eval('DBref.checkups[0].metrics.length') === 3, '示例体检含 3 项指标');

// 4. 体检模块页渲染
w.eval("go('checkup')");
h = w.document.getElementById('main').innerHTML;
ok(h.includes('体检 / 复查') && h.includes('体检 / 复查记录'), '体检模块页渲染');
ok(h.includes('指标趋势分析'), '含指标趋势分析区');
ok(h.includes('项异常'), '异常指标被标红（项异常徽标）');
ok(h.includes('肌酐 CREA'), '指标明细展示肌酐');
ok(h.includes('下次预计体检'), '展示下次体检计划');
ok(h.includes('★') || h.includes('重点关注'), '重点关注有标记');

// 5. 体检详情弹窗
const cid = w.eval('DBref.checkups[1].id');
w.eval(`showCheckupDetail('${cid}')`);
const d = w.document.getElementById('modalRoot').innerHTML;
ok(d.includes('肌酐 CREA') && d.includes('异常'), '详情弹窗显示异常指标');
ok(d.includes('★ 重点') || d.includes('重点关注'), '详情弹窗显示重点关注底色标记');
ok(d.includes('下次计划') || d.includes('预计日期'), '详情弹窗显示下次计划');
ok(d.includes('报告结论'), '详情弹窗显示报告结论/情况说明');
ok(d.includes('医嘱'), '详情弹窗显示医嘱');
w.eval('closeModal()');

// 6. parseReportText 自动解析
const pr = w.eval(`
  (function(){
    var txt = '白蛋白 ALB 35 g/L 28-40\\n红细胞 RBC 9.8 10^12/L 6.5-12.5\\n肌酐 CREA 200 μmol/L 62-160\\n建议多饮水，3个月后复查';
    var r = parseReportText(txt);
    return { n: r.metrics.length, abn: r.metrics.filter(function(x){return x.abnormal;}).length,
      hasAdvice: !!r.advice, names: r.metrics.map(function(x){return x.name;}).join(',') };
  })()
`);
ok(pr.n === 3, '解析出 3 项指标 → ' + pr.names);
ok(pr.abn === 1, '解析识别 1 项异常（肌酐超上限） → ' + pr.abn);
ok(pr.hasAdvice, '解析提取医嘱/建议文本');

// 7. computeAbnormal 判定
ok(w.eval("computeAbnormal({value:'200', low:'62', high:'160'})") === true, 'computeAbnormal：超上限判定异常');
ok(w.eval("computeAbnormal({value:'35', low:'28', high:'40'})") === false, 'computeAbnormal：范围内判定正常');

// 8. 首页健康提醒含下次体检
w.eval("go('home')");
h = w.document.getElementById('main').innerHTML;
ok(h.includes('下次体检') || h.includes('复查'), '首页健康提醒含下次体检/复查倒计时');

// 9. 日详情含体检段
const catId = w.eval('DBref.cats[0].id');
const cd = w.eval('DBref.checkups[0].date');
w.eval(`showDayDetail('${catId}','${cd}')`);
const dd = w.document.getElementById('modalRoot').innerHTML;
ok(dd.includes('体检/复查'), '日详情包含体检/复查段');
w.eval('closeModal()');

// 10. 新增体检表单含指标明细与报告上传
w.eval("openForm('checkup')");
const mh = w.document.getElementById('modalRoot').innerHTML;
ok(mh.includes('指标明细') && mh.includes('电子报告附件'), '体检表单含指标明细与报告上传');
ok(mh.includes('粘贴报告文字'), '表单支持粘贴文字自动解析');
w.eval('closeModal()');

console.log(fails === 0 ? '\n全部通过 ✅' : `\n${fails} 项失败 ❌`);
process.exit(fails === 0 ? 0 : 1);

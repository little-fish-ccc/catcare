const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const files = ['js/core.js', 'js/schemas.js', 'js/pages.js', 'js/stats.js', 'js/main.js'];
const bundle = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="toastRoot"></div><div id="main"></div><nav id="sidenav"></nav><select id="globalCat"></select></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
w.eval(bundle + '\n;window.DB=DB;window.DB_DEFAULT=DB_DEFAULT;window.ENTITIES=ENTITIES;window.PAGE_ENTITY=PAGE_ENTITY;window.openForm=openForm;window.submitForm=submitForm;window.renderListPage=renderListPage;window.renderHome=renderHome;window.openQuickAdd=openQuickAdd;window.showDayDetail=showDayDetail;window.today=today;window.__setFD=function(k,v){_formData[k]=v;};window.__getEntity=function(){return _formEntity;};window.__getFD=function(){return _formData;};');
if (typeof w.btoa !== 'function') w.btoa = s => Buffer.from(s, 'binary').toString('base64');
if (typeof w.atob !== 'function') w.atob = s => Buffer.from(s, 'base64').toString('binary');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

// 0. 准备猫咪
w.DB.cats.push({ id: 'c1', name: '布丁', photo: [] });
w.DB.settings.selectedCat = 'c1';

// 1. 实体与映射
ok(w.ENTITIES.interaction && w.ENTITIES.interaction.table === 'interactions', '互动实体存在(table=interactions)');
ok(w.PAGE_ENTITY.interaction === 'interaction', 'PAGE_ENTITY.interaction 已登记');
ok(Array.isArray(w.DB_DEFAULT.interactions), 'DB_DEFAULT 含 interactions 数组');
ok(Array.isArray(w.DB.interactions), '运行期 DB.interactions 已初始化');

// 2. 打开表单
w.openForm('interaction');
ok(w.__getEntity() && w.__getEntity().name === '互动记录', 'openForm 进入互动记录表单');
const modalTxt = w.document.getElementById('modalRoot').textContent;
ok(/互动类型/.test(modalTxt) && /陪伴撸猫/.test(modalTxt), '表单含互动类型与示例选项');
ok(/值得纪念/.test(w.document.getElementById('modalRoot').innerHTML), '表单含「值得纪念」勾选');
ok(w.__getFD().catId === 'c1', '默认猫咪为当前选中猫咪');

// 3. 填写并保存
w.__setFD('type', '陪伴撸猫');
w.__setFD('mood', '粘人撒娇');
w.__setFD('title', '第一次跳上书架');
w.__setFD('content', '布丁今天第一次成功跳上书架，回头看我喵了一声');
w.__setFD('memory', true);
w.submitForm();
ok(w.DB.interactions.length === 1, '保存后 interactions 增加 1 条');
const rec = w.DB.interactions[0];
ok(rec.type === '陪伴撸猫' && rec.title === '第一次跳上书架' && rec.memory === true, '记录字段正确写入');
ok(rec.date === w.today(), '记录日期默认为今天');

// 4. 列表页渲染
const main = w.document.getElementById('main');
w.renderListPage(main, 'interaction');
const listHtml = main.innerHTML;
ok(/互动记录/.test(listHtml), '列表页标题渲染');
ok(/陪伴撸猫/.test(listHtml) && /第一次跳上书架/.test(listHtml), '列表页含记录类型与主题');
ok(/★ 值得纪念/.test(listHtml), '列表页标记「值得纪念」');

// 5. 首页快捷记录入口
w.renderHome(main);
ok(/今日互动/.test(main.innerHTML) && /💞/.test(main.innerHTML), '首页快捷记录含「今日互动」入口');

// 6. 移动端 + 快捷弹窗
w.openQuickAdd();
ok(/今日互动/.test(w.document.getElementById('modalRoot').innerHTML), '快捷弹窗含「今日互动」入口');

// 7. 每日完整记录含互动分区
const t = w.today();
w.showDayDetail('c1', t);
ok(/互动回忆/.test(w.document.getElementById('modalRoot').innerHTML), '每日详情含互动回忆分区');

console.log('\n互动记录冒烟测试：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

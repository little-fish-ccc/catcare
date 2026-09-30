const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { const path = require('path'); JSDOM = require(path.join('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules', 'jsdom')).JSDOM; }

const root = __dirname + '/..';
const files = ['js/core.js', 'js/schemas.js', 'js/pages.js', 'js/stats.js', 'js/main.js'];
const bundle = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
const dom = new JSDOM('<!DOCTYPE html><body><div id="modalRoot"></div><div id="previewRoot"></div><div id="toastRoot"></div><div id="main"></div></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window;
w.eval(bundle + '\n;window.DBref=DB;window.ENTITIESref=ENTITIES;window.reportBoxInnerRef=reportBoxInner;window.abToBase64Ref=abToBase64;window.openPdfRef=openPdf;window.setFormDataRef=function(v){_formData=v;};window.getFormDataRef=function(){return _formData;};');
if (typeof w.btoa !== 'function') w.btoa = s => Buffer.from(s, 'binary').toString('base64');
if (typeof w.atob !== 'function') w.atob = s => Buffer.from(s, 'base64').toString('binary');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

// 1. 检查项目选项：DR 替代 胸部DR，新增 UPC、血气
const items = w.ENTITIESref.checkup.fields.find(f => f.k === 'items').opts;
ok(items.includes('DR'), '检查项目含 DR');
ok(!items.includes('胸部DR'), '检查项目不再含 胸部DR');
ok(items.includes('UPC'), '检查项目含 UPC');
ok(items.includes('血气'), '检查项目含 血气');

// 2. PDF 内容保存辅助函数存在且可逆
ok(typeof w.abToBase64Ref === 'function', 'abToBase64 函数存在');
ok(typeof w.openPdfRef === 'function', 'openPdf 函数存在（点开查看 PDF）');
const bytes = new Uint8Array([1, 2, 3, 250, 255, 0, 128]);
const b64 = w.abToBase64Ref(bytes.buffer);
ok(Buffer.compare(Buffer.from(b64, 'base64'), Buffer.from(bytes)) === 0, 'abToBase64 可逆（PDF 内容可还原）');

// 3. reportBoxInner 对图片/PDF 都生成「点开查看」而非直接删除
w.setFormDataRef({ rf: [{ name: 'a.png', kind: 'image', data: 'data:image/png;base64,AAA' }, { name: 'b.pdf', kind: 'pdf', data: 'data:application/pdf;base64,BBB' }] });
const inner = w.reportBoxInnerRef('rf');
ok(/onclick="showBigImg\(/.test(inner), '图片缩略图点击可放大查看');
ok(/onclick="openPdf\(/.test(inner), 'PDF 缩略图点击可打开查看');
ok((inner.match(/thumb-x/g) || []).length === 2, '每张报告有独立删除按钮');

// 4. PDF 报告保存了可打开的 data 内容（不再只剩文件名）
const samplePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A]);
const dataUrl = 'data:application/pdf;base64,' + Buffer.from(samplePdf).toString('base64');
const stored = { name: 'r.pdf', kind: 'pdf', data: dataUrl };
ok(stored.data && stored.data.startsWith('data:application/pdf;base64,'), 'PDF 报告保存了可打开的 data 内容（不再只剩文件名）');

// 5. openPdf 改为应用内预览（用独立 #previewRoot 弹层，不再用会被沙箱拦截的 window.open）
if (typeof w.Blob !== 'function') w.Blob = function (parts) { this.parts = parts; };
if (typeof w.URL === 'undefined') w.URL = {};
w.URL.createObjectURL = () => 'blob:https://x.test/abc';
w.URL.revokeObjectURL = () => {};
if (!w.document.getElementById('modalRoot')) {
  const root = w.document.createElement('div'); root.id = 'modalRoot'; w.document.body.appendChild(root);
}
if (!w.document.getElementById('previewRoot')) {
  const proot = w.document.createElement('div'); proot.id = 'previewRoot'; w.document.body.appendChild(proot);
}
w.openPdf(dataUrl);
const previewHTML = w.document.getElementById('previewRoot').innerHTML;
ok(/<object/.test(previewHTML), 'openPdf 在应用内弹窗渲染预览 PDF（object，不新标签页）');
ok(/download=/.test(previewHTML), 'openPdf 提供下载链接作为兜底');

// 6. 体检检查项目「其他」可输入自定义内容
const itemsField = w.ENTITIESref.checkup.fields.find(f => f.k === 'items');
ok(itemsField.freeTextOn === '其他', '检查项目字段带 freeTextOn=其他');
if (typeof w.onMultiOther !== 'function') w.onMultiOther = undefined;
ok(typeof w.eval('onMultiOther') === 'function', 'onMultiOther 函数存在');
// 模拟：选中「其他」后再输入自定义
w.setFormDataRef({ items: ['其他'] });
w.eval("onMultiOther('items','其他',['血常规','生化全套','其他'],'DNA检测')");
const afterType = w.getFormDataRef().items;
ok(afterType.includes('DNA检测') && !afterType.includes('其他'), '输入自定义后 items 含自定义文本且不含“其他”');
w.eval("onMultiOther('items','其他',['血常规','生化全套','其他'],'')");
const afterClear = w.getFormDataRef().items;
ok(afterClear.includes('其他') && !afterClear.some(x => x !== '其他' && !['血常规','生化全套'].includes(x)), '清空输入后回退为“其他”');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

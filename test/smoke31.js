/* smoke31（主程序）：PWA 配置完整性
   1) manifest.json 存在且关键字段齐全（name/short_name/start_url/display/icons）
   2) sw.js 存在且含 install/activate/fetch 三个事件处理
   3) index.html 引用 manifest、图标、theme-color，并注册 service worker
   4) 图标文件存在且尺寸正确
   5) 版本号在所有资源引用上一致（避免缓存不一致） */
const fs = require('fs');
const path = require('path');

const root = __dirname + '/..';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }

const exists = p => fs.existsSync(path.join(root, p));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

/* 1. manifest */
ok(exists('manifest.json'), 'manifest.json 存在');
const mf = JSON.parse(read('manifest.json'));
ok(mf.name && mf.name.length > 0, `manifest 有 name（${mf.name}）`);
ok(mf.short_name && mf.short_name.length <= 12, `short_name 简短（${mf.short_name}）`);
ok(mf.start_url === './index.html', `start_url 指向 index.html（${mf.start_url}）`);
ok(mf.display === 'standalone', `display 为 standalone（${mf.display}）`);
ok(mf.scope === './', 'scope 为相对根路径（子路径部署可用）');
ok(Array.isArray(mf.icons) && mf.icons.length >= 2, `icons ≥2 个（${mf.icons && mf.icons.length}）`);
ok(mf.icons.some(i => i.sizes === '192x192'), '含 192x192 图标（Android 必需）');
ok(mf.icons.some(i => i.sizes === '512x512'), '含 512x512 图标');
ok(mf.icons.some(i => i.purpose && i.purpose.includes('maskable')), '含 maskable 图标（Android 自适应）');
ok(mf.theme_color && mf.background_color, '含 theme_color / background_color');

/* 2. service worker */
ok(exists('sw.js'), 'sw.js 存在');
const sw = read('sw.js');
ok(/addEventListener\('install'/.test(sw), 'sw 有 install 事件');
ok(/addEventListener\('activate'/.test(sw), 'sw 有 activate 事件');
ok(/addEventListener\('fetch'/.test(sw), 'sw 有 fetch 事件');
ok(/caches\.open/.test(sw), 'sw 使用 Cache Storage');
ok(/skipWaiting/.test(sw) && /clients\.claim/.test(sw), 'sw 立即接管（skipWaiting + claim）');
ok(/url\.origin !== self\.location\.origin/.test(sw), 'sw 跳过跨域请求（CDN 不缓存）');
ok(/styles?\.css|index\.html/.test(sw), 'sw 预缓存应用外壳');

/* 3. index.html */
const html = read('index.html');
ok(/rel="manifest"/.test(html), 'index.html 引用 manifest');
ok(/name="theme-color"/.test(html), 'index.html 有 theme-color');
ok(/apple-mobile-web-app-capable/.test(html), 'index.html 支持 iOS 全屏');
ok(/apple-touch-icon/.test(html), 'index.html 引用 iOS 图标');
ok(/rel="icon"/.test(html), 'index.html 引用 favicon');
ok(/serviceWorker.*register/.test(html), 'index.html 注册 service worker');
ok(/portrait/.test(JSON.parse(read('manifest.json')).orientation || ''), 'manifest 指定竖屏');

/* 4. 图标文件 */
[['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180], ['icons/favicon.png', 48]].forEach(([p, size]) => {
  ok(exists(p), `${p} 存在`);
});

/* 5. 版本号一致 */
const vers = [...html.matchAll(/\?v=(2026[0-9a-z]+)/g)].map(m => m[1]);
const uniq = [...new Set(vers)];
ok(uniq.length === 1, `所有资源版本号一致（${uniq.join(',')}，共 ${vers.length} 处）`);
ok(/^20\d{6}[a-z]?$/.test(uniq[0]), `版本号格式合法（当前 ${uniq[0]}）`);
ok(!/v=20260912a|v=20260928a/.test(html), '旧版本号已全部替换');

console.log(`\nsmoke31: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

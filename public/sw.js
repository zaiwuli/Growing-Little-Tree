// No API caching: points and completion status must always come from the server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>成长小树 · 暂时离线</title><body style="margin:0;padding:60px 25px;background:#edf1e6;color:#293d32;font-family:sans-serif;text-align:center"><h1>小树正在等你回来</h1><p>暂时连接不到家庭服务器，请检查 Wi-Fi 和 NAS 是否在线。</p><p>联网后即可继续打卡，积分记录保存在 NAS 上。</p><button onclick="location.reload()" style="padding:14px 28px;border:0;border-radius:12px;background:#397254;color:white">重新连接</button></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

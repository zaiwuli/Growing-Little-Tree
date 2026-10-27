import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(root, 'data'), { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(root, 'data', 'growth.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
const sessions = new Map();
const date = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const load = () => JSON.parse(db.prepare('SELECT value FROM state WHERE id=1').get()?.value || 'null');
const save = state => db.prepare('INSERT INTO state VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(state));
const uid = () => randomBytes(10).toString('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (value, max = 80) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : fail('请填写有效内容');
const number = (value, min = 0, max = 1000) => Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fail('数值超出允许范围');
function tasks(s, child, day) {
  const weekday = new Date(day + 'T12:00:00+08:00').getUTCDay();
  for (const a of s.activities.filter(a => a.child === child && a.active && a.start <= day && a.days.includes(weekday))) {
    if (!s.tasks.some(t => t.activity === a.id && t.day === day)) s.tasks.push({ id: uid(), activity: a.id, child, day, title: a.title, icon: a.icon, points: a.points, period: a.period, review: a.review, status: 'todo' });
  }
  return s.tasks.filter(t => t.child === child && t.day === day);
}
const balance = (s, child) => s.ledger.filter(l => l.child === child).reduce((n, l) => n + l.amount, 0);
const frozen = (s, child) => s.redemptions.filter(r => r.child === child && r.status === 'pending').reduce((n, r) => n + r.cost, 0);
function entry(s, child, amount, reason, kind, task) { s.ledger.push({ id: uid(), child, amount, reason, kind, task, day: task ? s.tasks.find(t => t.id === task).day : date(), at: new Date().toISOString() }); }
function view(s, child) {
  const today = date();
  const list = tasks(s, child, today);
  const start = new Date(today + 'T12:00:00+08:00');
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const week = start.toISOString().slice(0, 10);
  const ledger = s.ledger.filter(l => l.child === child);
  return { family: s.family, children: s.children, child, today, tasks: list, activities: s.activities.filter(a => a.child === child), rewards: s.rewards, redemptions: s.redemptions.filter(r => r.child === child), ledger: ledger.slice().reverse(), balance: balance(s, child), frozen: frozen(s, child), earned: ledger.filter(l => ['task', 'reverse', 'bonus'].includes(l.kind)).reduce((n, l) => n + l.amount, 0), weekPoints: ledger.filter(l => l.day >= week && ['task', 'reverse'].includes(l.kind)).reduce((n, l) => n + l.amount, 0), goal: s.children.find(c => c.id === child).goal };
}
function mutate(s, action, b, parent) {
  const c = s.children.find(c => c.id === b.child) || fail('孩子不存在');
  const requireParent = () => { if (!parent) fail('请先解锁家长模式', 403); };
  if (action === 'complete') {
    const t = s.tasks.find(t => t.id === b.id && t.child === c.id) || fail('活动不存在');
    if (t.status === 'todo') { t.status = t.review && !parent ? 'pending' : 'done'; if (t.status === 'done') entry(s, c.id, t.points, t.title, 'task', t.id); }
  } else if (action === 'task') {
    const t = s.tasks.find(t => t.id === b.id && t.child === c.id) || fail('活动不存在');
    if (b.operation === 'withdraw') { if (t.status === 'pending') t.status = 'todo'; return; }
    if (b.operation !== 'undo' || t.review) requireParent();
    if (b.operation === 'approve' && t.status === 'pending') { t.status = 'done'; entry(s, c.id, t.points, t.title, 'task', t.id); }
    else if (b.operation === 'reject' && t.status === 'pending') t.status = 'todo';
    else if (b.operation === 'undo' && t.status === 'done') {
      for (const r of s.redemptions.filter(r => r.child === c.id && r.status === 'pending')) r.status = 'cancelled';
      t.status = 'todo'; entry(s, c.id, -t.points, '撤销：' + t.title, 'reverse', t.id);
    }
  } else if (action === 'activity' || action === 'edit-activity') {
    requireParent();
    const days = Array.isArray(b.days) && b.days.length && b.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6) ? b.days : fail('请选择重复日期');
    const period = text(b.period);
    if (!['早晨', '放学后', '晚上', '自由时间'].includes(period)) fail('请选择有效时段');
    const values = { title: text(b.title), icon: text(b.icon || '🌱', 8), points: number(b.points), days, period, review: !!b.review };
    if (action === 'activity') s.activities.push({ id: uid(), child: c.id, ...values, active: true, start: date() });
    else {
      const a = s.activities.find(a => a.id === b.id && a.child === c.id) || fail('活动不存在');
      Object.assign(a, values);
      const today = date(), weekday = new Date(today + 'T12:00:00+08:00').getUTCDay();
      // Only untouched tasks follow the edited schedule; submitted and completed snapshots stay intact.
      s.tasks = s.tasks.filter(t => !(t.activity === a.id && t.day === today && t.status === 'todo' && (!a.active || !days.includes(weekday))));
      for (const t of s.tasks.filter(t => t.activity === a.id && t.day === today && t.status === 'todo')) Object.assign(t, { title: a.title, icon: a.icon, points: a.points, period: a.period, review: a.review });
    }
  } else if (action === 'toggle') {
    requireParent(); const a = s.activities.find(a => a.id === b.id && a.child === c.id) || fail('活动不存在'); a.active = !a.active;
  } else if (action === 'goal') { requireParent(); c.goal = number(b.goal, 1, 100000); }
  else if (action === 'child') { requireParent(); s.children.push({ id: uid(), name: text(b.name, 20), goal: 100 }); }
  else if (action === 'bonus') { requireParent(); entry(s, c.id, number(b.points, 1), text(b.reason), 'bonus'); }
  else if (action === 'reward') { requireParent(); s.rewards.push({ id: uid(), title: text(b.title), icon: text(b.icon || '🎁', 8), cost: number(b.cost, 1, 100000) }); }
  else if (action === 'redeem') {
    const r = s.rewards.find(r => r.id === b.id) || fail('奖励不存在');
    if (balance(s, c.id) - frozen(s, c.id) < r.cost) fail('可用积分还不够，再加油！');
    s.redemptions.push({ id: uid(), child: c.id, title: r.title, icon: r.icon, cost: r.cost, status: 'pending', at: new Date().toISOString() });
  } else if (action === 'redemption') {
    requireParent(); const r = s.redemptions.find(r => r.id === b.id && r.child === c.id) || fail('申请不存在');
    if (r.status === 'pending' && b.operation === 'approve') { r.status = 'approved'; entry(s, c.id, -r.cost, '兑换：' + r.title, 'redeem'); }
    else if (r.status === 'pending' && b.operation === 'reject') r.status = 'rejected';
    else if (r.status === 'approved' && b.operation === 'deliver') r.status = 'delivered';
    else if (r.status === 'approved' && b.operation === 'refund') { r.status = 'cancelled'; entry(s, c.id, r.cost, '退款：' + r.title, 'refund'); }
  } else fail('未知操作');
}
const server = http.createServer(async (req, res) => {
  const send = (status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }); res.end(JSON.stringify(body)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
      files['/toothbrush.svg'] = ['toothbrush.svg', 'image/svg+xml'];
      for (const name of ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest', 'sw.js']) files['/' + name] = [name, name.endsWith('.png') ? 'image/png' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/javascript; charset=utf-8'];
      const file = files[url.pathname]; if (!file) return send(404, { error: '页面不存在' });
      res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); return res.end(readFileSync(path.join(root, 'public', file[0])));
    }
    let s = load();
    const token = req.headers.cookie?.match(/(?:^|; )session=([a-f0-9]+)/)?.[1];
    const session = sessions.get(token);
    const parent = session && session > Date.now();
    if (req.method === 'GET') {
      if (url.pathname === '/api/status') return send(200, { initialized: !!s, parent: !!parent });
      if (!s) return send(200, { initialized: false });
      if (url.pathname === '/api/export') { if (!parent) fail('请先解锁家长模式', 403); const { password, salt, ...backup } = s; return send(200, backup, { 'Content-Disposition': 'attachment; filename="growth-export.json"' }); }
      if (url.pathname !== '/api/state') fail('接口不存在', 404);
      const child = url.searchParams.get('child') || s.children[0].id;
      if (!s.children.some(c => c.id === child)) fail('孩子不存在');
      const result = view(s, child); save(s); return send(200, { ...result, parent: !!parent });
    }
    if (req.method !== 'POST') fail('不支持的请求方式', 405);
    if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin)) fail('请求来源不匹配', 403);
    let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 20000) fail('请求过大', 413); }
    let b; try { b = JSON.parse(raw || '{}'); } catch { fail('请求格式不正确'); }
    s = load();
    const action = url.pathname.slice(5);
    if (action === 'setup') {
      if (s) fail('已经初始化');
      const password = text(b.password, 128); if (password.length < 8) fail('家长密码至少 8 位');
      const salt = randomBytes(16).toString('hex'); const child = uid();
      s = { family: text(b.family), salt, password: scryptSync(password, salt, 64).toString('hex'), children: [{ id: child, name: text(b.name, 20), goal: 100 }], activities: [], tasks: [], rewards: [], ledger: [], redemptions: [] }; save(s);
    } else if (action === 'login') {
      if (!s) fail('请先初始化');
      const key = req.socket.remoteAddress; const attempt = attempts.get(key) || { count: 0, until: Date.now() + 60000 }; if (attempt.until < Date.now()) { attempt.count = 0; attempt.until = Date.now() + 60000; } attempts.set(key, attempt); if (++attempt.count > 8) fail('尝试次数过多，请稍后重试', 429);
      if (typeof b.password !== 'string' || b.password.length > 128 || !timingSafeEqual(scryptSync(b.password, s.salt, 64), Buffer.from(s.password, 'hex'))) fail('家长密码不正确', 403);
      attempts.delete(key); const token = uid(); sessions.set(token, Date.now() + 30 * 60000); return send(200, { ok: true }, { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800` });
    } else if (action === 'logout') { sessions.delete(token); return send(200, { ok: true }, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
    else { if (!s) fail('请先初始化'); mutate(s, action, b, parent); save(s); }
    send(200, { ok: true });
  } catch (error) { console.error(error.message); send(error.status || 500, { error: error.status ? error.message : '服务暂时出错，请重试' }); }
});
const attempts = new Map();
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('成长小树 http://' + (process.env.HOST || '127.0.0.1') + ':' + (process.env.PORT || 3000)));

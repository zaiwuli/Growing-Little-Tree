const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
let state, page = 'today', child = localStorage.getItem('child') || '', busy = false;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const renderIcon = icon => String(icon).replaceAll('\uFE0F', '') === '🪥' ? '<img src="/toothbrush.svg" alt="牙刷" style="width:1.25em;height:1.25em;vertical-align:middle">' : esc(icon);
const icons = { today: '◉', wishes: '✦', growth: '▥', manage: '⚙' };
const labels = { today: '今天', wishes: '心愿奖励', growth: '成长记录', manage: '家长管理' };
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3000); }
async function api(action, data) {
  const response = await fetch('/api/' + action, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ child, ...data }) } : {});
  const result = await response.json(); if (!response.ok) throw Error(result.error); return result;
}
async function refresh() { try { state = await api('state' + (child ? '?child=' + encodeURIComponent(child) : '')); if (state.initialized === false) return setup(); child = state.child; localStorage.setItem('child', child); render(); } catch (e) { if (child) { child = ''; return refresh(); } app.innerHTML = `<main class="onboarding"><h1>暂时无法加载</h1><p>${esc(e.message)}</p><button onclick="location.reload()">重新加载</button></main>`; } }
function setup() {
  app.innerHTML = `<main class="onboarding"><div class="brandmark"><img src="/icon.svg" alt="成长小树"></div><p class="eyebrow">GROW A LITTLE, EVERY DAY</p><h1>让好习惯，<br>慢慢长成大树。</h1><p>欢迎来到成长小树。一起约定小目标，收获每天的小进步。</p><form id="setup"><label>家庭名称<input name="family" placeholder="例如：向日葵之家" required maxlength="80"></label><label>孩子昵称<input name="name" placeholder="怎么称呼小朋友？" required maxlength="20"></label><label>设置家长密码<input name="password" type="password" minlength="8" maxlength="128" placeholder="至少 8 位，用于管理和审核" required></label><button class="primary">种下我们的第一棵树 →</button></form><small>数据保存在本机 · 无需注册外部账号</small></main>`;
  document.querySelector('#setup').onsubmit = async e => { e.preventDefault(); try { await api('setup', Object.fromEntries(new FormData(e.target))); await api('login', { password: e.target.password.value }); await refresh(); } catch (err) { toast(err.message); } };
}
function render() {
  const c = state.children.find(c => c.id === child), done = state.tasks.filter(t => t.status === 'done').length;
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="/"><img src="/icon.svg" alt=""> <span>成长小树<small>把每一份努力，都看见</small></span></a><nav>${Object.keys(labels).map(p => `<button data-page="${p}" class="nav ${page === p ? 'active' : ''}"><i>${icons[p]}</i>${labels[p]}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="mini-tree">🌱</div><p>每天一点点，<br>就是很棒的成长。</p><small>本机保存 · 家庭时区 UTC+8</small></div></aside>
  <main class="main"><header><div class="family"><img class="family-logo" src="/icon.svg" alt="成长小树">${esc(state.family)} <span>/ 我们的成长日记</span></div><div class="header-actions"><select id="children" aria-label="切换孩子">${state.children.map(c => `<option value="${c.id}" ${c.id === child ? 'selected' : ''}>🌻 ${esc(c.name)}</option>`).join('')}</select><button class="subtle" data-action="${state.parent ? 'logout' : 'login'}">${state.parent ? '🔓 退出家长模式' : '🔒 家长模式'}</button></div></header>
  <section class="page-heading"><div><p class="eyebrow">${state.today.replaceAll('-', ' / ')} · 每天进步一点点</p><h1>${page === 'today' ? `你好，${esc(c.name)} <span class="wave">☀</span>` : labels[page]}</h1><p>${page === 'today' ? '今天的小小努力，会变成明天的大大惊喜。' : page === 'wishes' ? '把期待放在这里，一点一点靠近它。' : page === 'growth' ? '每一次认真完成，都值得被记住。' : '一起约定，让每天的计划刚刚好。'}</p></div>${page === 'today' ? `<div class="date-stamp">TODAY<strong>${Number(state.today.slice(-2))}</strong>成长第 ${new Set(state.ledger.map(l => l.day)).size || 1} 天</div>` : ''}</section>
  ${page === 'today' ? today(done) : page === 'wishes' ? wishes() : page === 'growth' ? growth() : manage()}
  <footer>小树每天都在长大，你也是。 <span>GROWTH TREE / FAMILY EDITION</span></footer></main>`;
  document.querySelector('#children').onchange = e => { child = e.target.value; refresh(); };
}
function today(done) {
  const ratio = Math.min(100, Math.round(state.weekPoints / state.goal * 100));
  return `<div class="overview"><section class="hero"><div><span class="pill">✦ 这一周的成长约定</span><h2>每一分努力，<br>都在悄悄发芽。</h2><p>本周已经收获 <b>${state.weekPoints}</b> 分，${state.weekPoints >= state.goal ? '目标达成，真棒！' : `距离目标还差 ${state.goal - state.weekPoints} 分。`}</p><div class="progress"><span style="width:${ratio}%"></span></div><div class="progress-label"><span>本周积分目标</span><b>${state.weekPoints} / ${state.goal}</b></div></div><div class="tree-art"><div class="sun"></div><div class="crown c1"></div><div class="crown c2"></div><div class="crown c3"></div><div class="trunk"></div><div class="ground"></div><span class="leaf l1">✦</span><span class="leaf l2">✧</span></div></section><section class="wallet"><span class="wallet-icon">✷</span><p>我的积分小金库</p><strong>${state.balance - state.frozen}<small> 分</small></strong><span>累计收获 ${state.earned} 分${state.frozen ? ` · 待审批冻结 ${state.frozen} 分` : ''}</span><button data-page="wishes">看看我的心愿 <span>↗</span></button></section></div>
  <div class="section-title"><div><h2>今天的小任务 <span>${done}/${state.tasks.length}</span></h2><p>按照自己的节奏，一件一件完成吧</p></div>${state.parent ? '<button class="outline" data-action="activity">＋ 添加活动</button>' : ''}</div>
  ${state.tasks.length ? ['早晨', '放学后', '晚上', '自由时间'].map(period => { const list = state.tasks.filter(t => t.period === period); return list.length ? `<section class="task-group"><h3>${{ 早晨: '☀', 放学后: '☁', 晚上: '☾', 自由时间: '✧' }[period]} ${period}</h3><div class="task-grid">${list.map(taskCard).join('')}</div></section>` : ''; }).join('') : `<div class="empty"><span>🌱</span><h3>从一个小习惯开始</h3><p>请家长添加今天的活动，让第一份努力在这里发芽。</p><button class="primary" data-action="${state.parent ? 'activity' : 'login'}">${state.parent ? '添加第一个活动' : '解锁家长模式'}</button></div>`}`;
}
function taskCard(t) { return `<article class="task ${t.status}"><div class="task-icon">${renderIcon(t.icon)}</div><div class="task-copy"><h3>${esc(t.title)}</h3><p>${t.status === 'done' ? '已完成，做得很棒！' : t.status === 'pending' ? '等待家长确认' : t.review ? '完成后由家长确认' : '完成就能收获积分'}</p></div><span class="points">+${t.points}</span><button class="check" aria-label="${esc(t.title)}${t.status === 'todo' ? '，标记完成' : '，' + t.status}" data-action="complete" data-id="${t.id}" >${t.status === 'done' ? '✓' : t.status === 'pending' ? '◷' : ''}</button></article>`; }
function wishes() { return `<div class="balance-banner"><span>✷ 可用积分 <b>${state.balance - state.frozen}</b></span><small>兑换不会减少累计收获和本周进度</small></div><div class="reward-grid">${!state.rewards.length ? '<div class="empty reward-empty"><span>🎁</span><h3>心愿清单还是空的</h3><p>和家长一起约定第一份小期待吧。</p><button class="primary" data-action="' + (state.parent ? 'reward' : 'login') + '">' + (state.parent ? '添加心愿奖励' : '请家长添加奖励') + '</button></div>' : ''}${state.rewards.map(r => `<article class="reward"><div class="reward-icon">${renderIcon(r.icon)}</div><h2>${esc(r.title)}</h2><p>${r.cost} 分的美好期待</p><button class="${state.balance - state.frozen >= r.cost ? 'primary' : 'outline'}" data-action="redeem" data-id="${r.id}" ${state.balance - state.frozen < r.cost ? 'disabled' : ''}>${state.balance - state.frozen >= r.cost ? '申请兑换 →' : `还差 ${r.cost - state.balance + state.frozen} 分`}</button></article>`).join('')}</div><div class="section-title"><h2>我的兑换记录</h2></div>${redemptions(false)}`; }
function redemptions(parent) { const names = { pending: '等待家长批准', approved: '待家长兑现', delivered: '已兑现', rejected: '未通过', cancelled: '已取消' }; return state.redemptions.length ? `<div class="panel">${state.redemptions.slice().reverse().map(r => `<div class="record"><span class="record-icon">${renderIcon(r.icon)}</span><div><b>${esc(r.title)}</b><p>${names[r.status]} · ${r.cost} 分</p></div>${parent && r.status === 'pending' ? `<button data-action="redemption" data-id="${r.id}" data-op="approve">批准</button><button class="subtle" data-action="redemption" data-id="${r.id}" data-op="reject">拒绝</button>` : parent && r.status === 'approved' ? `<button data-action="redemption" data-id="${r.id}" data-op="deliver">标记兑现</button><button class="subtle" data-action="redemption" data-id="${r.id}" data-op="refund">取消退款</button>` : '<span class="record-tail">✦</span>'}</div>`).join('')}</div>` : '<div class="empty compact">还没有兑换记录，期待第一份小惊喜。</div>'; }
function growth() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(state.today + 'T12:00:00+08:00'); d.setUTCDate(d.getUTCDate() - 6 + i); const key = d.toISOString().slice(0, 10); return { day: key, points: state.ledger.filter(l => l.day === key && ['task', 'reverse'].includes(l.kind)).reduce((n, l) => n + l.amount, 0) }; });
  const max = Math.max(10, ...days.map(d => d.points));
  return `<div class="stat-grid"><div class="stat"><span>累计收获</span><strong>${state.earned}<small> 分</small></strong></div><div class="stat"><span>本周活动积分</span><strong>${state.weekPoints}<small> 分</small></strong></div><div class="stat"><span>今日完成</span><strong>${state.tasks.filter(t => t.status === 'done').length}<small> / ${state.tasks.length} 项</small></strong></div></div><section class="panel chart"><h2>最近七天的小进步</h2><div class="bars">${days.map(d => `<div class="bar-col"><b>${d.points}</b><div class="bar-track"><div style="height:${Math.max(3, d.points / max * 100)}%"></div></div><span>${d.day.slice(5).replace('-', '/')}</span></div>`).join('')}</div></section><div class="section-title"><h2>积分足迹</h2></div>${state.ledger.length ? `<div class="panel">${state.ledger.map(l => `<div class="record"><span class="record-icon">${l.amount >= 0 ? '✦' : '↗'}</span><div><b>${esc(l.reason)}</b><p>${l.day} · ${new Date(l.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p></div><strong class="record-tail ${l.amount >= 0 ? 'positive' : ''}">${l.amount > 0 ? '+' : ''}${l.amount}</strong></div>`).join('')}</div>` : '<div class="empty compact">完成第一项活动，留下你的成长足迹。</div>'}`;
}
function manage() {
  if (!state.parent) return '<div class="empty"><span>🔒</span><h2>这是家长的小园地</h2><p>解锁后可以设置活动、确认完成和管理奖励。</p><button class="primary" data-action="login">解锁家长模式</button></div>';
  return `<div class="management-actions"><button class="primary" data-action="activity">＋ 新建活动</button><button class="outline" data-action="goal">设置周目标</button><button class="outline" data-action="reward">添加奖励</button><button class="outline" data-action="child">添加孩子</button><button class="outline" data-action="bonus">鼓励加分</button><button class="outline" data-action="ai-tokens">AI 接入令牌</button><a class="button outline" href="/api/export" download>导出数据</a></div><div class="section-title"><h2>今日完成审核</h2></div><div class="panel">${state.tasks.filter(t => t.status !== 'todo').map(t => `<div class="record"><span class="record-icon">${renderIcon(t.icon)}</span><div><b>${esc(t.title)}</b><p>${t.status === 'pending' ? '待确认' : '已完成'} · ${t.points} 分</p></div>${t.status === 'pending' ? `<button data-action="task" data-id="${t.id}" data-op="approve">通过</button><button class="subtle" data-action="task" data-id="${t.id}" data-op="reject">退回</button>` : `<button class="subtle" data-action="task" data-id="${t.id}" data-op="undo">撤销完成</button>`}</div>`).join('') || '<p class="panel-empty">暂时没有待审核或已完成的活动</p>'}</div><div class="section-title"><h2>活动安排</h2><span class="muted">暂停从后续生成的任务生效</span></div><div class="panel">${state.activities.map(a => `<div class="record"><span class="record-icon">${renderIcon(a.icon)}</span><div><b>${esc(a.title)}</b><p>${a.days.map(d => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、')} · ${esc(a.period)} · ${a.points} 分 · ${a.review ? '需审核' : '直接计分'}</p></div><button class="outline" data-action="edit-activity" data-id="${a.id}">编辑</button><button class="${a.active ? 'subtle' : 'outline'}" data-action="toggle" data-id="${a.id}">${a.active ? '暂停' : '启用'}</button></div>`).join('') || '<p class="panel-empty">还没有活动，点击上方新建</p>'}</div><div class="section-title"><h2>奖励申请与兑现</h2></div>${redemptions(true)}`;
}
function dialog(title, fields, action, button = '保存') {
  modal.innerHTML = `<form id="dialog-form"><div class="dialog-heading"><h2>${title}</h2><button type="button" class="close" data-action="close" aria-label="关闭">×</button></div>${fields}<p id="form-error" role="alert"></p><button class="primary submit">${button}</button></form>`; modal.showModal();
  document.querySelector('#dialog-form').onsubmit = async e => { e.preventDefault(); const submit = e.target.querySelector('.submit'); submit.disabled = true; try { const f = new FormData(e.target); const data = Object.fromEntries(f); if (action === 'activity' || action === 'edit-activity') { data.days = f.getAll('days').map(Number); data.review = f.has('review'); } await api(action, data); modal.close(); toast(action === 'login' ? '家长模式已解锁' : '已保存'); await refresh(); } catch (error) { document.querySelector('#form-error').textContent = error.message; } finally { submit.disabled = false; } };
}
const field = (label, name, placeholder = '', type = 'text', value = '') => `<label>${label}<input name="${name}" type="${type}" placeholder="${placeholder}" value="${esc(value)}" required ${type === 'number' ? `min="${name === 'points' ? 0 : 1}" max="${name === 'points' ? 1000 : 100000}"` : 'maxlength="80"'}></label>`;
function iconPicker(selected, reward = false) {
  const groups = [
    ['学习阅读', [['📖','阅读'],['📚','书籍'],['📘','预习'],['✏️','写作业'],['🎒','学习用品'],['🎨','绘画'],['🎵','音乐'],['🧩','益智']]],
    ['生活习惯', [['🍽️','吃饭'],['🥣','早餐'],['🌙','睡眠'],['☀️','早起'],['🪥','刷牙'],['🧼','洗脸洗手'],['👕','穿衣'],['🧺','收拾衣物']]],
    ['运动家务', [['🥊','搏击'],['⚽','足球'],['🏃','跑步'],['🚴','骑行'],['🌳','户外'],['🧹','打扫'],['🏡','家务'],['🧸','整理玩具']]],
    ['礼貌与成长', [['👋','打招呼'],['🤝','礼貌'],['🌻','友爱'],['❤️','关爱家人'],['🌱','好习惯'],['⭐','努力'],['📺','电视'],['🎁','奖励']]]
  ];
  const rewardGroups = [
    ['出游与体验', [['🎬','看电影'],['🎡','游乐园'],['🎠','旋转木马'],['🎢','过山车'],['🏕️','露营'],['🧺','野餐'],['🏖️','海边玩'],['🚌','出去玩']]],
    ['礼物与爱好', [['🧸','买玩具'],['🚗','玩具汽车'],['🧩','拼图'],['🎨','画画'],['📚','买新书'],['🎮','游戏时间'],['🎵','音乐'],['🎁','神秘礼物']]],
    ['美食与陪伴', [['🍦','冰淇淋'],['🍰','小蛋糕'],['🍕','吃披萨'],['🍿','爆米花'],['🧁','一起烘焙'],['🍓','采摘水果'],['🚲','亲子骑行'],['⚽','一起踢球']]],
    ['特别的小期待', [['🐼','动物园'],['🐠','水族馆'],['🚂','坐小火车'],['🎈','家庭派对'],['🏊','去游泳'],['🪁','放风筝'],['🔭','探索科学'],['⭐','自选奖励']]]
  ];
  if (reward) groups.unshift(...rewardGroups);
  if (!groups.some(([, items]) => items.some(([icon]) => icon === selected))) groups.unshift(['当前图标', [[selected, '原有图标']]]);
  return `<fieldset class="icon-picker"><legend>选择${reward ? '奖励' : '活动'}图标</legend>${groups.map(([title, items]) => `<div class="icon-category">${title}</div><div class="icon-options">${items.map(([icon, label]) => `<label class="icon-option"><input type="radio" name="icon" value="${esc(icon)}" ${icon === selected ? 'checked' : ''} required><span><b>${renderIcon(icon)}</b><small>${label}</small></span></label>`).join('')}</div>`).join('')}</fieldset>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-page], [data-action]'); if (!el) return;
  if (el.dataset.page) { page = el.dataset.page; render(); window.scrollTo(0, 0); return; }
  let a = el.dataset.action;
  let operation = el.dataset.op;
  if (a === 'ai-tokens') return showAITokens();
  if (a === 'revoke-ai-token') { if (!confirm('撤销后使用此令牌的 AI 将立即失去访问权限，确定撤销？')) return; try { await api('ai-token-revoke', {id: el.dataset.id}); await showAITokens(); } catch (error) { toast(error.message); } return; }
  if (a === 'close') return modal.close();
  if (a === 'login') return dialog('进入家长模式', field('家长密码', 'password', '输入初始化时设置的密码', 'password'), 'login', '解锁');
  if (a === 'activity' || a === 'edit-activity') {
    const item = a === 'edit-activity' ? state.activities.find(item => item.id === el.dataset.id) : { title: '', icon: '📖', points: 10, period: '早晨', days: [0,1,2,3,4,5,6], review: true };
    return dialog(a === 'activity' ? '种下一个好习惯' : '修改活动安排', (item.id ? '<input type="hidden" name="id" value="' + item.id + '">' : '') + field('活动名称', 'title', '例如：自主阅读 15 分钟', 'text', item.title) + iconPicker(item.icon) + field('完成积分（0～1000）', 'points', '', 'number', item.points) + '<label>安排时段<select name="period">' + ['早晨', '放学后', '晚上', '自由时间'].map(p => '<option' + (p === item.period ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></label><fieldset><legend>重复日期</legend><div class="weekdays">' + [1,2,3,4,5,6,0].map(d => '<label><input type="checkbox" name="days" value="' + d + '"' + (item.days.includes(d) ? ' checked' : '') + '><span>' + ['日','一','二','三','四','五','六'][d] + '</span></label>').join('') + '</div></fieldset><label class="checkbox-label"><input name="review" type="checkbox"' + (item.review ? ' checked' : '') + '>完成后需要家长确认</label>' + (item.id ? '<p class="muted">修改会更新今天未完成的任务及以后安排；待审核、已完成的任务保留原内容与积分。</p>' : ''), a);
  }
  if (a === 'goal') return dialog('这周的小目标', field('本周活动积分目标', 'goal', '', 'number', state.goal), 'goal');
  if (a === 'child') return dialog('欢迎新的小树苗', field('孩子昵称', 'name', '输入昵称'), 'child');
  if (a === 'bonus') return dialog('给努力一点鼓励', field('鼓励积分', 'points', '', 'number', 5) + field('鼓励的原因', 'reason', '例如：主动帮助家人'), 'bonus');
  if (a === 'reward') return dialog('添加一份小期待', field('奖励名称', 'title', '例如：周末一起做蛋糕') + iconPicker('🎁', true) + field('需要积分', 'cost', '', 'number', 50), 'reward');
  if (a === 'complete') {
    const task = state.tasks.find(t => t.id === el.dataset.id);
    if (task.status === 'pending') { a = 'task'; operation = 'withdraw'; }
    else if (task.status === 'done') {
      if (task.review && !state.parent) return toast('这项活动已由家长确认，请家长帮忙修改');
      a = 'task'; operation = 'undo';
    }
  }
  if (a === 'redeem' && !confirm('申请这份奖励吗？所需积分将冻结，等待家长批准。')) return;
  if (a === 'task' && operation === 'undo') { const t = state.tasks.find(t => t.id === el.dataset.id); if (!confirm('取消完成并扣回 ' + t.points + ' 分？待审批的兑换申请也会取消。')) return; }
  if (busy) return; busy = true; el.disabled = true;
  try { await api(a, { id: el.dataset.id, operation }); toast(operation === 'withdraw' ? '已取消提交，积分未变化' : operation === 'undo' ? '已取消完成并扣回积分' : a === 'complete' ? '又前进了一小步！' : a === 'redeem' ? '已申请，等待家长确认' : '操作成功'); await refresh(); } catch (err) { toast(err.message); el.disabled = false; } finally { busy = false; }
});
if (new URLSearchParams(location.search).has('phone-preview')) {
  document.body.innerHTML = `<style>body{margin:0;background:radial-gradient(ellipse at 50% 30%,#edf1e6,#dce3d5);min-height:100dvh;display:grid;place-items:center;padding:28px 16px;font-family:var(--sans)}.preview-wrap{text-align:center}.preview-label{font-size:12px;letter-spacing:2px;color:#698065;margin:0 0 18px}.phone-frame{width:406px;height:min(850px,calc(100dvh - 110px));border:8px solid #293d32;border-radius:36px;overflow:hidden;background:#f8f8f2;box-shadow:0 25px 65px #293d322b}iframe{width:390px;height:100%;border:0;display:block}.preview-note{font-size:11px;color:#698065;margin:14px 0 0}@media(max-width:440px){body{padding:0}.preview-label,.preview-note{display:none}.phone-frame{border:0;border-radius:0;width:100vw;height:100dvh}iframe{width:100%;height:100%}}</style><main class="preview-wrap"><p class="preview-label">成长小树 · 手机端预览 · 390 PX</p><div class="phone-frame"><iframe src="/" title="成长小树手机界面"></iframe></div><p class="preview-note">真实页面，可点击操作与上下滚动</p></main>`;
} else refresh();

if ('serviceWorker' in navigator && window.isSecureContext) { navigator.serviceWorker.register('/sw.js').catch(() => {}); }

async function showAITokens() {
  try {
    const { tokens } = await api('ai-tokens');
    modal.innerHTML = '<div class="dialog-heading"><h2>AI 接入令牌</h2><button class="close" data-action="close">×</button></div><p class="muted">只读可查询全部孩子数据；管理可修改活动、积分、目标和奖励。令牌最长有效 365 天。</p><form id="token-form">' + field('令牌名称','name','例如：家庭 AI 助手') + '<label>权限<select name="scope"><option value="read">只读查询（推荐）</option><option value="manage">管理：含计分、审核与兑换</option></select></label>' + field('有效天数','days','','number',90) + '<button class="primary">创建令牌</button><p id="token-error" role="alert"></p></form><div id="token-secret"></div><div class="panel">' + tokens.map(t => '<div class="record"><div><b>' + esc(t.name) + '</b><p>' + (t.scope === 'read' ? '只读' : '管理') + ' · 到期 ' + t.expiresAt.slice(0,10) + (t.revokedAt ? ' · 已撤销' : '') + '</p></div>' + (!t.revokedAt ? '<button class="subtle" data-action="revoke-ai-token" data-id="' + t.id + '">撤销</button>' : '') + '</div>').join('') + '</div>';
    if (!modal.open) modal.showModal();
    document.querySelector('#token-form').onsubmit = async event => {
      event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
      try {
        const result = await api('ai-token-create', Object.fromEntries(new FormData(event.target)));
        document.querySelector('#token-secret').innerHTML = '<p><b>令牌仅显示这一次，请立即保存</b></p><textarea readonly aria-label="新建的 AI 访问令牌" style="width:100%;min-height:90px;overflow-wrap:anywhere"></textarea><p class="muted">请勿放入网址或公开分享。关闭后只能撤销并重新创建。</p>';
        document.querySelector('#token-secret textarea').value = result.token;
        document.querySelector('#token-secret textarea').select();
        button.textContent = '已创建，关闭后可查看列表';
      } catch(error) { document.querySelector('#token-error').textContent = error.message; button.disabled = false; }
    };
  } catch(error) { toast(error.message); }
}

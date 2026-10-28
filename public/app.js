const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
let childSlot = location.pathname.match(/^\/([1-9]\d*)$/)?.[1] || '';
if (childSlot) document.querySelector('link[rel="manifest"]').href = '/manifest.webmanifest?slot=' + childSlot;
let growthTab = 'map';
let state, page = 'today', child = localStorage.getItem('child') || '', busy = false, managementTab = 'review', historyDay = '', historyData = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const renderIcon = icon => String(icon).replaceAll('\uFE0F', '') === '🪥' ? '<img src="/toothbrush.svg" alt="牙刷" style="width:1.25em;height:1.25em;vertical-align:middle">' : esc(icon);
const icons = { today: '◉', wishes: '✦', growth: '▥', profile: '☻' };
const labels = { today: '今天', wishes: '心愿奖励', growth: '成长记录', profile: '我的' };
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3000); }
let lastParentActivity = 0;
async function renewParentSession() {
  if (!state?.parent || page !== 'manage' || Date.now() - lastParentActivity < 60000) return;
  lastParentActivity = Date.now();
  try { await api('parent-session', {}); } catch (error) { toast(error.message); }
}
for (const event of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(event, renewParentSession, { passive: true, capture: true });
async function api(action, data) {
  const response = await fetch('/api/' + action, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ child, ...data }) } : {});
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 403 && result.error === '请先解锁家长模式' && state?.parent) {
      state.parent = false; page = 'profile'; if (modal.open) modal.close(); render();
      throw Error('家长登录已过期或服务已重启，请从“我的”重新进入家长控制');
    }
    throw Error(result.error);
  }
  return result;
}
async function refresh() { try { state = await api('state' + (childSlot ? '?slot=' + childSlot : child ? '?child=' + encodeURIComponent(child) : '')); if (state.initialized === false) return setup(); child = state.child; localStorage.setItem('child', child); render(); } catch (e) { if (child && !childSlot) { child = ''; return refresh(); } app.innerHTML = `<main class="onboarding"><h1>暂时无法加载</h1><p>${esc(e.message)}</p><button onclick="location.reload()">重新加载</button></main>`; } }
function setup() {
  app.innerHTML = `<main class="onboarding"><div class="brandmark"><img src="/icon.svg" alt="成长小树"></div><p class="eyebrow">GROW A LITTLE, EVERY DAY</p><h1>让好习惯，<br>慢慢长成大树。</h1><p>欢迎来到成长小树。一起约定小目标，收获每天的小进步。</p><form id="setup"><label>家庭名称<input name="family" placeholder="例如：向日葵之家" required maxlength="80"></label><label>孩子昵称<input name="name" placeholder="怎么称呼小朋友？" required maxlength="20"></label><label>设置家长密码<input name="password" type="password" minlength="8" maxlength="128" placeholder="至少 8 位，用于管理和审核" required></label><button class="primary">种下我们的第一棵树 →</button></form><small>数据保存在本机 · 无需注册外部账号</small></main>`;
  document.querySelector('#setup').onsubmit = async e => { e.preventDefault(); try { await api('setup', Object.fromEntries(new FormData(e.target))); await api('login', { password: e.target.password.value }); await refresh(); } catch (err) { toast(err.message); } };
}
function render() {
  const c = state.children.find(c => c.id === child), done = state.tasks.filter(t => t.status === 'done').length;
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="/"><img src="/icon.svg" alt=""> <span>成长小树<small>把每一份努力，都看见</small></span></a><nav>${Object.keys(labels).map(p => `<button data-page="${p}" class="nav ${page === p ? 'active' : ''}"><i>${icons[p]}</i>${labels[p]}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="mini-tree">🌱</div><p>每天一点点，<br>就是很棒的成长。</p><small>本机保存 · 家庭时区 UTC+8</small></div></aside>
  <main class="main"><header><div class="family"><img class="family-logo" src="/icon.svg" alt="成长小树">${esc(state.family)} <span>/ 我们的成长日记</span></div><div class="header-actions"><select id="children" aria-label="切换孩子">${state.children.map(c => `<option value="${c.id}" ${c.id === child ? 'selected' : ''}>🌻 ${esc(c.name)}</option>`).join('')}</select></div></header>
  <section class="page-heading"><div><p class="eyebrow">${state.today.replaceAll('-', ' / ')} · 每天进步一点点</p><h1>${page === 'today' ? `你好，${esc(c.name)} <span class="wave">☀</span>` : page === 'manage' ? '家长管理' : labels[page]}</h1><p>${page === 'today' ? '今天的小小努力，会变成明天的大大惊喜。' : page === 'wishes' ? '把期待放在这里，一点一点靠近它。' : page === 'growth' ? '每一次认真完成，都值得被记住。' : '一起约定，让每天的计划刚刚好。'}</p></div>${page === 'today' ? `<div class="date-stamp">TODAY<strong>${Number(state.today.slice(-2))}</strong>成长第 ${new Set(state.ledger.map(l => l.day)).size || 1} 天</div>` : ''}</section>
  ${page === 'today' ? today(done) : page === 'wishes' ? wishes() : page === 'growth' ? growth() : page === 'manage' ? manage() : profile()}
  <footer>小树每天都在长大，你也是。 <span>GROWTH TREE / FAMILY EDITION</span></footer></main>`;
  document.querySelector('#children').onchange = async e => { child = e.target.value; if(childSlot) { childSlot = String(state.children.findIndex(c => c.id === child) + 1); history.replaceState(null, '', '/' + childSlot); } historyData = null; await refresh(); if(page === 'manage' && managementTab === 'history') await loadHistory(); };
}
function today(done) {
  const ratio = Math.min(100, Math.round(state.weekPoints / state.goal * 100));
  return `${adventureCard()}<div class="overview"><section class="hero"><div><span class="pill">✦ 这一周的成长约定</span><h2>每一分努力，<br>都在悄悄发芽。</h2><p>本周已经收获 <b>${state.weekPoints}</b> 分，${state.weekPoints >= state.goal ? '目标达成，真棒！' : `距离目标还差 ${state.goal - state.weekPoints} 分。`}</p><div class="progress"><span style="width:${ratio}%"></span></div><div class="progress-label"><span>本周积分目标</span><b>${state.weekPoints} / ${state.goal}</b></div></div><div class="tree-art"><div class="sun"></div><div class="crown c1"></div><div class="crown c2"></div><div class="crown c3"></div><div class="trunk"></div><div class="ground"></div><span class="leaf l1">✦</span><span class="leaf l2">✧</span></div></section><section class="wallet"><span class="wallet-icon">✷</span><p>我的积分小金库</p><strong>${state.balance - state.frozen}<small> 分</small></strong><span>累计收获 ${state.earned} 分${state.frozen ? ` · 待审批冻结 ${state.frozen} 分` : ''}</span><button data-page="wishes">看看我的心愿 <span>↗</span></button></section></div>
  <div class="section-title"><div><h2>今天的小任务 <span>${done}/${state.tasks.length}</span></h2><p>按照自己的节奏，一件一件完成吧</p></div></div>
  ${state.tasks.length ? ['早晨', '放学后', '晚上', '自由时间'].map(period => { const list = state.tasks.filter(t => t.period === period); return list.length ? `<section class="task-group"><h3>${{ 早晨: '☀', 放学后: '☁', 晚上: '☾', 自由时间: '✧' }[period]} ${period}</h3><div class="task-grid">${list.map(taskCard).join('')}</div></section>` : ''; }).join('') : `<div class="empty"><span>🌱</span><h3>从一个小习惯开始</h3><p>今天还没有安排，和家长一起约定一个小习惯吧。</p></div>`}`;
}
function taskCard(t) {
 const names = {todo:'未完成',pending:'待确认',done:'已完成'};
 const hint = t.status === 'todo' ? '点击标记完成' : t.status === 'pending' ? '点击撤回提交' : t.review && !state.parent ? '请家长修改' : '点击取消完成';
 const check = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 return '<article class="task '+t.status+'"><div class="task-icon">'+renderIcon(t.icon)+'</div><div class="task-copy"><h3>'+esc(t.title)+'</h3><p>'+(t.status === 'done' ? '已确认，积分已到账' : t.status === 'pending' ? '已提交，等待家长确认' : t.review ? '完成后由家长确认' : '完成就能收获积分')+'</p></div><span class="points">+'+t.points+'</span><div class="task-state"><button class="check" aria-label="'+esc(t.title)+'，'+names[t.status]+'，'+hint+'" aria-pressed="'+(t.status !== 'todo')+'" data-action="complete" data-id="'+t.id+'">'+(t.status !== 'todo' ? check : '')+'</button><span class="state-caption">'+names[t.status]+'</span></div></article>';
}
function wishes() { return `<div class="balance-banner"><span>✷ 可用积分 <b>${state.balance - state.frozen}</b></span><small>兑换不会减少累计收获和本周进度</small></div><div class="section-title"><div><h2>我的小小心愿</h2><p>自己许愿，和家长一起约定需要的积分</p></div><button class="primary" data-action="wish">＋ 许个心愿</button></div>${wishList(false)}<div class="section-title"><h2>可以兑换的奖励</h2></div><div class="reward-grid">${!state.rewards.length ? '<div class="empty reward-empty"><span>🎁</span><h3>写下你的第一个心愿</h3><p>想去哪里，想做什么？让家长听听你的期待。</p></div>' : ''}${state.rewards.map(r => `<article class="reward"><div class="reward-icon">${renderIcon(r.icon)}</div><h2>${esc(r.title)}</h2><p>${r.cost} 分的美好期待</p><button class="${state.balance - state.frozen >= r.cost ? 'primary' : 'outline'}" data-action="redeem" data-id="${r.id}" ${state.balance - state.frozen < r.cost ? 'disabled' : ''}>${state.balance - state.frozen >= r.cost ? '申请兑换 →' : `还差 ${r.cost - state.balance + state.frozen} 分`}</button></article>`).join('')}</div><div class="section-title"><h2>我的兑换记录</h2></div>${redemptions(false)}`; }
function redemptions(parent) { const names = { pending: '等待家长批准', approved: '待家长兑现', delivered: '已兑现', rejected: '未通过', cancelled: '已取消' }; return state.redemptions.length ? `<div class="panel">${state.redemptions.slice().reverse().map(r => `<div class="record"><span class="record-icon">${renderIcon(r.icon)}</span><div><b>${esc(r.title)}</b><p>${names[r.status]} · ${r.cost} 分</p></div>${parent && r.status === 'pending' ? `<button data-action="redemption" data-id="${r.id}" data-op="approve">批准</button><button class="subtle" data-action="redemption" data-id="${r.id}" data-op="reject">拒绝</button>` : parent && r.status === 'approved' ? `<button data-action="redemption" data-id="${r.id}" data-op="deliver">标记兑现</button><button class="subtle" data-action="redemption" data-id="${r.id}" data-op="refund">取消退款</button>` : '<span class="record-tail">✦</span>'}</div>`).join('')}</div>` : '<div class="empty compact">还没有兑换记录，期待第一份小惊喜。</div>'; }
function pointsHistory() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(state.today + 'T12:00:00+08:00'); d.setUTCDate(d.getUTCDate() - 6 + i); const key = d.toISOString().slice(0, 10); return { day: key, points: state.ledger.filter(l => l.day === key && ['task', 'reverse'].includes(l.kind)).reduce((n, l) => n + l.amount, 0) }; });
  const max = Math.max(10, ...days.map(d => d.points));
  return `<div class="stat-grid"><div class="stat"><span>累计收获</span><strong>${state.earned}<small> 分</small></strong></div><div class="stat"><span>本周活动积分</span><strong>${state.weekPoints}<small> 分</small></strong></div><div class="stat"><span>今日完成</span><strong>${state.tasks.filter(t => t.status === 'done').length}<small> / ${state.tasks.length} 项</small></strong></div></div><section class="panel chart"><h2>最近七天的小进步</h2><div class="bars">${days.map(d => `<div class="bar-col"><b>${d.points}</b><div class="bar-track"><div style="height:${Math.max(3, d.points / max * 100)}%"></div></div><span>${d.day.slice(5).replace('-', '/')}</span></div>`).join('')}</div></section><div class="section-title"><h2>积分足迹</h2></div>${state.ledger.length ? `<div class="panel">${state.ledger.map(l => `<div class="record"><span class="record-icon">${l.amount >= 0 ? '✦' : '↗'}</span><div><b>${esc(l.reason)}</b><p>${l.day} · ${new Date(l.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p></div><strong class="record-tail ${l.amount >= 0 ? 'positive' : ''}">${l.amount > 0 ? '+' : ''}${l.amount}</strong></div>`).join('')}</div>` : '<div class="empty compact">完成第一项活动，留下你的成长足迹。</div>'}`;
}
function legacyManage() {
  if (!state.parent) return profile();
  return `<div class="management-actions"><button class="primary" data-action="activity">＋ 新建活动</button><button class="outline" data-action="goal">设置周目标</button><button class="outline" data-action="reward">添加奖励</button><button class="outline" data-action="child">添加孩子</button><button class="outline" data-action="bonus">鼓励加分</button><button class="outline" data-action="ai-tokens">AI 接入令牌</button><a class="button outline" href="/api/export" download>导出数据</a></div><div class="section-title"><h2>心愿审批</h2></div>${wishList(true)}<div class="section-title"><h2>今日完成审核</h2></div><div class="panel">${state.tasks.filter(t => t.status !== 'todo').map(t => `<div class="record"><span class="record-icon">${renderIcon(t.icon)}</span><div><b>${esc(t.title)}</b><p>${t.status === 'pending' ? '待确认' : '已完成'} · ${t.points} 分</p></div>${t.status === 'pending' ? `<button data-action="task" data-id="${t.id}" data-op="approve">通过</button><button class="subtle" data-action="task" data-id="${t.id}" data-op="reject">退回</button>` : `<button class="subtle" data-action="task" data-id="${t.id}" data-op="undo">撤销完成</button>`}</div>`).join('') || '<p class="panel-empty">暂时没有待审核或已完成的活动</p>'}</div><div class="section-title"><h2>活动安排</h2><span class="muted">暂停从后续生成的任务生效</span></div><div class="panel">${state.activities.map((a, index) => `<div class="record activity-record"><span class="record-icon">${renderIcon(a.icon)}</span><div><b>${esc(a.title)}</b><p>${a.days.map(d => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、')} · ${esc(a.period)} · ${a.points} 分 · ${a.review ? '需审核' : '直接计分'}</p></div><div class="activity-sort"><button class="outline" aria-label="上移 ${esc(a.title)}" data-action="move-activity" data-direction="up" data-id="${a.id}" ${index === 0 ? 'disabled' : ''}>↑ 上移</button><button class="outline" aria-label="下移 ${esc(a.title)}" data-action="move-activity" data-direction="down" data-id="${a.id}" ${index === state.activities.length - 1 ? 'disabled' : ''}>↓ 下移</button></div><button class="outline" data-action="edit-activity" data-id="${a.id}">编辑</button><button class="${a.active ? 'subtle' : 'outline'}" data-action="toggle" data-id="${a.id}">${a.active ? '暂停' : '启用'}</button><button class="subtle danger" data-action="delete-activity" data-id="${a.id}">删除</button></div>`).join('') || '<p class="panel-empty">还没有活动，点击上方新建</p>'}</div><div class="section-title"><h2>奖励管理</h2></div><div class="panel">${state.rewards.map(r => `<div class="record"><span class="record-icon">${renderIcon(r.icon)}</span><div><b>${esc(r.title)}</b><p>${r.cost} 分</p></div><button class="subtle danger" data-action="delete-reward" data-id="${r.id}">删除</button></div>`).join('') || '<p class="panel-empty">还没有奖励</p>'}</div><div class="section-title"><h2>奖励申请与兑现</h2></div>${redemptions(true)}`;
}
function dialog(title, fields, action, button = '保存') {
  modal.innerHTML = `<form id="dialog-form"><div class="dialog-heading"><h2>${title}</h2><button type="button" class="close" data-action="close" aria-label="关闭">×</button></div>${fields}<p id="form-error" role="alert"></p><button class="primary submit">${button}</button></form>`; modal.showModal();
  document.querySelector('#dialog-form').onsubmit = async e => { e.preventDefault(); const submit = e.target.querySelector('.submit'); submit.disabled = true; try { const f = new FormData(e.target); const data = Object.fromEntries(f); if (action === 'activity' || action === 'edit-activity') { data.days = f.getAll('days').map(Number); data.review = f.has('review'); } await api(action, data); if (action === 'login') page = 'manage'; modal.close(); toast(action === 'login' ? '家长模式已解锁' : '已保存'); await refresh(); } catch (error) { document.querySelector('#form-error').textContent = error.message; } finally { submit.disabled = false; } };
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
  return `<fieldset class="icon-picker"><legend>选择${reward ? '奖励' : '活动'}图标</legend><details class="icon-dropdown"><summary><span class="selected-icon">${renderIcon(selected)}</span><span>点击选择图标</span><span class="icon-chevron">⌄</span></summary><div class="icon-dropdown-content">${groups.map(([title, items]) => `<div class="icon-category">${title}</div><div class="icon-options">${items.map(([icon, label]) => `<label class="icon-option"><input type="radio" name="icon" value="${esc(icon)}" ${icon === selected ? 'checked' : ''} required><span><b>${renderIcon(icon)}</b><small>${label}</small></span></label>`).join('')}</div>`).join('')}</div></details></fieldset>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-page], [data-action]'); if (!el) return;
  if (el.dataset.page) { if (el.dataset.page === 'manage' && !state.parent) { page = 'profile'; return dialog('进入家长管理', field('家长密码', 'password', '输入家长密码', 'password'), 'login', '解锁'); } page = el.dataset.page; render(); window.scrollTo(0, 0); return; }
  let a = el.dataset.action;
  let operation = el.dataset.op;
  if (a === 'ai-tokens') return showAITokens();
  if (a === 'delete-ai-token') { if (!confirm('删除这条令牌记录？此前的业务操作记录仍会保留。')) return; try { await api('ai-token-delete', {id:el.dataset.id}); await showAITokens(); toast('令牌记录已删除'); } catch(error) { toast(error.message); } return; }
  if (a === 'revoke-ai-token') { if (!confirm('撤销后使用此令牌的 AI 将立即失去访问权限，确定撤销？')) return; try { await api('ai-token-revoke', {id: el.dataset.id}); await showAITokens(); } catch (error) { toast(error.message); } return; }
  if (a === 'management-tab') { managementTab = el.dataset.tab; render(); if (managementTab === 'history') await loadHistory(); return; }
  if (a === 'history-query') { historyDay = document.querySelector('#history-day').value; return loadHistory(); }
  if (a === 'history-task') { if (operation !== 'undo' && !confirm('确认修改该日审核状态？')) return; try { await api('task',{id:el.dataset.id,operation}); await refresh(); await loadHistory(); toast(operation === 'undo' ? '已取消完成并扣回积分' : '审核状态已更新'); } catch(error){toast(error.message)} return; }
  if(a === 'save-adventure') { const segments=[...document.querySelectorAll('.segment-input')].map(input=>Number(input.value)); if(!segments.every(n=>Number.isInteger(n)&&n>=1&&n<=100000))return toast('每段请填写 1～100000 的整数'); try{await api('adventure-settings',{segments,includeBonus:document.querySelector('#adventure-include-bonus').checked}); await refresh(); toast('当前孩子的闯关门槛已保存');}catch(error){toast(error.message)}return; }
  if(a === 'point-planner'){openPointPlanner();return;}
  if(a === 'calculate-plan'){await calculatePointPlan();return;}
  if(a === 'apply-plan'){if(!pointPlanInput)return;try{await api('apply-point-plan',pointPlanInput);modal.close();await refresh();toast('建议积分已应用，已完成记录不变');}catch(error){toast(error.message)}return;}
  if (a === 'growth-tab') {growthTab=el.dataset.tab;render();return;}
  if (a === 'explore') {page='growth';growthTab='map';render();window.scrollTo(0,0);return;}
  if (a === 'scene-preview') {openScene(el.dataset.id);return;}
  if(a === 'discovery'){openDiscovery(el.dataset.scene,Number(el.dataset.node));return;}
  if(a === 'select-scene'){try{await api('adventure-scene',{scene:el.dataset.id});modal.close();await refresh();toast('首页场景已更新');}catch(error){toast(error.message)}return;}
  if (a === 'close') return modal.close();
  if (a === 'login') return dialog('进入家长模式', field('家长密码', 'password', '输入初始化时设置的密码', 'password'), 'login', '解锁');
  if (a === 'activity' || a === 'edit-activity') {
    const item = a === 'edit-activity' ? state.activities.find(item => item.id === el.dataset.id) : { title: '', icon: '📖', points: 10, period: '早晨', days: [0,1,2,3,4,5,6], review: true };
    return dialog(a === 'activity' ? '种下一个好习惯' : '修改活动安排', (item.id ? '<input type="hidden" name="id" value="' + item.id + '">' : '') + field('活动名称', 'title', '例如：自主阅读 15 分钟', 'text', item.title) + iconPicker(item.icon) + field('完成积分（0～1000）', 'points', '', 'number', item.points) + '<label>安排时段<select name="period">' + ['早晨', '放学后', '晚上', '自由时间'].map(p => '<option' + (p === item.period ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></label><fieldset><legend>重复日期</legend><div class="weekdays">' + [1,2,3,4,5,6,0].map(d => '<label><input type="checkbox" name="days" value="' + d + '"' + (item.days.includes(d) ? ' checked' : '') + '><span>' + ['日','一','二','三','四','五','六'][d] + '</span></label>').join('') + '</div></fieldset><label class="checkbox-label"><input name="review" type="checkbox"' + (item.review ? ' checked' : '') + '>完成后需要家长确认</label>' + (item.id ? '<p class="muted">修改会更新今天未完成的任务及以后安排；待审核、已完成的任务保留原内容与积分。</p>' : ''), a);
  }
  if (a === 'wish' || a === 'edit-wish') {
    const wish = a === 'edit-wish' ? state.wishes.find(w => w.id === el.dataset.id) : {title:'',icon:'🎁',note:''};
    return dialog(a === 'wish' ? '许一个小心愿' : '修改我的心愿', (wish.id ? '<input type="hidden" name="id" value="' + wish.id + '">' : '') + field('我想要的心愿','title','例如：周末去游乐园','text',wish.title) + iconPicker(wish.icon,true) + '<label>想对家长说的话（选填）<textarea name="note" maxlength="300" placeholder="为什么想实现这个心愿？">' + esc(wish.note) + '</textarea></label><p class="muted">提交后由家长回应并约定积分，现在不会扣分。</p>', a, '提交心愿');
  }
  if (a === 'approve-wish' || a === 'reject-wish') {
    const wish = state.wishes.find(w => w.id === el.dataset.id);
    return dialog(a === 'approve-wish' ? '同意心愿并设置积分' : '回应这个心愿', '<input type="hidden" name="id" value="' + wish.id + '"><input type="hidden" name="operation" value="' + (a === 'approve-wish' ? 'approve' : 'reject') + '">' + (a === 'approve-wish' ? field('心愿名称','title','','text',wish.title) + field('兑换所需积分','cost','','number',50) : field('给孩子的解释','reason','写下暂时不能实现的原因')), 'review-wish', '确认');
  }
  if (a === 'withdraw-wish' && !confirm('撤回这个尚未审批的心愿？')) return;
  if (a === 'deduct') return dialog('记录一次扣分', field('扣除积分','points','','number',5) + field('扣分原因','reason','请写清楚具体原因'), 'deduct');
  if (a === 'auto-approve') { try { await api('auto-approve',{enabled:!state.settings?.autoApprove?.enabled}); await refresh(); toast('定时审核设置已保存'); } catch(error){toast(error.message)} return; }
  if (a === 'edit-family') return dialog('修改家庭名称', field('家庭名称','family','','text',state.family), 'edit-family');
  if (a === 'edit-child') return dialog('修改孩子姓名', '<input type="hidden" name="child" value="' + el.dataset.id + '">' + field('孩子姓名','name','','text',state.children.find(c => c.id === el.dataset.id).name), 'edit-child');
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
  if (a === 'delete-activity' && !confirm('删除此活动？今天未完成的任务会移除，待审核、已完成和积分记录保留。')) return;
  if (a === 'delete-reward' && !confirm('删除此奖励？之后不能新申请兑换，已有兑换记录和待处理申请保留。')) return;
  if (a === 'redeem' && !confirm('申请这份奖励吗？所需积分将冻结，等待家长批准。')) return;
  if (a === 'task' && operation === 'undo' && !state.parent) { const t = state.tasks.find(t => t.id === el.dataset.id); if (!confirm('取消完成并扣回 ' + t.points + ' 分？待审批的兑换申请也会取消。')) return; }
  if (busy) return; busy = true; el.disabled = true;
  try { await api(a, { id: el.dataset.id, operation, direction: el.dataset.direction }); if (a === 'logout') page = 'profile'; toast(operation === 'withdraw' ? '已取消提交，积分未变化' : operation === 'undo' ? '已取消完成并扣回积分' : a === 'complete' ? '又前进了一小步！' : a === 'redeem' ? '已申请，等待家长确认' : '操作成功'); await refresh(); } catch (err) { toast(err.message); el.disabled = false; } finally { busy = false; }
});
if (new URLSearchParams(location.search).has('phone-preview')) {
  document.body.innerHTML = `<style>body{margin:0;background:radial-gradient(ellipse at 50% 30%,#edf1e6,#dce3d5);min-height:100dvh;display:grid;place-items:center;padding:28px 16px;font-family:var(--sans)}.preview-wrap{text-align:center}.preview-label{font-size:12px;letter-spacing:2px;color:#698065;margin:0 0 18px}.phone-frame{width:406px;height:min(850px,calc(100dvh - 110px));border:8px solid #293d32;border-radius:36px;overflow:hidden;background:#f8f8f2;box-shadow:0 25px 65px #293d322b}iframe{width:390px;height:100%;border:0;display:block}.preview-note{font-size:11px;color:#698065;margin:14px 0 0}@media(max-width:440px){body{padding:0}.preview-label,.preview-note{display:none}.phone-frame{border:0;border-radius:0;width:100vw;height:100dvh}iframe{width:100%;height:100%}}</style><main class="preview-wrap"><p class="preview-label">成长小树 · 手机端预览 · 390 PX</p><div class="phone-frame"><iframe src="/" title="成长小树手机界面"></iframe></div><p class="preview-note">真实页面，可点击操作与上下滚动</p></main>`;
} else refresh();

if ('serviceWorker' in navigator && window.isSecureContext) { navigator.serviceWorker.register('/sw.js').catch(() => {}); }

async function showAITokens() {
  try {
    const { tokens } = await api('ai-tokens');
    modal.innerHTML = '<div class="dialog-heading"><h2>AI 接入令牌</h2><button class="close" data-action="close">×</button></div><p class="muted">只读可查询全部孩子数据；管理可修改活动、积分、目标和奖励。令牌最长有效 365 天。</p><form id="token-form">' + field('令牌名称','name','例如：家庭 AI 助手') + '<label>权限<select name="scope"><option value="read">只读查询（推荐）</option><option value="manage">管理：含计分、审核与兑换</option></select></label>' + field('有效天数','days','','number',90) + '<button class="primary">创建令牌</button><p id="token-error" role="alert"></p></form><div id="token-secret"></div><div class="panel">' + tokens.map(t => '<div class="record"><div><b>' + esc(t.name) + '</b><p>' + (t.scope === 'read' ? '只读' : '管理') + ' · 到期 ' + t.expiresAt.slice(0,10) + (t.revokedAt ? ' · 已撤销' : t.expiresAt <= new Date().toISOString() ? ' · 已过期' : '') + '</p></div>' + (!t.revokedAt && t.expiresAt > new Date().toISOString() ? '<button class="subtle" data-action="revoke-ai-token" data-id="' + t.id + '">撤销</button>' : '<button class="subtle danger" data-action="delete-ai-token" data-id="' + t.id + '">删除记录</button>') + '</div>').join('') + '</div>';
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

document.addEventListener('change', event => {
  if (!event.target.matches('.icon-picker input[name="icon"]')) return;
  const picker = event.target.closest('.icon-picker');
  picker.querySelector('.selected-icon').innerHTML = renderIcon(event.target.value);
  picker.querySelector('details').open = false;
});

function profile() {
  const c = state.children.find(c => c.id === child);
  return '<section class="panel profile-card"><img src="/icon.svg" alt="" width="76" height="76"><h2>' + esc(c.name) + '的成长小天地</h2><div class="profile-links"><button class="outline" data-page="manage">家长控制 →</button></div></section>';
}
function wishList(parent) {
  const list = (state.wishes || []).filter(w => parent ? w.status === 'pending' : w.status !== 'withdrawn');
  const names = {pending:'等待家长回应',approved:'已同意',rejected:'家长的回应'};
  if (!list.length) return parent ? '<div class="empty compact">暂时没有待审批的心愿</div>' : '';
  return '<div class="panel">' + list.slice().reverse().map(w => '<div class="record"><span class="record-icon">' + renderIcon(w.icon) + '</span><div><b>' + esc(w.title) + '</b><p>' + names[w.status] + (w.cost ? ' · ' + w.cost + ' 分' : '') + '</p>' + (w.note ? '<p>' + esc(w.note) + '</p>' : '') + (w.reason ? '<p>家长说：' + esc(w.reason) + '</p>' : '') + '</div>' + (w.status === 'pending' ? parent ? '<button data-action="approve-wish" data-id="' + w.id + '">同意并定积分</button><button class="subtle" data-action="reject-wish" data-id="' + w.id + '">暂不同意</button>' : '<button class="subtle" data-action="edit-wish" data-id="' + w.id + '">修改</button><button class="subtle" data-action="withdraw-wish" data-id="' + w.id + '">撤回</button>' : '') + '</div>').join('') + '</div>';
}

function manage() {
 if (!state.parent) return profile();
 const tabs = {review:'审核中心',activities:'活动安排',points:'积分与目标',rewards:'心愿与奖励',history:'按日回溯',adventure:'成长探险',settings:'家庭与接入'};
 const template = document.createElement('template'); template.innerHTML = legacyManage();
 const panelFor = name => { const heading = [...template.content.querySelectorAll('.section-title')].find(el => el.textContent.includes(name)); return heading?.nextElementSibling?.outerHTML || ''; };
 const action = (name,label) => '<button class="outline" data-action="'+name+'">'+label+'</button>';
 let body = '';
 if(managementTab === 'review') body = '<section class="panel settings-panel"><h2>午夜自动审核</h2><p>北京时间每天 00:00，通过前一天所有孩子已提交的待审核任务；未完成任务不会自动计分。开启后从今天起生效，停机期间会在下次启动补处理。</p><button data-action="auto-approve" aria-pressed="'+!!state.settings?.autoApprove?.enabled+'">'+(state.settings?.autoApprove?.enabled ? '已开启 · 点击关闭' : '已关闭 · 点击开启')+'</button></section><div class="section-title"><h2>今日任务审核</h2></div>'+panelFor('今日完成审核');
 if(managementTab === 'activities') body = '<div class="management-actions">'+action('activity','＋ 新建活动')+'</div><p class="muted">使用上移、下移调整顺序；今日任务在各自时段内按此顺序显示，自动保存。</p>'+panelFor('活动安排');
 if(managementTab === 'points') body = '<section class="panel settings-panel"><h2>积分与目标</h2><p>可用 '+(state.balance-state.frozen)+' 分 · 本周 '+state.weekPoints+' / '+state.goal+' 分。扣分须填写原因，不能超过可用余额，不减少累计获得和本周任务积分。</p><div class="management-actions">'+action('goal','设置周目标')+action('bonus','鼓励加分')+action('deduct','记录扣分')+'</div></section>';
 if(managementTab === 'rewards') body = '<div class="management-actions">'+action('reward','＋ 添加奖励')+'</div><div class="section-title"><h2>心愿审批</h2></div>'+wishList(true)+'<div class="section-title"><h2>奖励管理</h2></div>'+panelFor('奖励管理')+'<div class="section-title"><h2>兑换与兑现</h2></div>'+redemptions(true);
 if(managementTab === 'history') body = '<section class="panel settings-panel"><h2>按日期回查</h2><p>查询该日已经生成的任务和审核记录；没有记录的日期不会补造任务。撤销按任务原日期冲回积分。</p><div class="management-actions"><input id="history-day" type="date" max="'+state.today+'" value="'+(historyDay||state.today)+'"><button data-action="history-query">查询</button></div></section><div id="history-result">请选择日期并查询</div>';
 if(managementTab === 'adventure') body = adventureSettings();
 if(managementTab === 'settings') body = '<section class="panel settings-panel"><h2>家庭与接入</h2><p>管理家庭成员、AI 授权和数据导出。</p><div class="management-actions">'+action('edit-family','修改家庭名称')+action('child','添加孩子')+action('ai-tokens','AI 接入令牌')+action('logout','退出家长控制')+'<a class="button outline" href="/api/export" download>导出数据</a></div></section><div class="section-title"><h2>孩子与专属入口</h2></div><div class="panel">'+state.children.map((c,i)=>'<div class="record"><div><b>'+esc(c.name)+'</b><p><a href="/'+(i+1)+'">'+esc(location.origin)+'/'+(i+1)+'</a></p></div><button class="outline" data-action="edit-child" data-id="'+c.id+'">修改姓名</button></div>').join('')+'</div>'; 
 return '<div class="section-title"><div><h2>家长控制</h2><p>管理完成后，可退出并交回孩子使用</p></div><button class="outline" data-action="logout">退出家长控制</button></div><div class="management-tabs">'+Object.entries(tabs).map(([key,label])=>'<button class="'+(key===managementTab?'primary':'outline')+'" data-action="management-tab" data-tab="'+key+'">'+label+'</button>').join('')+'</div>'+body;
}
async function loadHistory() {
 const selectedChild = child, selectedDay = historyDay || state.today; historyDay = selectedDay;
 try {
 const result = await api('history?child='+encodeURIComponent(selectedChild)+'&day='+encodeURIComponent(selectedDay));
 if(child!==selectedChild || page!=='manage' || managementTab!=='history') return;
 historyData=result;
 const target=document.querySelector('#history-result'); if(!target)return;
 const status={todo:'未完成',pending:'待审核',done:'已完成'};
 const operations={submit:'提交完成',complete:'确认完成',withdraw:'撤回',approve:'审核通过',reject:'退回',undo:'撤销完成'};
 target.innerHTML='<div class="section-title"><h2>'+esc(result.day)+' · '+result.tasks.filter(t=>t.status==='done').length+' / '+result.tasks.length+' 项完成</h2></div><div class="panel">'+(result.tasks.map(t=>'<div class="record"><span class="record-icon">'+renderIcon(t.icon)+'</span><div><b>'+esc(t.title)+'</b><p>'+status[t.status]+' · '+t.points+' 分'+(t.reviewedBy==='auto'?' · 自动审核':'')+'</p></div>'+(t.status==='done'?'<button class="subtle danger" data-action="history-task" data-id="'+t.id+'" data-op="undo">撤销完成</button>':t.status==='pending'?'<button data-action="history-task" data-id="'+t.id+'" data-op="approve">通过</button><button class="subtle" data-action="history-task" data-id="'+t.id+'" data-op="reject">退回</button>':'')+'</div>').join('')||'<p class="panel-empty">该日没有已记录的任务</p>')+'</div><div class="section-title"><h2>审核轨迹</h2></div><div class="panel">'+(result.events.map(e=>'<div class="record"><div><b>'+esc(result.tasks.find(t=>t.id===e.task)?.title||'历史任务')+' · '+(operations[e.action]||esc(e.action))+'</b><p>'+({auto:'午夜自动审核',parent:'家长',child:'孩子'}[e.actor]||esc(e.actor))+' · '+esc(new Date(e.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))+'</p></div></div>').join('')||'<p class="panel-empty">暂无审核轨迹（旧版记录可能只有积分流水）</p>')+'</div>';
 }catch(error){toast(error.message)}
}

function sceneArt(id) {
 const palettes={camp:['#e5efcf','#a8c18b','#6f995e'],forest:['#cee5d0','#7daa7c','#35664e'],ocean:['#d0edf0','#74c6cf','#368eaa'],desert:['#f5e2b8','#dfb66d','#bc8c4e'],snow:['#e0eff5','#b5d4df','#739fae'],sky:['#243f5b','#567792','#93b0b8']};
 const [sky,land,deep]=palettes[id];
 const trees='<path d="M88 176v-54m-30 15 30-58 31 58Z" fill="'+deep+'" stroke="'+deep+'" stroke-width="5"/><path d="M353 180v-60m-32 16 32-66 33 66Z" fill="'+deep+'" stroke="'+deep+'" stroke-width="5"/>';
 const objects={camp:trees+'<path d="m164 185 57-77 57 77Z" fill="#f5d68d"/><path d="m221 108 12 77h-30Z" fill="#ae8156"/>',forest:trees+'<circle cx="214" cy="92" r="50" fill="#54875d"/><path d="M211 181v-73" stroke="#95744f" stroke-width="13"/><rect x="184" y="111" width="59" height="38" rx="5" fill="#d2ae79"/><path d="m177 111 36-27 36 27" fill="#715b40"/>',ocean:'<path d="M0 163q40-15 80 0t80 0t80 0t80 0t80 0t80 0" fill="none" stroke="#c5edf0" stroke-width="6"/><path d="m185 158 23 25h69l23-25Z" fill="#a17751"/><path d="M240 155V72l-45 77Z" fill="#fff8e4"/><path d="m246 85 36 64h-36Z" fill="#e5b96a"/>',desert:'<path d="M105 185v-65m0 35H86v-23m19 10h21v-31" stroke="#688c65" stroke-width="12" fill="none" stroke-linecap="round"/><ellipse cx="290" cy="182" rx="49" ry="10" fill="#75b7ae"/><path d="m319 173-6-71m0 5q-26-25-46 1m46-1q22-28 43-3m-43 3q-6-32-25-32" stroke="#6d8b56" stroke-width="8" fill="none" stroke-linecap="round"/>',snow:'<path d="m85 178 94-130 91 130m-4 0 72-105 77 105" fill="'+deep+'"/><path d="m150 89 29-41 30 43-20-8-12 14-12-13Z" fill="#fffdf3"/><path d="M296 177v-56l29 12-29 10" fill="#d8aa60" stroke="#bd8e50" stroke-width="3"/>',sky:'<path d="m139 144 90 12 75-17-72 61Z" fill="#6f9691"/><ellipse cx="223" cy="142" rx="81" ry="17" fill="#afc49b"/><path d="m215 136 4-63h18l4 63Z" fill="#f5e4b1"/><path d="m213 73 15-18 15 18Z" fill="#dfb265"/><path d="M86 63v18m-9-9h18m262 30v16m-8-8h16" stroke="#f6dd92" stroke-width="3" stroke-linecap="round"/>'};
 return '<svg class="scene-art" viewBox="0 0 440 220" role="img" aria-label="场景插画"><rect width="440" height="220" fill="'+sky+'"/><circle cx="350" cy="48" r="24" fill="#f6dc96"/><path d="M0 159Q100 104 220 153T440 137V220H0Z" fill="'+land+'"/><path d="M0 192Q120 156 253 183T440 171V220H0Z" fill="'+deep+'" opacity=".25"/>'+objects[id]+'</svg>';
}
function adventureCard(){
 const a=state.adventure;if(!a)return '';
 const scene=a.scenes.find(s=>s.id===a.selected),next=a.scenes.find(s=>s.id===a.next),reached=a.scenes.find(s=>s.id===a.reached);
 const progress=next?Math.max(0,Math.min(100,(a.points-reached.threshold)/(next.threshold-reached.threshold)*100)):100;
 return '<section class="adventure-hero '+scene.id+'"><div class="adventure-copy"><p class="eyebrow">成长探险 · 第 '+(a.scenes.findIndex(s=>s.id===a.reached)+1)+' 站</p><h2>'+scene.name+'</h2><p>'+scene.description+'</p><div class="adventure-metrics"><b>'+a.points+'</b><span>成长值（'+(a.includeBonus?'含家长加分':'活动得分')+'） · '+(next?'前往'+next.name+'，还差 '+Math.max(0,next.threshold-a.points):'整张地图已点亮！')+'</span></div><div class="progress"><span style="width:'+progress+'%"></span></div><button class="adventure-link" data-action="explore">展开我的探险地图 ↗</button></div><div class="adventure-picture">'+sceneArt(scene.id)+'</div></section>';
}
function growth(){
 const tabs='<div class="growth-tabs"><button class="'+(growthTab==='map'?'primary':'outline')+'" data-action="growth-tab" data-tab="map">探险地图</button><button class="'+(growthTab==='points'?'primary':'outline')+'" data-action="growth-tab" data-tab="points">积分足迹</button></div>';
 if(growthTab==='points')return tabs+pointsHistory();
 const a=state.adventure;if(!a)return tabs;
 return tabs+adventureCard()+'<div class="section-title"><div><h2>下一片风景，等你发现</h2><p>完成任务积累成长值，兑换心愿不会让旅程后退</p></div><span class="pill">已到达 '+a.scenes.filter(s=>s.unlockedAt).length+' / 6 站</span></div><div class="adventure-map">'+a.scenes.map((s,i)=>'<button class="scene-card '+(!s.unlockedAt?'locked':'')+' '+(s.id===a.selected?'selected':'')+'" data-action="scene-preview" data-id="'+s.id+'"><div class="scene-illustration">'+sceneArt(s.id)+'<span class="scene-number">0'+(i+1)+'</span><span class="scene-lock">'+(s.unlockedAt?'已到达':'未解锁')+'</span></div><div class="scene-body"><h3>'+s.name+'</h3><p>'+s.description+'</p><div><b>'+s.threshold+' 成长值</b><span>'+(s.id===a.selected?'当前主题 ✓':s.unlockedAt?'进入看看 →':'还差 '+Math.max(0,s.threshold-a.points))+'</span></div></div></button>').join('')+'</div><div class="section-title"><h2>我的旅行纪念册</h2></div><div class="badge-shelf">'+a.scenes.filter(s=>s.unlockedAt).map(s=>'<div><span>✦</span><b>'+s.badge+'</b><small>'+s.unlockedAt.slice(0,10)+'</small></div>').join('')+'</div>';
}

function adventureSettings(){
 const a=state.adventure,c=state.children.find(c=>c.id===child);
 let total=0;
 return '<section class="panel settings-panel"><div class="section-title"><h2>'+esc(c.name)+'的成长探险</h2><button class="outline" data-action="point-planner">自动核算任务积分</button></div><h2>路段门槛</h2><p>只调整当前孩子。填写每一段所需成长值，系统自动累加为解锁门槛。兑换与行为扣分不影响成长值；家长加分可选择是否计入。</p><p>当前成长值 <b>'+a.points+'</b> · 已解锁 '+a.scenes.filter(s=>s.unlockedAt).length+' / 6 站</p><label class="checkbox-label" style="margin-top:20px"><input type="checkbox" id="adventure-include-bonus" '+(a.includeBonus?'checked':'')+'>家长加分计入成长值（包含历史加分）</label><p class="muted">补录历史积分可开启；关闭只统计已确认活动积分。已解锁场景不会收回。</p><div class="segment-list">'+a.segments.map((value,i)=>{total+=value;return '<label class="segment-row"><span>'+a.scenes[i].name+' → '+a.scenes[i+1].name+'</span><input class="segment-input" aria-label="'+a.scenes[i].name+'到'+a.scenes[i+1].name+'所需成长值" type="number" min="1" max="100000" step="1" value="'+value+'"><small>累计 <b class="segment-total">'+total+'</b> 解锁</small></label>';}).join('')+'</div><div class="adventure-preview" id="adventure-preview">'+adventurePreview(a.segments)+'</div><p class="muted">提高门槛不会收回已解锁场景；降低门槛后，达到条件的场景将解锁。这里只修改探险节奏，不更改任务积分、周目标和奖励价格。</p><button class="primary" data-action="save-adventure">保存当前孩子的配置</button></section>';
}
function adventurePreview(segments){
 let total=0; const targets=segments.map(n=>total+=n);
 const includes=document.querySelector('#adventure-include-bonus')?.checked ?? state.adventure.includeBonus;
 const points=Math.max(0,state.ledger.filter(l=>(includes?['task','reverse','bonus']:['task','reverse']).includes(l.kind)).reduce((n,l)=>n+l.amount,0));
 const newly=state.adventure.scenes.slice(1).filter((scene,i)=>!scene.unlockedAt && points>=targets[i]);
 return '按当前选择成长值为 <b>'+points+'</b>。整张地图共需 <b>'+total+'</b> 成长值。'+(newly.length?'保存后将新解锁：'+newly.map(s=>esc(s.name)).join('、'):'本次调整不会新增已解锁场景。');
}
function updateAdventurePreview(){
 let total=0;const inputs=[...document.querySelectorAll('.segment-input')];const segments=inputs.map(input=>Number(input.value));
 document.querySelectorAll('.segment-total').forEach((el,i)=>{total+=segments[i];el.textContent=Number.isFinite(total)?total:'—';});
 document.querySelector('#adventure-preview').innerHTML=segments.every(n=>Number.isInteger(n)&&n>=1&&n<=100000)?adventurePreview(segments):'请填写每段所需成长值（1～100000 的整数）';
}
document.addEventListener('input',event=>{if(event.target.matches('.segment-input, #adventure-include-bonus'))updateAdventurePreview();});

function openScene(id){
 const a=state.adventure,scene=a.scenes.find(s=>s.id===id),route=a.routes.find(r=>r.scene===id),index=a.scenes.findIndex(s=>s.id===id),next=a.scenes[index+1];
 const pct=Math.floor(route.progress*100),remaining=Math.max(0,route.end-a.points);
 const fractions=pct===75?'四分之一路程':pct>75?'不到四分之一路程':pct===50?'二分之一路程':pct>50?'不到二分之一路程':pct===25?'四分之三路程':pct>25?'不到四分之三路程':'四分之三以上路程';
 modal.classList.add('map-dialog');
 const coords=[[12,83],[35,66],[69,50],[41,30],[82,14]];
 const progressPath='M 72 415 L 155 415 L 155 330 L 310 330 L 310 250 L 445 250 L 445 150 L 246 150 L 246 70 L 492 70';
 modal.innerHTML='<div class="dialog-heading"><div><p class="eyebrow">探索手册 · 第 '+(index+1)+' 站</p><h2>'+scene.name+'</h2></div><button class="close" data-action="close">×</button></div><p class="map-description">'+scene.description+'</p><div class="route-summary"><b>'+pct+'% 已探索</b><span>'+(next?'距离'+next.name+'还差 '+remaining+' 成长值':'星岛探索，还差 '+remaining+' 成长值完成')+'</span><small>'+(pct===100?'这段旅程已完成，随时回来看看。':'还剩'+fractions+'，每一个好习惯都在带你前进。')+'</small></div><div class="maze-board '+scene.id+'"><div class="maze-landscape">'+sceneArt(id)+'</div><svg class="maze-path" viewBox="0 0 600 500" preserveAspectRatio="none" aria-hidden="true"><path d="M72 415V455H230V380H390V430H530V330H550V190H490M155 330H80V230H180V170H100V80H170M445 250H520V140H560M246 150V210H330" fill="none" stroke="#789572" stroke-width="13" opacity=".22" stroke-linecap="round" stroke-linejoin="round"/><path d="'+progressPath+'" fill="none" stroke="#fffdf3" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/><path d="'+progressPath+'" fill="none" stroke="#7f9d62" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="'+pct+' 100"/></svg>'+coords.map(([x,y],i)=>{
 const node=route.nodes[i-1],earned=i===0?!!scene.unlockedAt:i===4?!!next?.unlockedAt||route.progress===1:!!node.earnedAt;
 const icon=i===0?'⚑':i===4?'✦':node.icon;
 return '<button class="maze-node '+(earned?'earned':'waiting')+'" style="left:'+x+'%;top:'+y+'%" '+(i>0&&i<4?'data-action="discovery" data-scene="'+id+'" data-node="'+(i-1)+'"':'disabled')+' aria-label="'+(node?esc(node.name):i===0?'起点':'终点')+'"><span>'+icon+'</span><small>'+(i===0?'出发':i===4?'100% · 下一站':node.percent+'% · '+(earned?'已获得':'待发现'))+'</small></button>';
 }).join('')+'<div class="maze-note">虚线岔路是观察区，亮色路线是你的成长旅程</div></div><div class="section-title"><h2>本场景的探险收获</h2></div><div class="discovery-list">'+route.nodes.map((n,i)=>'<button class="discovery-row '+(n.earnedAt?'earned':'')+'" data-action="discovery" data-scene="'+id+'" data-node="'+i+'"><span>'+n.icon+'</span><div><b>'+n.name+'</b><small>'+n.percent+'% 节点 · '+(n.earnedAt?'已收入探险背包':'累计 '+n.required+' 成长值解锁')+'</small></div><strong>'+(n.earnedAt?'查看':'还差 '+Math.max(0,n.required-a.points))+'</strong></button>').join('')+'</div><p class="muted">道具和伙伴是虚拟收藏，不扣兑换积分。现实中的户外活动要有家长陪伴。</p>'+(scene.unlockedAt?'<button class="primary" data-action="select-scene" data-id="'+id+'">设为首页场景</button>':'<p class="muted">此场景尚未解锁，可以先预览路线。</p>');
 if(!modal.open)modal.showModal();
}
function openDiscovery(id,index){
 const node=state.adventure.routes.find(r=>r.scene===id).nodes[index];
 const scene=state.adventure.scenes.find(s=>s.id===id);
 modal.innerHTML='<div class="dialog-heading"><h2>'+esc(node.name)+'</h2><button class="close" data-action="close">×</button></div><div class="discovery-detail"><span>'+node.icon+'</span><p class="pill">'+(node.earnedAt?'已获得 · '+node.earnedAt.slice(0,10):'探索到 '+node.percent+'% 时获得')+'</p><h3>'+(node.earnedAt?'你又收获了一份成长礼物':'下一份发现正在等你')+'</h3><p>'+esc(node.lesson)+'</p><p class="muted">'+(node.earnedAt?'这份礼物会一直保存在你的旅行背包中。':'在'+scene.name+'继续前进，还差 '+Math.max(0,node.required-state.adventure.points)+' 成长值。')+'</p><button class="outline" data-action="scene-preview" data-id="'+id+'">返回场景路线</button></div>';
}
modal.addEventListener('close',()=>modal.classList.remove('map-dialog'));

let pointPlanInput=null;
function openPointPlanner(){
 pointPlanInput=null;
 const activities=state.activities.filter(a=>a.active);
 modal.innerHTML='<div class="dialog-heading"><h2>积分节奏规划师</h2><button class="close" data-action="close">×</button></div><p class="muted">从今天开始，规划走完剩余地图的日历天数。按重复星期精确计算活动次数，再按预计完成率与任务权重分配积分。</p><div class="form-row">'+field('预计多少天走完剩余地图','plan-days','','number',90)+field('预计完成率 %','plan-rate','','number',80)+'</div><p class="muted">分类只是建议权重，可逐项修改；条件性任务建议降低权重。周末任务只计入安排的星期，家长临时加分不纳入未来预测。</p><div class="planner-tasks">'+activities.map(a=>{
 const weight=/阅读|读书|运动|搏击|作业|预习|复习/.test(a.title)?2:1;
 return '<label class="planner-row"><span>'+esc(a.title)+'<small>每周 '+a.days.length+' 次 · 现 '+a.points+' 分</small></span><select data-plan-weight="'+a.id+'" aria-label="'+esc(a.title)+'任务权重">'+[[1,'基础习惯 ×1'],[1.5,'中等投入 ×1.5'],[2,'专注练习 ×2'],[3,'较大挑战 ×3']].map(([v,l])=>'<option value="'+v+'" '+(v===weight?'selected':'')+'>'+l+'</option>').join('')+'</select></label>';
 }).join('')+'</div><button class="primary" data-action="calculate-plan">计算建议方案</button><div id="point-plan-result"></div>';
 modal.classList.add('map-dialog');modal.showModal();
 const invalidate=()=>{pointPlanInput=null;document.querySelector('#point-plan-result').innerHTML='';};
 modal.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',invalidate));
}
async function calculatePointPlan(){
 const days=Number(modal.querySelector('[name="plan-days"]').value),completion=Number(modal.querySelector('[name="plan-rate"]').value)/100;
 const weights=Object.fromEntries([...modal.querySelectorAll('[data-plan-weight]')].map(el=>[el.dataset.planWeight,Number(el.value)]));
 try{
 const result=await api('point-plan',{days,completion,weights});pointPlanInput={days,completion,weights};
 let running=0;const a=state.adventure;
 document.querySelector('#point-plan-result').innerHTML='<div class="adventure-preview" style="margin-top:20px">剩余需 <b>'+result.remaining+'</b> 成长值，预计平均每天 <b>'+result.daily+'</b> 分。整数取整后约 <b>'+result.estimatedDays+'</b> 天达到终点。'+(result.constrained?'当前任务数量与整数积分限制导致偏差较大，建议调整天数或活动安排。':'')+'</div><div class="section-title"><h2>每项建议积分</h2></div><div class="panel">'+result.rows.map(r=>'<div class="record"><div><b>'+esc(r.title)+'</b><p>计划内 '+r.count+' 次 · 权重 '+r.weight+'</p></div><span>'+r.current+' → <b>'+r.suggested+' 分</b></span></div>').join('')+'</div><div class="section-title"><h2>预计到达时间</h2></div><div class="panel">'+a.scenes.slice(1).map(scene=>'<div class="record"><div><b>'+scene.name+'</b></div><span>'+(scene.unlockedAt?'已解锁':Math.ceil(Math.max(0,scene.threshold-a.points)/result.daily)+' 天左右')+'</span></div>').join('')+'</div><p class="muted">这是基于预计完成率的规划，不是达成保证。应用后更新活动及今天未完成任务的积分，待审核和已完成快照不变。地图门槛、奖励价格、周目标均不变。修改门槛后请重新计算。</p><button class="primary" data-action="apply-plan">确认应用建议积分</button>';
 }catch(error){toast(error.message)}
}

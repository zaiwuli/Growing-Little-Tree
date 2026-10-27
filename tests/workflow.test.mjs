import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('审核、重复打卡、兑换冻结和权限', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'growth-test-'));
  const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '3127', DB_PATH: path.join(dir, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(Error('server exit ' + code))); });
    let cookie = '', child;
    async function api(action, data, auth = true) {
      const r = await fetch('http://127.0.0.1:3127/api/' + action, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { Cookie: cookie } : {}) }, ...(data ? { body: JSON.stringify({ child, ...data }) } : {}) });
      if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
      return { status: r.status, data: await r.json() };
    }
    assert.equal((await api('setup', { family: '测试家庭', name: '测试孩子', password: 'test12345' })).status, 200);
    child = (await api('state')).data.child;
    assert.equal((await api('activity', { title: '未授权', days: [0,1,2,3,4,5,6], period: '早晨', points: 10 }, false)).status, 403);
    assert.equal((await api('state')).data.rewards.length, 0);
    await api('login', { password: 'test12345' });
    await api('reward', { title: '一起看一场电影', icon: '🎬', cost: 50 });
    await api('activity', { title: '阅读', days: [0,1,2,3,4,5,6], period: '晚上', points: 60, review: true });
    let s = (await api('state')).data;
    const id = s.tasks[0].id;
    await api('complete', { id }, false);
    assert.equal((await api('state')).data.balance, 0);
    await api('task', { id, operation: 'withdraw' }, false);
    assert.equal((await api('state')).data.tasks[0].status, 'todo');
    await api('complete', { id }, false);
    await api('task', { id, operation: 'approve' });
    assert.equal((await api('task', { id, operation: 'undo' }, false)).status, 403);
    await api('task', { id, operation: 'approve' });
    await api('complete', { id }, false);
    s = (await api('state')).data;
    assert.equal(s.balance, 60);
    assert.equal(s.ledger.length, 1);
    const activity = s.activities[0].id;
    const edit = { id: activity, title: '阅读新版', icon: '📚', days: [0,1,2,3,4,5,6], period: '早晨', points: 20, review: false };
    assert.equal((await api('edit-activity', edit, false)).status, 403);
    await api('edit-activity', edit);
    s = (await api('state')).data;
    assert.equal(s.tasks[0].points, 60);
    assert.equal(s.activities[0].points, 20);
    await api('redeem', { id: s.rewards[0].id }, false);
    assert.equal((await api('redeem', { id: s.rewards[0].id }, false)).status, 400);
    s = (await api('state')).data;
    assert.equal(s.frozen, 50);
    await api('redemption', { id: s.redemptions[0].id, operation: 'approve' });
    s = (await api('state')).data;
    assert.equal(s.balance, 10); assert.equal(s.earned, 60); assert.equal(s.weekPoints, 60);
    await api('task', { id, operation: 'undo' });
    s = (await api('state')).data;
    assert.equal(s.balance, -50); assert.equal(s.weekPoints, 0);
    assert.equal((await api('redeem', { id: s.rewards[0].id }, false)).status, 400);
    await api('edit-activity', edit);
    s = (await api('state')).data;
    assert.equal(s.tasks[0].points, 20);
    assert.equal(s.tasks[0].title, '阅读新版');
    await api('complete', { id }, false);
    await api('task', { id, operation: 'undo' }, false);
    await api('task', { id, operation: 'undo' }, false);
    assert.equal((await api('state')).data.balance, -50);
    const cross = await fetch('http://127.0.0.1:3127/api/goal', { method: 'POST', headers: { Origin: 'http://evil.example', 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ child, goal: 10 }) });
    assert.equal(cross.status, 403);
    const readToken = (await api('ai-token-create', { name: '只读测试', scope: 'read', days: 1 })).data;
    const manager = (await api('ai-token-create', { name: '管理测试', scope: 'manage', days: 1 })).data;
    async function ai(route, token, body, key = 'test-write') {
      return fetch('http://127.0.0.1:3127/api/ai/v1/' + route, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': key }, ...(body ? { body: JSON.stringify({ child, ...body }) } : {}) });
    }
    assert.equal((await ai('state', 'invalid')).status, 401);
    assert.equal((await ai('state', readToken.token)).status, 200);
    assert.equal((await ai('bonus', readToken.token, { points: 5, reason: '测试' })).status, 403);
    const before = (await api('state')).data.balance;
    assert.equal((await ai('bonus', manager.token, { points: 5, reason: 'AI鼓励' })).status, 200);
    assert.equal((await (await ai('bonus', manager.token, { points: 5, reason: 'AI鼓励' })).json()).replayed, true);
    assert.equal((await api('state')).data.balance, before + 5);
    assert.equal((await ai('bonus', manager.token, { points: 6, reason: 'AI鼓励' })).status, 409);
    assert.equal((await ai('ai-token-create', manager.token, { name: '不允许' })).status, 404);
    const exported = (await api('export')).data;
    assert.equal(exported.aiTokens, undefined);
    assert.equal(JSON.stringify((await api('ai-tokens')).data).includes(manager.token), false);
    await api('ai-token-revoke', { id: readToken.id });
    assert.equal((await ai('state', readToken.token)).status, 401);
    assert.equal((await api('ai-token-create', { name: '越权', scope: 'manage', days: 1 }, false)).status, 403);
  } finally { server.kill(); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve)); rmSync(dir, { recursive: true, force: true }); }
});

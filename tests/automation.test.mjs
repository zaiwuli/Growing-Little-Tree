import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approveOverdue } from '../automation.mjs';

test('午夜只审核启用后已提交的过去日期任务，补跑不重复计分', () => {
  const s = { settings: { autoApprove: { enabled: true, fromDate: '2026-10-26' } }, ledger: [], tasks: [
    { id: 'a', child: 'c', day: '2026-10-26', status: 'pending', points: 10, title: '阅读' },
    { id: 'b', child: 'c', day: '2026-10-26', status: 'todo', points: 10 },
    { id: 'c', child: 'c', day: '2026-10-27', status: 'pending', points: 10 },
    { id: 'd', child: 'c', day: '2026-10-25', status: 'pending', points: 10 }
  ] };
  assert.equal(approveOverdue(s, '2026-10-27'), 1);
  assert.equal(s.ledger[0].day, '2026-10-26');
  assert.equal(s.tasks[1].status, 'todo');
  assert.equal(s.tasks[2].status, 'pending');
  assert.equal(approveOverdue(s, '2026-10-27'), 0);
  s.tasks[0].status = 'todo';
  assert.equal(approveOverdue(s, '2026-10-27'), 0);
  s.settings.autoApprove.enabled = false;
  assert.equal(approveOverdue(s, '2026-10-28'), 0);
});

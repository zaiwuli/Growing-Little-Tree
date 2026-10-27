export function approveOverdue(state, today, now = new Date().toISOString()) {
  const setting = state.settings?.autoApprove;
  if (!setting?.enabled) return 0;
  let count = 0;
  for (const task of state.tasks) {
    if (task.status !== 'pending' || task.day >= today || task.day < setting.fromDate) continue;
    task.status = 'done';
    task.reviewedAt = now;
    task.reviewedBy = 'auto';
    state.ledger.push({ id: crypto.randomUUID(), child: task.child, amount: task.points, reason: '午夜自动审核：' + task.title, kind: 'task', task: task.id, day: task.day, at: now });
    state.taskEvents ||= [];
    state.taskEvents.push({ task: task.id, child: task.child, day: task.day, action: 'approve', actor: 'auto', at: now });
    count++;
  }
  return count;
}

export function planPoints({ activities, start, days, completion, remaining, weights = {} }) {
  if (!Number.isInteger(days) || days < 7 || days > 730 || !Number.isFinite(completion) || completion < .1 || completion > 1) throw Error('计划天数需为 7～730 天，预计完成率为 10%～100%');
  if (!(remaining > 0)) throw Error('这张地图的积分目标已经达到，无需重新规划');
  const rows = activities.filter(a => a.active && !a.deletedAt).map(a => {
    const weight = Number(weights[a.id] ?? 1);
    if (![1, 1.5, 2, 3].includes(weight)) throw Error('任务权重无效');
    let count = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(start + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i);
      if (a.days.includes(d.getUTCDay()) && d.toISOString().slice(0,10) >= a.start) count++;
    }
    return { id:a.id, title:a.title, current:a.points, weight, count };
  });
  const units = rows.reduce((sum,r) => sum + r.count * r.weight * completion, 0);
  if (!units) throw Error('计划期间没有有效活动，请先添加并启用活动');
  const scale = remaining / units;
  for (const r of rows) r.suggested = Math.max(1,Math.min(1000,Math.round(scale * r.weight)));
  const projected = rows.reduce((sum,r)=>sum+r.count*r.suggested*completion,0);
  return { rows, remaining, days, completion, projected:Math.round(projected), daily:Math.round(projected/days*10)/10, estimatedDays:Math.round(remaining/(projected/days)), constrained:Math.abs(projected-remaining)/remaining > .1 };
}

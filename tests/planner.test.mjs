import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planPoints} from '../planner.mjs';
test('按重复星期和权重分配积分',()=>{
 const activities=[{id:'daily',title:'阅读',points:10,active:true,start:'2026-01-01',days:[0,1,2,3,4,5,6]},{id:'weekend',title:'运动',points:10,active:true,start:'2026-01-01',days:[0,6]}];
 const plan=planPoints({activities,start:'2026-10-26',days:7,completion:1,remaining:160,weights:{daily:2,weekend:1}});
 assert.equal(plan.rows[0].count,7);assert.equal(plan.rows[1].count,2);
 assert.equal(plan.rows[0].suggested,20);assert.equal(plan.rows[1].suggested,10);
 assert.equal(plan.projected,160);assert.equal(plan.estimatedDays,7);
 assert.throws(()=>planPoints({activities:[],start:'2026-10-26',days:7,completion:1,remaining:100}));
 assert.throws(()=>planPoints({activities,start:'2026-10-26',days:0,completion:1,remaining:100}));
});

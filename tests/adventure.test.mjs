import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adventure } from '../adventure.mjs';
test('探险只统计活动积分，兑换不回退，纠错保留已解锁场景', () => {
  const s={adventures:{a:{unlocked:{},selected:'camp',segments:[100,200,300,400,500]}},ledger:[{child:'a',kind:'task',amount:300},{child:'a',kind:'bonus',amount:100},{child:'a',kind:'redeem',amount:-200}]};
  let a=adventure(s,'a');
  assert.equal(a.points,300); assert.equal(a.reached,'ocean');
  s.ledger.push({child:'a',kind:'reverse',amount:-10});
  a=adventure(s,'a');
  assert.equal(a.points,290);assert.equal(a.reached,'ocean');assert.equal(a.next,'desert');
  assert.equal(adventure(s,'b').points,0);
});

test('默认长线门槛、按孩子配置和提高门槛保留解锁', () => {
 const s={ledger:[{child:'a',kind:'task',amount:500}]};
 let a=adventure(s,'a');
 assert.deepEqual(a.scenes.map(s=>s.threshold),[0,500,1500,3000,5000,8000]);
 assert.equal(a.reached,'forest');
 s.adventures.a.segments=[1000,2000,3000,4000,5000];
 a=adventure(s,'a');assert.equal(a.reached,'forest');assert.equal(a.scenes[1].threshold,1000);
 assert.equal(adventure(s,'b').scenes[1].threshold,500);
});
test('可选择补录家长加分，关闭后不收回场景', () => {
 const s={ledger:[{child:'a',kind:'task',amount:20},{child:'a',kind:'bonus',amount:1600},{child:'a',kind:'deduct',amount:-100}]};
 assert.equal(adventure(s,'a').points,20);
 s.adventures.a.includeBonus=true;
 const a=adventure(s,'a'); assert.equal(a.points,1620);assert.equal(a.reached,'ocean');
 s.adventures.a.includeBonus=false;
 assert.equal(adventure(s,'a').reached,'ocean');
});
test('四分之一路程解锁道具，收藏幂等并按孩子隔离', () => {
 const s={ledger:[{child:'a',kind:'task',amount:125}]};
 let a=adventure(s,'a');
 assert.equal(a.routes[0].progress,.25);
 assert.ok(a.routes[0].nodes[0].earnedAt);
 assert.equal(a.routes[0].nodes[1].earnedAt,null);
 const at=a.routes[0].nodes[0].earnedAt;
 assert.equal(adventure(s,'a').routes[0].nodes[0].earnedAt,at);
 s.ledger.push({child:'a',kind:'reverse',amount:-100});
 assert.ok(adventure(s,'a').routes[0].nodes[0].earnedAt);
 assert.equal(adventure(s,'b').routes[0].nodes[0].earnedAt,null);
});

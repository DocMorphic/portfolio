import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterReflectionBudget} from './water-reflection-budget.ts';

test('fast camera motion keeps a reflection every frame',()=>{
  const budget=new WaterReflectionBudget();
  for(let frame=0;frame<80;frame++)assert.equal(budget.shouldUpdate(frame*16.7,true,false),true);
});

test('sustained late camera frames skip reflection passes, then recover',()=>{
  const budget=new WaterReflectionBudget();
  let skipped=0;
  for(let frame=0;frame<40;frame++)if(!budget.shouldUpdate(frame*33,true,false))skipped++;
  assert.ok(skipped>8);
  for(let frame=0;frame<150;frame++)budget.shouldUpdate(1400+frame*16.7,true,false);
  assert.equal(budget.shouldUpdate(4000,true,false),true);
  assert.equal(budget.shouldUpdate(4016.7,true,false),true);
});

test('stationary scenes reuse the last reflection until explicitly dirty',()=>{
  const budget=new WaterReflectionBudget();
  assert.equal(budget.shouldUpdate(0,true,false),true);
  assert.equal(budget.shouldUpdate(16,false,false),false);
  assert.equal(budget.shouldUpdate(80,false,true),true);
});

test('very slow devices still skip passes and lens changes refresh immediately',()=>{
  const budget=new WaterReflectionBudget();
  let skipped=0;
  for(let frame=0;frame<40;frame++)if(!budget.shouldUpdate(frame*100,true,false))skipped++;
  assert.ok(skipped>8);
  assert.equal(budget.shouldUpdate(4000,true,false,true),true);
  assert.equal(budget.shouldUpdate(4001,true,false,true),true);
});

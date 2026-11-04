import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuotaManager } from '../../src/infrastructure/quota/quota-manager.mjs';

test('minute threshold is enforced',()=>{
  let now=100000;
  const quota=createQuotaManager({clock:()=>now,minute:2,hour:10,day:20,gapMs:0});
  quota.reserve();
  quota.reserve();
  assert.throws(()=>quota.reserve(),{name:'QuotaError',statusCode:429});
  now+=61000;
  quota.reserve();
  assert.equal(quota.stats().limits.minute.used,1);
});

test('spacing threshold prevents bursts',()=>{
  let now=100000;
  const quota=createQuotaManager({clock:()=>now,minute:10,hour:100,day:500,gapMs:7000});
  quota.reserve();
  assert.throws(()=>quota.reserve(),{name:'QuotaError',statusCode:429});
  now+=7000;
  quota.reserve();
});

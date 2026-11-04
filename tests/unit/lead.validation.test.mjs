import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLeadListQuery } from '../../src/modules/leads/lead.validation.mjs';

test('lead list defaults to the current UTC day',()=>{
  const result=parseLeadListQuery({}, {
    now:new Date('2026-11-04T20:30:00.000Z')
  });

  assert.deepEqual(result.filter.postedAt,{
    $gte:new Date('2026-11-04T00:00:00.000Z'),
    $lt:new Date('2026-11-05T00:00:00.000Z')
  });
  assert.equal(result.options.page,1);
  assert.equal(result.options.limit,10);
  assert.equal(result.options.sortBy,'postedAt:desc');
});

test('lead list supports month and searched keyword filters',()=>{
  const result=parseLeadListQuery({
    month:'2026-11',
    searchedKeyword:'  Node.js  ',
    page:'2',
    limit:'25'
  });

  assert.deepEqual(result.filter.postedAt,{
    $gte:new Date('2026-11-01T00:00:00.000Z'),
    $lt:new Date('2026-12-01T00:00:00.000Z')
  });
  assert.equal(result.options.search,'Node.js');
  assert.deepEqual(result.options.searchFields,['searchedKeywords']);
  assert.equal(result.options.page,2);
  assert.equal(result.options.limit,25);
});

test('lead list custom toDate includes the full UTC day',()=>{
  const result=parseLeadListQuery({
    fromDate:'2026-10-30',
    toDate:'2026-11-04'
  });

  assert.deepEqual(result.filter.postedAt,{
    $gte:new Date('2026-10-30T00:00:00.000Z'),
    $lt:new Date('2026-11-05T00:00:00.000Z')
  });
});

test('lead list rejects conflicting date filters',()=>{
  assert.throws(
    ()=>parseLeadListQuery({date:'2026-11-04',month:'2026-11'}),
    error=>error.statusCode===400&&/only one date filter mode/i.test(error.message)
  );
});

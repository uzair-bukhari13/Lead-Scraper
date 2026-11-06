import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeadRepository } from '../../src/modules/leads/lead.repository.mjs';

test('lead repository upserts jobs and merges keyword and skill arrays',async()=>{
  const writes=[];
  const model={
    bulkWrite:async(operations,options)=>{
      writes.push({operations,options});
      return {acknowledged:true};
    }
  };
  const repository=createLeadRepository({model});

  await repository.upsertMany([{
    id:'2117709706166172517',
    title:'Example job',
    url:'https://www.upwork.com/jobs/~022117709706166172517',
    source:'Upwork',
    country:'Canada',
    budget:{amount:500},
    jobType:'Fixed-price',
    duration:'1 to 3 months',
    postedAt:'2026-11-03T21:35:49.142Z',
    hasAttachments:true,
    searchedKeywords:['Web development','Web development'],
    skills:['Node.js','MongoDB','Node.js'],
    summary:'Build an API'
  }],{searchRunId:'run-123'});

  assert.equal(writes.length,1);
  assert.deepEqual(writes[0].options,{ordered:false});

  const operation=writes[0].operations[0].updateOne;
  assert.deepEqual(operation.filter,{externalId:'2117709706166172517'});
  assert.equal(operation.upsert,true);
  assert.equal(operation.update.$set.budget,'{"amount":500}');
  assert.equal(operation.update.$set.hasAttachments,true);
  assert.equal(operation.update.$set.lastSearchRunId,'run-123');
  assert.deepEqual(
    operation.update.$addToSet.searchedKeywords.$each,
    ['Web development']
  );
  assert.deepEqual(
    operation.update.$addToSet.skills.$each,
    ['Node.js','MongoDB']
  );
});

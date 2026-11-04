import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchRunsService } from '../../src/modules/search-runs/search-runs.service.mjs';

const waitForFinishedRun=async(service,id)=>{
  for (let attempt=0;attempt<50;attempt++) {
    const run=service.getRun(id);
    if (run.status!=='running') return run;
    await new Promise(resolve=>setImmediate(resolve));
  }
  throw new Error('Manual search run did not finish');
};

test('manual run performs all 13 searches for the configured country',async()=>{
  const calls=[];
  const progressEvents=[];
  const storedLeadBatches=[];
  const postedAt='2026-11-03T20:05:15.584Z';
  const mcp={call:async(action,params)=>{
    calls.push({action,params});
    return {jobs:[{
      id:'2117709706166172517',
      title:'Example job',
      url:'https://www.upwork.com/jobs/~022117709706166172517',
      client:{country:'Canada'},
      published_date:postedAt
    }]};
  }};
  const quota={nextAvailableMs:()=>0,reserve:()=>{}};
  const service=createSearchRunsService(mcp,quota,undefined,{
    publishProgress:progress=>progressEvents.push(progress),
    leadRepository:{
      upsertMany:async(leads,context)=>storedLeadBatches.push({leads,context})
    }
  });
  const started=service.startManualRun({country:'Canada',limit:5});
  assert.equal(started.plannedRequests,13);
  assert.equal(started.jobsCount,0);
  const run=await waitForFinishedRun(service,started.id);
  assert.equal(run.status,'complete');
  assert.equal(run.completedRequests,13);
  assert.equal(run.trigger,'manual');
  assert.equal(run.country,'Canada');
  assert.equal(calls.length,13);
  assert.ok(calls.every(({action,params})=>action==='search'&&params.location==='Canada'&&params.limit===5));
  assert.equal(run.jobs.length,1);
  assert.equal(run.jobsCount,run.jobs.length);
  assert.equal(run.jobs[0].postedAt,postedAt);
  assert.equal(run.jobs[0].searchedKeywords.length,13);
  assert.equal(progressEvents.length,14);
  assert.equal(progressEvents[0].completedRequests,1);
  assert.equal(progressEvents[0].status,'running');
  assert.equal(progressEvents[0].jobs[0].searchedKeywords.length,1);
  assert.equal(progressEvents.at(-1).completedRequests,13);
  assert.equal(progressEvents.at(-1).status,'complete');
  assert.equal(progressEvents.at(-1).jobsCount,1);
  assert.equal(progressEvents.at(-1).stored,true);
  assert.equal(storedLeadBatches.length,13);
  assert.ok(storedLeadBatches.every(batch=>batch.context.searchRunId===run.id));
});

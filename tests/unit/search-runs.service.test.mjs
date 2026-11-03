import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchRunsService } from '../../src/modules/search-runs/search-runs.service.mjs';

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
  const mcp={call:async(action,params)=>{calls.push({action,params});return {jobs:[]};}};
  const quota={nextAvailableMs:()=>0,reserve:()=>{}};
  const service=new SearchRunsService(mcp,quota);
  const started=service.startManualRun({country:'Canada',limit:5});
  assert.equal(started.plannedRequests,13);
  const run=await waitForFinishedRun(service,started.id);
  assert.equal(run.status,'complete');
  assert.equal(run.completedRequests,13);
  assert.equal(run.trigger,'manual');
  assert.equal(run.country,'Canada');
  assert.equal(calls.length,13);
  assert.ok(calls.every(({action,params})=>action==='search'&&params.location==='Canada'&&params.limit===5));
});

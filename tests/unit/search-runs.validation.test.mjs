import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStartSearchRunInput } from '../../src/modules/search-runs/search-runs.validation.mjs';

test('search run accepts, trims and deduplicates manual keywords',()=>{
  const result=parseStartSearchRunInput({
    limit:5,
    keywords:[' React development ','Node.js API','React development']
  });

  assert.deepEqual(result,{
    limit:5,
    keywords:['React development','Node.js API']
  });
});

test('search run keeps configured keywords when keywords are omitted',()=>{
  assert.deepEqual(parseStartSearchRunInput({limit:10}),{
    limit:10,
    keywords:undefined
  });
});

test('search run rejects invalid manual keyword lists',()=>{
  for (const keywords of [[],[''],[42],Array.from({length:14},(_,index)=>`keyword-${index}`)]) {
    assert.throws(
      ()=>parseStartSearchRunInput({keywords}),
      error=>error.statusCode===400&&/keywords must be an array/i.test(error.message)
    );
  }
});

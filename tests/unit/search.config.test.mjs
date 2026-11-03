import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYWORDS, expandSearches, normalizeCountry } from '../../src/config/search.config.mjs';
import { formatJobs } from '../../src/modules/search-runs/search-runs.parsed-response.mjs';

test('there are exactly 13 configured keywords',()=>assert.equal(KEYWORDS.length,13));
test('manual cycle uses one configured country for all 13 calls',()=>{
  const searches=expandSearches({country:'United States'});
  assert.equal(searches.length,13);
  assert.ok(searches.every(search=>search.country==='United States'));
});
test('country whitelist requires actual US/Canada metadata',()=>{
  assert.equal(normalizeCountry('USA'),'United States');
  assert.equal(normalizeCountry('Canada'),'Canada');
  assert.equal(normalizeCountry('North America'),null);
  assert.equal(normalizeCountry(undefined),null);
});
test('jobs are deduplicated and unrelated countries are excluded',()=>{
  const results=formatJobs([
    {id:'123',title:'One',url:'https://www.upwork.com/jobs/~02123',client:{country:'USA'}},
    {id:'123',title:'Duplicate',url:'https://www.upwork.com/jobs/~02123',client:{country:'United States'}},
    {id:'124',title:'Unknown',url:'https://www.upwork.com/jobs/~02124',client:{}},
    {id:'125',title:'Foreign',url:'https://www.upwork.com/jobs/~02125',client:{country:'Australia'}},
    {id:'126',title:'Canada',url:'https://www.upwork.com/jobs/~02126',client:{country:'Canada'}}
  ]);
  assert.deepEqual(results.map(result=>result.id),['123','126']);
});

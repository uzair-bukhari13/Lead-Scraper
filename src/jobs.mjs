import { randomUUID } from 'node:crypto';
import { KEYWORDS, expandSearches, formatJobs } from './config.mjs';

const RUN_TTL_MS = 15 * 60_000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export class SearchService {
  constructor(mcp, quota) {
    this.mcp = mcp;
    this.quota = quota;
    this.runs = new Map();
    this.busy = false;
  }
  async #regulatedCall(action, params) {
    // A user-initiated batch can wait for our conservative spacing window, but
    // it MUST stop rather than rescheduling itself after a long quota exhaustion.
    const wait = this.quota.nextAvailableMs();
    if (wait > 60_000) {
      const err = new Error('Search quota exhausted; start a new manual run later');
      err.statusCode = 429;
      throw err;
    }
    if (wait) await pause(wait + 10);
    this.quota.reserve();
    return await this.mcp.call(action, params);
  }
  async searchOnce({ keyword, country, limit = 10 }) {
    if (this.busy) throw Object.assign(new Error('Another search is in progress'), {statusCode:409});
    this.busy = true;
    try {
      const params = {query:keyword,sort:'recency',limit};
      if (country) params.location = country;
      const result = await this.#regulatedCall('search', params);
      if (result.filters_rejected?.length || result.filters_ignored?.length) {
        const e = new Error('Upwork rejected or ignored requested filters');
        e.statusCode = 502; throw e;
      }
      return {jobs:formatJobs(result.jobs || [], country),pageInfo:result.pageInfo || null,hasMore:!!result.hasMore};
    } finally { this.busy = false; }
  }
  async jobDetail(id) {
    if (this.busy) throw Object.assign(new Error('Another Upwork request is in progress'), {statusCode:409});
    this.busy = true;
    try {
      const response = await this.#regulatedCall('get',{id});
      const raw = response.data?.marketplaceJobPosting;
      if (!raw) throw Object.assign(new Error('Job details unavailable'),{statusCode:404});
      const countryRaw = raw.clientCompanyPublic?.country?.name;
      // Exclude unverified geographic eligibility (the response must provide country).
      const {normalizeCountry} = await import('./config.mjs');
      const country = normalizeCountry(countryRaw);
      if (!country) throw Object.assign(new Error('Client location outside US/Canada or unknown'),{statusCode:403});
      return {
        source:'Upwork',
        id:String(raw.id || id),title:raw.content?.title || 'Untitled job',
        url:raw.url,clientCountry:country,
        description:typeof raw.content?.description === 'string'
          ? raw.content.description.replace(/<\/?untrusted_participant_content>/g,'').trim() : null,
        terms:raw.contractTerms ?? null,
        status:raw.workFlowState?.status || null,
        clientRecord:response.client_record || null
      };
    } finally {this.busy = false;}
  }
  startManualRun({country,limit=10}={}) {
    this.clean();
    if (this.busy) throw Object.assign(new Error('A search batch is already running'),{statusCode:409});
    const searches = expandSearches({keywords:KEYWORDS,country});
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw Object.assign(new Error('limit must be 1–10'), {statusCode:400});
    const id=randomUUID();
    const run={id,status:'running',startedAt:new Date().toISOString(),finishedAt:null,expiresAt:Date.now()+RUN_TTL_MS,
      plannedRequests:searches.length,completedRequests:0,errors:[],jobs:[],trigger:'manual',country,stored:false};
    this.runs.set(id,run);
    this.busy=true;
    this.#execute(run,searches,limit).catch(()=>{});
    return {id,status:run.status,plannedRequests:run.plannedRequests};
  }
  async #execute(run,searches,limit) {
    const ids = new Set();
    try {
      for (const {keyword,country} of searches) {
        const params={query:keyword,sort:'recency',limit};
        if (country) params.location=country;
        let response;
        try { response=await this.#regulatedCall('search',params); }
        catch(e) { run.errors.push({keyword,country,message:e.message}); break; }
        run.completedRequests++;
        if (response.filters_rejected?.length || response.filters_ignored?.length) {
          run.errors.push({keyword,country,message:'One or more filters rejected or ignored'});
          continue;
        }
        const matches=formatJobs(response.jobs || [],country);
        for (const job of matches) if (!ids.has(job.id)) {ids.add(job.id);run.jobs.push(job);}
      }
      run.status=run.errors.length ? 'partial' : 'complete';
    } catch(e) {
      run.errors.push({message:e.message});run.status='failed';
    } finally {
      this.busy=false;
      run.finishedAt=new Date().toISOString();
      run.expiresAt=Date.now()+RUN_TTL_MS;
    }
  }
  getRun(id) {this.clean();const run=this.runs.get(id); if (!run) throw Object.assign(new Error('Run not found or expired'),{statusCode:404});return run;}
  clean() {const now=Date.now();for(const [id,r] of this.runs) if(r.expiresAt<now && r.status!=='running') this.runs.delete(id);}
}

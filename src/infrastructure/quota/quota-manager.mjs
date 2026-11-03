import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class QuotaError extends Error {
  constructor(waitMs,window) {
    super(`Local Upwork safety limit reached (${window}); retry later`);
    this.statusCode=429;
    this.retryAfterSeconds=Math.max(1,Math.ceil(waitMs/1000));
  }
}

export class QuotaManager {
  constructor({path,minute=10,hour=100,day=500,gapMs=7000,clock=()=>Date.now()}={}) {
    this.path=path;
    this.limits=[
      {label:'minute',ms:60_000,max:minute},
      {label:'hour',ms:3_600_000,max:hour},
      {label:'day',ms:86_400_000,max:day}
    ];
    this.gapMs=gapMs;
    this.clock=clock;
    if (!path) this.history=[];
    else {
      try {this.history=JSON.parse(readFileSync(path,'utf8')).history||[];}
      catch(error) {if(error.code!=='ENOENT') throw error;this.history=[];}
    }
    if (!Array.isArray(this.history)) throw new Error('Invalid quota store');
  }
  prune=now=>{this.history=this.history.filter(timestamp=>Number.isFinite(timestamp)&&timestamp>=now-86_400_000);};
  check=(now=this.clock())=>{
    this.prune(now);
    const last=this.history.at(-1);
    if (last!==undefined&&now<last+this.gapMs) return {waitMs:last+this.gapMs-now,window:'spacing'};
    for (const {label,ms,max} of this.limits) {
      const active=this.history.filter(timestamp=>timestamp>now-ms);
      if (active.length>=max) return {waitMs:active[active.length-max]+ms-now+1,window:label};
    }
    return null;
  };
  reserve=()=>{
    const now=this.clock();
    const blocked=this.check(now);
    if (blocked) throw new QuotaError(blocked.waitMs,blocked.window);
    this.history.push(now);
    this.#persist();
  };
  nextAvailableMs=()=>this.check()?.waitMs||0;
  stats=()=>{
    const now=this.clock();
    this.prune(now);
    return {
      source:'locally-recorded requests only',
      limits:Object.fromEntries(this.limits.map(({label,max,ms})=>[label,{used:this.history.filter(timestamp=>timestamp>now-ms).length,max}])),
      nextAllowedInSeconds:Math.ceil(this.nextAvailableMs()/1000)
    };
  };
  #persist=()=>{
    if (!this.path) return;
    mkdirSync(dirname(this.path),{recursive:true,mode:0o700});
    const temp=`${this.path}.${process.pid}.tmp`;
    writeFileSync(temp,JSON.stringify({history:this.history}),{mode:0o600});
    renameSync(temp,this.path);
  };
}

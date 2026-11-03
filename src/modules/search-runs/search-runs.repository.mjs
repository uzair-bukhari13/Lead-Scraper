export class SearchRunRepository {
  constructor({clock=()=>Date.now()}={}) {
    this.clock=clock;
    this.runs=new Map();
  }
  create=run=>{
    this.runs.set(run.id,run);
    return run;
  };
  findById=id=>{
    this.removeExpired();
    return this.runs.get(id)||null;
  };
  removeExpired=()=>{
    const now=this.clock();
    for (const [id,run] of this.runs) {
      if (run.expiresAt<now&&run.status!=='running') this.runs.delete(id);
    }
  };
}

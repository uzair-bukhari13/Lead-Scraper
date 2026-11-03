import { normalizeCountry } from '../../config/search.config.mjs';

export const canonicalJobId=job=>{
  if (job&&String(job.id||'').trim()) return String(job.id).trim();
  if (typeof job?.url!=='string') return null;
  const match=job.url.match(/~0?2(\d{15,})/);
  return match?match[1]:null;
};

export const formatJobs=(jobs,location=null)=>{
  if (!Array.isArray(jobs)) return [];
  const ids=new Set();
  const results=[];
  for (const job of jobs) {
    const country=normalizeCountry(job.client?.country);
    const id=canonicalJobId(job);
    if (!id||!country||(location&&country!==location)||ids.has(id)) continue;
    if (typeof job.url!=='string') continue;
    try {
      const parsed=new URL(job.url);
      if (!['www.upwork.com','upwork.com'].includes(parsed.hostname)||parsed.protocol!=='https:') continue;
    } catch {continue;}
    ids.add(id);
    results.push({
      id,
      title:typeof job.title==='string'?job.title:'Untitled job',
      url:job.url,
      source:'Upwork',
      country,
      budget:job.budget??null,
      jobType:job.job_type??null,
      duration:job.duration??null,
      postedAt:job.published_date??job.created_date??null,
      skills:Array.isArray(job.skills)?job.skills:[],
      summary:typeof job.description_snippet==='string'
        ?job.description_snippet.replace(/<\/?untrusted_participant_content>/g,'').trim()
        :null
    });
  }
  return results;
};

import { normalizeCountry } from '../../config/search.config.mjs';

export const canonicalJobId=job=>{
  if (job&&String(job.id||'').trim()) return String(job.id).trim();
  if (typeof job?.url!=='string') return null;
  const match=job.url.match(/~0?2(\d{15,})/);
  return match?match[1]:null;
};

const hasAttachments=job=>{
  if (Array.isArray(job?.attachments)) return job.attachments.length>0;
  if (Array.isArray(job?.attachment)) return job.attachment.length>0;
  if (typeof job?.hasAttachments==='boolean') return job.hasAttachments;
  if (typeof job?.has_attachments==='boolean') return job.has_attachments;
  return false;
};

export const formatJobs=(jobs,location=null,searchedKeyword=null)=>{
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
      hasAttachments:hasAttachments(job),
      searchedKeywords:searchedKeyword?[searchedKeyword]:[],
      skills:Array.isArray(job.skills)?job.skills:[],
      summary:typeof job.description_snippet==='string'
        ?job.description_snippet.replace(/<\/?untrusted_participant_content>/g,'').trim()
        :null
    });
  }
  return results;
};

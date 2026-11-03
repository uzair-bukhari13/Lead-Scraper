export const KEYWORDS = Object.freeze([
  'Web development',
  'Mobile app development',
  'Marketing',
  'Search Engine Optimization',
  'Social Media Marketing',
  'CMS development',
  'AI Automation',
  'SaaS Development',
  'IT Solution provider',
  'UI design',
  'Branding',
  'Web design',
  'Website'
]);

export const COUNTRIES = Object.freeze(['United States', 'Canada']);
export const UPWORK_PUBLIC_URL = 'https://mcp.upwork.com/mcp';

export function normalizeCountry(raw) {
  if (typeof raw !== 'string') return null;
  const country = raw.trim().toLowerCase();
  if (country === 'united states' || country === 'united states of america' || country === 'usa' || country === 'us') return 'United States';
  if (country === 'canada' || country === 'ca') return 'Canada';
  return null;
}

export function expandSearches({ keywords = KEYWORDS, country } = {}) {
  if (!Array.isArray(keywords) || keywords.length < 1 || keywords.length > 13) throw new Error('Provide 1 to 13 keywords');
  if (!COUNTRIES.includes(country)) throw new Error('country must be United States or Canada');
  const cleaned = [...new Set(keywords.map(k => {
    if (typeof k !== 'string' || !k.trim() || k.length > 80) throw new Error('Invalid keyword');
    return k.trim();
  }))];
  return cleaned.map(keyword => ({ keyword, country }));
}

export function canonicalJobId(job) {
  if (job && String(job.id || '').trim()) return String(job.id).trim();
  const url = job?.url;
  if (typeof url !== 'string') return null;
  const match = url.match(/~0?2(\d{15,})/);
  return match ? match[1] : null;
}

export function formatJobs(jobs, location = null) {
  if (!Array.isArray(jobs)) return [];
  const ids = new Set();
  const results = [];
  for (const j of jobs) {
    const country = normalizeCountry(j.client?.country);
    const id = canonicalJobId(j);
    if (!id || !country || (location && country !== location) || ids.has(id)) continue;
    if (typeof j.url !== 'string') continue;
    try {
      const parsed = new URL(j.url);
      if (!['www.upwork.com', 'upwork.com'].includes(parsed.hostname) || parsed.protocol !== 'https:') continue;
    } catch { continue; }
    ids.add(id);
    results.push({
      id,
      title: typeof j.title === 'string' ? j.title : 'Untitled job',
      url: j.url,
      source: 'Upwork',
      country,
      budget: j.budget ?? null,
      jobType: j.job_type ?? null,
      duration: j.duration ?? null,
      postedAt: j.published_date ?? j.created_date ?? null,
      skills: Array.isArray(j.skills) ? j.skills : [],
      summary: typeof j.description_snippet === 'string'
        ? j.description_snippet.replace(/<\/?untrusted_participant_content>/g, '').trim()
        : null
    });
  }
  return results;
}

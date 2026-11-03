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

export const normalizeCountry=raw=>{
  if (typeof raw !== 'string') return null;
  const country = raw.trim().toLowerCase();
  if (['united states','united states of america','usa','us'].includes(country)) return 'United States';
  if (['canada','ca'].includes(country)) return 'Canada';
  return null;
};

export const expandSearches=({keywords=KEYWORDS,country}={})=>{
  if (!Array.isArray(keywords)||keywords.length<1||keywords.length>13) throw new Error('Provide 1 to 13 keywords');
  if (!COUNTRIES.includes(country)) throw new Error('country must be United States or Canada');
  const cleaned=[...new Set(keywords.map(keyword=>{
    if (typeof keyword!=='string'||!keyword.trim()||keyword.length>80) throw new Error('Invalid keyword');
    return keyword.trim();
  }))];
  return cleaned.map(keyword=>({keyword,country}));
};

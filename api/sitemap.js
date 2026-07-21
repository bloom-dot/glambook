// Sitemap dynamique : pages statiques + profils artistes actifs (slug)
const SITE = 'https://glambook-pi.vercel.app';

module.exports = async function handler(req, res) {
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/artists.html', priority: '0.9', changefreq: 'daily' },
    { loc: '/auth/register.html', priority: '0.6', changefreq: 'monthly' },
    { loc: '/legal/mentions-legales.html', priority: '0.2', changefreq: 'yearly' },
    { loc: '/legal/cgu.html', priority: '0.2', changefreq: 'yearly' },
    { loc: '/legal/cgv.html', priority: '0.2', changefreq: 'yearly' },
    { loc: '/legal/confidentialite.html', priority: '0.2', changefreq: 'yearly' }
  ];

  let artistUrls = [];
  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/artists_public?select=slug,created_at&order=created_at.desc&limit=1000`,
      { headers: { apikey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
                   Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    const artists = await r.json();
    if (Array.isArray(artists)) {
      artistUrls = artists
        .filter(a => a.slug)
        .map(a => ({ loc: `/artiste/${encodeURIComponent(a.slug)}`, priority: '0.8', changefreq: 'weekly' }));
    }
  } catch (e) {
    console.error('Sitemap: erreur artistes', e);
  }

  const urls = [...staticPages, ...artistUrls]
    .map(u => `  <url><loc>${SITE}${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
    .join('\n');

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  );
};

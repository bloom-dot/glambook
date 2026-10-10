// Maintien en activité de la base Supabase.
// Le plan gratuit met le projet en pause après ~7 jours sans requête : tout le site dynamique
// (connexion, profils, devis, messagerie) cesse alors de répondre. Vercel appelle cette fonction
// une fois par jour (voir « crons » dans vercel.json) ; une lecture minuscule suffit.
module.exports = async function handler(req, res) {
  // Vercel envoie « Bearer <CRON_SECRET> » aux tâches planifiées quand la variable existe
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ ok: false });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ ok: false, error: 'non configuré' });
  try {
    const r = await fetch(`${url}/rest/v1/artists?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, at: new Date().toISOString() });
  } catch (e) {
    console.error('keepalive', e);
    return res.status(502).json({ ok: false });
  }
};

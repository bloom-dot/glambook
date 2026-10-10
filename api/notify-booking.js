// Prévient la cliente quand la maquilleuse confirme ou refuse un rendez-vous réservé sur un créneau.
// Appelé par l'espace pro juste après la mise à jour du statut (le statut fait foi : on relit la base).
// POST { bookingId }  + en-tête Authorization: Bearer <jeton de session de la maquilleuse>
// Une seule notification par rendez-vous et par statut (compteur api_usage).
// Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_FROM, PUBLIC_SITE_URL
const { originAllowed } = require('./_shared');

const SITE = (process.env.PUBLIC_SITE_URL || 'https://glambook-pi.vercel.app').replace(/\/+$/, '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const euros = (c) => (Math.round(Number(c) || 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

module.exports = async function handler(req, res) {
  if (!originAllowed(req)) return res.status(403).json({ error: 'Origine non autorisée' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { bookingId } = req.body || {};
  if (!bookingId || !UUID_RE.test(bookingId)) return res.status(400).json({ error: 'Paramètres invalides' });
  const auth = req.headers.authorization || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'Authentification requise' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Service non configuré' });
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ ok: true, emailed: false });
  const H = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    const ur = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${jwt}` } });
    if (!ur.ok) return res.status(401).json({ error: 'Session invalide' });
    const user = await ur.json();

    const br = await fetch(`${url}/rest/v1/bookings?id=eq.${bookingId}&select=id,status,date,time_slot,address,client_name,client_email,access_token,services(name,price_cents),artists(display_name,user_id)`, { headers: H });
    const [b] = br.ok ? await br.json() : [];
    if (!b) return res.status(404).json({ error: 'Rendez-vous introuvable' });
    if (b.artists?.user_id !== user.id) return res.status(403).json({ error: 'Accès refusé' });
    if (!['confirmed', 'cancelled'].includes(b.status) || !b.client_email || /\.invalid$/i.test(b.client_email)) return res.status(200).json({ ok: true, emailed: false });

    // Une seule fois par statut
    const tag = `notify:${b.id}:${b.status}`;
    const cr = await fetch(`${url}/rest/v1/api_usage?endpoint=eq.${encodeURIComponent(tag)}&select=id&limit=1`, { headers: H });
    if (cr.ok && (await cr.json()).length) return res.status(200).json({ ok: true, emailed: false, already: true });
    await fetch(`${url}/rest/v1/api_usage`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ endpoint: tag, user_id: user.id }) });

    const artist = b.artists?.display_name || 'Votre maquilleuse';
    const when = `${new Date(b.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} à ${b.time_slot}`;
    const first = String(b.client_name || '').split(' ')[0];
    const ok = b.status === 'confirmed';
    const link = b.access_token ? `${SITE}/rdv.html?t=${b.access_token}` : `${SITE}/rdv.html`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/></head>
<body style="margin:0;background:#F4F2F5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#17151A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0E0E10;padding:20px 28px;"><span style="font-size:22px;font-weight:800;letter-spacing:.04em;color:#F4F2F5;">GLAM<span style="color:#D4AF37;">BOOK</span></span></td></tr>
<tr><td style="padding:28px;font-size:15px;">
<p style="margin:0 0 14px;">Bonjour ${esc(first)},</p>
<p style="margin:0 0 18px;line-height:1.6;color:#4B4651;">${ok
  ? `<b>${esc(artist)}</b> confirme votre rendez-vous du <b>${esc(when)}</b>${b.address ? ' à ' + esc(b.address) : ''}.${b.services ? `<br/>${esc(b.services.name)} · ${euros(b.services.price_cents)} à régler sur place.` : ''}`
  : `<b>${esc(artist)}</b> ne peut malheureusement pas assurer votre rendez-vous du <b>${esc(when)}</b>. Le créneau est annulé, vous n’avez rien à faire.`}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#D4AF37;border-radius:8px;">
<a href="${esc(ok ? link : SITE + '/artists.html?mode=express')}" style="display:inline-block;padding:14px 26px;color:#17120A;font-weight:800;text-decoration:none;letter-spacing:.06em;text-transform:uppercase;font-size:14px;">${ok ? 'Voir mon rendez-vous' : 'Trouver un autre créneau'}</a></td></tr></table>
</td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #EAE6EC;font-size:12px;color:#8A8590;">E-mail envoyé par GlamBook.</td></tr>
</table></td></tr></table></body></html>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'GlamBook <onboarding@resend.dev>', to: [b.client_email], subject: ok ? `Rendez-vous confirmé — ${when}` : `Rendez-vous du ${when} annulé`, html }),
    });
    if (!r.ok) console.error('Resend', r.status, await r.text().catch(() => ''));
    return res.status(200).json({ ok: true, emailed: r.ok });
  } catch (err) {
    console.error('notify-booking', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

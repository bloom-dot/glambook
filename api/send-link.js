// Liens personnels du parcours sans compte (/rdv.html?t=<jeton>)
//
// POST { token }  → juste après une demande ou une réservation : envoie à la cliente l'e-mail
//                   contenant son lien personnel, et prévient la maquilleuse. Une seule fois par
//                   jeton (link_sent_at), pour qu'on ne puisse pas s'en servir pour bombarder une boîte.
// POST { cancelled } → (jeton) la cliente vient d'annuler : la maquilleuse est prévenue, une fois.
// POST { email }  → « Retrouver mon rendez-vous » : renvoie à cette adresse les liens de ses
//                   demandes et rendez-vous en cours. Réponse identique que l'adresse soit connue
//                   ou non (rien à deviner), 3 envois par heure et par adresse au maximum.
//
// Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_FROM, PUBLIC_SITE_URL
const crypto = require('crypto');
const { originAllowed } = require('./_shared');

const SITE = (process.env.PUBLIC_SITE_URL || 'https://glambook-pi.vercel.app').replace(/\/+$/, '');
const TOKEN_RE = /^[0-9a-f]{64}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const euros = (c) => (Math.round(Number(c) || 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const dateFr = (d, withTime) => {
  if (!d) return '';
  const x = new Date(d);
  return x.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
};

module.exports = async function handler(req, res) {
  if (!originAllowed(req)) return res.status(403).json({ error: 'Origine non autorisée' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Service non configuré' });
  const H = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async (path) => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: H }); return r.ok ? r.json() : []; };
  const patch = (path, body) => fetch(`${url}/rest/v1/${path}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  const emailOn = !!process.env.RESEND_API_KEY;
  // Compteur dans api_usage : vrai si moins de `max` passages sur l'heure écoulée (et compte celui-ci)
  async function underLimit(tag, max) {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const cr = await fetch(`${url}/rest/v1/api_usage?endpoint=eq.${encodeURIComponent(tag)}&created_at=gte.${encodeURIComponent(since)}&select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
    const total = parseInt((cr.headers.get('content-range') || '/0').split('/')[1], 10) || 0;
    if (total >= max) return false;
    await fetch(`${url}/rest/v1/api_usage`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ endpoint: tag }) });
    return true;
  }
  const { token, email, cancelled } = req.body || {};

  try {
    // ── 0. Annulation par la cliente : prévenir la maquilleuse ──
    if (cancelled) {
      if (!TOKEN_RE.test(cancelled)) return res.status(400).json({ error: 'Lien invalide' });
      if (!emailOn) return res.status(200).json({ ok: true, emailed: false });
      let kind = 'request';
      let [it] = await get(`booking_requests?access_token=eq.${cancelled}&select=id,artist_id,status,client_name,event_date`);
      if (!it) { kind = 'booking'; [it] = await get(`bookings?access_token=eq.${cancelled}&select=id,artist_id,status,client_name,date,time_slot,services(name)`); }
      // Le statut fait foi : rien n'est envoyé tant que la ligne n'est pas réellement annulée
      if (!it || it.status !== 'cancelled') return res.status(200).json({ ok: true, emailed: false });
      const tag = `annul:${it.id}`;
      const seen = await get(`api_usage?endpoint=eq.${encodeURIComponent(tag)}&select=id&limit=1`);
      if (seen.length) return res.status(200).json({ ok: true, emailed: false, already: true });
      await fetch(`${url}/rest/v1/api_usage`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ endpoint: tag }) });
      const [artist] = await get(`artists?id=eq.${it.artist_id}&select=user_id`);
      const ar = artist?.user_id ? await fetch(`${url}/auth/v1/admin/users/${artist.user_id}`, { headers: H }) : null;
      const to = ar?.ok ? (await ar.json())?.email : null;
      if (!to || /\.invalid$/i.test(to)) return res.status(200).json({ ok: true, emailed: false });
      const when = kind === 'request' ? dateFr(it.event_date, true) : `${dateFr(it.date + 'T12:00:00')} à ${it.time_slot}`;
      const sent = await send({
        to,
        subject: kind === 'request' ? `Demande annulée — ${it.client_name || 'une cliente'}` : `Rendez-vous annulé — ${when}`,
        html: layout(`
          <p style="margin:0 0 14px;">Bonjour,</p>
          <p style="margin:0 0 18px;line-height:1.6;color:#4B4651;">${kind === 'request'
            ? `<b>${esc(it.client_name || 'La cliente')}</b> a annulé sa demande de devis pour le <b>${esc(when)}</b>. Vous n’avez rien à faire.`
            : `<b>${esc(it.client_name || 'La cliente')}</b> a annulé son rendez-vous${it.services?.name ? ' (' + esc(it.services.name) + ')' : ''} du <b>${esc(when)}</b>. Le créneau est de nouveau libre.`}</p>
          ${button(`${SITE}/dashboard/artist.html`, 'Ouvrir mon espace')}`),
      }).catch(() => false);
      return res.status(200).json({ ok: true, emailed: !!sent });
    }

    // ── 1. Confirmation après une demande ou une réservation ──
    if (token) {
      if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Lien invalide' });
      let kind = 'request';
      let [it] = await get(`booking_requests?access_token=eq.${token}&select=id,artist_id,client_name,client_email,event_date,event_address,note,services_snapshot,link_sent_at,created_at`);
      if (!it) { kind = 'booking'; [it] = await get(`bookings?access_token=eq.${token}&select=id,artist_id,client_name,client_email,client_phone,date,time_slot,address,service_id,link_sent_at,created_at`); }
      if (!it) return res.status(404).json({ error: 'Introuvable' });
      if (it.link_sent_at) return res.status(200).json({ ok: true, emailed: false, already: true });
      if (!emailOn) return res.status(200).json({ ok: true, emailed: false });
      // Envoi seulement juste après la demande : un vieux jeton ne sert pas à relancer des e-mails
      if (Date.now() - new Date(it.created_at).getTime() > 30 * 60e3) return res.status(200).json({ ok: true, emailed: false, expired: true });
      // Garde-fou par connexion : 20 confirmations par heure et par adresse IP
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
      if (!(await underLimit('lien-ip:' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32), 20))) return res.status(429).json({ error: 'Trop de demandes' });
      // « Envoyé » posé de façon atomique : deux appels simultanés n'envoient qu'un seul e-mail
      const table = kind === 'request' ? 'booking_requests' : 'bookings';
      const pr = await fetch(`${url}/rest/v1/${table}?id=eq.${it.id}&link_sent_at=is.null`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ link_sent_at: new Date().toISOString() }) });
      const claimed = pr.ok ? await pr.json() : [];
      if (!claimed.length) return res.status(200).json({ ok: true, emailed: false, already: true });

      const [artist] = await get(`artists?id=eq.${it.artist_id}&select=display_name,user_id`);
      const artistName = artist?.display_name || 'votre maquilleuse';
      let svc = null;
      if (kind === 'booking' && it.service_id) [svc] = await get(`services?id=eq.${it.service_id}&select=name,price_cents`);
      const link = `${SITE}/rdv.html?t=${token}`;
      const when = kind === 'request' ? dateFr(it.event_date, true) : `${dateFr(it.date + 'T12:00:00')} à ${it.time_slot}`;

      const first = String(it.client_name || '').split(' ')[0];
      const clientMail = await send({
        to: it.client_email,
        subject: kind === 'request' ? `Votre demande à ${artistName} est envoyée` : `Votre rendez-vous du ${when} avec ${artistName}`,
        html: layout(`
          <p style="margin:0 0 14px;">Bonjour ${esc(first)},</p>
          <p style="margin:0 0 18px;line-height:1.6;color:#4B4651;">${kind === 'request'
            ? `${esc(artistName)} a bien reçu votre demande pour le <b>${esc(when)}</b>. Elle vous répondra par un devis, que vous pourrez lire et signer depuis ce même lien.`
            : `Votre demande de rendez-vous du <b>${esc(when)}</b>${svc ? ` (${esc(svc.name)}, ${euros(svc.price_cents)} à régler sur place)` : ''} est envoyée à ${esc(artistName)}. Vous recevrez sa confirmation.`}</p>
          ${button(link, kind === 'request' ? 'Suivre ma demande' : 'Voir mon rendez-vous')}
          <p style="margin:18px 0 0;font-size:13px;color:#6B6670;line-height:1.5;">Gardez cet e-mail : ce lien vous permet de suivre, ${kind === 'request' ? 'signer le devis' : 'déplacer'} ou annuler, sans mot de passe. Ne le transmettez pas.</p>`),
      });

      // La maquilleuse est prévenue (sauf adresses techniques de démonstration)
      // Envoi raté : on libère le jeton pour qu'un nouvel essai reste possible
      if (!clientMail) await patch(`${table}?id=eq.${it.id}`, { link_sent_at: null });
      if (artist?.user_id) {
        const ar = await fetch(`${url}/auth/v1/admin/users/${artist.user_id}`, { headers: H });
        const au = ar.ok ? await ar.json() : null;
        const to = au?.email;
        if (to && !/\.invalid$/i.test(to)) {
          await send({
            to,
            reply_to: it.client_email,
            subject: kind === 'request' ? `Nouvelle demande de devis — ${it.client_name}` : `Nouveau rendez-vous à confirmer — ${when}`,
            html: layout(`
              <p style="margin:0 0 14px;">Bonjour,</p>
              <p style="margin:0 0 18px;line-height:1.6;color:#4B4651;">${kind === 'request'
                ? `<b>${esc(it.client_name)}</b> vous demande un devis pour le <b>${esc(when)}</b>${it.event_address ? ' à ' + esc(it.event_address) : ''}.${it.note ? `<br/><br/><i>« ${esc(it.note)} »</i>` : ''}`
                : `<b>${esc(it.client_name)}</b> a réservé ${svc ? esc(svc.name) + ' ' : ''}le <b>${esc(when)}</b>${it.address ? ' à ' + esc(it.address) : ''}. Confirmez-le depuis votre agenda.`}</p>
              ${button(`${SITE}/dashboard/artist.html${kind === 'request' ? '#demandes' : '#reservations'}`, kind === 'request' ? 'Répondre par un devis' : 'Confirmer le rendez-vous')}`),
          }).catch(() => {});
        }
      }
      return res.status(200).json({ ok: true, emailed: clientMail });
    }

    // ── 2. Retrouver mon rendez-vous ──
    if (email) {
      const mail = String(email).trim().toLowerCase();
      if (!EMAIL_RE.test(mail) || mail.length > 200) return res.status(400).json({ error: 'Adresse invalide' });
      if (!emailOn) return res.status(200).json({ ok: true, emailEnabled: false });
      if (/[%*\\,()]/.test(mail)) return res.status(400).json({ error: 'Adresse invalide' });
      if (!(await underLimit('retrouver:' + crypto.createHash('sha256').update(mail).digest('hex').slice(0, 32), 3))) return res.status(200).json({ ok: true, emailEnabled: true });

      const today = new Date().toISOString().slice(0, 10);
      const e = encodeURIComponent(mail);
      // Égalité stricte (les adresses sont enregistrées en minuscules) : pas de jokers % ou _
      const reqs = await get(`booking_requests?client_email=eq.${e}&status=in.(pending,quoted)&select=access_token,event_date,artists(display_name)&order=created_at.desc&limit=10`);
      const bks = await get(`bookings?client_email=eq.${e}&status=in.(pending,confirmed)&date=gte.${today}&select=access_token,date,time_slot,artists(display_name)&order=date.asc&limit=10`);
      const rows = [
        ...bks.map(b => ({ t: b.access_token, txt: `Rendez-vous du ${dateFr(b.date + 'T12:00:00')} à ${b.time_slot} — ${b.artists?.display_name || ''}` })),
        ...reqs.map(r => ({ t: r.access_token, txt: `Demande de devis pour le ${dateFr(r.event_date)} — ${r.artists?.display_name || ''}` })),
      ].filter(x => x.t);
      if (rows.length) {
        await send({
          to: mail,
          subject: 'Vos rendez-vous GlamBook',
          html: layout(`
            <p style="margin:0 0 16px;line-height:1.6;color:#4B4651;">Voici vos demandes et rendez-vous en cours. Chaque lien ouvre la page correspondante, sans mot de passe.</p>
            ${rows.map(x => `<p style="margin:0 0 10px;"><a href="${SITE}/rdv.html?t=${x.t}" style="color:#8A6A12;font-weight:600;">${esc(x.txt)}</a></p>`).join('')}
            <p style="margin:18px 0 0;font-size:13px;color:#6B6670;">Vous n’avez rien demandé ? Ignorez simplement cet e-mail.</p>`),
        }).catch(() => {});
      }
      return res.status(200).json({ ok: true, emailEnabled: true });
    }
    return res.status(400).json({ error: 'Paramètres manquants' });
  } catch (err) {
    console.error('send-link', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

async function send({ to, subject, html, reply_to }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'GlamBook <onboarding@resend.dev>', to: [to], subject, html, reply_to: reply_to || undefined }),
  });
  if (!r.ok) console.error('Resend', r.status, await r.text().catch(() => ''));
  return r.ok;
}
function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#D4AF37;border-radius:8px;">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;color:#17120A;font-weight:800;text-decoration:none;letter-spacing:.06em;text-transform:uppercase;font-size:14px;">${esc(label)}</a></td></tr></table>
    <p style="margin:12px 0 0;font-size:12px;color:#8A8590;word-break:break-all;">${esc(href)}</p>`;
}
function layout(inner) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;background:#F4F2F5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#17151A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0E0E10;padding:20px 28px;"><span style="font-size:22px;font-weight:800;letter-spacing:.04em;color:#F4F2F5;">GLAM<span style="color:#D4AF37;">BOOK</span></span></td></tr>
<tr><td style="padding:28px;font-size:15px;">${inner}</td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #EAE6EC;font-size:12px;color:#8A8590;">E-mail envoyé par GlamBook.</td></tr>
</table></td></tr></table></body></html>`;
}

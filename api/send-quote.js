// Envoi du devis à la cliente par email (avec lien unique de signature)
// Conventions alignées sur api/create-checkout.js :
//   - contrôle d'origine (CSRF), POST uniquement
//   - authentification via JWT Supabase (l'artiste connecté)
//   - accès BDD avec la service role key ; l'appartenance du devis est vérifiée
// Variables d'environnement requises :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY          -> clé API Resend (https://resend.com)
//   MAIL_FROM               -> ex. "GlamBook <devis@votre-domaine.fr>"
//   PUBLIC_SITE_URL         -> ex. "https://glambook-pi.vercel.app" (défaut ci-dessous)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE = process.env.PUBLIC_SITE_URL || 'https://glambook-pi.vercel.app';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const euros = (cents) => (Math.round(Number(cents) || 0) / 100)
  .toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

module.exports = async function handler(req, res) {
  // CSRF — vérifier l'origine
  const origin = req.headers.origin || '';
  const allowed = ['https://glambook-pi.vercel.app', 'http://localhost:3000'];
  if (origin && !allowed.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { quoteId } = req.body || {};
  if (!quoteId || !UUID_REGEX.test(quoteId)) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'Authentification requise' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const writeHeaders = { ...svcHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  try {
    // 1) Identifier l'artiste depuis son JWT
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Session invalide' });
    const user = await userRes.json();

    // Rate limiting : max 60 envois / heure / artiste
    const allowed = await rateLimit(supabaseUrl, serviceKey, user.id, 'send-quote', 60, 60);
    if (!allowed) return res.status(429).json({ error: "Trop d'envois. Réessayez dans un moment." });

    // 2) Charger le devis + le user_id du propriétaire (embed artists)
    const qRes = await fetch(
      `${supabaseUrl}/rest/v1/quotes?id=eq.${quoteId}` +
      `&select=id,share_token,status,quote_number,client_name,client_email,mua_name,mua_logo_url,total_cents,artist_id,artists(user_id)`,
      { headers: svcHeaders }
    );
    const quotes = await qRes.json();
    if (!quotes?.length) return res.status(404).json({ error: 'Devis introuvable' });
    const q = quotes[0];

    // 3) Vérifier l'appartenance : le devis doit être à l'artiste connecté
    const ownerUserId = q.artists?.user_id;
    if (!ownerUserId || ownerUserId !== user.id) {
      return res.status(403).json({ error: 'Devis non autorisé' });
    }
    if (!q.client_email) {
      return res.status(422).json({ error: "Aucun email cliente renseigné" });
    }
    if (q.status === 'signed') {
      return res.status(409).json({ error: 'Devis déjà signé' });
    }

    // 4) Passer le devis au statut "sent" (si ce n'est pas déjà fait)
    if (q.status !== 'sent') {
      await fetch(`${supabaseUrl}/rest/v1/quotes?id=eq.${quoteId}`, {
        method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ status: 'sent' })
      });
    }

    const link = `${SITE}/signature.html?t=${encodeURIComponent(q.share_token)}`;

    // 5) Envoyer l'email via Resend (si configuré)
    const resendKey = process.env.RESEND_API_KEY;
    // Expéditeur configurable via MAIL_FROM. Sans domaine vérifié dans Resend,
    // l'adresse technique reste onboarding@resend.dev (libellé affiché « GlamBook »).
    // Les réponses de la cliente sont routées vers l'artiste via reply_to (ci-dessous).
    const from = process.env.MAIL_FROM || 'GlamBook <onboarding@resend.dev>';
    if (!resendKey) {
      // Pas de fournisseur email configuré : on renvoie quand même le lien pour partage manuel
      return res.status(200).json({ ok: true, emailed: false, link });
    }

    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [q.client_email],
        // Les réponses de la cliente arrivent directement à l'artiste.
        reply_to: user.email || undefined,
        subject: `Votre devis ${q.quote_number || ''} — ${q.mua_name || 'GlamBook'}`,
        html: emailHtml({
          clientName: q.client_name, muaName: q.mua_name, logoUrl: q.mua_logo_url,
          quoteNumber: q.quote_number, total: q.total_cents, link
        })
      })
    });

    if (!mailRes.ok) {
      const detail = await mailRes.text().catch(() => '');
      console.error('Resend error:', mailRes.status, detail);
      // Le devis est marqué "sent" ; on renvoie le lien pour partage manuel
      return res.status(200).json({ ok: true, emailed: false, link });
    }

    return res.status(200).json({ ok: true, emailed: true, link });

  } catch (err) {
    console.error('send-quote error:', err);
    return res.status(500).json({ error: "Erreur lors de l'envoi du devis" });
  }
};

// Rate limiting via la table api_usage (service role). true = autorisé.
async function rateLimit(url, key, userId, endpoint, max, minutes) {
  if (!userId) return true;
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const since = new Date(Date.now() - minutes * 60000).toISOString();
    const cRes = await fetch(
      `${url}/rest/v1/api_usage?user_id=eq.${userId}&endpoint=eq.${encodeURIComponent(endpoint)}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: { ...h, Prefer: 'count=exact', Range: '0-0' } });
    const cr = cRes.headers.get('content-range');
    const total = cr && cr.includes('/') ? parseInt(cr.split('/')[1], 10) : 0;
    if (total >= max) return false;
    await fetch(`${url}/rest/v1/api_usage`, {
      method: 'POST', headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, endpoint }) });
    return true;
  } catch (e) { console.error('rateLimit err', e); return true; }
}

function emailHtml({ clientName, muaName, quoteNumber, total, link, logoUrl }) {
  // Les images en data: URL sont bloquées par la plupart des messageries → on n'affiche
  // le logo dans l'email que s'il est hébergé (http/https). PDF & aperçu l'affichent toujours.
  const logoTag = (logoUrl && /^https?:\/\//i.test(logoUrl))
    ? `<img src="${esc(logoUrl)}" alt="${esc(muaName || '')}" style="max-height:40px;max-width:150px;margin-top:10px;"/>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);">
        <tr><td style="background:#111;padding:22px 28px;">
          <span style="font-size:22px;font-weight:800;color:#E8547A;letter-spacing:-.03em;">Glam<span style="color:#D4AF37;">Book</span></span>
          ${logoTag ? '<br/>' + logoTag : ''}
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="font-size:15px;margin:0 0 14px;">Bonjour ${esc(clientName) || ''},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 18px;color:#374151;">
            ${esc(muaName) || 'Votre maquilleuse'} vous a préparé un devis${quoteNumber ? ' (<b>' + esc(quoteNumber) + '</b>)' : ''}.
            Vous pouvez le consulter et le signer en ligne, directement depuis votre téléphone.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
            <tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px 20px;">
              <span style="font-size:13px;color:#6B7280;">Montant total</span><br/>
              <span style="font-size:22px;font-weight:800;color:#C43A60;">${euros(total)}</span>
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="${esc(link)}" style="display:inline-block;background:#E8547A;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:10px;">
              Consulter &amp; signer mon devis
            </a>
          </td></tr></table>
          <p style="font-size:12px;color:#9CA3AF;margin:22px 0 0;text-align:center;word-break:break-all;">
            Ou copiez ce lien : ${esc(link)}
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #E5E7EB;">
          <p style="font-size:12px;color:#9CA3AF;margin:0;">Email envoyé via GlamBook. Si vous n'attendiez pas ce devis, ignorez ce message.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

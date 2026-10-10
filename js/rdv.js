// Parcours sans compte : liens personnels, mémoire de l'appareil, écran « C'est envoyé ».
import { supabase } from '/js/supabase.js';
import { esc } from '/js/utils.js';

const KEY = 'gb_rdv';
export const rdvUrl = (t) => `${location.origin}/rdv.html?t=${encodeURIComponent(t)}`;

// Les liens restent aussi sur ce téléphone, pour retrouver un rendez-vous sans l'e-mail
export function rememberLocal(item) {
  try {
    const all = listLocal().filter(x => x.t !== item.t);
    all.unshift({ ...item, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 20)));
  } catch (_) {}
}
export function listLocal() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(x => x && /^[0-9a-f]{64}$/.test(x.t)); } catch (_) { return []; }
}

export async function emailEnabled() {
  try { return !!(await (await fetch('/api/config')).json()).emailEnabled; } catch (_) { return false; }
}
export async function sendLink(token) {
  try {
    const r = await fetch('/api/send-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const j = await r.json().catch(() => ({}));
    return !!j.emailed;
  } catch (_) { return false; }
}

// Après une annulation par la cliente : la maquilleuse reçoit un e-mail (le serveur vérifie le statut)
export function notifyCancel(token) {
  if (!/^[0-9a-f]{64}$/.test(token || '')) return;
  fetch('/api/send-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelled: token }), keepalive: true }).catch(() => {});
}

const ERR = {
  artist_unavailable: 'Cette maquilleuse n’accepte plus de demandes pour le moment.',
  name_required: 'Indiquez votre prénom.',
  phone_required: 'Indiquez votre téléphone : la maquilleuse en a besoin pour le jour J.',
  email_invalid: 'Vérifiez votre adresse e-mail.',
  address_required: 'Indiquez l’adresse où elle doit venir.',
  date_invalid: 'Choisissez une date à venir.',
  need_required: 'Choisissez une prestation ou décrivez votre besoin.',
  slot_unavailable: 'Ce créneau vient d’être pris. Choisissez-en un autre.',
  service_mismatch: 'Cette prestation n’est plus proposée. Rechargez la page.',
  too_many: 'Vous avez déjà plusieurs demandes en attente. Retrouvez-les dans « Mon rendez-vous ».',
};
export const errorText = (code) => ERR[code] || 'L’envoi n’a pas abouti. Réessayez dans un instant.';

// Écran de fin commun (demande de devis et réservation)
export function renderDone(box, { kind, token, artistName, when, email, name, emailed, loggedIn }) {
  const link = rdvUrl(token);
  box.innerHTML = `
  <div class="gb-done">
    <div class="done-ok" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></div>
    <h1>C’est <em>envoyé</em>.</h1>
    <p class="done-lead">${esc(artistName)} a reçu votre ${kind === 'booking' ? 'demande de rendez-vous' : 'demande'}${when ? ' pour le ' + esc(when) : ''}.</p>
    <div class="done-mail">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
      <div>${emailed
        ? `<b>Un lien vient de partir vers ${esc(email)}</b><span>Gardez cet e-mail : son lien vous permet de suivre, ${kind === 'booking' ? 'déplacer ou annuler votre rendez-vous' : 'lire et signer le devis, ou annuler'}. Pas de mot de passe.</span>`
        : `<b>Votre lien personnel</b><span>Il vous permet de suivre, ${kind === 'booking' ? 'déplacer ou annuler votre rendez-vous' : 'lire et signer le devis, ou annuler'}, sans mot de passe. Il est aussi gardé sur ce téléphone.</span>`}
        <div class="done-link"><input type="text" readonly value="${esc(link)}" aria-label="Votre lien personnel"/><button type="button" class="btn btn-ghost btn-sm" data-copy>Copier</button></div>
      </div>
    </div>
    <ol class="done-next">
      ${kind === 'booking'
        ? `<li><span>01</span><div><b>Elle confirme le créneau</b><small>Vous êtes prévenue par e-mail.</small></div></li>
           <li><span>02</span><div><b>Le jour J, elle vient à vous</b><small>Vous réglez sur place.</small></div></li>
           <li><span>03</span><div><b>Vous laissez un avis</b><small>Depuis votre espace, si vous en créez un.</small></div></li>`
        : `<li><span>01</span><div><b>Elle vous répond par devis</b><small>Vous le recevez par e-mail.</small></div></li>
           <li><span>02</span><div><b>Vous signez depuis votre téléphone</b><small>Sans mot de passe.</small></div></li>
           <li><span>03</span><div><b>Le jour J, elle vient à vous</b><small>Puis vous pourrez laisser un avis.</small></div></li>`}
    </ol>
    <div class="done-actions">
      <a class="btn btn-primary" href="${esc(link)}">${kind === 'booking' ? 'Voir mon rendez-vous' : 'Suivre ma demande'}</a>
      <a class="btn btn-ghost" href="/artists.html">Voir d’autres maquilleuses</a>
    </div>
    ${loggedIn ? `<p class="done-space">Vous la retrouvez aussi dans <a href="/mes-devis.html">Mon espace</a>.</p>` : `
    <details class="done-space">
      <summary>Vous reviendrez ? Gardez tout dans un espace (facultatif)</summary>
      <form class="done-acc" novalidate>
        <p>Choisissez un mot de passe : vos demandes, devis et messages vous attendront dans Mon espace.</p>
        <label>Mot de passe<input type="password" name="pw" minlength="8" autocomplete="new-password" required/></label>
        <label class="done-cgu"><input type="checkbox" name="cgu" required/> <span>J’accepte les <a href="/legal/cgu.html" target="_blank">CGU</a> et la <a href="/legal/confidentialite.html" target="_blank">politique de confidentialité</a></span></label>
        <button type="submit" class="btn btn-ghost">Créer mon espace</button>
        <p class="done-acc-msg" role="status"></p>
      </form>
    </details>`}
  </div>`;
  box.querySelector('[data-copy]')?.addEventListener('click', async () => {
    const inp = box.querySelector('.done-link input');
    try { await navigator.clipboard.writeText(inp.value); box.querySelector('[data-copy]').textContent = 'Copié'; }
    catch (_) { inp.select(); }
  });
  const form = box.querySelector('.done-acc');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = form.pw.value, msg = form.querySelector('.done-acc-msg');
    if (pw.length < 8) { msg.textContent = '8 caractères minimum.'; return; }
    if (!form.cgu.checked) { msg.textContent = 'Acceptez les CGU pour créer votre espace.'; return; }
    form.querySelector('button').disabled = true;
    const { error } = await supabase.auth.signUp({ email, password: pw, options: { data: { role: 'client', full_name: name || '' }, emailRedirectTo: `${location.origin}/mes-devis.html` } });
    if (error) { form.querySelector('button').disabled = false; msg.textContent = /registered|exists/i.test(error.message) ? 'Un compte existe déjà avec cette adresse : connectez-vous depuis « Connexion ».' : 'La création n’a pas abouti. Réessayez.'; return; }
    form.innerHTML = `<p><b>Presque fini.</b> Confirmez votre adresse depuis l’e-mail que vous venez de recevoir : vos demandes s’ajouteront à votre espace.</p>`;
  });
  window.scrollTo({ top: 0 });
}

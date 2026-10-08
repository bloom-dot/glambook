// Échappement HTML — protection XSS
export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Valide qu'une URL commence par https://
export function safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? url : null;
  } catch { return null; }
}

// Format date FR
export function dateFR(d, opts = { weekday:'long', day:'numeric', month:'long' }) {
  return new Date(d).toLocaleDateString('fr-FR', opts);
}

// Toast global
export function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Spécialités : la base stocke des slugs, l'UI affiche des libellés ──
export const SPECIALTY_LABELS = {
  mariage:   'Mariage',
  soiree:    'Soirée',
  quotidien: 'Quotidien',
  editorial: 'Éditorial / Shooting',
  scene:     'Scène / Spectacle',
  coiffure:  'Coiffure',
  ongles:    'Ongles',
  airbrush:  'Airbrush'
};

export function specialtyLabel(slug) {
  return SPECIALTY_LABELS[slug] || slug;
}

// ── Dates : toujours en heure locale ──
// new Date(2026, 9, 15).toISOString() renvoie « 2026-10-14 » en France (UTC+2) :
// ne jamais passer par toISOString() pour obtenir une date de calendrier.
export function localISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// « 2026-10-15 » → Date à minuit heure locale (et non minuit UTC)
export function parseLocalDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Redirection après connexion/inscription : chemins internes uniquement (pas d'open redirect).
// Accepte un chemin (« /artiste/x ») ou une URL complète de ce même site.
export function safeRedirect(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw, location.origin);
    if (u.origin !== location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch { return null; }
}

// ── Icônes au trait (charte : 1,5 px, jamais de remplissage, jamais d'emoji) ──
const svg = (d) => `<svg class="gb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  pin:      svg('<path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>'),
  image:    svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  chat:     svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>'),
  inbox:    svg('<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z"/>'),
  doc:      svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 14h6"/><path d="M9 18h4"/>'),
  user:     svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  more:     svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  play:     svg('<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9.5 5 2.5-5 2.5Z"/>'),
  lock:     svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  camera:   svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>'),
  trash:    svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  check:    svg('<path d="m5 12 5 5 9-10"/>'),
  home:     svg('<path d="M4 11 12 4l8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9"/>'),
  external: svg('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  eye:      svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff:   svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.6 8.5 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  mail:     svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  logout:   svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  star:     svg('<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8Z"/>'),
  brush:    svg('<path d="M9.5 14.5 3 21"/><path d="M14.6 3.9a2 2 0 0 1 2.8 0l2.7 2.7a2 2 0 0 1 0 2.8l-6.9 6.9-5.5-5.5Z"/>'),
  tag:      svg('<path d="M3 12V4h8l10 10-8 8Z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),
  palette:  svg('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.6-.2-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h1.6A4.5 4.5 0 0 0 21 9.8C21 6 17 3 12 3Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>'),
  shield:   svg('<path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z"/>'),
  scan:     svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="11" r="3"/><path d="M7.5 17a5 5 0 0 1 9 0"/>'),
};

// Mode de prise de rendez-vous de chaque maquilleuse, pour l'annoncer dès les cartes :
//   'slots' → prestations tarifées ET créneaux libres à venir : réservation en ligne
//   'quote' → tout le reste : la cliente décrit son besoin et reçoit un devis
export async function bookingModes(supabase, artists) {
  const modes = new Map((artists || []).map(a => [a.id, 'quote']));
  const priced = (artists || []).filter(a => (parseInt(a.price_from) || 0) > 0).map(a => a.id);
  if (!priced.length) return modes;
  try {
    const { data } = await supabase.from('availabilities').select('artist_id')
      .in('artist_id', priced).gte('date', localISODate()).eq('is_available', true).eq('is_booked', false).limit(1000);
    (data || []).forEach(r => modes.set(r.artist_id, 'slots'));
  } catch (_) { /* sans réponse : on annonce « Sur devis », toujours vrai en dernier recours */ }
  return modes;
}
export function modeTag(mode) {
  return mode === 'slots'
    ? '<span class="mode-tag is-slots">Réservation en ligne</span>'
    : '<span class="mode-tag">Sur devis</span>';
}

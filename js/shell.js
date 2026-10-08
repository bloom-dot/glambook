// Cadre commun des pages « hors tableau de bord » (Messages, éditeur de devis).
//  • Maquilleuse : la même barre latérale que son tableau de bord (et la barre du bas sur mobile),
//    pour ne jamais avoir l'impression de quitter son espace.
//  • Cliente : la barre de navigation du site.
// Usage : import { mountShell } from '/js/shell.js'; mountShell('messages');
import { supabase, getProfile } from '/js/supabase.js';
import { ICON } from '/js/utils.js';

const PRO = [
  ['Activité'],
  ['demandes', 'Demandes', 'inbox'],
  ['devis', 'Devis', 'doc'],
  ['messages', 'Messages', 'chat', '/messages.html'],
  ['reservations', 'Réservations', 'check'],
  ['disponibilites', 'Disponibilités', 'calendar'],
  ['avis', 'Avis clientes', 'star'],
  ['Profil public'],
  ['profil', 'Mon profil', 'user'],
  ['photos', 'Portfolio', 'image'],
  ['services', 'Prestations & tarifs', 'tag'],
  ['espace', 'Apparence', 'palette'],
];
const MOBILE = [['demandes', 'Demandes', 'inbox'], ['devis', 'Devis', 'doc'], ['messages', 'Messages', 'chat', '/messages.html'], ['profil', 'Profil', 'user'], ['more', 'Tableau', 'more', '/dashboard/artist.html']];
const href = (key, url) => url || '/dashboard/artist.html' + (key === 'demandes' ? '' : '#' + key);
const e = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mountShell(active) {
  let user = null, profile = null;
  try { ({ data: { user } } = await supabase.auth.getUser()); } catch (_) {}
  if (user) { try { profile = await getProfile(user.id); } catch (_) {} }
  const isPro = ['artist', 'admin'].includes(profile?.role);

  if (isPro) {
    const name = profile?.full_name || user?.email || '';
    const side = document.createElement('aside');
    side.className = 'pshell';
    side.setAttribute('aria-label', 'Mon espace pro');
    side.innerHTML = `<a class="pshell-logo" href="/">Glam<span>Book</span></a>
      <div class="pshell-user"><div class="n">${e(name)}</div><div class="s">Maquilleuse</div></div>
      <nav>${PRO.map(([k, l, ic, url]) => l === undefined
        ? `<div class="pshell-sec">${e(k)}</div>`
        : `<a class="pshell-item${k === active ? ' active' : ''}" href="${href(k, url)}"${k === active ? ' aria-current="page"' : ''}>${ICON[ic] || ''}<span>${e(l)}</span></a>`).join('')}</nav>
      <a class="pshell-item pshell-out" href="#" data-logout>${ICON.logout}<span>Déconnexion</span></a>`;
    document.body.prepend(side);
    const bar = document.createElement('nav');
    bar.className = 'pshell-mob';
    bar.setAttribute('aria-label', 'Navigation');
    bar.innerHTML = MOBILE.map(([k, l, ic, url]) =>
      `<a href="${href(k, url)}" class="${k === active ? 'active' : ''}">${ICON[ic] || ''}<span>${e(l)}</span></a>`).join('');
    document.body.append(bar);
    document.body.classList.add('has-pshell');
  } else {
    const nav = document.createElement('nav');
    nav.className = 'nav';
    nav.innerHTML = `<div class="nav-inner" style="max-width:1200px;"><a href="/" class="nav-logo">Glam<span>Book</span></a>
      <div class="nav-links"><a href="/artists.html" class="hide-mobile">Maquilleuses</a>
      ${user ? '<a href="/mes-devis.html" class="btn-nav btn">Mon espace</a><a href="#" class="nav-quiet hide-mobile" data-logout>Déconnexion</a>' : '<a href="/auth/login.html">Connexion</a>'}</div></div>`;
    document.body.prepend(nav);
    document.body.classList.add('has-topnav');
  }
  document.querySelectorAll('[data-logout]').forEach(a => a.addEventListener('click', async (ev) => {
    ev.preventDefault();
    try { await supabase.auth.signOut(); } catch (_) {}
    location.href = '/';
  }));
  return { user, profile, isPro };
}

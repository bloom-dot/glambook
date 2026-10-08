// Barre de navigation : reflète l'état de session sur les pages publiques.
// Usage : <span id="nav-auth">…liens visiteur…</span> puis  initNav()  dans le module de la page.
import { supabase, getProfile } from '/js/supabase.js';

export async function initNav() {
  const slot = document.getElementById('nav-auth');
  let user = null;
  try { ({ data: { user } } = await supabase.auth.getUser()); } catch (_) {}
  if (!user) return { user: null, role: null };

  let role = null;
  try { role = (await getProfile(user.id))?.role || null; } catch (_) {}
  const space = role === 'artist' ? '/dashboard/artist.html' : '/mes-devis.html';

  if (slot) {
    slot.innerHTML =
      `<a href="${space}" class="btn-nav btn">Mon espace</a>` +
      '<a href="#" id="nav-logout" class="nav-quiet hide-mobile">Déconnexion</a>';
    document.getElementById('nav-logout').addEventListener('click', async (e) => {
      e.preventDefault();
      try { await supabase.auth.signOut(); } catch (_) {}
      location.reload();
    });
  }
  return { user, role, space };
}

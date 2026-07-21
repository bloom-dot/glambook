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

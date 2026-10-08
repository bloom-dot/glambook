// Utilitaires communs aux fonctions serveur (le préfixe « _ » évite que Vercel en fasse une route).

// Origines autorisées à appeler les fonctions : le site de production, l'adresse publique
// configurée (PUBLIC_SITE_URL, utile le jour où un nom de domaine est branché) et le local.
function allowedOrigins() {
  const list = ['https://glambook-pi.vercel.app', 'http://localhost:3000'];
  const site = (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  if (site) list.push(site);
  if (process.env.VERCEL_URL) list.push('https://' + process.env.VERCEL_URL); // aperçus de déploiement
  return list;
}

// Comparaison stricte : « startsWith » laissait passer https://glambook-pi.vercel.app.autre-site.com
function originAllowed(req) {
  const origin = req.headers.origin || '';
  return !origin || allowedOrigins().includes(origin);
}

module.exports = { originAllowed, allowedOrigins };

// Diagnostic visage par IA (vision) — renvoie un JSON structuré de conseils maquillage.
// Conventions alignées sur les autres fonctions api/ : contrôle d'origine (CSRF),
// POST uniquement, authentification par JWT Supabase (cliente connectée).
//
// ⚠️ Confidentialité : la photo N'EST PAS stockée. Elle est transmise à l'API vision
// le temps de l'analyse puis oubliée ; seul le diagnostic (texte) est renvoyé au client.
//
// Variables d'environnement :
//   OPENAI_API_KEY     -> clé API OpenAI (vision)
//   OPENAI_MODEL       -> optionnel, défaut "gpt-4o"
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

module.exports.config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const SOUS_TONS = ['chaud', 'froid', 'neutre'];
const TYPES_PEAU = ['seche', 'mixte', 'grasse', 'normale'];

const SYSTEM_PROMPT = `Tu es une maquilleuse professionnelle qui réalise un diagnostic beauté à partir d'une photo de visage.
Analyse UNIQUEMENT des aspects cosmétiques (teint, sous-ton, type de peau apparent, zones à travailler) pour conseiller un maquillage.
Tu n'es pas médecin : ne pose aucun diagnostic médical, ne nomme aucune pathologie.
Réponds STRICTEMENT en JSON valide, sans texte autour, avec exactement ces clés :
{
  "sous_ton": "chaud" | "froid" | "neutre",
  "type_de_peau": "seche" | "mixte" | "grasse" | "normale",
  "sensibilite_ou_imperfections": string[],   // ex: ["rougeurs légères zone T", "cernes"]
  "recommandations_produits": string[],        // ex: ["base hydratante conseillée", "fond de teint fini satiné"]
  "confiance": "faible" | "moyenne" | "elevee"
}
Si la photo ne montre pas clairement un visage, renvoie confiance "faible" et des tableaux vides.`;

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ['https://glambook-pi.vercel.app', 'http://localhost:3000'];
  if (origin && !allowed.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth cliente
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'Authentification requise' });
  try {
    const u = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${jwt}` }
    });
    if (!u.ok) return res.status(401).json({ error: 'Session invalide' });
  } catch { return res.status(401).json({ error: 'Session invalide' }); }

  const { image } = req.body || {};
  if (!image || typeof image !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(image)) {
    return res.status(400).json({ error: 'Image invalide (data URL PNG/JPEG/WebP attendue)' });
  }
  // Garde-fou taille (~5 Mo de base64)
  if (image.length > 7_000_000) {
    return res.status(413).json({ error: 'Image trop volumineuse. Réduisez la résolution.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'Diagnostic IA non configuré (OPENAI_API_KEY manquante)' });
  }

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: [
            { type: 'text', text: 'Réalise le diagnostic maquillage de ce visage au format JSON demandé.' },
            { type: 'image_url', image_url: { url: image, detail: 'low' } }
          ] }
        ]
      })
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      console.error('OpenAI error:', aiRes.status, detail);
      return res.status(502).json({ error: "Le service d'analyse est momentanément indisponible." });
    }

    const data = await aiRes.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Réponse IA illisible.' }); }

    const diagnostic = normalize(parsed);
    return res.status(200).json({ ok: true, diagnostic });

  } catch (err) {
    console.error('face-diagnostic error:', err);
    return res.status(500).json({ error: 'Erreur lors du diagnostic.' });
  }
};

// Normalise / valide la sortie de l'IA pour garantir le schéma
function normalize(p) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const arr = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 8) : [];
  const oneOf = (v, list, def) => list.includes(str(v).toLowerCase()) ? str(v).toLowerCase() : def;
  return {
    sous_ton: oneOf(p.sous_ton, SOUS_TONS, 'neutre'),
    type_de_peau: oneOf(p.type_de_peau, TYPES_PEAU, 'normale'),
    sensibilite_ou_imperfections: arr(p.sensibilite_ou_imperfections),
    recommandations_produits: arr(p.recommandations_produits),
    confiance: ['faible', 'moyenne', 'elevee'].includes(str(p.confiance).toLowerCase()) ? str(p.confiance).toLowerCase() : 'moyenne',
    _disclaimer: "Diagnostic cosmétique généré par IA, à titre indicatif — ne constitue pas un avis médical.",
  };
}

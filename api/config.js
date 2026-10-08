// Expose la clé publique Stripe au frontend (jamais la clé secrète)
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    // Paiement en ligne : il faut la clé publique ET la clé secrète, sinon la page
    // de réservation proposerait une carte bancaire que le serveur ne peut pas débiter.
    stripePublishableKey: (process.env.STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_SECRET_KEY) ? process.env.STRIPE_PUBLISHABLE_KEY : null,
    // Diagnostic visage : proposé seulement si la clé du service d'analyse est configurée
    diagnosticEnabled: !!process.env.OPENAI_API_KEY
  });
};

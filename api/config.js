// Expose la clé publique Stripe au frontend (jamais la clé secrète)
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
  });
};

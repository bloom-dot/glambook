const Stripe = require('stripe');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  // CSRF — vérifier l'origine
  const origin = req.headers.origin || '';
  const allowed = [
    'https://glambook-pi.vercel.app',
    'http://localhost:3000'
  ];
  if (origin && !allowed.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { artistId, serviceId, slotId, userId } = req.body;

  // Validation UUID
  if (!artistId || !serviceId || !slotId) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }
  if (![artistId, serviceId, slotId].every(id => UUID_REGEX.test(id))) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  try {
    // Vérifier la prestation
    const svcRes = await fetch(
      `${supabaseUrl}/rest/v1/services?id=eq.${serviceId}&artist_id=eq.${artistId}&select=price_cents,name`,
      { headers }
    );
    const services = await svcRes.json();
    if (!services?.length) {
      return res.status(404).json({ error: 'Prestation introuvable' });
    }
    const service = services[0];

    // Vérifier disponibilité du créneau (avec verrou)
    const slotRes = await fetch(
      `${supabaseUrl}/rest/v1/availabilities?id=eq.${slotId}&artist_id=eq.${artistId}&is_booked=eq.false&is_available=eq.true&select=id`,
      { headers }
    );
    const slots = await slotRes.json();
    if (!slots?.length) {
      return res.status(409).json({ error: 'Ce créneau n\'est plus disponible' });
    }

    // Créer le PaymentIntent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   service.price_cents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: { artistId, serviceId, slotId, userId: userId || '', serviceName: service.name }
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error('Checkout error:', err);
    // Ne jamais exposer le message d'erreur raw en production
    return res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
};

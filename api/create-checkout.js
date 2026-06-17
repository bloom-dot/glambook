const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { artistId, serviceId, slotId, userId } = req.body;

  if (!artistId || !serviceId || !slotId) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    // Récupérer le prix depuis Supabase via REST
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const svcRes = await fetch(
      `${supabaseUrl}/rest/v1/services?id=eq.${serviceId}&select=price_cents,name`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const services = await svcRes.json();
    if (!services || services.length === 0) {
      return res.status(404).json({ error: 'Prestation introuvable' });
    }
    const service = services[0];

    // Vérifier que le créneau est toujours disponible
    const slotRes = await fetch(
      `${supabaseUrl}/rest/v1/availabilities?id=eq.${slotId}&select=is_booked,is_available`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const slots = await slotRes.json();
    if (!slots || slots.length === 0 || slots[0].is_booked || !slots[0].is_available) {
      return res.status(409).json({ error: 'Ce créneau n\'est plus disponible' });
    }

    // Créer le PaymentIntent Stripe (prise de commission = plateforme GlamBook)
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   service.price_cents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: { artistId, serviceId, slotId, userId, serviceName: service.name }
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
};

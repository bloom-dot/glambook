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

  const { bookingId } = req.body || {};
  if (!bookingId || !UUID_REGEX.test(bookingId)) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  // Authentification : le JWT Supabase du client doit correspondre à la réservation
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'Authentification requise' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  try {
    // Identifier l'utilisateur depuis son JWT (vérifié par Supabase Auth)
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Session invalide' });
    const user = await userRes.json();

    // Charger la réservation — le prix vient TOUJOURS de la BDD, jamais du client
    const bkRes = await fetch(
      `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=id,client_id,status,service_id,artist_id`,
      { headers: svcHeaders }
    );
    const bookings = await bkRes.json();
    if (!bookings?.length) return res.status(404).json({ error: 'Réservation introuvable' });
    const booking = bookings[0];

    if (booking.client_id !== user.id) {
      return res.status(403).json({ error: 'Réservation non autorisée' });
    }
    if (booking.status !== 'pending') {
      return res.status(409).json({ error: 'Réservation déjà traitée' });
    }

    const svcRes = await fetch(
      `${supabaseUrl}/rest/v1/services?id=eq.${booking.service_id}&select=price_cents,name`,
      { headers: svcHeaders }
    );
    const services = await svcRes.json();
    if (!services?.length) return res.status(404).json({ error: 'Prestation introuvable' });
    const service = services[0];

    if (!Number.isInteger(service.price_cents) || service.price_cents < 50) {
      return res.status(422).json({ error: 'Tarif invalide' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   service.price_cents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { bookingId, serviceName: service.name }
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
};

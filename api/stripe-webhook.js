const Stripe = require('stripe');

// Le corps brut est requis pour vérifier la signature Stripe
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).json({ error: 'Signature invalide' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
  };

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const bookingId = pi.metadata?.bookingId;
      if (bookingId) {
        await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&status=eq.pending`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'confirmed', stripe_pi_id: pi.id })
        });
      }
    }

    if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
      const pi = event.data.object;
      const bookingId = pi.metadata?.bookingId;
      if (bookingId) {
        // Annuler la réservation en attente et libérer le créneau
        const bkRes = await fetch(
          `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&status=eq.pending&select=id,slot_id`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        );
        const bookings = await bkRes.json();
        if (bookings?.length) {
          await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ status: 'cancelled', stripe_pi_id: pi.id })
          });
          if (bookings[0].slot_id) {
            await fetch(`${supabaseUrl}/rest/v1/availabilities?id=eq.${bookings[0].slot_id}`, {
              method: 'PATCH', headers,
              body: JSON.stringify({ is_booked: false })
            });
          }
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    // 500 → Stripe réessaie automatiquement
    return res.status(500).json({ error: 'Erreur de traitement' });
  }
};

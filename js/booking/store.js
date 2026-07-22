// ═══════════════════════════════════════════════════
// GlamBook — Réservation + diagnostic visage : données & services
// ═══════════════════════════════════════════════════
import { supabase, getCurrentUser } from '/js/supabase.js';
import { emptyQuote } from '/js/devis/model.js';
import { saveQuote, emailQuote, markAsSent, signatureUrl } from '/js/devis/store.js';

/**
 * @typedef {Object} FaceDiagnostic
 * @property {'chaud'|'froid'|'neutre'} sous_ton
 * @property {'seche'|'mixte'|'grasse'|'normale'} type_de_peau
 * @property {string[]} sensibilite_ou_imperfections
 * @property {string[]} recommandations_produits
 * @property {'faible'|'moyenne'|'elevee'} [confiance]
 */

/**
 * @typedef {Object} ServiceSnapshot
 * @property {string} id
 * @property {string} name
 * @property {number} price_cents
 */

/**
 * @typedef {Object} BookingRequest
 * @property {string}  [id]
 * @property {string}  artistId
 * @property {string}  clientName
 * @property {string}  clientEmail
 * @property {string}  clientPhone
 * @property {string}  eventAddress
 * @property {string}  eventDate            ISO datetime
 * @property {ServiceSnapshot[]} services
 * @property {number}  travelDistanceKm
 * @property {FaceDiagnostic|null} diagnostic
 * @property {string}  [note]
 * @property {'pending'|'quoted'|'declined'} [status]
 * @property {string}  [quoteId]
 * @property {string}  [createdAt]
 */

// ── Chargement des prestations d'un artiste (pour le step form) ──
export async function getArtistServices(artistId) {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, price_cents, duration_min, category')
    .eq('artist_id', artistId)
    .order('price_cents', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Nom public de l'artiste (via la vue artists_public). */
export async function getArtistName(artistId) {
  const { data } = await supabase
    .from('artists_public').select('display_name').eq('id', artistId).maybeSingle();
  return data?.display_name || '';
}

// ── Appel du diagnostic visage (API vision serverless) ──
/**
 * @param {string} imageDataUrl  data URL PNG/JPEG (idéalement réduit à ~768px)
 * @returns {Promise<FaceDiagnostic>}
 */
export async function requestFaceDiagnostic(imageDataUrl) {
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token;
  if (!jwt) throw new Error('Connexion requise pour le diagnostic.');
  const res = await fetch('/api/face-diagnostic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ image: imageDataUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Diagnostic indisponible.');
  return data.diagnostic;
}

// ── Création d'une demande de réservation ──
/**
 * @param {BookingRequest} req
 * @returns {Promise<BookingRequest>}
 */
export async function createBookingRequest(req) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Connexion requise.');
  const row = {
    artist_id: req.artistId,
    client_id: user.id,
    client_name: req.clientName,
    client_email: req.clientEmail,
    client_phone: req.clientPhone,
    event_address: req.eventAddress,
    event_date: req.eventDate || null,
    services_snapshot: (req.services || []).map(s => ({ id: s.id, name: s.name, price_cents: s.price_cents })),
    travel_distance_km: Number(req.travelDistanceKm) || 0,
    diagnostic: req.diagnostic || null,
    note: req.note || null,
    status: 'pending',
  };
  const { data, error } = await supabase.from('booking_requests').insert(row).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

// ── Liste des demandes reçues par l'artiste connecté ──
export async function listArtistRequests(status = null) {
  let q = supabase.from('booking_requests').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(fromRow);
}

/** Marque une demande comme refusée. */
export async function declineRequest(requestId) {
  const { error } = await supabase.from('booking_requests')
    .update({ status: 'declined' }).eq('id', requestId);
  if (error) throw error;
}

/**
 * Convertit une demande en objet devis (Quote), prêt pour saveQuote.
 * @param {BookingRequest} req
 * @param {{name?:string,email?:string,phone?:string,siret?:string,address?:string}} mua
 * @param {{travelDistanceKm?:number, travelRateCents?:number, vatExempt?:boolean}} [opts]
 */
export function requestToQuote(req, mua = {}, opts = {}) {
  const q = emptyQuote();
  q.mua = { name: mua.name || '', siret: mua.siret || '', address: mua.address || '',
            email: mua.email || '', phone: mua.phone || '', logoUrl: '' };
  q.client = { name: req.clientName || '', email: req.clientEmail || '',
               phone: req.clientPhone || '', eventAddress: req.eventAddress || '' };
  q.eventDate = req.eventDate || '';
  q.items = (req.services || []).map(s => ({ title: s.name, qty: 1, unitPriceCents: s.price_cents }));
  q.travelDistanceKm = opts.travelDistanceKm ?? req.travelDistanceKm ?? 0;
  q.travelRateCents = opts.travelRateCents ?? 50;
  q.vatExempt = opts.vatExempt ?? true;
  // Rappel du diagnostic dans les notes du devis (contexte pour la cliente)
  if (req.diagnostic?.recommandations_produits?.length) {
    q.notes = 'Recommandations issues du diagnostic : ' + req.diagnostic.recommandations_produits.join(', ') + '.';
  }
  return q;
}

/**
 * Valide une demande : crée le devis, l'envoie par email, et lie le devis à la demande.
 * @returns {Promise<{ quoteId:string, link:string, emailed:boolean }>}
 */
export async function validateRequestToQuote(req, mua, opts) {
  const quote = requestToQuote(req, mua, opts);
  const saved = await saveQuote(quote);           // status 'draft', RLS: artiste propriétaire
  let emailed = false, link = '';
  try {
    const r = await emailQuote(saved.id);         // marque 'sent' + email cliente
    emailed = !!r.emailed; link = r.link || '';
  } catch (_) {
    const { shareToken } = await markAsSent(saved.id);  // repli : lien manuel
    link = signatureUrl(shareToken);
  }
  // Lier le devis à la demande + statut quoted
  await supabase.from('booking_requests')
    .update({ status: 'quoted', quote_id: saved.id }).eq('id', req.id);
  return { quoteId: saved.id, link, emailed };
}

// ── Mapping DB → JS ──
export function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    artistId: row.artist_id,
    clientName: row.client_name || '',
    clientEmail: row.client_email || '',
    clientPhone: row.client_phone || '',
    eventAddress: row.event_address || '',
    eventDate: row.event_date || '',
    services: (row.services_snapshot || []).map(s => ({ id: s.id, name: s.name, price_cents: Math.round(Number(s.price_cents) || 0) })),
    travelDistanceKm: Number(row.travel_distance_km) || 0,
    diagnostic: row.diagnostic || null,
    note: row.note || '',
    status: row.status || 'pending',
    quoteId: row.quote_id || '',
    createdAt: row.created_at || '',
  };
}

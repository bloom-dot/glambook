// ═══════════════════════════════════════════════════
// GlamBook — Devis : modèle de données & calculs
// Tout est stocké/calculé en CENTIMES pour éviter les erreurs de flottant.
// ═══════════════════════════════════════════════════

/**
 * @typedef {Object} MuaInfo
 * @property {string} name      Nom de la MUA
 * @property {string} siret     N° SIRET
 * @property {string} address   Adresse
 * @property {string} email     Email
 * @property {string} phone     Téléphone
 * @property {string} [logoUrl] URL du logo (optionnel)
 */

/**
 * @typedef {Object} ClientInfo
 * @property {string} name          Nom de la cliente
 * @property {string} email         Email
 * @property {string} phone         Téléphone
 * @property {string} eventAddress  Adresse de l'événement
 */

/**
 * @typedef {Object} QuoteItem
 * @property {string} title           Intitulé de la prestation
 * @property {number} qty             Quantité
 * @property {number} unitPriceCents  Prix unitaire en centimes
 */

/**
 * @typedef {Object} Quote
 * @property {string}     [id]
 * @property {string}     [quoteNumber]
 * @property {'draft'|'sent'|'signed'|'declined'|'expired'} status
 * @property {MuaInfo}    mua
 * @property {ClientInfo} client
 * @property {string}     [eventDate]        ISO datetime de l'événement
 * @property {QuoteItem[]} items
 * @property {number}     travelDistanceKm   Distance aller-retour en km
 * @property {number}     travelRateCents    Tarif par km en centimes
 * @property {number}     depositCents       Acompte demandé en centimes
 * @property {string}     [paymentTerms]     Conditions de paiement
 * @property {boolean}    vatExempt          true = franchise en base (art. 293 B CGI)
 * @property {number}     vatRate            Taux de TVA en % (si non exonéré)
 * @property {string}     [notes]
 * @property {string}     [validUntil]       Date de validité (ISO date)
 * @property {string}     [signatureData]    dataURL PNG
 * @property {string}     [signedName]
 * @property {string}     [signedAt]
 */

/** Devis vierge avec valeurs par défaut. */
export function emptyQuote() {
  return {
    status: 'draft',
    mua:    { name: '', siret: '', address: '', email: '', phone: '', logoUrl: '' },
    client: { name: '', email: '', phone: '', eventAddress: '' },
    eventDate: '',
    items: [ { title: '', qty: 1, unitPriceCents: 0 } ],
    travelDistanceKm: 0,
    travelRateCents: 50,          // 0,50 €/km par défaut
    depositCents: 0,
    paymentTerms: 'Acompte de 30 % à la réservation, solde le jour de la prestation.',
    vatExempt: true,              // auto-entrepreneur par défaut
    vatRate: 20,
    notes: '',
    validUntil: '',
  };
}

/** Coût d'une ligne de prestation, en centimes. */
export function lineTotalCents(item) {
  const qty = Math.max(0, Number(item.qty) || 0);
  const unit = Math.max(0, Math.round(Number(item.unitPriceCents) || 0));
  return qty * unit;
}

/** Frais de déplacement = distance × tarif/km, en centimes. */
export function travelCents(quote) {
  const km = Math.max(0, Number(quote.travelDistanceKm) || 0);
  const rate = Math.max(0, Math.round(Number(quote.travelRateCents) || 0));
  return Math.round(km * rate);
}

/**
 * Calcule tous les totaux d'un devis.
 * @param {Quote} quote
 * @returns {{ prestationsCents:number, travelCents:number, subtotalCents:number, vatCents:number, totalCents:number, depositCents:number, balanceCents:number }}
 */
export function computeTotals(quote) {
  const prestations = (quote.items || []).reduce((s, it) => s + lineTotalCents(it), 0);
  const travel = travelCents(quote);
  const subtotal = prestations + travel;                       // Total HT
  const vat = quote.vatExempt
    ? 0
    : Math.round(subtotal * (Number(quote.vatRate) || 0) / 100); // TVA
  const total = subtotal + vat;                                 // Total TTC
  const deposit = Math.min(Math.max(0, Math.round(Number(quote.depositCents) || 0)), total);
  return {
    prestationsCents: prestations,
    travelCents: travel,
    subtotalCents: subtotal,
    vatCents: vat,
    totalCents: total,
    depositCents: deposit,
    balanceCents: total - deposit,
  };
}

/** Formate des centimes en euros FR : 12345 → "123,45 €". */
export function euros(cents) {
  return (Math.round(Number(cents) || 0) / 100).toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR',
  });
}

/** Convertit une saisie euros ("12,50" ou "12.5") en centimes. */
export function parseEuros(str) {
  if (str === null || str === undefined) return 0;
  const n = parseFloat(String(str).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Numéro de devis lisible : DEV-2026-XXXX. */
export function generateQuoteNumber(date = new Date()) {
  const y = date.getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DEV-${y}-${rand}`;
}

/**
 * Validation minimale avant envoi.
 * @returns {string[]} liste de messages d'erreur (vide si OK)
 */
export function validateForSend(quote) {
  const errs = [];
  const t = computeTotals(quote);
  if (!quote.mua?.name) errs.push('Le nom de la MUA est requis.');
  if (!quote.client?.name) errs.push('Le nom de la cliente est requis.');
  if (!quote.client?.email) errs.push("L'email de la cliente est requis pour l'envoi.");
  const validItems = (quote.items || []).filter(it => it.title && lineTotalCents(it) >= 0 && Number(it.qty) > 0);
  if (validItems.length === 0) errs.push('Ajoutez au moins une prestation.');
  if (t.totalCents <= 0) errs.push('Le montant total doit être supérieur à 0.');
  return errs;
}

/** Mapping objet JS → colonnes de la table `quotes` (snake_case). */
export function toRow(quote, artistId, userId) {
  const t = computeTotals(quote);
  return {
    artist_id: artistId,
    created_by: userId,
    quote_number: quote.quoteNumber || generateQuoteNumber(),
    status: quote.status || 'draft',
    mua_name: quote.mua.name, mua_siret: quote.mua.siret, mua_address: quote.mua.address,
    mua_email: quote.mua.email, mua_phone: quote.mua.phone, mua_logo_url: quote.mua.logoUrl || null,
    client_name: quote.client.name, client_email: quote.client.email,
    client_phone: quote.client.phone, event_address: quote.client.eventAddress,
    event_date: quote.eventDate || null,
    items: (quote.items || [])
      .filter(it => it.title)
      .map(it => ({ title: it.title, qty: Number(it.qty) || 0, unit_price_cents: Math.round(Number(it.unitPriceCents) || 0) })),
    travel_distance_km: Number(quote.travelDistanceKm) || 0,
    travel_rate_cents: Math.round(Number(quote.travelRateCents) || 0),
    deposit_cents: t.depositCents,
    payment_terms: quote.paymentTerms || null,
    vat_exempt: !!quote.vatExempt,
    vat_rate: Number(quote.vatRate) || 0,
    subtotal_cents: t.subtotalCents,
    vat_cents: t.vatCents,
    total_cents: t.totalCents,
    notes: quote.notes || null,
    valid_until: quote.validUntil || null,
  };
}

/** Mapping colonnes DB (snake_case) → objet JS. Accepte lignes RLS ou RPC. */
export function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    status: row.status,
    mua: {
      name: row.mua_name || '', siret: row.mua_siret || '', address: row.mua_address || '',
      email: row.mua_email || '', phone: row.mua_phone || '', logoUrl: row.mua_logo_url || '',
    },
    client: {
      name: row.client_name || '', email: row.client_email || '',
      phone: row.client_phone || '', eventAddress: row.event_address || '',
    },
    eventDate: row.event_date || '',
    items: (row.items || []).map(it => ({
      title: it.title, qty: Number(it.qty) || 0, unitPriceCents: Math.round(Number(it.unit_price_cents) || 0),
    })),
    travelDistanceKm: Number(row.travel_distance_km) || 0,
    travelRateCents: Math.round(Number(row.travel_rate_cents) || 0),
    depositCents: Math.round(Number(row.deposit_cents) || 0),
    paymentTerms: row.payment_terms || '',
    vatExempt: !!row.vat_exempt,
    vatRate: Number(row.vat_rate) || 0,
    subtotalCents: Math.round(Number(row.subtotal_cents) || 0),
    vatCents: Math.round(Number(row.vat_cents) || 0),
    totalCents: Math.round(Number(row.total_cents) || 0),
    notes: row.notes || '',
    validUntil: row.valid_until || '',
    signatureData: row.signature_data || '',
    signedName: row.signed_name || '',
    signedAt: row.signed_at || '',
    createdAt: row.created_at || '',
  };
}

// ═══════════════════════════════════════════════════
// GlamBook — Devis : accès aux données (Supabase)
// ═══════════════════════════════════════════════════
import { supabase, getCurrentUser } from '/js/supabase.js';
import { toRow, fromRow } from '/js/devis/model.js';

/** Récupère l'id `artists.id` de l'utilisateur connecté (ou null). */
export async function getMyArtistId() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('artists').select('id').eq('user_id', user.id).single();
  return data?.id || null;
}

/** Liste les devis de l'artiste connecté. */
export async function listMyQuotes() {
  const artistId = await getMyArtistId();
  if (!artistId) return [];
  const { data, error } = await supabase
    .from('quotes').select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

/** Charge un devis par id (RLS : doit appartenir à l'artiste). */
export async function getQuote(id) {
  const { data, error } = await supabase
    .from('quotes').select('*').eq('id', id).single();
  if (error) throw error;
  return fromRow(data);
}

/**
 * Crée ou met à jour un devis.
 * @param {import('./model.js').Quote} quote
 * @returns {Promise<import('./model.js').Quote>}
 */
export async function saveQuote(quote) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Non connecté.');
  const artistId = await getMyArtistId();
  if (!artistId) throw new Error("Profil artiste introuvable.");

  const row = toRow(quote, artistId, user.id);

  if (quote.id) {
    const { data, error } = await supabase
      .from('quotes').update(row).eq('id', quote.id).select('*').single();
    if (error) throw error;
    return fromRow(data);
  } else {
    const { data, error } = await supabase
      .from('quotes').insert(row).select('*').single();
    if (error) throw error;
    return fromRow(data);
  }
}

/** Passe un devis au statut "sent" et renvoie son token de partage + le devis. */
export async function markAsSent(id) {
  const { data, error } = await supabase
    .from('quotes').update({ status: 'sent' }).eq('id', id)
    .select('*').single();
  if (error) throw error;
  // share_token est en base mais non renvoyé par fromRow — on le lit séparément
  const { data: tok } = await supabase
    .from('quotes').select('share_token').eq('id', id).single();
  return { quote: fromRow(data), shareToken: tok?.share_token || null };
}

/** Récupère le token de partage d'un devis. */
export async function getShareToken(id) {
  const { data, error } = await supabase
    .from('quotes').select('share_token').eq('id', id).single();
  if (error) throw error;
  return data?.share_token || null;
}

/** Supprime un devis. */
export async function deleteQuote(id) {
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) throw error;
}

/** Construit l'URL publique de signature à partir d'un token. */
export function signatureUrl(token) {
  return `${location.origin}/signature.html?t=${encodeURIComponent(token)}`;
}

// ── Côté PUBLIC (page de signature, cliente non authentifiée) ──

/** Charge un devis via le RPC sécurisé get_quote_by_token. */
export async function getQuoteByToken(token) {
  const { data, error } = await supabase.rpc('get_quote_by_token', { p_token: token });
  if (error) throw error;
  return fromRow(data);
}

/**
 * Signe un devis via le RPC sécurisé sign_quote.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function signQuoteByToken(token, signatureDataUrl, signedName) {
  const { data, error } = await supabase.rpc('sign_quote', {
    p_token: token, p_signature: signatureDataUrl, p_name: signedName || '',
  });
  if (error) throw error;
  return data || { ok: false, error: 'unknown' };
}

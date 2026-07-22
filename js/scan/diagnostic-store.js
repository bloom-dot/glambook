// ═══════════════════════════════════════════════════
// GlamBook — Diagnostics visage enregistrés par la MUA (par rendez-vous)
// ═══════════════════════════════════════════════════
import { supabase } from '/js/supabase.js';
import { getMyArtistId } from '/js/devis/store.js';

// Réutilise l'appel à l'API vision (auth cliente OU artiste)
export { requestFaceDiagnostic } from '/js/booking/store.js';

/**
 * Enregistre un diagnostic lié à une cliente / un rendez-vous.
 * @param {{ clientName?:string, appointmentDate?:string, diagnostic:object, note?:string }} d
 */
export async function saveDiagnostic(d) {
  const artistId = await getMyArtistId();
  if (!artistId) throw new Error("Profil artiste introuvable.");
  const { data, error } = await supabase.from('client_diagnostics').insert({
    artist_id: artistId,
    client_name: d.clientName || null,
    appointment_date: d.appointmentDate || null,
    diagnostic: d.diagnostic || null,
    note: d.note || null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

/** Liste les diagnostics de l'artiste (rendez-vous à venir en premier). */
export async function listDiagnostics() {
  const { data, error } = await supabase
    .from('client_diagnostics').select('*')
    .order('appointment_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Supprime un diagnostic enregistré. */
export async function deleteDiagnostic(id) {
  const { error } = await supabase.from('client_diagnostics').delete().eq('id', id);
  if (error) throw error;
}

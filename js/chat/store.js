// ═══════════════════════════════════════════════════
// GlamBook — Messagerie sécurisée : données & temps réel
// Aucune coordonnée (email/téléphone) n'est échangée : seuls les
// noms d'affichage et les messages transitent, via des tables RLS.
// ═══════════════════════════════════════════════════
import { supabase, getCurrentUser } from '/js/supabase.js';

/**
 * @typedef {Object} ConversationSummary
 * @property {string}  id
 * @property {string}  artist_id
 * @property {string}  other_name     Nom de l'autre partie (jamais email/tel)
 * @property {boolean} i_am_client
 * @property {string}  last_message_at
 * @property {string}  [last_body]
 * @property {number}  unread
 */

/** Démarre (ou retrouve) une conversation avec un artiste. Renvoie l'id de conversation. */
export async function startConversation(artistId) {
  const { data, error } = await supabase.rpc('start_conversation', { p_artist_id: artistId });
  if (error) throw error;
  return data;
}

/** Liste des conversations de l'utilisateur courant (cliente ou artiste). */
export async function myConversations() {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return data || [];
}

/** Messages d'une conversation, ordre chronologique. */
export async function getMessages(convId) {
  const { data, error } = await supabase
    .from('messages').select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Envoie un message. */
export async function sendMessage(convId, body) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Non connecté.');
  const text = String(body || '').trim();
  if (!text) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: convId, sender_id: user.id, body: text })
    .select('*').single();
  if (error) throw error;
  return data;
}

/** Marque comme lus les messages reçus non lus d'une conversation. */
export async function markRead(convId) {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', convId)
    .is('read_at', null)
    .neq('sender_id', user.id);
}

/**
 * Abonnement temps réel aux nouveaux messages d'une conversation.
 * @returns {() => void} fonction de désabonnement
 */
export function subscribeMessages(convId, onInsert) {
  const channel = supabase
    .channel('msg-' + convId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
      (payload) => onInsert(payload.new))
    .subscribe();
  return () => { try { supabase.removeChannel(channel); } catch (_) {} };
}

/** Abonnement temps réel à toutes mes conversations (pour rafraîchir la liste). */
export function subscribeMyMessages(onAny) {
  const channel = supabase
    .channel('msg-all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onAny(p.new))
    .subscribe();
  return () => { try { supabase.removeChannel(channel); } catch (_) {} };
}

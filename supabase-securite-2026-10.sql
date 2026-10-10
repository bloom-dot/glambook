-- ══════════════════════════════════════════════════════════════════════
-- GlamBook — Durcissement des droits (7 octobre 2026)
-- ⚠️ PAS ENCORE APPLIQUÉ sur le projet lcrrdwlnxmneqfzqediu (accord donné le 10 octobre, application à relancer).
-- Revu le 10 octobre 2026 : toujours nécessaire (la faille « rôle admin » est réelle en base),
-- compatible avec le parcours sans compte, complété (jetons figés, devis signés intouchables).
-- Pour l'appliquer : Supabase → SQL Editor → coller ce fichier en entier → Run.
-- Testé à blanc sur une base locale (21 vérifications, aucune en échec).
--
-- Constat : les règles RLS vérifient QUI modifie une ligne, pas QUELLES colonnes.
-- Depuis le navigateur, une personne connectée pouvait donc :
--   • se donner le rôle « admin » dans sa propre ligne profiles ;
--   • se déclarer « vérifiée » et fixer sa note et son nombre d'avis (artists) ;
--   • confirmer elle-même sa réservation sans payer (bookings) ;
--   • réécrire les messages de l'autre personne (messages) ;
--   • lever un blocage posé par l'autre personne (conversations) ;
--   • publier un avis sur n'importe quelle maquilleuse à partir d'une réservation non honorée (reviews).
--
-- Principe du correctif : des déclencheurs qui ne s'appliquent qu'aux rôles de l'API
-- (authenticated, anon). Les fonctions internes SECURITY DEFINER (admin_*, book_slot,
-- cancel_booking, calcul de la note…) s'exécutent sous un autre rôle et ne sont pas gênées.
-- Pour revenir en arrière : supprimer les déclencheurs trg_guard_* (dont trg_guard_quotes) et trg_review_check.
-- ══════════════════════════════════════════════════════════════════════

-- Vrai quand la requête vient de l'API (navigateur), faux depuis une fonction interne ou le tableau de bord Supabase.
create or replace function public.from_api() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('authenticated', 'anon');
$$;

-- ── profiles : le rôle admin ne s'attribue pas soi-même ──
create or replace function public.guard_profiles() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.from_api() then
    if tg_op = 'INSERT' then
      if new.role is distinct from 'artist' then new.role := 'client'; end if;
    else
      new.user_id := old.user_id;
      if new.role is distinct from old.role and (new.role = 'admin' or old.role = 'admin') then
        raise exception 'Le rôle administrateur ne peut pas être modifié ici' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profiles on public.profiles;
create trigger trg_guard_profiles before insert or update on public.profiles
  for each row execute function public.guard_profiles();

-- ── artists : vérification, note et nombre d'avis ne sont jamais fixés par l'artiste ──
create or replace function public.guard_artists() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.from_api() then
    if tg_op = 'INSERT' then
      new.is_verified := false; new.rating_avg := 5.00; new.review_count := 0;
    else
      new.user_id := old.user_id;
      new.is_verified := old.is_verified;
      new.rating_avg := old.rating_avg;
      new.review_count := old.review_count;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_artists on public.artists;
create trigger trg_guard_artists before insert or update on public.artists
  for each row execute function public.guard_artists();

-- ── bookings : seule la maquilleuse change le statut ; le reste est figé après création ──
-- (l'annulation passe par la fonction cancel_booking, non concernée par ce déclencheur)
create or replace function public.guard_bookings() returns trigger
language plpgsql set search_path = '' as $$
declare is_owner boolean;
begin
  if public.from_api() and tg_op = 'INSERT' then
    -- création directe (hors fonction book_slot) : jamais « confirmée » ni « payée » d'office
    new.status := 'pending'; new.stripe_pi_id := null; new.reviewed := false;
  elsif public.from_api() then
    new.client_id := old.client_id; new.artist_id := old.artist_id; new.service_id := old.service_id;
    new.slot_id := old.slot_id; new.date := old.date; new.time_slot := old.time_slot;
    new.stripe_pi_id := old.stripe_pi_id; new.reviewed := old.reviewed;
    -- lien personnel et coordonnées de la cliente : jamais modifiés depuis le navigateur
    new.access_token := old.access_token; new.link_sent_at := old.link_sent_at;
    new.client_email := old.client_email; new.client_name := old.client_name;
    new.client_phone := old.client_phone; new.address := old.address; new.created_at := old.created_at;
    if new.status is distinct from old.status then
      select exists (select 1 from public.artists a where a.id = old.artist_id and a.user_id = auth.uid()) into is_owner;
      if not is_owner or not (old.status in ('pending', 'confirmed') and new.status in ('confirmed', 'done')) then
        raise exception 'Changement de statut non autorisé' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_bookings on public.bookings;
create trigger trg_guard_bookings before insert or update on public.bookings
  for each row execute function public.guard_bookings();

-- ── messages : on peut marquer « lu », pas réécrire ──
create or replace function public.guard_messages() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.from_api() then
    new.body := old.body; new.sender_id := old.sender_id;
    new.conversation_id := old.conversation_id; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_messages on public.messages;
create trigger trg_guard_messages before update on public.messages
  for each row execute function public.guard_messages();

-- ── conversations : on bloque en son nom, on ne lève que son propre blocage ──
create or replace function public.guard_conversations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.from_api() then
    new.artist_id := old.artist_id; new.client_id := old.client_id; new.created_at := old.created_at;
    if new.blocked_by is distinct from old.blocked_by then
      if not ((old.blocked_by is null and new.blocked_by = auth.uid())
           or (new.blocked_by is null and old.blocked_by = auth.uid())) then
        raise exception 'Blocage non autorisé' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_conversations on public.conversations;
create trigger trg_guard_conversations before update on public.conversations
  for each row execute function public.guard_conversations();

-- ── reviews : un avis par réservation honorée, rattaché à la maquilleuse de cette réservation ──
create or replace function public.review_check() returns trigger
language plpgsql set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  if public.from_api() then
    select * into b from public.bookings where id = new.booking_id;
    if not found or b.client_id is distinct from auth.uid() then
      raise exception 'Réservation introuvable' using errcode = '42501';
    end if;
    if b.status not in ('confirmed', 'done') or b.date > current_date then
      raise exception 'Un avis se laisse après la prestation' using errcode = '42501';
    end if;
    new.artist_id := b.artist_id;   -- jamais celle indiquée par le navigateur
    new.client_id := auth.uid();
    new.quote_id := null;           -- l'avis sur devis passe par review_quote()
  end if;
  return new;
end $$;
drop trigger if exists trg_review_check on public.reviews;
create trigger trg_review_check before insert on public.reviews
  for each row execute function public.review_check();

-- ── quotes : un devis signé ne se retouche plus ; seule la cliente signe (sign_quote) ──
create or replace function public.guard_quotes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.from_api() then
    if tg_op = 'UPDATE' and old.status = 'signed' then
      raise exception 'Devis signé : il ne peut plus être modifié' using errcode = '42501';
    end if;
    if new.status = 'signed' then
      raise exception 'Seule la cliente signe un devis' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      new.signature_data := old.signature_data; new.signed_at := old.signed_at; new.signed_name := old.signed_name;
      new.share_token := old.share_token; new.artist_id := old.artist_id;
    else
      new.signature_data := null; new.signed_at := null; new.signed_name := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_quotes on public.quotes;
create trigger trg_guard_quotes before insert or update on public.quotes
  for each row execute function public.guard_quotes();

-- Un devis signé ne se supprime pas non plus depuis le navigateur
create or replace function public.guard_quotes_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.from_api() and old.status = 'signed' then
    raise exception 'Devis signé : il ne peut pas être supprimé' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists trg_guard_quotes_delete on public.quotes;
create trigger trg_guard_quotes_delete before delete on public.quotes
  for each row execute function public.guard_quotes_delete();

-- ── Avis publics : prénom et initiale, pas le nom complet de la cliente ──
create or replace view public.reviews_public as
  select r.id, r.artist_id, r.rating, r.comment, r.created_at,
         coalesce(
           nullif(trim(split_part(trim(p.full_name), ' ', 1)
             || coalesce(' ' || nullif(upper(left(split_part(trim(p.full_name), ' ', 2), 1)), '') || '.', '')), ''),
           'Cliente') as reviewer_name
  from public.reviews r
  left join public.profiles p on p.user_id = r.client_id;

-- ── Portfolio : images seulement, 5 Mo maximum (le formulaire l'annonçait, rien ne l'imposait) ──
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'portfolio';

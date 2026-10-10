-- ═════════════════════════════════════════════════════════════════════
-- GlamBook — correctifs du 10 octobre 2026 (audit de nuit)
-- Bugs de fonctionnement et garde-fous du parcours sans compte.
-- Ne remplace PAS supabase-securite-2026-10.sql (toujours à valider par Fernand).
-- Rejouable sans risque.
-- ═════════════════════════════════════════════════════════════════════

-- 1. Une réservation annulée ne bloque plus l'agenda ----------------------
-- bookings.slot_id pointait sans ON DELETE vers le créneau : après une annulation,
-- enregistrer ses créneaux du jour ou appliquer la semaine type échouait.
alter table public.bookings drop constraint if exists bookings_slot_id_fkey;
alter table public.bookings add constraint bookings_slot_id_fkey
  foreign key (slot_id) references public.availabilities(id) on delete set null;

-- 2. Index pour les garde-fous par adresse e-mail -------------------------
create index if not exists booking_requests_email_created_idx on public.booking_requests (lower(client_email), created_at);
create index if not exists bookings_email_status_idx on public.bookings (lower(client_email), status, date);

-- 3. Demande de devis : diagnostic plafonné, 15 demandes sans compte / h / maquilleuse
create or replace function public.submit_request(
  p_artist uuid, p_name text, p_email text, p_phone text,
  p_event_date timestamptz, p_address text, p_note text,
  p_services jsonb default '[]'::jsonb, p_diagnostic jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := nullif(left(trim(coalesce(p_name, '')), 80), '');
  v_note  text := nullif(left(trim(coalesce(p_note, '')), 2000), '');
  v_snap  jsonb;
  v_row   booking_requests%rowtype;
begin
  if not exists (select 1 from artists where id = p_artist and is_active) then
    return jsonb_build_object('ok', false, 'error', 'artist_unavailable'); end if;
  if v_name is null then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  -- Le diagnostic visage est un petit résumé : au-delà, on l'ignore (protège la base gratuite)
  if p_diagnostic is not null and pg_column_size(p_diagnostic) > 8000 then p_diagnostic := null; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'email_invalid'); end if;
  if p_event_date is null or p_event_date < now() - interval '1 day' then
    return jsonb_build_object('ok', false, 'error', 'date_invalid'); end if;
  -- Prestations : relues dans la base (nom et prix), seulement celles de cette maquilleuse
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'price_cents', s.price_cents) order by s.price_cents), '[]'::jsonb)
    into v_snap
    from services s
   where s.artist_id = p_artist
     and s.id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) x where (x->>'id') ~ '^[0-9a-f-]{36}$');
  if jsonb_array_length(v_snap) = 0 and v_note is null then
    return jsonb_build_object('ok', false, 'error', 'need_required'); end if;
  -- Garde-fou : 10 demandes par adresse e-mail et par jour
  if (select count(*) from booking_requests where lower(client_email) = v_email and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  -- Garde-fou : 15 demandes sans compte par maquilleuse et par heure
  if auth.uid() is null and (select count(*) from booking_requests where artist_id = p_artist and client_id is null and created_at > now() - interval '1 hour') >= 15 then
    return jsonb_build_object('ok', false, 'error', 'too_many'); end if;

  insert into booking_requests (artist_id, client_id, client_name, client_email, client_phone, event_address,
                                event_date, services_snapshot, travel_distance_km, diagnostic, note, status)
  values (p_artist, auth.uid(), v_name, v_email, nullif(left(trim(coalesce(p_phone, '')), 30), ''),
          nullif(left(trim(coalesce(p_address, '')), 200), ''), p_event_date, v_snap, 0, p_diagnostic, v_note, 'pending')
  returning * into v_row;
  return jsonb_build_object('ok', true, 'token', v_row.access_token, 'id', v_row.id);
end $$;

-- 4. Réservation : plus de créneau déjà passé dans la journée, et pas d'agenda bloqué
create or replace function public.book_slot_guest(
  p_slot uuid, p_service uuid, p_name text, p_email text, p_phone text, p_address text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := nullif(left(trim(coalesce(p_name, '')), 80), '');
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 30), '');
  v_slot  availabilities%rowtype;
  v_row   bookings%rowtype;
  v_now   timestamp := now() at time zone 'Europe/Paris';
begin
  if v_name is null then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'phone_required'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'email_invalid'); end if;
  if nullif(trim(coalesce(p_address, '')), '') is null then return jsonb_build_object('ok', false, 'error', 'address_required'); end if;
  select * into v_slot from availabilities where id = p_slot for update;
  if not found or not coalesce(v_slot.is_available, false) or coalesce(v_slot.is_booked, false)
     or (v_slot.date + case when v_slot.time_slot ~ '^\d{1,2}:\d{2}' then substring(v_slot.time_slot from '^\d{1,2}:\d{2}')::time else '00:00'::time end) <= v_now then
    return jsonb_build_object('ok', false, 'error', 'slot_unavailable'); end if;
  if not exists (select 1 from artists where id = v_slot.artist_id and is_active) then
    return jsonb_build_object('ok', false, 'error', 'artist_unavailable'); end if;
  if not exists (select 1 from services where id = p_service and artist_id = v_slot.artist_id) then
    return jsonb_build_object('ok', false, 'error', 'service_mismatch'); end if;
  -- 5 réservations à venir non confirmées par adresse e-mail
  if (select count(*) from bookings where lower(client_email) = v_email and status = 'pending' and date >= current_date) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  -- 6 réservations sans compte par maquilleuse et par heure : personne ne peut vider un agenda
  if auth.uid() is null and (select count(*) from bookings where artist_id = v_slot.artist_id and client_id is null
                               and status = 'pending' and created_at > now() - interval '1 hour') >= 6 then
    return jsonb_build_object('ok', false, 'error', 'too_many'); end if;

  insert into bookings (client_id, artist_id, service_id, slot_id, date, time_slot, status, note,
                        client_name, client_email, client_phone, address)
  values (auth.uid(), v_slot.artist_id, p_service, p_slot, v_slot.date, v_slot.time_slot, 'pending',
          nullif(left(trim(coalesce(p_note, '')), 1000), ''), v_name, v_email, v_phone, left(trim(p_address), 200))
  returning * into v_row;
  update availabilities set is_booked = true where id = p_slot;
  return jsonb_build_object('ok', true, 'token', v_row.access_token, 'id', v_row.id);
end $$;
grant execute on function public.book_slot_guest(uuid, uuid, text, text, text, text, text) to anon, authenticated;

-- 5. Annulation par lien : impossible une fois le devis signé ; le devis envoyé est retiré
create or replace function public.cancel_by_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r booking_requests%rowtype; b bookings%rowtype;
begin
  if p_token is null or length(p_token) < 32 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into r from booking_requests where access_token = p_token for update;
  if found then
    if r.status not in ('pending', 'quoted') then return jsonb_build_object('ok', false, 'error', 'not_cancellable'); end if;
    if r.quote_id is not null and exists (select 1 from quotes where id = r.quote_id and status = 'signed') then
      return jsonb_build_object('ok', false, 'error', 'quote_signed'); end if;
    update booking_requests set status = 'cancelled' where id = r.id;
    if r.quote_id is not null then update quotes set status = 'declined' where id = r.quote_id and status in ('draft', 'sent'); end if;
    return jsonb_build_object('ok', true);
  end if;
  select * into b from bookings where access_token = p_token for update;
  if found then
    if b.status not in ('pending', 'confirmed') or b.date < current_date then
      return jsonb_build_object('ok', false, 'error', 'not_cancellable'); end if;
    update bookings set status = 'cancelled' where id = b.id;
    if b.slot_id is not null then update availabilities set is_booked = false where id = b.slot_id; end if;
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'error', 'not_found');
end $$;
grant execute on function public.cancel_by_token(text) to anon, authenticated;

-- 6. Mon espace : devis retrouvés quelle que soit la casse de l'adresse, e-mail confirmé exigé
create or replace function public.my_quotes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select q.id, q.quote_number, q.status, q.total_cents, q.created_at,
           q.event_date, q.signed_at, q.mua_name, q.share_token, q.artist_id,
           a.slug as artist_slug,
           exists (select 1 from reviews r where r.quote_id = q.id) as reviewed,
           (q.status = 'signed'
             and coalesce(q.event_date, q.signed_at + interval '1 day') <= now()
             and not exists (select 1 from reviews r where r.quote_id = q.id)) as can_review
    from quotes q
    left join artists a on a.id = q.artist_id
    where lower(trim(q.client_email)) = (select lower(email) from auth.users
                                         where id = (select auth.uid()) and email_confirmed_at is not null)
      and q.status in ('sent', 'signed')
  ) x;
$$;

create or replace function public.review_quote(p_quote_id uuid, p_rating integer, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q quotes%rowtype;
  v_uid uuid := auth.uid();
  v_email text;
  v_when timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  select email into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  select * into q from quotes where id = p_quote_id;
  if not found or q.client_email is null or v_email is null or lower(trim(q.client_email)) <> lower(trim(v_email)) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if q.status <> 'signed' then return jsonb_build_object('ok', false, 'error', 'not_signed'); end if;
  v_when := coalesce(q.event_date, q.signed_at + interval '1 day');
  if v_when is null or v_when > now() then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;
  if exists (select 1 from reviews where quote_id = q.id) then return jsonb_build_object('ok', false, 'error', 'already_reviewed'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('ok', false, 'error', 'bad_rating'); end if;
  insert into reviews (artist_id, client_id, rating, comment, quote_id)
  values (q.artist_id, v_uid, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''), q.id);
  return jsonb_build_object('ok', true);
end $$;

-- 7. Signature : devis expiré refusé, signature plafonnée à ~300 Ko
create or replace function public.sign_quote(p_token text, p_signature text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q quotes%rowtype;
begin
  select * into q from quotes where share_token = p_token limit 1 for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if q.status = 'signed' then return jsonb_build_object('ok', false, 'error', 'already_signed'); end if;
  if q.status <> 'sent' then return jsonb_build_object('ok', false, 'error', 'not_sendable'); end if;
  if q.valid_until is not null and q.valid_until < current_date then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if coalesce(length(p_signature), 0) < 100 then return jsonb_build_object('ok', false, 'error', 'empty_signature'); end if;
  if length(p_signature) > 300000 then return jsonb_build_object('ok', false, 'error', 'signature_too_large'); end if;
  update quotes set signature_data = p_signature, signed_name = nullif(left(trim(p_name), 120), ''),
                    signed_at = now(), status = 'signed' where id = q.id;
  return jsonb_build_object('ok', true);
end $$;

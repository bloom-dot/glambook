-- ════════════════════════════════════════════════════════════════════
--  GlamBook — Parcours cliente sans inscription (9 octobre 2026)
--
--  Une cliente peut demander un devis ou réserver un créneau sans créer de compte :
--  prénom, téléphone et e-mail suffisent. Chaque demande et chaque réservation reçoit
--  un jeton secret (access_token) : le lien /rdv.html?t=<jeton> permet de la suivre,
--  de l'annuler, de signer le devis reçu. Si elle crée un compte plus tard avec la même
--  adresse (confirmée), claim_my_items() rattache tout à son compte.
--
--  Fonctions appelables sans compte : submit_request, book_slot_guest, get_by_token,
--  cancel_by_token. Les prix et la maquilleuse viennent toujours de la base, jamais du navigateur.
--  Corrige aussi cancel_booking : une réservation sans compte (client_id vide) ne pouvait pas
--  être protégée par la comparaison « <> ».
-- ════════════════════════════════════════════════════════════════════

-- ── Jetons, adresse du rendez-vous, envoi du lien ──
alter table public.booking_requests add column if not exists access_token text;
alter table public.booking_requests add column if not exists link_sent_at timestamptz;
update public.booking_requests set access_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where access_token is null;
alter table public.booking_requests alter column access_token set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
create unique index if not exists booking_requests_access_token_key on public.booking_requests (access_token);

alter table public.bookings add column if not exists access_token text;
alter table public.bookings add column if not exists address text;
alter table public.bookings add column if not exists link_sent_at timestamptz;
update public.bookings set access_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where access_token is null;
alter table public.bookings alter column access_token set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
create unique index if not exists bookings_access_token_key on public.bookings (access_token);

-- Une cliente peut annuler sa demande
alter table public.booking_requests drop constraint if exists booking_requests_status_check;
alter table public.booking_requests add constraint booking_requests_status_check
  check (status in ('pending', 'quoted', 'declined', 'cancelled'));

-- ── Demande de devis, avec ou sans compte ──
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

  insert into booking_requests (artist_id, client_id, client_name, client_email, client_phone, event_address,
                                event_date, services_snapshot, travel_distance_km, diagnostic, note, status)
  values (p_artist, auth.uid(), v_name, v_email, nullif(left(trim(coalesce(p_phone, '')), 30), ''),
          nullif(left(trim(coalesce(p_address, '')), 200), ''), p_event_date, v_snap, 0, p_diagnostic, v_note, 'pending')
  returning * into v_row;
  return jsonb_build_object('ok', true, 'token', v_row.access_token, 'id', v_row.id);
end $$;

-- ── Réservation d'un créneau, avec ou sans compte (réglée sur place) ──
create or replace function public.book_slot_guest(
  p_slot uuid, p_service uuid, p_name text, p_email text, p_phone text, p_address text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := nullif(left(trim(coalesce(p_name, '')), 80), '');
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 30), '');
  v_slot  availabilities%rowtype;
  v_row   bookings%rowtype;
begin
  if v_name is null then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'phone_required'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'email_invalid'); end if;
  if nullif(trim(coalesce(p_address, '')), '') is null then return jsonb_build_object('ok', false, 'error', 'address_required'); end if;
  select * into v_slot from availabilities where id = p_slot for update;
  if not found or not coalesce(v_slot.is_available, false) or coalesce(v_slot.is_booked, false) or v_slot.date < current_date then
    return jsonb_build_object('ok', false, 'error', 'slot_unavailable'); end if;
  if not exists (select 1 from artists where id = v_slot.artist_id and is_active) then
    return jsonb_build_object('ok', false, 'error', 'artist_unavailable'); end if;
  if not exists (select 1 from services where id = p_service and artist_id = v_slot.artist_id) then
    return jsonb_build_object('ok', false, 'error', 'service_mismatch'); end if;
  -- Garde-fou : 5 réservations à venir non confirmées par adresse e-mail
  if (select count(*) from bookings where lower(client_email) = v_email and status = 'pending' and date >= current_date) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many'); end if;

  insert into bookings (client_id, artist_id, service_id, slot_id, date, time_slot, status, note,
                        client_name, client_email, client_phone, address)
  values (auth.uid(), v_slot.artist_id, p_service, p_slot, v_slot.date, v_slot.time_slot, 'pending',
          nullif(left(trim(coalesce(p_note, '')), 1000), ''), v_name, v_email, v_phone, left(trim(p_address), 200))
  returning * into v_row;
  update availabilities set is_booked = true where id = p_slot;
  return jsonb_build_object('ok', true, 'token', v_row.access_token, 'id', v_row.id);
end $$;

-- ── Lecture par le lien personnel ──
create or replace function public.get_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r booking_requests%rowtype; b bookings%rowtype; v_artist jsonb; q quotes%rowtype;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into r from booking_requests where access_token = p_token;
  if found then
    select jsonb_build_object('id', a.id, 'name', coalesce(nullif(a.display_name, ''), p.full_name), 'slug', a.slug, 'city', p.city,
             'photo', (select ph.url from artist_photos ph where ph.artist_id = a.id order by ph.created_at limit 1))
      into v_artist from artists a left join profiles p on p.user_id = a.user_id where a.id = r.artist_id;
    if r.quote_id is not null then select * into q from quotes where id = r.quote_id; end if;
    return jsonb_build_object('kind', 'request', 'status', r.status, 'created_at', r.created_at, 'event_date', r.event_date,
      'address', r.event_address, 'note', r.note, 'services', r.services_snapshot,
      'first_name', split_part(coalesce(r.client_name, ''), ' ', 1), 'email', r.client_email, 'artist', v_artist,
      'quote', case when q.id is null or q.status not in ('sent', 'signed') then null
                    else jsonb_build_object('status', q.status, 'token', q.share_token, 'total_cents', q.total_cents, 'number', q.quote_number) end);
  end if;
  select * into b from bookings where access_token = p_token;
  if found then
    select jsonb_build_object('id', a.id, 'name', coalesce(nullif(a.display_name, ''), p.full_name), 'slug', a.slug, 'city', p.city,
             'photo', (select ph.url from artist_photos ph where ph.artist_id = a.id order by ph.created_at limit 1))
      into v_artist from artists a left join profiles p on p.user_id = a.user_id where a.id = b.artist_id;
    return jsonb_build_object('kind', 'booking', 'status', b.status, 'created_at', b.created_at, 'date', b.date, 'time', b.time_slot,
      'address', b.address, 'note', b.note, 'first_name', split_part(coalesce(b.client_name, ''), ' ', 1), 'email', b.client_email,
      'artist', v_artist,
      'service', (select jsonb_build_object('id', s.id, 'name', s.name, 'price_cents', s.price_cents, 'duration_min', s.duration_min) from services s where s.id = b.service_id));
  end if;
  return null;
end $$;

-- ── Annulation par le lien personnel ──
create or replace function public.cancel_by_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r booking_requests%rowtype; b bookings%rowtype;
begin
  if p_token is null or length(p_token) < 32 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into r from booking_requests where access_token = p_token for update;
  if found then
    if r.status not in ('pending', 'quoted') then return jsonb_build_object('ok', false, 'error', 'not_cancellable'); end if;
    update booking_requests set status = 'cancelled' where id = r.id;
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

-- ── Rattacher au compte ce qui a été fait sans compte (adresse e-mail confirmée uniquement) ──
create or replace function public.claim_my_items()
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; n1 int; n2 int;
begin
  if v_uid is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update booking_requests set client_id = v_uid where client_id is null and lower(client_email) = v_email;
  get diagnostics n1 = row_count;
  update bookings set client_id = v_uid where client_id is null and lower(client_email) = v_email;
  get diagnostics n2 = row_count;
  return n1 + n2;
end $$;

-- ── Correctif : cancel_booking compare aussi une réservation sans compte ──
create or replace function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_booking public.bookings%rowtype; v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.client_id is distinct from v_uid
     and not exists (select 1 from public.artists a where a.id = v_booking.artist_id and a.user_id = v_uid) then
    raise exception 'FORBIDDEN';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then raise exception 'NOT_CANCELLABLE'; end if;
  update public.bookings set status = 'cancelled' where id = p_booking_id;
  if v_booking.slot_id is not null then
    update public.availabilities set is_booked = false where id = v_booking.slot_id;
  end if;
end $$;

revoke all on function public.submit_request(uuid, text, text, text, timestamptz, text, text, jsonb, jsonb) from public;
revoke all on function public.book_slot_guest(uuid, uuid, text, text, text, text, text) from public;
revoke all on function public.get_by_token(text) from public;
revoke all on function public.cancel_by_token(text) from public;
revoke all on function public.claim_my_items() from public, anon;
grant execute on function public.submit_request(uuid, text, text, text, timestamptz, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.book_slot_guest(uuid, uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_by_token(text) to anon, authenticated;
grant execute on function public.cancel_by_token(text) to anon, authenticated;
grant execute on function public.claim_my_items() to authenticated;

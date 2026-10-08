-- ════════════════════════════════════════════════════════════════════
--  GlamBook — Avis après un devis signé (8 octobre 2026)
--
--  Jusqu'ici un avis ne pouvait se laisser qu'à partir d'une réservation de créneau.
--  Or presque toutes les prestations passent par un devis : aucun avis n'arrivait.
--
--  Ce script :
--   • rattache un avis à un devis (colonne reviews.quote_id, un avis par devis) ;
--   • ajoute la fonction review_quote() : la cliente dont l'adresse e-mail figure sur un devis
--     SIGNÉ peut le noter une fois la date de l'événement passée (ou, sans date, 1 jour après
--     la signature). La maquilleuse notée est celle du devis, jamais celle envoyée par le navigateur ;
--   • enrichit my_quotes() avec ce qu'il faut pour proposer l'avis (date, maquilleuse, déjà noté ?).
--
--  Les insertions directes dans reviews restent réservées aux réservations (politique existante) :
--  un avis sur devis passe obligatoirement par review_quote().
--  Compatible avec supabase-securite-2026-10.sql (son contrôle ne s'applique pas aux fonctions internes).
--  Pour revenir en arrière : drop function public.review_quote; alter table public.reviews drop column quote_id;
--  puis recréer my_quotes() dans sa version précédente.
-- ════════════════════════════════════════════════════════════════════

alter table public.reviews add column if not exists quote_id uuid references public.quotes(id) on delete set null;
create unique index if not exists reviews_quote_id_key on public.reviews (quote_id) where quote_id is not null;

create or replace function public.review_quote(p_quote_id uuid, p_rating int, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q quotes%rowtype;
  v_uid uuid := auth.uid();
  v_email text;
  v_when timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  select email into v_email from auth.users where id = v_uid;
  select * into q from quotes where id = p_quote_id;
  if not found or q.client_email is null or lower(trim(q.client_email)) <> lower(trim(coalesce(v_email, ''))) then
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

revoke all on function public.review_quote(uuid, int, text) from public, anon;
grant execute on function public.review_quote(uuid, int, text) to authenticated;

-- my_quotes : mêmes devis qu'avant, avec de quoi proposer l'avis
create or replace function public.my_quotes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
    where q.client_email = (select email from auth.users where id = (select auth.uid()))
      and q.status in ('sent', 'signed')
  ) x;
$$;

-- ═══════════════════════════════════════════════════
-- GLAMBOOK — Module Devis (quotes) + signature
-- À coller dans l'éditeur SQL Supabase (ou appliqué via migration)
-- ═══════════════════════════════════════════════════

create extension if not exists "pgcrypto";  -- pour gen_random_bytes / gen_random_uuid

-- ─────────────────────────────────────────────────────
-- TABLE quotes (devis)
-- ─────────────────────────────────────────────────────
create table if not exists quotes (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid references artists(id) on delete cascade,
  created_by    uuid references auth.users(id),
  quote_number  text,
  status        text not null default 'draft'
                  check (status in ('draft','sent','signed','declined','expired')),
  share_token   text unique not null default encode(gen_random_bytes(16), 'hex'),

  -- Informations MUA (snapshot au moment du devis)
  mua_name      text,
  mua_siret     text,
  mua_address   text,
  mua_email     text,
  mua_phone     text,
  mua_logo_url  text,

  -- Informations Cliente
  client_name   text,
  client_email  text,
  client_phone  text,
  event_address text,
  event_date    timestamptz,

  -- Prestations & tarification
  items              jsonb  not null default '[]'::jsonb,  -- [{title, qty, unit_price_cents}]
  travel_distance_km numeric(8,2) default 0,
  travel_rate_cents  int    default 0,   -- tarif par km en centimes
  deposit_cents      int    default 0,   -- acompte demandé
  payment_terms      text,
  vat_exempt         boolean default true,          -- franchise en base (auto-entrepreneur)
  vat_rate           numeric(5,2) default 20.00,

  -- Totaux (stockés en centimes, calculés côté client puis re-vérifiables)
  subtotal_cents int default 0,   -- Total HT (prestations + déplacement)
  vat_cents      int default 0,   -- TVA
  total_cents    int default 0,   -- Total TTC

  -- Signature
  signature_data text,            -- dataURL PNG de la signature manuscrite
  signed_at      timestamptz,
  signed_name    text,

  notes       text,
  valid_until date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_quotes_artist on quotes(artist_id, created_at desc);
create index if not exists idx_quotes_token  on quotes(share_token);

-- updated_at auto
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_quotes_updated on quotes;
create trigger trg_quotes_updated before update on quotes
  for each row execute procedure public.touch_updated_at();

-- ─────────────────────────────────────────────────────
-- RLS : l'artiste gère ses propres devis
-- ─────────────────────────────────────────────────────
alter table quotes enable row level security;

drop policy if exists "Artiste voit ses devis"    on quotes;
drop policy if exists "Artiste crée ses devis"    on quotes;
drop policy if exists "Artiste modifie ses devis" on quotes;
drop policy if exists "Artiste supprime ses devis" on quotes;

create policy "Artiste voit ses devis" on quotes for select using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "Artiste crée ses devis" on quotes for insert with check (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "Artiste modifie ses devis" on quotes for update using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "Artiste supprime ses devis" on quotes for delete using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- ─────────────────────────────────────────────────────
-- RPC sécurisés pour la page publique de signature
-- (la cliente n'est PAS authentifiée ; on n'expose que la ligne
--  correspondant au token, jamais toute la table)
-- ─────────────────────────────────────────────────────

-- Lecture d'un devis par son token de partage
create or replace function public.get_quote_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare q jsonb;
begin
  select to_jsonb(x) into q
  from (
    select id, quote_number, status,
           mua_name, mua_siret, mua_address, mua_email, mua_phone, mua_logo_url,
           client_name, client_email, client_phone, event_address, event_date,
           items, travel_distance_km, travel_rate_cents, deposit_cents,
           payment_terms, vat_exempt, vat_rate,
           subtotal_cents, vat_cents, total_cents,
           signature_data, signed_at, signed_name,
           notes, valid_until, created_at
    from quotes
    where share_token = p_token
    limit 1
  ) x;
  return q;  -- null si token inconnu
end; $$;

-- Signature d'un devis (uniquement si envoyé et pas déjà signé)
create or replace function public.sign_quote(p_token text, p_signature text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare q quotes%rowtype;
begin
  select * into q from quotes where share_token = p_token limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if q.status = 'signed' then
    return jsonb_build_object('ok', false, 'error', 'already_signed');
  end if;
  if q.status <> 'sent' then
    return jsonb_build_object('ok', false, 'error', 'not_sendable');
  end if;
  if coalesce(length(p_signature), 0) < 100 then
    return jsonb_build_object('ok', false, 'error', 'empty_signature');
  end if;

  update quotes
     set signature_data = p_signature,
         signed_name    = nullif(trim(p_name), ''),
         signed_at      = now(),
         status         = 'signed'
   where id = q.id;

  return jsonb_build_object('ok', true);
end; $$;

-- Autoriser l'appel des RPC par les rôles anon (page publique) et authenticated
grant execute on function public.get_quote_by_token(text) to anon, authenticated;
grant execute on function public.sign_quote(text, text, text) to anon, authenticated;

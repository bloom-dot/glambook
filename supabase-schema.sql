-- ═══════════════════════════════════════════════════
-- GLAMBOOK — Schéma Supabase complet
-- Coller dans l'éditeur SQL de votre projet Supabase
-- ═══════════════════════════════════════════════════

-- Extensions
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────
-- 1. PROFILES (complète auth.users)
-- ─────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'client' check (role in ('client','artist','admin')),
  city        text,
  phone       text,
  region      text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Créé automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, full_name, role, city, phone, region)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'region'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────
-- 2. ARTISTS
-- ─────────────────────────────────────────────────────
create table artists (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid unique references auth.users(id) on delete cascade,
  bio           text,
  is_active     boolean default false,
  is_verified   boolean default false,
  rating_avg    numeric(3,2) default 5.00,
  review_count  int default 0,
  price_from    numeric(8,2),
  instagram     text,
  tiktok        text,
  youtube       text,
  website       text,
  specialties   text[] default '{}',
  created_at    timestamptz default now()
);

-- Index recherche full-text (pour filtres ville/région via profiles)
create index idx_artists_active on artists(is_active) where is_active = true;
create index idx_artists_rating on artists(rating_avg desc);

-- ─────────────────────────────────────────────────────
-- 3. SERVICES (prestations par artiste)
-- ─────────────────────────────────────────────────────
create table services (
  id           uuid primary key default uuid_generate_v4(),
  artist_id    uuid references artists(id) on delete cascade,
  name         text not null,
  description  text,
  price_cents  int not null,
  duration_min int not null default 60,
  category     text,
  created_at   timestamptz default now()
);

create index idx_services_artist on services(artist_id);

-- ─────────────────────────────────────────────────────
-- 4. AVAILABILITIES (créneaux horaires)
-- ─────────────────────────────────────────────────────
create table availabilities (
  id           uuid primary key default uuid_generate_v4(),
  artist_id    uuid references artists(id) on delete cascade,
  date         date not null,
  time_slot    text not null,
  is_available boolean default true,
  is_booked    boolean default false,
  created_at   timestamptz default now(),
  unique(artist_id, date, time_slot)
);

create index idx_avail_artist_date on availabilities(artist_id, date);
create index idx_avail_available   on availabilities(date, is_available, is_booked);

-- ─────────────────────────────────────────────────────
-- 5. BOOKINGS (réservations)
-- ─────────────────────────────────────────────────────
create table bookings (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid references auth.users(id),
  artist_id     uuid references artists(id),
  service_id    uuid references services(id),
  slot_id       uuid references availabilities(id),
  date          date not null,
  time_slot     text not null,
  status        text not null default 'pending' check (status in ('pending','confirmed','cancelled','done')),
  note          text,
  client_name   text,
  client_email  text,
  client_phone  text,
  reviewed      boolean default false,
  stripe_pi_id  text,
  created_at    timestamptz default now()
);

create index idx_bookings_client on bookings(client_id, date desc);
create index idx_bookings_artist on bookings(artist_id, date desc);

-- ─────────────────────────────────────────────────────
-- 6. REVIEWS (avis clients)
-- ─────────────────────────────────────────────────────
create table reviews (
  id          uuid primary key default uuid_generate_v4(),
  booking_id  uuid unique references bookings(id) on delete cascade,
  artist_id   uuid references artists(id) on delete cascade,
  client_id   uuid references auth.users(id),
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now()
);

create index idx_reviews_artist on reviews(artist_id, created_at desc);

-- ─────────────────────────────────────────────────────
-- 7. ARTIST_PHOTOS (portfolio)
-- ─────────────────────────────────────────────────────
create table artist_photos (
  id         uuid primary key default uuid_generate_v4(),
  artist_id  uuid references artists(id) on delete cascade,
  url        text not null,
  caption    text,
  created_at timestamptz default now()
);

create index idx_photos_artist on artist_photos(artist_id, created_at desc);

-- ─────────────────────────────────────────────────────
-- 8. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────

alter table profiles       enable row level security;
alter table artists        enable row level security;
alter table services       enable row level security;
alter table availabilities enable row level security;
alter table bookings       enable row level security;
alter table reviews        enable row level security;
alter table artist_photos  enable row level security;

-- PROFILES
create policy "Lecture profil public"   on profiles for select using (true);
create policy "Modifier son profil"     on profiles for update using (auth.uid() = user_id);
create policy "Créer son profil"        on profiles for insert with check (auth.uid() = user_id);

-- ARTISTS
create policy "Lecture artistes actifs" on artists for select using (is_active = true or auth.uid() = user_id);
create policy "Modifier son profil artiste" on artists for update using (auth.uid() = user_id);
create policy "Créer profil artiste"    on artists for insert with check (auth.uid() = user_id);

-- SERVICES
create policy "Lecture services publique" on services for select using (true);
create policy "Gérer ses services"        on services for all using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- AVAILABILITIES
create policy "Lecture créneaux publique" on availabilities for select using (true);
create policy "Gérer ses créneaux"        on availabilities for all using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- BOOKINGS
create policy "Voir ses réservations client"  on bookings for select using (auth.uid() = client_id);
create policy "Voir ses réservations artiste" on bookings for select using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "Créer une réservation"         on bookings for insert with check (auth.uid() = client_id);
create policy "Mettre à jour réservation"     on bookings for update using (
  auth.uid() = client_id or auth.uid() = (select user_id from artists where id = artist_id)
);

-- REVIEWS
create policy "Lecture avis publique"  on reviews for select using (true);
create policy "Créer un avis"          on reviews for insert with check (auth.uid() = client_id);

-- ARTIST_PHOTOS
create policy "Lecture photos publique" on artist_photos for select using (true);
create policy "Gérer ses photos"        on artist_photos for all using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- ─────────────────────────────────────────────────────
-- 9. STORAGE — bucket portfolio (photos artistes)
-- ─────────────────────────────────────────────────────
-- À créer dans Supabase Dashboard > Storage > New bucket : "portfolio" (public)
-- Puis ajouter cette policy :
-- insert into storage.policies (name, bucket_id, operation, definition) values
-- ('Upload portfolio', 'portfolio', 'INSERT', 'auth.role() = ''authenticated''');

-- ─────────────────────────────────────────────────────
-- 10. DONNÉES DE TEST (optionnel)
-- ─────────────────────────────────────────────────────
-- Décommentez pour insérer des données de démo APRÈS avoir créé un compte artiste

/*
-- Ajouter une artiste de démo (remplacer l'UUID par celui d'un vrai user)
-- insert into artists (user_id, bio, is_active, is_verified, rating_avg, review_count, price_from, specialties)
-- values ('UUID-ARTISTE', 'Maquilleuse professionnelle depuis 10 ans...', true, true, 4.8, 24, 80, ARRAY['Mariage','Soirée','Éditorial / Shooting']);
*/

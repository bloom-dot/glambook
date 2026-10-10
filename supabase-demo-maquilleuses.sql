-- ════════════════════════════════════════════════════════════════════
--  GlamBook — Maquilleuses de démonstration (9 octobre 2026)
--
--  Six fiches marquées « (démo) » pour tester le parcours cliente :
--  recherche par occasion, ville et distance, fiche, demande de devis,
--  réservation d'un créneau en ligne (Léa et Sofia ont des tarifs et des créneaux).
--
--  Ce ne sont pas des comptes utilisables : pas de mot de passe, adresses en
--  @demo.glambook.invalid (domaine qui ne peut recevoir aucun e-mail).
--  Les demandes qu'on leur envoie restent donc sans réponse.
--
--  POUR TOUT SUPPRIMER (fiches, photos, tarifs, créneaux, demandes reçues) :
--    delete from bookings where artist_id in (select a.id from artists a join auth.users u on u.id = a.user_id where u.email like '%@demo.glambook.invalid');
--    delete from auth.users where email like '%@demo.glambook.invalid';
-- ════════════════════════════════════════════════════════════════════

-- 1. Comptes techniques (le déclencheur crée le profil avec le nom, la ville et le rôle)
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', v.name, 'role', 'artist', 'city', v.city, 'region', v.region),
       now(), now()
from (values
  ('de000000-0000-4000-8000-000000000001', 'lea.demo@demo.glambook.invalid',    'Léa Moreau',    'Annecy',           'Auvergne-Rhône-Alpes'),
  ('de000000-0000-4000-8000-000000000002', 'ines.demo@demo.glambook.invalid',   'Inès Kaci',     'Ferney-Voltaire',  'Auvergne-Rhône-Alpes'),
  ('de000000-0000-4000-8000-000000000003', 'camille.demo@demo.glambook.invalid','Camille Rey',   'Lyon',             'Auvergne-Rhône-Alpes'),
  ('de000000-0000-4000-8000-000000000004', 'sofia.demo@demo.glambook.invalid',  'Sofia Benali',  'Annemasse',        'Auvergne-Rhône-Alpes'),
  ('de000000-0000-4000-8000-000000000005', 'maelle.demo@demo.glambook.invalid', 'Maëlle Dupuis', 'Thonon-les-Bains', 'Auvergne-Rhône-Alpes'),
  ('de000000-0000-4000-8000-000000000006', 'nora.demo@demo.glambook.invalid',   'Nora Diallo',   'Gex',              'Auvergne-Rhône-Alpes')
) as v(id, email, name, city, region)
on conflict (id) do nothing;

-- Coordonnées pour la recherche « autour de moi » / par distance
update public.profiles p set lat = v.lat, lng = v.lng
from (values
  ('de000000-0000-4000-8000-000000000001'::uuid, 45.8992, 6.1294),
  ('de000000-0000-4000-8000-000000000002'::uuid, 46.2558, 6.1083),
  ('de000000-0000-4000-8000-000000000003'::uuid, 45.7640, 4.8357),
  ('de000000-0000-4000-8000-000000000004'::uuid, 46.1934, 6.2342),
  ('de000000-0000-4000-8000-000000000005'::uuid, 46.3705, 6.4794),
  ('de000000-0000-4000-8000-000000000006'::uuid, 46.3333, 6.0578)
) as v(uid, lat, lng)
where p.user_id = v.uid;

-- 2. Fiches maquilleuses, en ligne
insert into public.artists (id, user_id, display_name, slug, bio, specialties, is_active, instagram, created_at)
values
  ('da000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'Léa Moreau (démo)', 'demo-lea-moreau-annecy',
   'Profil de démonstration pour tester GlamBook. Maquilleuse mariage et shooting depuis huit ans : teint lumineux, tenue longue durée, essai à domicile.',
   array['mariage','editorial','quotidien'], true, 'https://instagram.com/glambook', now() - interval '20 days'),
  ('da000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000002', 'Inès Kaci (démo)', 'demo-ines-kaci-ferney-voltaire',
   'Profil de démonstration pour tester GlamBook. Soirées, galas et scène : smoky, paillettes et maquillages qui tiennent sous les projecteurs.',
   array['soiree','scene'], true, null, now() - interval '15 days'),
  ('da000000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000003', 'Camille Rey (démo)', 'demo-camille-rey-lyon',
   'Profil de démonstration pour tester GlamBook. Mariées et témoins, style naturel et lumineux. Je me déplace dans toute la région lyonnaise.',
   array['mariage','quotidien'], true, null, now() - interval '12 days'),
  ('da000000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000004', 'Sofia Benali (démo)', 'demo-sofia-benali-annemasse',
   'Profil de démonstration pour tester GlamBook. Shooting, mode et soirées. Réservation de créneau en ligne possible.',
   array['editorial','soiree'], true, null, now() - interval '9 days'),
  ('da000000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000005', 'Maëlle Dupuis (démo)', 'demo-maelle-dupuis-thonon',
   'Profil de démonstration pour tester GlamBook. Maquillage et coiffure de mariée, sur devis selon le nombre de personnes.',
   array['mariage','coiffure'], true, null, now() - interval '6 days'),
  ('da000000-0000-4000-8000-000000000006', 'de000000-0000-4000-8000-000000000006', 'Nora Diallo (démo)', 'demo-nora-diallo-gex',
   'Profil de démonstration pour tester GlamBook. Scène, artistique et airbrush pour spectacles et tournages.',
   array['scene','editorial','airbrush'], true, null, now() - interval '3 days')
on conflict (id) do nothing;

-- 3. Photos (les images du site)
insert into public.artist_photos (artist_id, url, created_at)
select v.aid::uuid, 'https://glambook-pi.vercel.app/img/' || v.f, now() - (v.o || ' minutes')::interval
from (values
  ('da000000-0000-4000-8000-000000000001','cat-mariage.jpg',5), ('da000000-0000-4000-8000-000000000001','cat-quotidien.jpg',4), ('da000000-0000-4000-8000-000000000001','cat-shooting.jpg',3), ('da000000-0000-4000-8000-000000000001','portrait.jpg',2),
  ('da000000-0000-4000-8000-000000000002','cat-soiree.jpg',5), ('da000000-0000-4000-8000-000000000002','cat-scene.jpg',4), ('da000000-0000-4000-8000-000000000002','cat-toutes.jpg',3),
  ('da000000-0000-4000-8000-000000000003','portrait.jpg',5), ('da000000-0000-4000-8000-000000000003','cat-mariage.jpg',4), ('da000000-0000-4000-8000-000000000003','cat-quotidien.jpg',3),
  ('da000000-0000-4000-8000-000000000004','cat-shooting.jpg',5), ('da000000-0000-4000-8000-000000000004','cat-soiree.jpg',4), ('da000000-0000-4000-8000-000000000004','hero.jpg',3),
  ('da000000-0000-4000-8000-000000000005','bandeau-pro.jpg',5), ('da000000-0000-4000-8000-000000000005','cat-mariage.jpg',4), ('da000000-0000-4000-8000-000000000005','portrait.jpg',3),
  ('da000000-0000-4000-8000-000000000006','cat-scene.jpg',5), ('da000000-0000-4000-8000-000000000006','cat-shooting.jpg',4), ('da000000-0000-4000-8000-000000000006','cat-toutes.jpg',3)
) as v(aid, f, o);

-- 4. Tarifs (Léa, Camille, Sofia, Nora) ; Inès et Maëlle restent « Sur devis »
insert into public.services (artist_id, name, description, price_cents, duration_min, category) values
  ('da000000-0000-4000-8000-000000000001', 'Mariée + essai', 'Essai à domicile un mois avant, retouches le jour J', 18000, 120, 'mariage'),
  ('da000000-0000-4000-8000-000000000001', 'Invitée', 'Maquillage complet, tenue longue durée', 9000, 60, 'mariage'),
  ('da000000-0000-4000-8000-000000000001', 'Shooting', 'Maquillage photo, une retouche pendant la séance', 12000, 90, 'editorial'),
  ('da000000-0000-4000-8000-000000000003', 'Mariée', 'Sans essai, déplacement inclus dans Lyon', 22000, 120, 'mariage'),
  ('da000000-0000-4000-8000-000000000003', 'Témoin ou maman', null, 8000, 60, 'mariage'),
  ('da000000-0000-4000-8000-000000000004', 'Maquillage soirée', 'Smoky ou glow, faux-cils inclus', 6500, 60, 'soiree'),
  ('da000000-0000-4000-8000-000000000004', 'Shooting mode', 'Deux looks', 15000, 120, 'editorial'),
  ('da000000-0000-4000-8000-000000000006', 'Maquillage de scène', 'Pour un artiste, tenue sous projecteurs', 11000, 90, 'scene');
update public.artists a set price_from = s.m / 100.0
from (select artist_id, min(price_cents) m from public.services group by artist_id) s
where s.artist_id = a.id and a.id::text like 'da000000-%';

-- 5. Créneaux libres sur les 4 prochaines semaines (Léa : mardi-samedi ; Sofia : mercredi-samedi)
insert into public.availabilities (artist_id, date, time_slot, is_available, is_booked)
select a.aid::uuid, d::date, t, true, false
from (values ('da000000-0000-4000-8000-000000000001', array[2,3,4,5,6]), ('da000000-0000-4000-8000-000000000004', array[3,4,5,6])) as a(aid, days),
     generate_series(current_date + 1, current_date + 28, interval '1 day') as d,
     unnest(array['09:00','11:00','14:00','16:00']) as t
where extract(isodow from d)::int = any(a.days)
on conflict (artist_id, date, time_slot) do nothing;

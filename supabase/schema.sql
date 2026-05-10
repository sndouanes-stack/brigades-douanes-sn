-- ============================================================
-- Brigades Douanes SN — Supabase Schema
-- Exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- ── 1. Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── 2. Table users (profils) ─────────────────────────────────
-- Miroir de auth.users avec les champs métier
create table if not exists public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null,
  nom                   text not null default '',
  prenom                text not null default '',
  role                  text not null check (role in ('AGENT','CHEF_BRIGADE','CHEF_SUBDIVISION','DIRECTEUR_REGIONAL','ADMIN')),
  brigade_id            text,
  subdivision_id        text,
  direction_regionale_id text,
  matricule             text,
  grade                 text,
  actif                 boolean not null default true,
  created_at            timestamptz not null default now()
);

-- Créer un profil automatiquement à la création d'un utilisateur Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce(new.raw_user_meta_data->>'role', 'AGENT')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 3. Directions Régionales ─────────────────────────────────
create table if not exists public.directions_regionales (
  id   text primary key,
  nom  text not null
);

-- ── 4. Subdivisions ──────────────────────────────────────────
create table if not exists public.subdivisions (
  id                    text primary key,
  nom                   text not null,
  direction_regionale_id text references public.directions_regionales(id)
);

-- ── 5. Brigades ──────────────────────────────────────────────
create table if not exists public.brigades (
  id                    text primary key,
  nom                   text not null,
  subdivision_id        text references public.subdivisions(id),
  direction_regionale_id text references public.directions_regionales(id),
  localite              text,
  chef_brigade          text
);

-- ── 6. Agents ────────────────────────────────────────────────
create table if not exists public.agents (
  id          uuid primary key default uuid_generate_v4(),
  matricule   text not null unique,
  nom         text not null,
  prenom      text not null,
  grade       text not null default '',
  brigade_id  text references public.brigades(id),
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── 7. Montages (présence / statuts journaliers) ──────────────
create table if not exists public.montages (
  id          uuid primary key default uuid_generate_v4(),
  date        text not null,           -- 'YYYY-MM-DD'
  brigade_id  text references public.brigades(id),
  statuts     jsonb not null default '{}'::jsonb,
  resume      jsonb not null default '{}'::jsonb,
  saisi_par   text not null default '',
  statut      text not null default 'Brouillon',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists montages_date_idx       on public.montages(date);
create index if not exists montages_brigade_id_idx on public.montages(brigade_id);

-- ── 8. Transactions (caisse) ──────────────────────────────────
create table if not exists public.transactions (
  id          uuid primary key default uuid_generate_v4(),
  date        text not null,           -- 'YYYY-MM-DD'
  type        text not null,           -- 'recette' | 'depense'
  montant     numeric(15,2) not null,
  libelle     text not null default '',
  brigade_id  text references public.brigades(id),
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists transactions_date_idx on public.transactions(date);

-- ── 9. Correspondances ────────────────────────────────────────
create table if not exists public.correspondances (
  id          uuid primary key default uuid_generate_v4(),
  date        text not null,
  objet       text not null,
  expediteur  text not null default '',
  destinataire text not null default '',
  type        text not null default 'arrivee',  -- 'arrivee' | 'depart'
  statut      text not null default 'en-cours',
  brigade_id  text references public.brigades(id),
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists correspondances_date_idx on public.correspondances(date);

-- ── 10. Main Courante ─────────────────────────────────────────
create table if not exists public.main_courante (
  id          uuid primary key default uuid_generate_v4(),
  date        text not null,
  heure       text not null default '',
  fait        text not null,
  lieu        text not null default '',
  suite       text not null default '',
  brigade_id  text references public.brigades(id),
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists main_courante_date_idx on public.main_courante(date);

-- ── 11. Saisies ───────────────────────────────────────────────
create table if not exists public.saisies (
  id              uuid primary key default uuid_generate_v4(),
  numero          integer not null,
  date            text not null,
  contrevenant    text not null default '',
  nature_infraction text not null default '',
  valeur_marchandises numeric(15,2) not null default 0,
  penalite        numeric(15,2) not null default 0,
  statut          text not null default 'en-cours',
  numero_pv       text,
  brigade_id      text references public.brigades(id),
  created_by      text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists saisies_date_idx      on public.saisies(date);
create index if not exists saisies_brigade_idx   on public.saisies(brigade_id);

-- ── 12. Règlements Transactionnels ────────────────────────────
create table if not exists public.reglements_transactionnels (
  id              uuid primary key default uuid_generate_v4(),
  saisie_id       uuid references public.saisies(id) on delete cascade,
  saisie_numero   integer,
  montant_lettres text not null default '',
  reference_ac    text not null default '',
  montant         numeric(15,2),
  created_at      timestamptz not null default now()
);

-- ── 13. PV Saisies ────────────────────────────────────────────
create table if not exists public.pv_saisies (
  id              uuid primary key default uuid_generate_v4(),
  saisie_id       uuid references public.saisies(id) on delete cascade,
  saisie_numero   integer,
  contenu         text not null default '',
  created_at      timestamptz not null default now()
);

-- ── 14. Quittances ────────────────────────────────────────────
create table if not exists public.quittances (
  id              uuid primary key default uuid_generate_v4(),
  numero          text not null,
  date            text not null,
  contribuable    text not null default '',
  montant         numeric(15,2) not null default 0,
  motif           text not null default '',
  brigade_id      text references public.brigades(id),
  created_by      text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists quittances_date_idx on public.quittances(date);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

alter table public.users                   enable row level security;
alter table public.directions_regionales   enable row level security;
alter table public.subdivisions            enable row level security;
alter table public.brigades                enable row level security;
alter table public.agents                  enable row level security;
alter table public.montages                enable row level security;
alter table public.transactions            enable row level security;
alter table public.correspondances         enable row level security;
alter table public.main_courante           enable row level security;
alter table public.saisies                 enable row level security;
alter table public.reglements_transactionnels enable row level security;
alter table public.pv_saisies              enable row level security;
alter table public.quittances              enable row level security;

-- Lecture structure (tout utilisateur connecté)
create policy "Lecture directions"  on public.directions_regionales for select to authenticated using (true);
create policy "Lecture subdivisions" on public.subdivisions          for select to authenticated using (true);
create policy "Lecture brigades"    on public.brigades               for select to authenticated using (true);

-- Users : chacun voit son propre profil ; admin voit tout
create policy "Users: own profile"  on public.users for select to authenticated using (auth.uid() = id);
create policy "Users: admin all"    on public.users for all    to authenticated
  using ((select role from public.users where id = auth.uid()) = 'ADMIN')
  with check ((select role from public.users where id = auth.uid()) = 'ADMIN');
create policy "Users: update own"   on public.users for update to authenticated using (auth.uid() = id);

-- Agents : lecture tous connectés ; écriture admin/chef brigade
create policy "Agents: lecture"     on public.agents for select to authenticated using (true);
create policy "Agents: ecriture"    on public.agents for all    to authenticated
  using ((select role from public.users where id = auth.uid()) in ('ADMIN','CHEF_BRIGADE'))
  with check ((select role from public.users where id = auth.uid()) in ('ADMIN','CHEF_BRIGADE'));

-- Données opérationnelles : lecture/écriture aux utilisateurs connectés
-- (la logique fine est gérée côté application)
create policy "Montages: authenticated" on public.montages for all to authenticated using (true) with check (true);
create policy "Transactions: auth"      on public.transactions for all to authenticated using (true) with check (true);
create policy "Correspondances: auth"   on public.correspondances for all to authenticated using (true) with check (true);
create policy "MainCourante: auth"      on public.main_courante for all to authenticated using (true) with check (true);
create policy "Saisies: auth"           on public.saisies for all to authenticated using (true) with check (true);
create policy "RT: auth"                on public.reglements_transactionnels for all to authenticated using (true) with check (true);
create policy "PV: auth"                on public.pv_saisies for all to authenticated using (true) with check (true);
create policy "Quittances: auth"        on public.quittances for all to authenticated using (true) with check (true);

-- ============================================================
-- SEED — Structure organisationnelle (8 DR / 16 Subdiv / 80 Brigades)
-- ============================================================

-- Directions Régionales
insert into public.directions_regionales (id, nom) values
  ('dakar-port',       'Direction Régionale de Dakar Port'),
  ('ouest',            'Direction Régionale de l''Ouest'),
  ('hydrocarbures',    'Direction Régionale des Hydrocarbures'),
  ('unites-maritimes', 'Direction Régionale des Unités Maritimes'),
  ('centre',           'Direction Régionale du Centre'),
  ('sud',              'Direction Régionale du Sud'),
  ('sud-est',          'Direction Régionale du Sud-Est'),
  ('nord',             'Direction Régionale du Nord')
on conflict (id) do update set nom = excluded.nom;

-- Subdivisions
insert into public.subdivisions (id, nom, direction_regionale_id) values
  ('sub-dakar-port',       'Subdivision Dakar-Port',              'dakar-port'),
  ('sub-dakar-ports-secs', 'Subdivision Dakar Ports-Secs',        'dakar-port'),
  ('sub-aibd',             'Subdivision AIBD',                    'ouest'),
  ('sub-dakar-exterieur',  'Subdivision Dakar Extérieur',         'ouest'),
  ('sub-hydrocarbures',    'Subdivision des Hydrocarbures',       'hydrocarbures'),
  ('sub-littoral-nord',    'Subdivision Littoral Nord',           'unites-maritimes'),
  ('sub-littoral-sud',     'Subdivision Littoral Sud',            'unites-maritimes'),
  ('sub-portuaire',        'Subdivision Portuaire',               'unites-maritimes'),
  ('sub-kaolack',          'Subdivision de Kaolack',              'centre'),
  ('sub-diourbel',         'Subdivision Diourbel',                'centre'),
  ('sub-ziguinchor',       'Subdivision de Ziguinchor',           'sud'),
  ('sub-kolda',            'Subdivision de Kolda',                'sud'),
  ('sub-tambacounda',      'Subdivision Tambacounda',             'sud-est'),
  ('sub-kedougou',         'Subdivision de Kédougou',             'sud-est'),
  ('sub-saint-louis',      'Subdivision de Saint-Louis',          'nord'),
  ('sub-matam',            'Subdivision de Matam',                'nord')
on conflict (id) do update set nom = excluded.nom, direction_regionale_id = excluded.direction_regionale_id;

-- Brigades (80)
insert into public.brigades (id, nom, subdivision_id, direction_regionale_id) values
  -- Dakar-Port
  ('b-mole1-belair',       'Brigade commerciale Môle 1 et Bel Air',                  'sub-dakar-port',       'dakar-port'),
  ('b-produits-pondereux', 'Brigade des Produits pondéreux',                          'sub-dakar-port',       'dakar-port'),
  ('b-scanning',           'Unité de scanning des Conteneurs',                        'sub-dakar-port',       'dakar-port'),
  ('b-magasins-portuaire', 'Magasins et Aires de dédouanement (enceinte portuaire)',  'sub-dakar-port',       'dakar-port'),
  -- Dakar Ports-Secs
  ('b-diamniadio-com',     'Brigade commerciale de Diamniadio',                       'sub-dakar-ports-secs', 'dakar-port'),
  ('b-icd',                'Brigade commerciale ICD',                                 'sub-dakar-ports-secs', 'dakar-port'),
  ('b-plateforme-dist',    'Brigade commerciale de la Plateforme de Distribution',    'sub-dakar-ports-secs', 'dakar-port'),
  ('b-magasins-ext',       'Magasins et aires de dédouanement (extérieur enceinte)',  'sub-dakar-ports-secs', 'dakar-port'),
  -- AIBD
  ('b-aibd-speciale',      'Brigade spéciale AIBD',                                   'sub-aibd',             'ouest'),
  ('b-aibd-commerciale',   'Brigade Commerciale AIBD',                                'sub-aibd',             'ouest'),
  ('b-tourisme',           'Brigade de tourisme',                                     'sub-aibd',             'ouest'),
  -- Dakar Extérieur
  ('b-dakar-ext-speciale', 'Brigade spéciale Dakar Extérieur',                        'sub-dakar-exterieur',  'ouest'),
  ('b-dakar-n1',           'Brigade n°1',                                             'sub-dakar-exterieur',  'ouest'),
  ('b-dakar-n2',           'Brigade n°2',                                             'sub-dakar-exterieur',  'ouest'),
  ('b-dakar-n3',           'Brigade n°3',                                             'sub-dakar-exterieur',  'ouest'),
  ('b-banlieue',           'Brigade Banlieue (Pikine, Thiaroye, Diamniadio)',         'sub-dakar-exterieur',  'ouest'),
  -- Hydrocarbures
  ('b-dakar-hydro',        'Brigade de Dakar Hydrocarbures',                          'sub-hydrocarbures',    'hydrocarbures'),
  ('b-stlouis-hydro',      'Brigade de Saint-Louis Hydrocarbures',                    'sub-hydrocarbures',    'hydrocarbures'),
  ('b-sangomar-hydro',     'Brigade de Sangomar Hydrocarbures',                       'sub-hydrocarbures',    'hydrocarbures'),
  -- Littoral Nord
  ('b-lompoul',            'Brigade de Lompoul',                                      'sub-littoral-nord',    'unites-maritimes'),
  ('b-kayar',              'Brigade de Kayar',                                        'sub-littoral-nord',    'unites-maritimes'),
  ('b-rufisque',           'Brigade de Rufisque',                                     'sub-littoral-nord',    'unites-maritimes'),
  ('b-fluviale-stlouis',   'Brigade fluviale de Saint-Louis',                         'sub-littoral-nord',    'unites-maritimes'),
  -- Littoral Sud
  ('b-mbour',              'Brigade de Mbour',                                        'sub-littoral-sud',     'unites-maritimes'),
  ('b-djiferre',           'Brigade de Djiferre',                                     'sub-littoral-sud',     'unites-maritimes'),
  ('b-fimela',             'Brigade de Fimela',                                       'sub-littoral-sud',     'unites-maritimes'),
  ('b-capskiring',         'Brigade de Capskiring',                                   'sub-littoral-sud',     'unites-maritimes'),
  -- Portuaire
  ('b-surveillance-port',  'Brigade de surveillance portuaire',                       'sub-portuaire',        'unites-maritimes'),
  ('b-haute-mer',          'Brigade haute mer',                                       'sub-portuaire',        'unites-maritimes'),
  -- Kaolack
  ('b-karang',             'Brigade commerciale de Karang',                           'sub-kaolack',          'centre'),
  ('b-keur-ayib',          'Brigade commerciale de Keur-Ayib',                        'sub-kaolack',          'centre'),
  ('b-kaolack-n1',         'Brigade n°1 de Kaolack',                                 'sub-kaolack',          'centre'),
  ('b-kaolack-n2',         'Brigade n°2 de Kaolack',                                 'sub-kaolack',          'centre'),
  ('b-pont-ssbm',          'Brigade du Pont Serigne Bassirou Mbacké',                'sub-kaolack',          'centre'),
  ('b-nioro',              'Brigade de Nioro',                                        'sub-kaolack',          'centre'),
  ('b-fatick',             'Brigade de Fatick',                                       'sub-kaolack',          'centre'),
  ('b-foundiougne',        'Brigade de Foundiougne',                                  'sub-kaolack',          'centre'),
  ('b-keur-moussa',        'Poste de Keur Moussa',                                    'sub-kaolack',          'centre'),
  ('b-saboya',             'Poste de Saboya',                                         'sub-kaolack',          'centre'),
  -- Diourbel
  ('b-gossas',             'Brigade de Gossas',                                       'sub-diourbel',         'centre'),
  ('b-diourbel',           'Brigade de Diourbel',                                     'sub-diourbel',         'centre'),
  ('b-kaffrine',           'Brigade de Kaffrine',                                     'sub-diourbel',         'centre'),
  ('b-koungheul',          'Brigade de Koungheul',                                    'sub-diourbel',         'centre'),
  ('b-nganda',             'Poste de Nganda',                                         'sub-diourbel',         'centre'),
  ('b-maka-gouye',         'Poste de Maka-Gouye',                                     'sub-diourbel',         'centre'),
  -- Ziguinchor
  ('b-ziguinchor',         'Brigade de Ziguinchor',                                   'sub-ziguinchor',       'sud'),
  ('b-bignona',            'Brigade de Bignona',                                      'sub-ziguinchor',       'sud'),
  ('b-oussouye',           'Brigade de Oussouye',                                     'sub-ziguinchor',       'sud'),
  ('b-selety',             'Poste de Séléty',                                         'sub-ziguinchor',       'sud'),
  ('b-senoba',             'Poste de Sénoba',                                         'sub-ziguinchor',       'sud'),
  ('b-pata',               'Poste de Pata',                                           'sub-ziguinchor',       'sud'),
  -- Kolda
  ('b-kolda',              'Brigade de Kolda',                                        'sub-kolda',            'sud'),
  ('b-sedhiou',            'Brigade de Sedhiou',                                      'sub-kolda',            'sud'),
  ('b-velingara',          'Brigade de Vélingara',                                    'sub-kolda',            'sud'),
  ('b-medina-yf',          'Poste de Médina Yoro Foulla',                             'sub-kolda',            'sud'),
  ('b-salikenie',          'Poste de Salikénié',                                      'sub-kolda',            'sud'),
  ('b-nianaw',             'Poste de Nianaw',                                         'sub-kolda',            'sud'),
  ('b-manda',              'Poste de Manda',                                          'sub-kolda',            'sud'),
  -- Tambacounda
  ('b-kidira',             'Brigade commerciale de Kidira',                           'sub-tambacounda',      'sud-est'),
  ('b-bakel',              'Brigade de Bakel',                                        'sub-tambacounda',      'sud-est'),
  ('b-tambacounda',        'Brigade de Tambacounda',                                  'sub-tambacounda',      'sud-est'),
  ('b-gouloumbou',         'Brigade mobile de Gouloumbou',                            'sub-tambacounda',      'sud-est'),
  ('b-koumpentoum',        'Brigade mobile de Koumpentoum',                           'sub-tambacounda',      'sud-est'),
  ('b-guenoto',            'Poste de Guénoto',                                        'sub-tambacounda',      'sud-est'),
  -- Kédougou
  ('b-kedougou',           'Brigade mobile de Kédougou',                              'sub-kedougou',         'sud-est'),
  ('b-moussala',           'Brigade commerciale de Moussala',                         'sub-kedougou',         'sud-est'),
  ('b-saraya',             'Brigade mobile de Saraya',                                'sub-kedougou',         'sud-est'),
  ('b-salemata',           'Brigade mobile de Salémata',                              'sub-kedougou',         'sud-est'),
  -- Saint-Louis
  ('b-rosso',              'Brigade commerciale de Rosso',                            'sub-saint-louis',      'nord'),
  ('b-saint-louis',        'Brigade de Saint-Louis',                                  'sub-saint-louis',      'nord'),
  ('b-louga',              'Brigade de Louga',                                        'sub-saint-louis',      'nord'),
  ('b-linguere',           'Brigade de Linguère',                                     'sub-saint-louis',      'nord'),
  ('b-ndioum',             'Brigade de Ndioum',                                       'sub-saint-louis',      'nord'),
  ('b-podor',              'Brigade de Podor',                                        'sub-saint-louis',      'nord'),
  ('b-diama',              'Poste de Diama',                                          'sub-saint-louis',      'nord'),
  ('b-demet',              'Poste de Démet',                                          'sub-saint-louis',      'nord'),
  -- Matam
  ('b-matam',              'Brigade de Matam',                                        'sub-matam',            'nord'),
  ('b-semme',              'Brigade de Semmé',                                        'sub-matam',            'nord'),
  ('b-ranerou',            'Brigade de Ranérou',                                      'sub-matam',            'nord'),
  ('b-gourel-omar-ly',     'Poste de Gourel Oumar Ly',                                'sub-matam',            'nord')
on conflict (id) do update set
  nom = excluded.nom,
  subdivision_id = excluded.subdivision_id,
  direction_regionale_id = excluded.direction_regionale_id;

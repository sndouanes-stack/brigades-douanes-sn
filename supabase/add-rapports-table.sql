-- ============================================================
-- Ajout de la table rapports (rapports d'activité des agents)
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

create table if not exists public.rapports (
  id         uuid        default gen_random_uuid() primary key,
  brigade_id uuid        references public.brigades(id) on delete set null,
  date       date        not null default current_date,
  titre      text        not null,
  contenu    text,
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists rapports_brigade_id_idx on public.rapports(brigade_id);
create index if not exists rapports_date_idx        on public.rapports(date);

alter table public.rapports enable row level security;

-- Tous les utilisateurs connectés peuvent lire les rapports
create policy "Rapports: select" on public.rapports
  for select to authenticated using (true);

-- Chaque agent peut créer/modifier/supprimer ses propres rapports
create policy "Rapports: own write" on public.rapports
  for all to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

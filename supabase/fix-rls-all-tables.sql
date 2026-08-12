-- ============================================================
-- SQL Migration : Autoriser l'accès RLS aux tables de gestion
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

-- ── 1. Table transactions (Caisse) ───────────────────────────
alter table public.transactions enable row level security;
drop policy if exists "Transactions: authenticated all" on public.transactions;
create policy "Transactions: authenticated all" on public.transactions
  for all to authenticated
  using (true)
  with check (true);

-- ── 2. Table saisies ─────────────────────────────────────────
alter table public.saisies enable row level security;
drop policy if exists "Saisies: authenticated all" on public.saisies;
create policy "Saisies: authenticated all" on public.saisies
  for all to authenticated
  using (true)
  with check (true);

-- ── 3. Table correspondances ──────────────────────────────────
alter table public.correspondances enable row level security;
drop policy if exists "Correspondances: authenticated all" on public.correspondances;
create policy "Correspondances: authenticated all" on public.correspondances
  for all to authenticated
  using (true)
  with check (true);

-- ── 4. Table main_courante ────────────────────────────────────
alter table public.main_courante enable row level security;
drop policy if exists "Main courante: authenticated all" on public.main_courante;
create policy "Main courante: authenticated all" on public.main_courante
  for all to authenticated
  using (true)
  with check (true);

-- ── 5. Table rapports ─────────────────────────────────────────
alter table public.rapports enable row level security;
drop policy if exists "Rapports: authenticated all" on public.rapports;
create policy "Rapports: authenticated all" on public.rapports
  for all to authenticated
  using (true)
  with check (true);

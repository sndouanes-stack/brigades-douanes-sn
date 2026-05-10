-- ============================================================
-- Correction RLS — éviter la récursion infinie sur users + agents
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

-- ── Étape 1 : Fonction SECURITY DEFINER (lit le rôle sans déclencher RLS) ──
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- ── Étape 2 : Correction RLS table users ─────────────────────────────────────
drop policy if exists "Users: own profile"        on public.users;
drop policy if exists "Users: admin all"          on public.users;
drop policy if exists "Users: update own"         on public.users;
drop policy if exists "users_select_own"          on public.users;
drop policy if exists "users_admin_all"           on public.users;
drop policy if exists "users_admin_select_all"    on public.users;
drop policy if exists "users_admin_write_all"     on public.users;
drop policy if exists "users_update_own"          on public.users;

-- Chaque utilisateur lit son propre profil (sans récursion)
create policy "users_select_own" on public.users
  for select to authenticated
  using (auth.uid() = id);

-- Admin lit tous les profils (via SECURITY DEFINER, pas de récursion)
create policy "users_admin_select_all" on public.users
  for select to authenticated
  using (public.get_my_role() = 'ADMIN');

-- Admin peut modifier tous les profils
create policy "users_admin_write_all" on public.users
  for all to authenticated
  using (public.get_my_role() = 'ADMIN')
  with check (public.get_my_role() = 'ADMIN');

-- Chaque utilisateur peut mettre à jour son propre profil
create policy "users_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── Étape 3 : Correction RLS table agents ────────────────────────────────────
drop policy if exists "Agents: lecture"   on public.agents;
drop policy if exists "Agents: ecriture"  on public.agents;

-- Tous les utilisateurs connectés peuvent lire les agents
create policy "agents_select_all" on public.agents
  for select to authenticated
  using (true);

-- Seuls CHEF_BRIGADE et ADMIN peuvent modifier (via SECURITY DEFINER)
create policy "agents_write" on public.agents
  for all to authenticated
  using (public.get_my_role() in ('ADMIN', 'CHEF_BRIGADE'))
  with check (public.get_my_role() in ('ADMIN', 'CHEF_BRIGADE'));

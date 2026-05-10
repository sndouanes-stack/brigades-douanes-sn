-- ============================================================
-- Correction RLS table users — éviter la récursion infinie
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

-- Étape 1 : Fonction SECURITY DEFINER (lit le rôle sans déclencher RLS)
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- Étape 2 : Supprimer les anciennes policies conflictuelles
drop policy if exists "Users: own profile"  on public.users;
drop policy if exists "Users: admin all"    on public.users;
drop policy if exists "Users: update own"   on public.users;

-- Étape 3 : Recréer sans récursion
-- Chaque utilisateur lit son propre profil
create policy "users_select_own" on public.users
  for select to authenticated
  using (auth.uid() = id);

-- Admin accède à toutes les lignes (via fonction SECURITY DEFINER)
create policy "users_admin_select_all" on public.users
  for select to authenticated
  using (public.get_my_role() = 'ADMIN');

create policy "users_admin_write_all" on public.users
  for all to authenticated
  using (public.get_my_role() = 'ADMIN')
  with check (public.get_my_role() = 'ADMIN');

-- Chaque utilisateur peut modifier son propre profil (nom, prenom)
create policy "users_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

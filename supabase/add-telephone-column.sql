-- ============================================================
-- Migration : Ajouter le champ téléphone aux profils utilisateurs
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telephone text DEFAULT '';
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS telephone text DEFAULT '';

-- Index pour recherche rapide par téléphone
CREATE INDEX IF NOT EXISTS users_telephone_idx ON public.users(telephone);
CREATE INDEX IF NOT EXISTS agents_telephone_idx ON public.agents(telephone);

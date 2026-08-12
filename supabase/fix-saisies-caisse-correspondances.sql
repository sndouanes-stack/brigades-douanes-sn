-- ============================================================
-- Migration : corriger les tables saisies, transactions, correspondances
-- Exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- ── Saisies : numero text (était integer) ─────────────────────
ALTER TABLE public.saisies ALTER COLUMN numero TYPE text USING numero::text;

-- ── Saisies : colonnes opérationnelles manquantes ─────────────
ALTER TABLE public.saisies ADD COLUMN IF NOT EXISTS heure        text not null default '';
ALTER TABLE public.saisies ADD COLUMN IF NOT EXISTS description  text not null default '';
ALTER TABLE public.saisies ADD COLUMN IF NOT EXISTS quantite     text not null default '';
ALTER TABLE public.saisies ADD COLUMN IF NOT EXISTS unite        text not null default 'kg';
ALTER TABLE public.saisies ADD COLUMN IF NOT EXISTS lieu         text not null default '';
ALTER TABLE public.saisies ADD COLUMN IF NOT EXISTS agent        text not null default '';
ALTER TABLE public.saisies ADD COLUMN IF NOT EXISTS observations text not null default '';

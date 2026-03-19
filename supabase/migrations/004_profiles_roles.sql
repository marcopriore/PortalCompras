-- Suporte a múltiplos roles por usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';

-- Backfill: usuários existentes recebem array com o role atual
UPDATE public.profiles
SET roles = ARRAY[role]::text[]
WHERE roles IS NULL OR roles = '{}';

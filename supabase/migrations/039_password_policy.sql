-- Migration 039: política de senhas por tenant + histórico

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

UPDATE public.profiles
SET password_changed_at = created_at
WHERE password_changed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.user_password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_password_history_user_created
  ON public.user_password_history(user_id, created_at DESC);

ALTER TABLE public.user_password_history ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated: leitura/escrita apenas via service role nas APIs.

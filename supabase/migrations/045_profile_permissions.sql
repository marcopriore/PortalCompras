-- Permissões individuais por usuário (ex.: user.impersonate — "Agir como")
-- Não vinculadas a role_permissions para evitar liberar em massa por perfil Comprador.

CREATE TABLE IF NOT EXISTS public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_profile_permissions_user
  ON public.profile_permissions (company_id, user_id)
  WHERE enabled = true;

ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- Leitura: usuários do mesmo tenant
CREATE POLICY "profile_permissions: read same tenant"
ON public.profile_permissions
FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Escrita: admin do tenant
CREATE POLICY "profile_permissions: admin write"
ON public.profile_permissions
FOR ALL
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'admin'
        OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
      )
  )
)
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'admin'
        OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
      )
  )
);

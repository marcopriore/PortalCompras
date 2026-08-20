-- Convites e usuários do portal fornecedor (multi-login por supplier_id)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_supplier_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_cnpj text;

CREATE INDEX IF NOT EXISTS idx_profiles_login_cnpj
  ON public.profiles (login_cnpj)
  WHERE is_supplier_admin = true AND login_cnpj IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supplier_portal
  ON public.profiles (company_id, supplier_id)
  WHERE profile_type = 'supplier' AND supplier_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.supplier_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_invites_token_pending
  ON public.supplier_invites (token)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_supplier_invites_supplier
  ON public.supplier_invites (company_id, supplier_id, status);

ALTER TABLE public.supplier_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers manage supplier invites in tenant"
ON public.supplier_invites
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = supplier_invites.company_id
      AND p.profile_type = 'buyer'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = supplier_invites.company_id
      AND p.profile_type = 'buyer'
  )
);

COMMENT ON TABLE public.supplier_invites IS
  'Convites enviados pelo comprador para cadastro no portal do fornecedor.';
COMMENT ON COLUMN public.profiles.is_supplier_admin IS
  'Admin do fornecedor: login principal via CNPJ (login_cnpj).';
COMMENT ON COLUMN public.profiles.login_cnpj IS
  'CNPJ normalizado (14 dígitos) usado como identificador de login do admin.';

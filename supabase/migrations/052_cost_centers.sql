-- ============================================================
-- 052 — Centros de custo (picklist por tenant) + vínculo no perfil
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_company_active
  ON public.cost_centers (company_id)
  WHERE active = true;

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_manage_cost_centers"
ON public.cost_centers FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Superadmin com cookie de tenant: leitura/escrita via service role nas APIs;
-- no client, superadmin usa o company_id do perfil ou RLS via mesmo tenant selecionado no app.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_cost_center
  ON public.profiles (cost_center_id)
  WHERE cost_center_id IS NOT NULL;

-- Seed a partir de códigos já usados em requisições
INSERT INTO public.cost_centers (company_id, code, description, active)
SELECT DISTINCT
  r.company_id,
  trim(r.cost_center),
  trim(r.cost_center),
  true
FROM public.requisitions r
WHERE r.cost_center IS NOT NULL
  AND trim(r.cost_center) <> ''
ON CONFLICT (company_id, code) DO NOTHING;

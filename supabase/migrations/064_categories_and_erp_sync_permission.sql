-- ============================================================
-- 064 — Categorias unificadas (itens + fornecedores) + permissão erp.sync
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_categories_company_active
  ON public.categories (company_id)
  WHERE active = true;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories: buyer tenant" ON public.categories;

CREATE POLICY "categories: buyer tenant"
ON public.categories FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = categories.company_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = categories.company_id
      )
  )
);

-- Seed a partir de commodity_group dos itens
INSERT INTO public.categories (company_id, code, name, active)
SELECT DISTINCT
  i.company_id,
  upper(left(regexp_replace(trim(i.commodity_group), '\s+', '_', 'g'), 40)),
  trim(i.commodity_group),
  true
FROM public.items i
WHERE i.commodity_group IS NOT NULL
  AND trim(i.commodity_group) <> ''
ON CONFLICT (company_id, code) DO NOTHING;

-- Seed a partir de supplier_categories (nome = category)
INSERT INTO public.categories (company_id, code, name, active)
SELECT DISTINCT
  sc.company_id,
  upper(left(regexp_replace(trim(sc.category), '\s+', '_', 'g'), 40)),
  trim(sc.category),
  true
FROM public.supplier_categories sc
WHERE sc.category IS NOT NULL
  AND trim(sc.category) <> ''
ON CONFLICT (company_id, code) DO NOTHING;

-- Permissão erp.sync: só grupo admin por padrão (ação sensível)
DO $$
DECLARE
  company uuid;
  g_id uuid;
BEGIN
  FOR company IN
    SELECT DISTINCT company_id FROM public.permission_groups
  LOOP
    SELECT id INTO g_id
    FROM public.permission_groups
    WHERE company_id = company AND code = 'admin';

    IF g_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.permission_group_rules (
      company_id, group_id, permission_key, enabled
    )
    VALUES (company, g_id, 'erp.sync', true)
    ON CONFLICT (group_id, permission_key) DO UPDATE
      SET enabled = true;
  END LOOP;
END $$;

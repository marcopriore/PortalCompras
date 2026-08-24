-- ============================================================
-- 054 — Catálogo de Compras (Fase 1): carrinho + campos REQ
-- ============================================================

INSERT INTO public.tenant_features (company_id, feature_key, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', 'purchase_catalog', true)
ON CONFLICT (company_id, feature_key) DO NOTHING;

-- Status buyer_review para revisão do comprador (Fase 2)
ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_status_check;
ALTER TABLE public.requisitions ADD CONSTRAINT requisitions_status_check
  CHECK (
    status IN (
      'draft',
      'buyer_review',
      'pending',
      'approved',
      'rejected',
      'in_quotation',
      'completed',
      'cancelled'
    )
  );

ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

ALTER TABLE public.requisition_items
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id),
  ADD COLUMN IF NOT EXISTS contract_item_id uuid REFERENCES public.contract_items(id),
  ADD COLUMN IF NOT EXISTS unit_price numeric;

CREATE TABLE IF NOT EXISTS public.catalog_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_carts_user
  ON public.catalog_carts (company_id, user_id);

CREATE TABLE IF NOT EXISTS public.catalog_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.catalog_carts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_item_id uuid NOT NULL REFERENCES public.contract_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  material_code text NOT NULL,
  material_description text NOT NULL,
  unit_of_measure text,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  contract_kind text NOT NULL CHECK (contract_kind IN ('por_valor', 'por_quantidade')),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, contract_item_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_cart_items_cart
  ON public.catalog_cart_items (cart_id);

ALTER TABLE public.catalog_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_cart_items ENABLE ROW LEVEL SECURITY;

-- Superadmin pode operar carrinho em qualquer tenant (seletor no header)
DROP POLICY IF EXISTS "catalog_carts: own user" ON public.catalog_carts;
CREATE POLICY "catalog_carts: own user"
ON public.catalog_carts FOR ALL
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_superadmin, false) = true
    )
    OR company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "catalog_cart_items: own cart" ON public.catalog_cart_items;
CREATE POLICY "catalog_cart_items: own cart"
ON public.catalog_cart_items FOR ALL
USING (
  cart_id IN (SELECT c.id FROM public.catalog_carts c WHERE c.user_id = auth.uid())
)
WITH CHECK (
  cart_id IN (SELECT c.id FROM public.catalog_carts c WHERE c.user_id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_superadmin, false) = true
    )
    OR company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- Origin 'catalog' para requisições do Catálogo de Compras
ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_origin_check;
ALTER TABLE public.requisitions ADD CONSTRAINT requisitions_origin_check
  CHECK (origin IS NULL OR origin IN ('manual', 'erp', 'catalog'));

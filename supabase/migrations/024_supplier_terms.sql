-- Termos de fornecimento por empresa + aceites por pedido
CREATE TABLE IF NOT EXISTS supplier_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Termos e Condições de Fornecimento',
  content TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  version_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_terms_company_active_idx
  ON supplier_terms(company_id)
  WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS supplier_term_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID NOT NULL REFERENCES supplier_terms(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  term_version TEXT NOT NULL,
  term_version_date DATE NOT NULL
);

ALTER TABLE supplier_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyers_read_own_terms"
  ON supplier_terms FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "suppliers_read_active_terms"
  ON supplier_terms FOR SELECT
  USING (active = TRUE);

CREATE POLICY "admin_manage_terms"
  ON supplier_terms FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND (is_superadmin = TRUE OR 'admin' = ANY(COALESCE(roles, ARRAY[]::text[])))
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND (is_superadmin = TRUE OR 'admin' = ANY(COALESCE(roles, ARRAY[]::text[])))
    )
  );

ALTER TABLE supplier_term_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_insert_acceptance"
  ON supplier_term_acceptances FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "supplier_read_own_acceptances"
  ON supplier_term_acceptances FOR SELECT
  USING (user_id = auth.uid());

-- Nota: service role ignora RLS; não criar policy USING (true) — exporia a tabela a qualquer JWT.

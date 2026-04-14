-- Migration 025: supplier_categories
-- Vínculo entre fornecedor e categorias que atende

CREATE TABLE supplier_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_categories_unique UNIQUE (supplier_id, category)
);

-- Índices
CREATE INDEX idx_supplier_categories_company   ON supplier_categories(company_id);
CREATE INDEX idx_supplier_categories_supplier  ON supplier_categories(supplier_id);
CREATE INDEX idx_supplier_categories_category  ON supplier_categories(category);

-- RLS
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_categories: leitura por tenant"
  ON supplier_categories FOR SELECT
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "supplier_categories: escrita por buyer"
  ON supplier_categories FOR INSERT
  WITH CHECK (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "supplier_categories: delete por buyer"
  ON supplier_categories FOR DELETE
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

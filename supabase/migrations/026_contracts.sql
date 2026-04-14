-- Migration 026: contracts
-- Módulo de contratos com fornecedores

CREATE TYPE contract_status AS ENUM (
  'draft',
  'active',
  'expired',
  'cancelled'
);

CREATE TYPE contract_type AS ENUM (
  'fornecimento',
  'servico',
  'sla',
  'nda',
  'outro'
);

CREATE TABLE contracts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  code          text NOT NULL,
  title         text NOT NULL,
  type          contract_type NOT NULL DEFAULT 'fornecimento',
  status        contract_status NOT NULL DEFAULT 'draft',
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  value         numeric(15,2),
  file_url      text,
  notes         text,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_code_unique UNIQUE (company_id, code)
);

-- Índices
CREATE INDEX idx_contracts_company    ON contracts(company_id);
CREATE INDEX idx_contracts_supplier   ON contracts(supplier_id);
CREATE INDEX idx_contracts_status     ON contracts(status);
CREATE INDEX idx_contracts_end_date   ON contracts(end_date);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();

-- RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts: leitura por tenant"
  ON contracts FOR SELECT
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contracts: escrita por buyer"
  ON contracts FOR INSERT
  WITH CHECK (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contracts: update por buyer"
  ON contracts FOR UPDATE
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contracts: delete por buyer"
  ON contracts FOR DELETE
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Feature key na empresa teste (enabled alinhado ao uso em tenant_features no app)
INSERT INTO tenant_features (company_id, feature_key, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', 'contracts', true)
ON CONFLICT (company_id, feature_key) DO NOTHING;

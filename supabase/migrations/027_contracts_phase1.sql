-- Migration 027: contracts_phase1
-- Enriquecimento do módulo de contratos

-- 1. Adicionar colunas na tabela contracts
ALTER TABLE contracts
  ADD COLUMN payment_condition_id uuid REFERENCES payment_conditions(id),
  ADD COLUMN contract_terms       text,
  ADD COLUMN erp_code             text,
  ADD COLUMN quotation_id         uuid REFERENCES quotations(id),
  ADD COLUMN total_value          numeric(15,2),
  ADD COLUMN consumed_value       numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN consumed_quantity    numeric(15,3) NOT NULL DEFAULT 0;

-- Índice para busca por cotação origem
CREATE INDEX idx_contracts_quotation ON contracts(quotation_id);
CREATE INDEX idx_contracts_erp_code  ON contracts(erp_code);

-- 2. Criar tabela contract_items
CREATE TABLE contract_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id          uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_code        text NOT NULL,
  material_description text NOT NULL,
  unit_of_measure      text,
  quantity_contracted  numeric(15,3) NOT NULL,
  quantity_consumed    numeric(15,3) NOT NULL DEFAULT 0,
  unit_price           numeric(15,2) NOT NULL,
  total_price          numeric(15,2) GENERATED ALWAYS AS (quantity_contracted * unit_price) STORED,
  consumed_value       numeric(15,2) NOT NULL DEFAULT 0,
  notes                text,
  quotation_item_id    uuid REFERENCES quotation_items(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_items_contract  ON contract_items(contract_id);
CREATE INDEX idx_contract_items_company   ON contract_items(company_id);
CREATE INDEX idx_contract_items_material  ON contract_items(material_code);

-- RLS contract_items
ALTER TABLE contract_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_items: leitura por tenant"
  ON contract_items FOR SELECT
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contract_items: escrita por buyer"
  ON contract_items FOR INSERT
  WITH CHECK (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contract_items: update por buyer"
  ON contract_items FOR UPDATE
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contract_items: delete por buyer"
  ON contract_items FOR DELETE
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- 3. Trigger: recalcular consumed_value e consumed_quantity em contracts
--    quando contract_items for atualizado
CREATE OR REPLACE FUNCTION update_contract_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contracts SET
    consumed_value    = (
      SELECT COALESCE(SUM(consumed_value), 0)
      FROM contract_items WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
    ),
    consumed_quantity = (
      SELECT COALESCE(SUM(quantity_consumed), 0)
      FROM contract_items WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
    ),
    total_value = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM contract_items WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
    )
  WHERE id = COALESCE(NEW.contract_id, OLD.contract_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contract_totals
  AFTER INSERT OR UPDATE OR DELETE ON contract_items
  FOR EACH ROW EXECUTE FUNCTION update_contract_totals();

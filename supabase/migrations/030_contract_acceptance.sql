-- Migration 030: contract_acceptance

-- 1. Adicionar novo status ao enum
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'pending_acceptance';

-- 2. Tabela de aceites de contrato
CREATE TABLE contract_acceptances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  action          text NOT NULL CHECK (action IN ('accepted', 'refused')),
  notes           text,
  term_version    text,
  term_version_date date,
  ip_address      text,
  user_id         uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_acceptances_contract
  ON contract_acceptances(contract_id);
CREATE INDEX idx_contract_acceptances_company
  ON contract_acceptances(company_id);

-- RLS
ALTER TABLE contract_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_acceptances: leitura por tenant"
  ON contract_acceptances FOR SELECT
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contract_acceptances: insert autenticado"
  ON contract_acceptances FOR INSERT
  WITH CHECK (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- 3. Adicionar campos de aceite em contracts
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS sent_for_acceptance_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_supplier    uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS refusal_reason          text;

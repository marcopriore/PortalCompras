-- Migration 028: contract_items_delivery + contract_code + contract_kind
-- contract_kind: por_valor vs por_quantidade (complementa o enum type de negócio)

-- 1. Adicionar delivery_days em contract_items
ALTER TABLE contract_items
  ADD COLUMN delivery_days integer;

-- 2. Adicionar contract_kind em contracts
--    (substitui o campo "type" para tipo de contrato por valor vs quantidade)
ALTER TABLE contracts
  ADD COLUMN contract_kind text NOT NULL DEFAULT 'por_valor'
  CHECK (contract_kind IN ('por_valor', 'por_quantidade'));

-- 3. Função para gerar código automático de contrato
--    Padrão: CTR-{ANO}-{SEQUENCIAL 4 dígitos} por tenant
CREATE OR REPLACE FUNCTION generate_contract_code(p_company_id uuid)
RETURNS text AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_seq  integer;
  v_code text;
BEGIN
  SELECT COUNT(*) + 1
  INTO v_seq
  FROM contracts
  WHERE company_id = p_company_id
    AND code LIKE 'CTR-' || v_year || '-%';

  v_code := 'CTR-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft delete / marcação de itens de contrato eliminados

ALTER TABLE contract_items
  ADD COLUMN IF NOT EXISTS eliminated boolean NOT NULL DEFAULT false;

ALTER TABLE contract_items
  ADD COLUMN IF NOT EXISTS eliminated_at timestamptz;

ALTER TABLE contract_items
  ADD COLUMN IF NOT EXISTS eliminated_reason text;

-- Adiciona colunas para suportar fluxos de aprovação (requisições e pedidos)
-- Requisições: cost_center, flow='requisition'
-- Pedidos: category, min_value, max_value, flow='order'

ALTER TABLE public.approval_levels
  ADD COLUMN IF NOT EXISTS flow text DEFAULT 'requisition',
  ADD COLUMN IF NOT EXISTS cost_center text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approver_name text;

-- Atualiza registros existentes para o novo formato
UPDATE public.approval_levels
SET flow = 'requisition',
    cost_center = COALESCE(cost_center, '*'),
    category = COALESCE(category, '*')
WHERE flow IS NULL;

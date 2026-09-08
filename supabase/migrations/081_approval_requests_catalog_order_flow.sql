-- 081: approval_requests.flow aceita catalog_order (Pedido — Catálogo)
-- Corrige checkout cost_center_approval: INSERT violava approval_requests_flow_check

ALTER TABLE public.approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_flow_check;

ALTER TABLE public.approval_requests
  ADD CONSTRAINT approval_requests_flow_check
  CHECK (flow IN ('requisition', 'order', 'catalog_order'));

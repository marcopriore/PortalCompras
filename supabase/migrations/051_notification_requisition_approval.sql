-- ============================================================
-- 051 — Preferência: Aprovação de Requisição (bell + e-mail)
-- Usada quando a requisição do solicitante é aprovada/reprovada.
-- ============================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS requisition_approval_bell boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requisition_approval_email boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notification_preferences.requisition_approval_bell IS
  'Sininho: requisição aprovada ou reprovada';
COMMENT ON COLUMN public.notification_preferences.requisition_approval_email IS
  'E-mail: requisição aprovada ou reprovada';

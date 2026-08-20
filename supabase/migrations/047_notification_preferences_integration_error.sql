-- Preferências de alerta para Erro de Integração (integration_error)

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS integration_error_bell boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS integration_error_email boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.integration_error_bell IS
  'Sino in-app quando pedido/contrato fica com Erro de Integração (TI/admin).';

COMMENT ON COLUMN public.notification_preferences.integration_error_email IS
  'E-mail quando pedido/contrato fica com Erro de Integração (TI/admin).';

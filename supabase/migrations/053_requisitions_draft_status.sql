-- ============================================================
-- 053 — Status draft (rascunho) em requisições + RLS solicitante
-- ============================================================

ALTER TABLE public.requisitions
DROP CONSTRAINT IF EXISTS requisitions_status_check;

ALTER TABLE public.requisitions
ADD CONSTRAINT requisitions_status_check
CHECK (status = ANY (ARRAY[
  'draft'::text,
  'pending'::text,
  'approved'::text,
  'rejected'::text,
  'in_quotation'::text,
  'completed'::text,
  'cancelled'::text
]));

-- Substituir policy estreita pending→cancelled por políticas de ciclo de vida do solicitante
DROP POLICY IF EXISTS "requisitions: requester cancela proprias" ON public.requisitions;
DROP POLICY IF EXISTS "requisitions: requester edita rascunho" ON public.requisitions;
DROP POLICY IF EXISTS "requisitions: requester envia ou reenvia" ON public.requisitions;
DROP POLICY IF EXISTS "requisitions: requester auto aprova" ON public.requisitions;

-- Cancelar: pending ou draft → cancelled
CREATE POLICY "requisitions: requester cancela proprias"
ON public.requisitions FOR UPDATE
USING (
  requester_id = auth.uid()
  AND status = ANY (ARRAY['pending'::text, 'draft'::text])
)
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'cancelled'
);

-- Editar conteúdo do rascunho (permanece draft)
CREATE POLICY "requisitions: requester edita rascunho"
ON public.requisitions FOR UPDATE
USING (
  requester_id = auth.uid()
  AND status = 'draft'
)
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'draft'
);

-- Enviar rascunho ou reenviar reprovada → pending
CREATE POLICY "requisitions: requester envia ou reenvia"
ON public.requisitions FOR UPDATE
USING (
  requester_id = auth.uid()
  AND status = ANY (ARRAY['draft'::text, 'rejected'::text])
)
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'pending'
);

-- Auto-aprovação no cliente quando fluxo desabilitado / sem regra de CC
CREATE POLICY "requisitions: requester auto aprova"
ON public.requisitions FOR UPDATE
USING (
  requester_id = auth.uid()
  AND status = 'pending'
)
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'approved'
);

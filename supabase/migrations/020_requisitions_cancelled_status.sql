-- Adiciona status 'cancelled' à constraint de requisitions
ALTER TABLE public.requisitions
DROP CONSTRAINT IF EXISTS requisitions_status_check;

ALTER TABLE public.requisitions
ADD CONSTRAINT requisitions_status_check
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'approved'::text,
  'rejected'::text,
  'in_quotation'::text,
  'completed'::text,
  'cancelled'::text
]));

-- Atualizar RLS policy para permitir cancelamento pelo solicitante
DROP POLICY IF EXISTS "requisitions: requester cancela proprias" ON public.requisitions;

CREATE POLICY "requisitions: requester cancela proprias"
ON public.requisitions FOR UPDATE
USING (
  requester_id = auth.uid()
  AND status = 'pending'
)
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'cancelled'
);

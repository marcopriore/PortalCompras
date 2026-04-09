-- Migration 019: Portal do Solicitante
-- Adiciona requester_id em requisitions e profile_type 'requester'

ALTER TABLE public.requisitions
ADD COLUMN IF NOT EXISTS requester_id uuid REFERENCES auth.users(id);

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_profile_type_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_profile_type_check
CHECK (profile_type IN ('buyer', 'supplier', 'requester'));

CREATE POLICY "requisitions: requester le proprias"
ON public.requisitions FOR SELECT
USING (
  requester_id = auth.uid()
  OR company_id = (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid()
    AND profile_type IN ('buyer', 'admin')
  )
);

CREATE POLICY "requisitions: requester insere"
ON public.requisitions FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  AND company_id = (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "requisitions: requester cancela proprias"
ON public.requisitions FOR UPDATE
USING (
  requester_id = auth.uid()
  AND status = 'pending'
);

CREATE INDEX IF NOT EXISTS idx_requisitions_requester_id
ON public.requisitions (requester_id);

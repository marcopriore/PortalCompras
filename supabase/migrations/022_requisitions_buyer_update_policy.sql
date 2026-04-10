-- Policy: comprador pode atualizar requisições do próprio tenant
DROP POLICY IF EXISTS "requisitions: buyer atualiza status" ON public.requisitions;

CREATE POLICY "requisitions: buyer atualiza status"
ON public.requisitions FOR UPDATE
USING (
  company_id = (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid()
    AND profile_type = 'buyer'
  )
)
WITH CHECK (
  company_id = (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid()
    AND profile_type = 'buyer'
  )
);

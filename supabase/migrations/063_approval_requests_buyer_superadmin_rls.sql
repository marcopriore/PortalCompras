-- ============================================================
-- 063 — approval_requests: SELECT/UPDATE/INSERT/DELETE para buyer + superadmin
-- Superadmin usa cookie selected_company_id; RLS não lê cookie — libera is_superadmin.
-- ============================================================

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approval_requests: buyer tenant" ON public.approval_requests;

CREATE POLICY "approval_requests: buyer tenant"
ON public.approval_requests FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = approval_requests.company_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = approval_requests.company_id
      )
  )
);

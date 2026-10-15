-- ============================================================
-- 087 — requisition_items / requisition_attachments: fornecedor não
--        apaga nem altera linhas e anexos de requisição
--
-- 073 criou policies FOR ALL só com company_id (+ superadmin), sem
-- profile_type. Sessão do portal fornecedor (mesmo company_id do
-- comprador — profiles.company_id / activate-tenant) podia
-- DELETE/UPDATE todas as linhas e anexos do tenant via JWT + anon key.
--
-- Leitura/escrita:
--   buyer (+ superadmin): tenant inteiro
--   requester: só itens/anexos de REQ com requester_id = auth.uid()
--   supplier: nenhum acesso
-- Service role inalterado.
-- ============================================================

-- ------------------------------------------------------------
-- requisition_items
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "requisition_items: buyer gerencia tenant"
  ON public.requisition_items;
DROP POLICY IF EXISTS "requisition_items: requester own"
  ON public.requisition_items;

CREATE POLICY "requisition_items: buyer gerencia tenant"
ON public.requisition_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = requisition_items.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = requisition_items.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
);

CREATE POLICY "requisition_items: requester own"
ON public.requisition_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.requisitions r
      ON r.id = requisition_items.requisition_id
     AND r.company_id = requisition_items.company_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = requisition_items.company_id
      AND r.requester_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.requisitions r
      ON r.id = requisition_items.requisition_id
     AND r.company_id = requisition_items.company_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = requisition_items.company_id
      AND r.requester_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- requisition_attachments (mesmo buraco em 073)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "requisition_attachments: buyer gerencia tenant"
  ON public.requisition_attachments;
DROP POLICY IF EXISTS "requisition_attachments: requester own"
  ON public.requisition_attachments;

CREATE POLICY "requisition_attachments: buyer gerencia tenant"
ON public.requisition_attachments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = requisition_attachments.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = requisition_attachments.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
);

CREATE POLICY "requisition_attachments: requester own"
ON public.requisition_attachments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.requisitions r
      ON r.id = requisition_attachments.requisition_id
     AND r.company_id = requisition_attachments.company_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = requisition_attachments.company_id
      AND r.requester_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.requisitions r
      ON r.id = requisition_attachments.requisition_id
     AND r.company_id = requisition_attachments.company_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = requisition_attachments.company_id
      AND r.requester_id = auth.uid()
  )
);

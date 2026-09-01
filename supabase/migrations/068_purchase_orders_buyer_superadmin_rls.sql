-- ============================================================
-- 068 — purchase_orders / purchase_order_items / account assignments
-- Superadmin com tenant selecionado no app (cookie) não batia company_id
-- do profile → UPDATE 0 linhas ou falha em classificação contábil.
-- Padrão alinhado à migration 062 (requisitions).
-- ============================================================

-- purchase_orders — comprador gerencia tenant (+ superadmin)
DROP POLICY IF EXISTS "purchase_orders: buyer gerencia tenant" ON public.purchase_orders;

CREATE POLICY "purchase_orders: buyer gerencia tenant"
ON public.purchase_orders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = purchase_orders.company_id
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
        OR p.company_id = purchase_orders.company_id
      )
  )
);

-- purchase_order_items — comprador gerencia itens do tenant (+ superadmin)
DROP POLICY IF EXISTS "purchase_order_items: buyer gerencia tenant" ON public.purchase_order_items;

CREATE POLICY "purchase_order_items: buyer gerencia tenant"
ON public.purchase_order_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = purchase_order_items.company_id
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
        OR p.company_id = purchase_order_items.company_id
      )
  )
);

-- Classificação contábil — rateio por linha (+ superadmin)
DROP POLICY IF EXISTS "po_item_account_assignments: tenant select"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant select"
  ON public.purchase_order_item_account_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = purchase_order_item_account_assignments.company_id
        )
    )
  );

DROP POLICY IF EXISTS "po_item_account_assignments: tenant insert"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant insert"
  ON public.purchase_order_item_account_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = purchase_order_item_account_assignments.company_id
        )
    )
  );

DROP POLICY IF EXISTS "po_item_account_assignments: tenant update"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant update"
  ON public.purchase_order_item_account_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = purchase_order_item_account_assignments.company_id
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
          OR p.company_id = purchase_order_item_account_assignments.company_id
        )
    )
  );

DROP POLICY IF EXISTS "po_item_account_assignments: tenant delete"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant delete"
  ON public.purchase_order_item_account_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = purchase_order_item_account_assignments.company_id
        )
    )
  );

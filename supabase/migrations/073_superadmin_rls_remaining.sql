-- ============================================================
-- 073 — RLS superadmin cross-tenant (restante do portal comprador)
-- Superadmin opera tenant via cookie selected_company_id; RLS não lê cookie.
-- Padrão: COALESCE(is_superadmin) OR company_id do profile = linha.company_id
-- ============================================================

-- ------------------------------------------------------------
-- contract_acceptances (histórico de aceite — leitura comprador)
-- Aceite/recusa do fornecedor usa service role na API.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "contract_acceptances: leitura por tenant" ON public.contract_acceptances;
DROP POLICY IF EXISTS "contract_acceptances: insert autenticado" ON public.contract_acceptances;
DROP POLICY IF EXISTS "contract_acceptances: buyer gerencia tenant" ON public.contract_acceptances;

CREATE POLICY "contract_acceptances: buyer gerencia tenant"
ON public.contract_acceptances
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
        OR p.company_id = contract_acceptances.company_id
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
        OR p.company_id = contract_acceptances.company_id
      )
  )
);

-- ------------------------------------------------------------
-- supplier_categories
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "supplier_categories: leitura por tenant" ON public.supplier_categories;
DROP POLICY IF EXISTS "supplier_categories: escrita por buyer" ON public.supplier_categories;
DROP POLICY IF EXISTS "supplier_categories: delete por buyer" ON public.supplier_categories;
DROP POLICY IF EXISTS "supplier_categories: buyer gerencia tenant" ON public.supplier_categories;

CREATE POLICY "supplier_categories: buyer gerencia tenant"
ON public.supplier_categories
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
        OR p.company_id = supplier_categories.company_id
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
        OR p.company_id = supplier_categories.company_id
      )
  )
);

-- ------------------------------------------------------------
-- payment_conditions (comprador; leitura fornecedor mantida)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "company_manage_payment_conditions" ON public.payment_conditions;

CREATE POLICY "company_manage_payment_conditions"
ON public.payment_conditions
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
        OR p.company_id = payment_conditions.company_id
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
        OR p.company_id = payment_conditions.company_id
      )
  )
);

-- ------------------------------------------------------------
-- item_import_logs
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "item_import_logs_select_company" ON public.item_import_logs;
DROP POLICY IF EXISTS "item_import_logs_insert_company" ON public.item_import_logs;
DROP POLICY IF EXISTS "item_import_logs: buyer gerencia tenant" ON public.item_import_logs;

CREATE POLICY "item_import_logs: buyer gerencia tenant"
ON public.item_import_logs
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
        OR p.company_id = item_import_logs.company_id
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
        OR p.company_id = item_import_logs.company_id
      )
  )
);

-- ------------------------------------------------------------
-- ai_analysis_logs
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "ai_analysis_logs: leitura por tenant" ON public.ai_analysis_logs;
DROP POLICY IF EXISTS "ai_analysis_logs: insert por tenant" ON public.ai_analysis_logs;
DROP POLICY IF EXISTS "ai_analysis_logs: buyer gerencia tenant" ON public.ai_analysis_logs;

CREATE POLICY "ai_analysis_logs: buyer gerencia tenant"
ON public.ai_analysis_logs
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
        OR p.company_id = ai_analysis_logs.company_id
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
        OR p.company_id = ai_analysis_logs.company_id
      )
  )
);

-- ------------------------------------------------------------
-- requisition_attachments
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "requisition_attachments: tenant select" ON public.requisition_attachments;
DROP POLICY IF EXISTS "requisition_attachments: tenant insert" ON public.requisition_attachments;
DROP POLICY IF EXISTS "requisition_attachments: tenant delete" ON public.requisition_attachments;
DROP POLICY IF EXISTS "requisition_attachments: buyer gerencia tenant" ON public.requisition_attachments;

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
        OR p.company_id = requisition_attachments.company_id
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
        OR p.company_id = requisition_attachments.company_id
      )
  )
);

-- ------------------------------------------------------------
-- quotations + quotation_items + quotation_suppliers (comprador)
-- Políticas do portal fornecedor (006) são preservadas.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Quotations are readable only within user's company" ON public.quotations;
DROP POLICY IF EXISTS "Quotations are insertable only within user's company" ON public.quotations;
DROP POLICY IF EXISTS "Quotations are updatable only within user's company" ON public.quotations;
DROP POLICY IF EXISTS "Quotations are deletable only within user's company" ON public.quotations;
DROP POLICY IF EXISTS "quotations: buyer gerencia tenant" ON public.quotations;

CREATE POLICY "quotations: buyer gerencia tenant"
ON public.quotations
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
        OR p.company_id = quotations.company_id
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
        OR p.company_id = quotations.company_id
      )
  )
);

DROP POLICY IF EXISTS "Quotation items are readable only within user's company" ON public.quotation_items;
DROP POLICY IF EXISTS "Quotation items are insertable only within user's company" ON public.quotation_items;
DROP POLICY IF EXISTS "Quotation items are updatable only within user's company" ON public.quotation_items;
DROP POLICY IF EXISTS "Quotation items are deletable only within user's company" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items: buyer gerencia tenant" ON public.quotation_items;

CREATE POLICY "quotation_items: buyer gerencia tenant"
ON public.quotation_items
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
        OR p.company_id = quotation_items.company_id
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
        OR p.company_id = quotation_items.company_id
      )
  )
);

DROP POLICY IF EXISTS "Quotation suppliers are readable only within user's company" ON public.quotation_suppliers;
DROP POLICY IF EXISTS "Quotation suppliers are insertable only within user's company" ON public.quotation_suppliers;
DROP POLICY IF EXISTS "Quotation suppliers are updatable only within user's company" ON public.quotation_suppliers;
DROP POLICY IF EXISTS "Quotation suppliers are deletable only within user's company" ON public.quotation_suppliers;
DROP POLICY IF EXISTS "quotation_suppliers: buyer gerencia tenant" ON public.quotation_suppliers;

CREATE POLICY "quotation_suppliers: buyer gerencia tenant"
ON public.quotation_suppliers
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
        OR p.company_id = quotation_suppliers.company_id
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
        OR p.company_id = quotation_suppliers.company_id
      )
  )
);

-- ------------------------------------------------------------
-- suppliers (corrige 044: is_superadmin não substituía company_id)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Buyers insert suppliers in tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Buyers update suppliers in tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers are readable only within user's company" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers are insertable only within user's company" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers are updatable only within user's company" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers: buyer gerencia tenant" ON public.suppliers;

CREATE POLICY "suppliers: buyer gerencia tenant"
ON public.suppliers
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
        OR (
          p.company_id = suppliers.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
        )
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
        OR (
          p.company_id = suppliers.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
        )
      )
  )
);

-- Leitura de fornecedores para compradores do tenant (sem exigir admin)
CREATE POLICY "suppliers: buyer le tenant"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = suppliers.company_id
      )
  )
);

-- ------------------------------------------------------------
-- supplier_invites
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Buyers manage supplier invites in tenant" ON public.supplier_invites;

CREATE POLICY "Buyers manage supplier invites in tenant"
ON public.supplier_invites
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
        OR p.company_id = supplier_invites.company_id
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
        OR p.company_id = supplier_invites.company_id
      )
  )
);

-- ------------------------------------------------------------
-- supplier_terms
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "buyers_read_own_terms" ON public.supplier_terms;
DROP POLICY IF EXISTS "admin_manage_terms" ON public.supplier_terms;

CREATE POLICY "buyers_read_own_terms"
ON public.supplier_terms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = supplier_terms.company_id
      )
  )
);

CREATE POLICY "admin_manage_terms"
ON public.supplier_terms
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
          p.company_id = supplier_terms.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
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
          p.company_id = supplier_terms.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
        )
      )
  )
);

-- ------------------------------------------------------------
-- companies (seletor / joins do superadmin)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Companies are visible only to users with a profile in them" ON public.companies;

CREATE POLICY "Companies are visible only to users with a profile in them"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = companies.id
      )
  )
);

-- ------------------------------------------------------------
-- notifications — INSERT cross-tenant (notificar usuários do tenant ativo)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users insert notifications for same-company recipients" ON public.notifications;

CREATE POLICY "Users insert notifications for same-company recipients"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = notifications.company_id
      )
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = notifications.user_id
      AND pr.company_id = notifications.company_id
  )
);

-- ------------------------------------------------------------
-- Loja de API / integrações (admin tenant + superadmin)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "api_keys: tenant admin manage" ON public.api_keys;
CREATE POLICY "api_keys: tenant admin manage"
ON public.api_keys
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
          p.company_id = api_keys.company_id
          AND (
            p.role = 'admin'
            OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
          )
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
          p.company_id = api_keys.company_id
          AND (
            p.role = 'admin'
            OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "api_request_logs: tenant admin read" ON public.api_request_logs;
CREATE POLICY "api_request_logs: tenant admin read"
ON public.api_request_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = api_request_logs.company_id
          AND (
            p.role = 'admin'
            OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "integration_endpoints: tenant admin manage" ON public.integration_endpoints;
CREATE POLICY "integration_endpoints: tenant admin manage"
ON public.integration_endpoints
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
          p.company_id = integration_endpoints.company_id
          AND (
            p.role = 'admin'
            OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
          )
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
          p.company_id = integration_endpoints.company_id
          AND (
            p.role = 'admin'
            OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "integration_delivery_logs: tenant admin read" ON public.integration_delivery_logs;
CREATE POLICY "integration_delivery_logs: tenant admin read"
ON public.integration_delivery_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = integration_delivery_logs.company_id
          AND (
            p.role = 'admin'
            OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
          )
        )
      )
  )
);

-- ------------------------------------------------------------
-- permission_groups / profile_permissions (configurações admin)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "permission_groups: read same tenant" ON public.permission_groups;
CREATE POLICY "permission_groups: read same tenant"
ON public.permission_groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = permission_groups.company_id
      )
  )
);

DROP POLICY IF EXISTS "permission_group_rules: read same tenant" ON public.permission_group_rules;
CREATE POLICY "permission_group_rules: read same tenant"
ON public.permission_group_rules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = permission_group_rules.company_id
      )
  )
);

DROP POLICY IF EXISTS "profile_permission_groups: read same tenant" ON public.profile_permission_groups;
CREATE POLICY "profile_permission_groups: read same tenant"
ON public.profile_permission_groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = profile_permission_groups.company_id
      )
  )
);

DROP POLICY IF EXISTS "permission_groups: admin write" ON public.permission_groups;
CREATE POLICY "permission_groups: admin write"
ON public.permission_groups
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
          p.company_id = permission_groups.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
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
          p.company_id = permission_groups.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "permission_group_rules: admin write" ON public.permission_group_rules;
CREATE POLICY "permission_group_rules: admin write"
ON public.permission_group_rules
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
          p.company_id = permission_group_rules.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
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
          p.company_id = permission_group_rules.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "profile_permission_groups: admin write" ON public.profile_permission_groups;
CREATE POLICY "profile_permission_groups: admin write"
ON public.profile_permission_groups
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
          p.company_id = profile_permission_groups.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
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
          p.company_id = profile_permission_groups.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "profile_permissions: read same tenant" ON public.profile_permissions;
CREATE POLICY "profile_permissions: read same tenant"
ON public.profile_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = profile_permissions.company_id
      )
  )
);

DROP POLICY IF EXISTS "profile_permissions: admin write" ON public.profile_permissions;
CREATE POLICY "profile_permissions: admin write"
ON public.profile_permissions
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
          p.company_id = profile_permissions.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
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
          p.company_id = profile_permissions.company_id
          AND (
            p.role = 'admin'
            OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
          )
        )
      )
  )
);

-- ------------------------------------------------------------
-- items (catálogo) — políticas comuns em PRD
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'items'
  ) THEN
    EXECUTE 'ALTER TABLE public.items ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Items are readable only within user''s company" ON public.items';
    EXECUTE 'DROP POLICY IF EXISTS "Items are insertable only within user''s company" ON public.items';
    EXECUTE 'DROP POLICY IF EXISTS "Items are updatable only within user''s company" ON public.items';
    EXECUTE 'DROP POLICY IF EXISTS "Items are deletable only within user''s company" ON public.items';
    EXECUTE 'DROP POLICY IF EXISTS "items: buyer gerencia tenant" ON public.items';
    EXECUTE 'DROP POLICY IF EXISTS "items: tenant read" ON public.items';
    EXECUTE 'DROP POLICY IF EXISTS "items: buyer write" ON public.items';

    EXECUTE $policy$
      CREATE POLICY "items: tenant read"
      ON public.items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (
              COALESCE(p.is_superadmin, false) = true
              OR (
                p.company_id = items.company_id
                AND p.profile_type IN ('buyer', 'requester')
              )
            )
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "items: buyer write"
      ON public.items
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
              OR p.company_id = items.company_id
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
              OR p.company_id = items.company_id
            )
        )
      )
    $policy$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- quotation_rounds / quotation_proposals / proposal_items
-- (se RLS estiver ativo em PRD)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'quotation_rounds'
  ) THEN
    EXECUTE 'ALTER TABLE public.quotation_rounds ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "quotation_rounds: buyer gerencia tenant" ON public.quotation_rounds';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation rounds are readable only within user''s company" ON public.quotation_rounds';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation rounds are insertable only within user''s company" ON public.quotation_rounds';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation rounds are updatable only within user''s company" ON public.quotation_rounds';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation rounds are deletable only within user''s company" ON public.quotation_rounds';

    EXECUTE $policy$
      CREATE POLICY "quotation_rounds: buyer gerencia tenant"
      ON public.quotation_rounds
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
              OR p.company_id = quotation_rounds.company_id
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
              OR p.company_id = quotation_rounds.company_id
            )
        )
      )
    $policy$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'quotation_proposals'
  ) THEN
    EXECUTE 'ALTER TABLE public.quotation_proposals ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "quotation_proposals: buyer gerencia tenant" ON public.quotation_proposals';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation proposals are readable only within user''s company" ON public.quotation_proposals';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation proposals are insertable only within user''s company" ON public.quotation_proposals';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation proposals are updatable only within user''s company" ON public.quotation_proposals';
    EXECUTE 'DROP POLICY IF EXISTS "Quotation proposals are deletable only within user''s company" ON public.quotation_proposals';

    EXECUTE $policy$
      CREATE POLICY "quotation_proposals: buyer gerencia tenant"
      ON public.quotation_proposals
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
              OR p.company_id = quotation_proposals.company_id
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
              OR p.company_id = quotation_proposals.company_id
            )
        )
      )
    $policy$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'proposal_items'
  ) THEN
    EXECUTE 'ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "proposal_items: buyer gerencia tenant" ON public.proposal_items';
    EXECUTE 'DROP POLICY IF EXISTS "Proposal items are readable only within user''s company" ON public.proposal_items';
    EXECUTE 'DROP POLICY IF EXISTS "Proposal items are insertable only within user''s company" ON public.proposal_items';
    EXECUTE 'DROP POLICY IF EXISTS "Proposal items are updatable only within user''s company" ON public.proposal_items';
    EXECUTE 'DROP POLICY IF EXISTS "Proposal items are deletable only within user''s company" ON public.proposal_items';

    EXECUTE $policy$
      CREATE POLICY "proposal_items: buyer gerencia tenant"
      ON public.proposal_items
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
              OR p.company_id = proposal_items.company_id
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
              OR p.company_id = proposal_items.company_id
            )
        )
      )
    $policy$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- approval_levels (alçadas)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'approval_levels'
  ) THEN
    EXECUTE 'ALTER TABLE public.approval_levels ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "approval_levels: buyer gerencia tenant" ON public.approval_levels';
    EXECUTE 'DROP POLICY IF EXISTS "Approval levels are readable only within user''s company" ON public.approval_levels';
    EXECUTE 'DROP POLICY IF EXISTS "Approval levels are insertable only within user''s company" ON public.approval_levels';
    EXECUTE 'DROP POLICY IF EXISTS "Approval levels are updatable only within user''s company" ON public.approval_levels';
    EXECUTE 'DROP POLICY IF EXISTS "Approval levels are deletable only within user''s company" ON public.approval_levels';

    EXECUTE $policy$
      CREATE POLICY "approval_levels: buyer gerencia tenant"
      ON public.approval_levels
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
              OR p.company_id = approval_levels.company_id
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
              OR p.company_id = approval_levels.company_id
            )
        )
      )
    $policy$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- requisition_items (linhas de requisição)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'requisition_items'
  ) THEN
    EXECUTE 'ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "requisition_items: buyer gerencia tenant" ON public.requisition_items';
    EXECUTE 'DROP POLICY IF EXISTS "Requisition items are readable only within user''s company" ON public.requisition_items';
    EXECUTE 'DROP POLICY IF EXISTS "Requisition items are insertable only within user''s company" ON public.requisition_items';
    EXECUTE 'DROP POLICY IF EXISTS "Requisition items are updatable only within user''s company" ON public.requisition_items';
    EXECUTE 'DROP POLICY IF EXISTS "Requisition items are deletable only within user''s company" ON public.requisition_items';

    EXECUTE $policy$
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
              OR p.company_id = requisition_items.company_id
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
              OR p.company_id = requisition_items.company_id
            )
        )
      )
    $policy$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- company_settings (configurações por tenant)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'company_settings'
  ) THEN
    EXECUTE 'ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "company_settings: buyer gerencia tenant" ON public.company_settings';
    EXECUTE 'DROP POLICY IF EXISTS "company_settings: tenant manage" ON public.company_settings';

    EXECUTE $policy$
      CREATE POLICY "company_settings: buyer gerencia tenant"
      ON public.company_settings
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (
              COALESCE(p.is_superadmin, false) = true
              OR p.company_id = company_settings.company_id
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
              OR p.company_id = company_settings.company_id
            )
        )
      )
    $policy$;
  END IF;
END $$;

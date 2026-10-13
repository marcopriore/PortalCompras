-- ============================================================
-- 085 — RLS em tenant_features e company_settings
--
-- tenant_features: nenhuma migration habilitava RLS. Com GRANT padrão do
-- autenticado, qualquer sessão (incl. fornecedor no mesmo company_id) podia
-- upsert de módulos (ex.: desligar approval_requisition / ligar premium).
--
-- company_settings (073): policy "buyer gerencia tenant" não filtrava
-- profile_type — fornecedor/requisitante gravava chaves de implantação
-- (catalog_post_checkout_mode, erp_integration_enabled, password_*,
-- api_capabilities).
--
-- Escrita autenticada (client):
--   company_settings: só lead_time_target_days e contract_po_link_prompt_enabled
--   tenant_features: superadmin qualquer chave; buyer com settings.manage/admin
--                    só approval_requisition / approval_order / approval_catalog_order
-- Demais writes (admin tenant, create-tenant) usam service role.
-- ============================================================

-- ------------------------------------------------------------
-- tenant_features
-- ------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'tenant_features'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY';

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_features'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.tenant_features',
      pol.policyname
    );
  END LOOP;
END $$;

CREATE POLICY "tenant_features: tenant read"
ON public.tenant_features
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
          p.company_id = tenant_features.company_id
          AND p.profile_type IN ('buyer', 'requester')
        )
      )
  )
);

CREATE POLICY "tenant_features: superadmin write"
ON public.tenant_features
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_superadmin, false) = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_superadmin, false) = true
  )
);

CREATE POLICY "tenant_features: settings admin write approval modules"
ON public.tenant_features
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_features.feature_key IN (
    'approval_requisition',
    'approval_order',
    'approval_catalog_order'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND p.company_id = tenant_features.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
        OR EXISTS (
          SELECT 1
          FROM public.profile_permissions pp
          WHERE pp.user_id = p.id
            AND pp.company_id = p.company_id
            AND pp.permission_key = 'settings.manage'
            AND pp.enabled = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.profile_permission_groups ppg
          INNER JOIN public.permission_group_rules pgr
            ON pgr.group_id = ppg.group_id
           AND pgr.company_id = ppg.company_id
          WHERE ppg.user_id = p.id
            AND ppg.company_id = p.company_id
            AND pgr.permission_key = 'settings.manage'
            AND pgr.enabled = true
        )
      )
  )
);

CREATE POLICY "tenant_features: settings admin update approval modules"
ON public.tenant_features
FOR UPDATE
TO authenticated
USING (
  tenant_features.feature_key IN (
    'approval_requisition',
    'approval_order',
    'approval_catalog_order'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND p.company_id = tenant_features.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
        OR EXISTS (
          SELECT 1
          FROM public.profile_permissions pp
          WHERE pp.user_id = p.id
            AND pp.company_id = p.company_id
            AND pp.permission_key = 'settings.manage'
            AND pp.enabled = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.profile_permission_groups ppg
          INNER JOIN public.permission_group_rules pgr
            ON pgr.group_id = ppg.group_id
           AND pgr.company_id = ppg.company_id
          WHERE ppg.user_id = p.id
            AND ppg.company_id = p.company_id
            AND pgr.permission_key = 'settings.manage'
            AND pgr.enabled = true
        )
      )
  )
)
WITH CHECK (
  tenant_features.feature_key IN (
    'approval_requisition',
    'approval_order',
    'approval_catalog_order'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND p.company_id = tenant_features.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY(p.roles))
        OR EXISTS (
          SELECT 1
          FROM public.profile_permissions pp
          WHERE pp.user_id = p.id
            AND pp.company_id = p.company_id
            AND pp.permission_key = 'settings.manage'
            AND pp.enabled = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.profile_permission_groups ppg
          INNER JOIN public.permission_group_rules pgr
            ON pgr.group_id = ppg.group_id
           AND pgr.company_id = ppg.company_id
          WHERE ppg.user_id = p.id
            AND ppg.company_id = p.company_id
            AND pgr.permission_key = 'settings.manage'
            AND pgr.enabled = true
        )
      )
  )
);

-- ------------------------------------------------------------
-- company_settings
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "company_settings: buyer gerencia tenant" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings: tenant manage" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings: tenant read" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings: buyer write operational keys" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings: buyer update operational keys" ON public.company_settings;

CREATE POLICY "company_settings: tenant read"
ON public.company_settings
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
          p.company_id = company_settings.company_id
          AND p.profile_type IN ('buyer', 'requester')
        )
      )
  )
);

CREATE POLICY "company_settings: buyer write operational keys"
ON public.company_settings
FOR INSERT
TO authenticated
WITH CHECK (
  company_settings.key IN (
    'lead_time_target_days',
    'contract_po_link_prompt_enabled'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = company_settings.company_id
      )
  )
);

CREATE POLICY "company_settings: buyer update operational keys"
ON public.company_settings
FOR UPDATE
TO authenticated
USING (
  company_settings.key IN (
    'lead_time_target_days',
    'contract_po_link_prompt_enabled'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = company_settings.company_id
      )
  )
)
WITH CHECK (
  company_settings.key IN (
    'lead_time_target_days',
    'contract_po_link_prompt_enabled'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = company_settings.company_id
      )
  )
);

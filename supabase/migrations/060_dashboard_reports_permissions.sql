-- Migration 060: permissões por widget do Dashboard e seções/exports de Relatórios
-- Seed em grupos de sistema admin, buyer e manager (enabled = true) para não regressar UX.

DO $$
DECLARE
  company uuid;
  g_id uuid;
  role_code text;
  perm_key text;
  dash_report_perms text[] := ARRAY[
    'dashboard.metrics',
    'dashboard.spend_category',
    'dashboard.quotation_status',
    'dashboard.recent_activity',
    'dashboard.lead_time',
    'dashboard.roi',
    'reports.saving',
    'reports.spend',
    'reports.orders',
    'reports.quotations',
    'reports.export.spend_category',
    'reports.export.supplier_performance',
    'reports.export.saving',
    'reports.export.process_time'
  ];
BEGIN
  FOR company IN
    SELECT DISTINCT company_id FROM public.permission_groups
  LOOP
    FOREACH role_code IN ARRAY ARRAY['admin', 'buyer', 'manager']
    LOOP
      SELECT id INTO g_id
      FROM public.permission_groups
      WHERE company_id = company AND code = role_code;

      IF g_id IS NULL THEN
        CONTINUE;
      END IF;

      FOREACH perm_key IN ARRAY dash_report_perms
      LOOP
        INSERT INTO public.permission_group_rules (
          company_id, group_id, permission_key, enabled
        )
        VALUES (company, g_id, perm_key, true)
        ON CONFLICT (group_id, permission_key) DO UPDATE
          SET enabled = true;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

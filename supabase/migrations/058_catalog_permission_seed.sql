-- Migration 058: seed das permissões do Catálogo de Compras nos grupos de sistema
-- Libera nav.catalog / catalog.order / catalog.buyer_review em permission_group_rules
-- para admin, buyer, manager (completos) e requester (sem buyer_review).

DO $$
DECLARE
  company uuid;
  g_id uuid;
  role_code text;
  perm_key text;
  catalog_perms text[] := ARRAY[
    'nav.catalog',
    'catalog.order',
    'catalog.buyer_review'
  ];
  requester_perms text[] := ARRAY[
    'nav.catalog',
    'catalog.order'
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

      FOREACH perm_key IN ARRAY catalog_perms
      LOOP
        INSERT INTO public.permission_group_rules (
          company_id, group_id, permission_key, enabled
        )
        VALUES (company, g_id, perm_key, true)
        ON CONFLICT (group_id, permission_key) DO UPDATE
          SET enabled = true;
      END LOOP;
    END LOOP;

    SELECT id INTO g_id
    FROM public.permission_groups
    WHERE company_id = company AND code = 'requester';

    IF g_id IS NOT NULL THEN
      FOREACH perm_key IN ARRAY requester_perms
      LOOP
        INSERT INTO public.permission_group_rules (
          company_id, group_id, permission_key, enabled
        )
        VALUES (company, g_id, perm_key, true)
        ON CONFLICT (group_id, permission_key) DO UPDATE
          SET enabled = true;
      END LOOP;
    END IF;
  END LOOP;
END $$;

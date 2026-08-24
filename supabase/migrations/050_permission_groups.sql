-- ============================================================
-- 050 — Grupos de permissões (rules) + vínculo por usuário
-- Modelo híbrido: grupos (pacotes) + rules diretas em profile_permissions
-- Migra role_permissions → grupos de sistema e atribui aos usuários pelos roles.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  source_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_permission_groups_company
  ON public.permission_groups (company_id);

CREATE TABLE IF NOT EXISTS public.permission_group_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_permission_group_rules_group
  ON public.permission_group_rules (group_id)
  WHERE enabled = true;

CREATE TABLE IF NOT EXISTS public.profile_permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_permission_groups_user
  ON public.profile_permission_groups (company_id, user_id);

ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_group_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permission_groups ENABLE ROW LEVEL SECURITY;

-- Leitura: mesmo tenant
CREATE POLICY "permission_groups: read same tenant"
ON public.permission_groups FOR SELECT
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "permission_group_rules: read same tenant"
ON public.permission_group_rules FOR SELECT
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "profile_permission_groups: read same tenant"
ON public.profile_permission_groups FOR SELECT
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- Escrita: admin do tenant
CREATE POLICY "permission_groups: admin write"
ON public.permission_groups FOR ALL
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[])))
  )
)
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[])))
  )
);

CREATE POLICY "permission_group_rules: admin write"
ON public.permission_group_rules FOR ALL
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[])))
  )
)
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[])))
  )
);

CREATE POLICY "profile_permission_groups: admin write"
ON public.profile_permission_groups FOR ALL
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[])))
  )
)
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[])))
  )
);

-- ------------------------------------------------------------
-- Seed / migração a partir de role_permissions + profiles.roles
-- ------------------------------------------------------------
DO $$
DECLARE
  role_labels jsonb := '{
    "admin": "Administrador",
    "buyer": "Comprador",
    "manager": "Gestor de Compras",
    "approver_requisition": "Aprov. Requisição",
    "approver_order": "Aprov. Pedido",
    "requester": "Requisitante"
  }'::jsonb;
  r record;
  g_id uuid;
  company uuid;
  role_code text;
  role_name text;
BEGIN
  -- Empresas com role_permissions OU com usuários buyer/admin
  FOR company IN
    SELECT DISTINCT company_id FROM (
      SELECT company_id FROM public.role_permissions
      UNION
      SELECT company_id FROM public.profiles
        WHERE profile_type IS DISTINCT FROM 'supplier'
    ) t
  LOOP
    -- Roles presentes em role_permissions desta empresa
    FOR role_code IN
      SELECT DISTINCT rp.role
      FROM public.role_permissions rp
      WHERE rp.company_id = company
      UNION
      SELECT unnest(ARRAY['admin','buyer','manager','approver_requisition','approver_order','requester'])
    LOOP
      role_name := COALESCE(role_labels ->> role_code, initcap(replace(role_code, '_', ' ')));

      INSERT INTO public.permission_groups (
        company_id, code, name, description, is_system, source_role
      )
      VALUES (
        company,
        role_code,
        role_name,
        'Grupo de sistema migrado do perfil ' || role_name,
        true,
        role_code
      )
      ON CONFLICT (company_id, code) DO UPDATE
        SET name = EXCLUDED.name,
            is_system = true,
            source_role = EXCLUDED.source_role,
            updated_at = now()
      RETURNING id INTO g_id;

      SELECT id INTO g_id
      FROM public.permission_groups
      WHERE company_id = company AND code = role_code;

      -- Copiar rules habilitadas do role_permissions
      INSERT INTO public.permission_group_rules (
        company_id, group_id, permission_key, enabled
      )
      SELECT company, g_id, rp.permission_key, rp.enabled
      FROM public.role_permissions rp
      WHERE rp.company_id = company
        AND rp.role = role_code
        AND rp.enabled = true
      ON CONFLICT (group_id, permission_key) DO UPDATE
        SET enabled = EXCLUDED.enabled;
    END LOOP;

    -- Atribuir grupos aos usuários conforme profiles.roles / role
    FOR r IN
      SELECT p.id AS user_id, COALESCE(p.roles, ARRAY[p.role]::text[]) AS user_roles
      FROM public.profiles p
      WHERE p.company_id = company
        AND p.profile_type IS DISTINCT FROM 'supplier'
    LOOP
      FOREACH role_code IN ARRAY r.user_roles
      LOOP
        SELECT id INTO g_id
        FROM public.permission_groups
        WHERE company_id = company AND code = role_code;

        IF g_id IS NOT NULL THEN
          INSERT INTO public.profile_permission_groups (company_id, user_id, group_id)
          VALUES (company, r.user_id, g_id)
          ON CONFLICT (company_id, user_id, group_id) DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

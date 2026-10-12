-- 085: impedir auto-escalação via UPDATE no próprio profiles
-- Política "Users can update only their own profile" (001) só exige id = auth.uid(),
-- sem restrição de coluna. Sessão authenticated podia gravar is_superadmin,
-- company_id, roles, profile_type, supplier_id, status, etc.
-- service_role (APIs admin / convite / create-user) continua podendo alterar.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só aplica em sessão de usuário (JWT com sub).
  -- service_role, postgres e jobs internos não têm auth.uid().
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.is_superadmin IS DISTINCT FROM OLD.is_superadmin
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.roles IS DISTINCT FROM OLD.roles
     OR NEW.profile_type IS DISTINCT FROM OLD.profile_type
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.is_supplier_admin IS DISTINCT FROM OLD.is_supplier_admin
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.cost_center_id IS DISTINCT FROM OLD.cost_center_id
     OR NEW.login_cnpj IS DISTINCT FROM OLD.login_cnpj
  THEN
    RAISE EXCEPTION 'Alteração de campos privilegiados do perfil não é permitida'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

COMMENT ON FUNCTION public.protect_profile_privileged_columns() IS
  'Bloqueia UPDATE autenticado de colunas de identidade/privilégio em profiles. Self-update de nome/avatar/contato permanece permitido.';

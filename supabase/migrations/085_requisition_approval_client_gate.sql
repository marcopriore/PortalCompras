-- 085: impedir que JWT do solicitante/comprador aprove (ou avance) REQ pending
-- quando a alçada de requisição está ativa.
--
-- Políticas atuais:
-- - "requisitions: requester auto aprova" (053) — pending → approved sem checar o módulo
-- - "requisitions: buyer atualiza status" (062) — qualquer status, inclusive pending → approved
--
-- Auto-aprovação legítima (módulo off / sem regra de CC) continua permitida no cliente.
-- Decisão do gestor e ERP usam service role (auth.uid() nulo) e não passam por este gate.

CREATE OR REPLACE FUNCTION public.get_approver_for_requisition(
  p_company_id uuid,
  p_cost_center text DEFAULT '*'
)
RETURNS TABLE (approver_id uuid, approver_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT al.approver_id, al.approver_name
  FROM public.approval_levels al
  WHERE al.company_id = p_company_id
    AND al.flow = 'requisition'
    AND al.approver_id IS NOT NULL
    AND (
      al.cost_center = p_cost_center
      OR al.cost_center = '*'
      OR al.cost_center IS NULL
    )
  ORDER BY
    CASE
      WHEN al.cost_center = p_cost_center THEN 0
      WHEN al.cost_center = '*' OR al.cost_center IS NULL THEN 1
      ELSE 2
    END,
    al.created_at ASC NULLS LAST
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_approver_for_requisition(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_approver_for_requisition(uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.requisition_requires_manual_approval(
  p_company_id uuid,
  p_cost_center text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_approver uuid;
  v_cc text;
BEGIN
  SELECT tf.enabled INTO v_enabled
  FROM public.tenant_features tf
  WHERE tf.company_id = p_company_id
    AND tf.feature_key = 'approval_requisition'
  LIMIT 1;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN false;
  END IF;

  v_cc := COALESCE(NULLIF(trim(p_cost_center), ''), '*');

  SELECT g.approver_id INTO v_approver
  FROM public.get_approver_for_requisition(p_company_id, v_cc) AS g
  LIMIT 1;

  RETURN v_approver IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.requisition_requires_manual_approval(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_requires_manual_approval(uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_enforce_requisition_approval_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- service_role / jobs: JWT sem sub → auth.uid() nulo
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status NOT IN ('pending', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('pending', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Usa OLD.cost_center para o atacante não trocar o CC na mesma UPDATE
  IF NEW.status = 'approved'
     AND NOT public.requisition_requires_manual_approval(
       OLD.company_id,
       OLD.cost_center
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Requisição pendente de alçada não pode ser aprovada ou avançada sem o gestor'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_requisition_approval_gate ON public.requisitions;
CREATE TRIGGER trg_enforce_requisition_approval_gate
  BEFORE UPDATE OF status ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_requisition_approval_gate();

DROP POLICY IF EXISTS "requisitions: requester auto aprova" ON public.requisitions;
CREATE POLICY "requisitions: requester auto aprova"
ON public.requisitions FOR UPDATE
USING (
  requester_id = auth.uid()
  AND status = 'pending'
  AND NOT public.requisition_requires_manual_approval(company_id, cost_center)
)
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'approved'
  AND NOT public.requisition_requires_manual_approval(company_id, cost_center)
);

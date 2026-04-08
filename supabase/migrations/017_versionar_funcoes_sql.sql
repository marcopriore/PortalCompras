-- Migration: 017_versionar_funcoes_sql.sql
-- Versiona funções SQL que existiam apenas na instância Supabase.
-- Gerado em: 2026-04-08

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_my_supplier_id()
--    Retorna o supplier_id do usuário autenticado (perfil fornecedor).
--    Usada nas RLS do portal fornecedor.
--    SECURITY DEFINER + STABLE para performance em políticas RLS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_supplier_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT supplier_id FROM profiles
  WHERE id = auth.uid()
    AND profile_type = 'supplier'
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. close_expired_rounds()
--    Fecha rodadas de negociação com prazo vencido (response_deadline < hoje).
--    Chamada periodicamente via proxy.ts.
--    Retorna quantidade de rodadas fechadas.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_expired_rounds()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE quotation_rounds
  SET
    status = 'closed',
    closed_at = now()
  WHERE
    status = 'active'
    AND response_deadline IS NOT NULL
    AND response_deadline < CURRENT_DATE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. check_round_completion()
--    Trigger function: ao atualizar uma proposta, verifica se todos os
--    fornecedores convidados na rodada já submeteram resposta.
--    Se sim, fecha a rodada automaticamente (status = 'closed').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_round_completion()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id uuid;
  v_total_invited int;
  v_total_submitted int;
BEGIN
  -- Pega o round_id da proposta recém-atualizada
  v_round_id := NEW.round_id;

  -- Conta fornecedores convidados nessa rodada
  SELECT COUNT(*) INTO v_total_invited
  FROM quotation_proposals
  WHERE round_id = v_round_id;

  -- Conta fornecedores que já submeteram proposta
  SELECT COUNT(*) INTO v_total_submitted
  FROM quotation_proposals
  WHERE round_id = v_round_id
    AND status = 'submitted';

  -- Se todos responderam, fecha a rodada
  IF v_total_invited > 0 AND v_total_invited = v_total_submitted THEN
    UPDATE quotation_rounds
    SET status = 'closed',
        closed_at = now()
    WHERE id = v_round_id
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota: o trigger que chama check_round_completion() deve existir na instância.
-- Verificar com:
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--   WHERE tgfoid = 'public.check_round_completion'::regproc;
-- Se não existir, recriar com:
--   CREATE TRIGGER trg_check_round_completion
--   AFTER UPDATE ON public.quotation_proposals
--   FOR EACH ROW EXECUTE FUNCTION public.check_round_completion();
-- ─────────────────────────────────────────────────────────────────────────────

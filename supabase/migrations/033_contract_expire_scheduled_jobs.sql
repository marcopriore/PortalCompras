-- Expira contratos ativos com end_date no passado + controle de jobs agendados

CREATE TABLE IF NOT EXISTS public.scheduled_job_runs (
  job_key     text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.expire_overdue_contracts()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE contracts
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

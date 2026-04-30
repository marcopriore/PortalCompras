CREATE TABLE public.ai_analysis_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL,
  entity         text NOT NULL,
  entity_id      uuid NOT NULL,
  analysis_type  text NOT NULL,
  prompt         text NOT NULL,
  response       text NOT NULL,
  model          text NOT NULL,
  input_tokens   integer,
  output_tokens  integer,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_analysis_logs_entity 
  ON public.ai_analysis_logs(entity, entity_id);
CREATE INDEX idx_ai_analysis_logs_company 
  ON public.ai_analysis_logs(company_id);

ALTER TABLE public.ai_analysis_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_analysis_logs: leitura por tenant"
  ON public.ai_analysis_logs FOR SELECT
  USING (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "ai_analysis_logs: insert por tenant"
  ON public.ai_analysis_logs FOR INSERT
  WITH CHECK (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));
CREATE TABLE IF NOT EXISTS public.requisition_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  content_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requisition_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requisition_attachments: tenant select"
  ON public.requisition_attachments FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "requisition_attachments: tenant insert"
  ON public.requisition_attachments FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "requisition_attachments: tenant delete"
  ON public.requisition_attachments FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_requisition_attachments_requisition
  ON public.requisition_attachments (requisition_id);

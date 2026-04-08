-- Catálogo: origem / última sincronização + log de importação Excel

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS sync_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS items_company_code_unique
  ON public.items (company_id, code);

CREATE TABLE IF NOT EXISTS public.item_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  imported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'excel',
  total_rows int NOT NULL DEFAULT 0,
  success int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  error_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_import_logs_company_created
  ON public.item_import_logs (company_id, created_at DESC);

ALTER TABLE public.item_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_import_logs_select_company"
ON public.item_import_logs
FOR SELECT
TO authenticated
USING (
  company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "item_import_logs_insert_company"
ON public.item_import_logs
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

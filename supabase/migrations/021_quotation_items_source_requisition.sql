ALTER TABLE public.quotation_items
ADD COLUMN IF NOT EXISTS source_requisition_code text DEFAULT NULL;

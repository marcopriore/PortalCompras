-- Status 'refused' (recusado pelo fornecedor) e justificativa de alteração de data
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS delivery_date_change_reason text;

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'draft'::text,
        'processing'::text,
        'sent'::text,
        'refused'::text,
        'error'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  );

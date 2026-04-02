-- Portal do fornecedor: vínculo e ciclo de vida do pedido
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS accepted_by_supplier boolean DEFAULT false;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id
  ON public.purchase_orders (supplier_id)
  WHERE supplier_id IS NOT NULL;

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'draft'::text,
        'processing'::text,
        'sent'::text,
        'error'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  );

-- Fornecedor: leitura dos próprios pedidos
CREATE POLICY "Supplier reads own purchase_orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND p.supplier_id = purchase_orders.supplier_id
  )
);

-- Fornecedor: atualizar pedidos atribuídos (aceite, datas, cancelamento pelo fornecedor)
CREATE POLICY "Supplier updates own purchase_orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND p.supplier_id = purchase_orders.supplier_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND p.supplier_id = purchase_orders.supplier_id
  )
);

-- Itens do pedido visíveis ao fornecedor do pedido
CREATE POLICY "Supplier reads items of own purchase_orders"
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.purchase_orders po ON po.id = purchase_order_items.purchase_order_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND po.supplier_id = p.supplier_id
  )
);

-- Nome/CNPJ do cliente (empresa compradora) para o fornecedor ver pedidos
CREATE POLICY "Supplier reads companies linked to own purchase_orders"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.purchase_orders po
      ON po.company_id = companies.id
     AND po.supplier_id = p.supplier_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
  )
);

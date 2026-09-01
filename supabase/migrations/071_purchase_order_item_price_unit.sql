-- 071 — POR (preço por unidade de medida) em linhas de pedido

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS price_unit integer NOT NULL DEFAULT 1;

ALTER TABLE purchase_order_items
  DROP CONSTRAINT IF EXISTS purchase_order_items_price_unit_check;

ALTER TABLE purchase_order_items
  ADD CONSTRAINT purchase_order_items_price_unit_check
  CHECK (price_unit IN (1, 10, 100, 1000, 10000));

COMMENT ON COLUMN purchase_order_items.price_unit IS
  'Unidade de preço (POR): preço unitário refere-se a N unidades de medida (1, 10, 100, 1000, 10000).';

-- Migration: 023_saving_module_item_prices.sql
-- Módulo Saving: campos de preço em items/quotation_items + triggers.
-- Aplicar no Supabase SQL Editor (ou supabase db push) no projeto desejado.

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1 — Campos em items
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS target_price NUMERIC(15, 4) NULL,
  ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC(15, 4) NULL,
  ADD COLUMN IF NOT EXISTS last_purchase_date DATE NULL,
  ADD COLUMN IF NOT EXISTS average_price NUMERIC(15, 4) NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2 — Campos em quotation_items
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS target_price NUMERIC(15, 4) NULL,
  ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC(15, 4) NULL,
  ADD COLUMN IF NOT EXISTS average_price NUMERIC(15, 4) NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 3 — Atualizar catálogo quando pedido muda de status (transição para sent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_item_prices_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_material_code TEXT;
  v_company_id UUID;
  v_unit_price NUMERIC;
  v_quantity NUMERIC;
  v_last_date DATE;
  v_avg_price NUMERIC;
  v_total_qty NUMERIC;
  v_total_value NUMERIC;
BEGIN
  IF NEW.status NOT IN ('sent', 'processing', 'completed') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'sent' AND NEW.status IN ('processing', 'completed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'processing' AND NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_company_id := NEW.company_id;

  FOR v_item IN
    SELECT
      poi.material_code,
      poi.unit_price,
      poi.quantity
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id
      AND poi.unit_price IS NOT NULL
      AND poi.unit_price > 0
      AND poi.material_code IS NOT NULL
  LOOP
    v_material_code := v_item.material_code;
    v_unit_price := v_item.unit_price;
    v_quantity := COALESCE(v_item.quantity, 1);

    SELECT
      SUM(poi2.unit_price * poi2.quantity),
      SUM(poi2.quantity)
    INTO v_total_value, v_total_qty
    FROM public.purchase_order_items poi2
    INNER JOIN public.purchase_orders po2 ON po2.id = poi2.purchase_order_id
    WHERE poi2.material_code = v_material_code
      AND po2.company_id = v_company_id
      AND po2.status IN ('sent', 'processing', 'completed')
      AND poi2.unit_price IS NOT NULL
      AND poi2.unit_price > 0;

    IF v_total_qty > 0 THEN
      v_avg_price := ROUND(v_total_value / v_total_qty, 4);
    ELSE
      v_avg_price := v_unit_price;
    END IF;

    v_last_date := COALESCE(NEW.created_at::DATE, CURRENT_DATE);

    UPDATE public.items
    SET
      last_purchase_price = v_unit_price,
      last_purchase_date = v_last_date,
      average_price = v_avg_price
    WHERE company_id = v_company_id
      AND code = v_material_code;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_item_prices ON public.purchase_orders;
CREATE TRIGGER trg_update_item_prices
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_prices_on_order();

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 4 — Herdar preços do catálogo ao inserir quotation_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inherit_item_prices_on_quotation_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_price NUMERIC(15, 4);
  v_last_purchase_price NUMERIC(15, 4);
  v_average_price NUMERIC(15, 4);
BEGIN
  SELECT i.target_price, i.last_purchase_price, i.average_price
  INTO v_target_price, v_last_purchase_price, v_average_price
  FROM public.items i
  WHERE i.company_id = NEW.company_id
    AND i.code = NEW.material_code;

  IF FOUND THEN
    NEW.target_price := COALESCE(NEW.target_price, v_target_price);
    NEW.last_purchase_price := v_last_purchase_price;
    NEW.average_price := v_average_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_item_prices ON public.quotation_items;
CREATE TRIGGER trg_inherit_item_prices
  BEFORE INSERT ON public.quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION public.inherit_item_prices_on_quotation_item();

-- PASSO 5 (manual no SQL Editor):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('items', 'quotation_items')
--   AND column_name IN ('target_price', 'last_purchase_price', 'average_price', 'last_purchase_date')
-- ORDER BY table_name, column_name;
--
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name IN ('trg_update_item_prices', 'trg_inherit_item_prices')
-- ORDER BY trigger_name;

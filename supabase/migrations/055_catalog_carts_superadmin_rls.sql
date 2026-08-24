-- Fix RLS catálogo: superadmin opera em tenant via cookie (selected_company_id)

DROP POLICY IF EXISTS "catalog_carts: own user" ON public.catalog_carts;
CREATE POLICY "catalog_carts: own user"
ON public.catalog_carts FOR ALL
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_superadmin, false) = true
    )
    OR company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "catalog_cart_items: own cart" ON public.catalog_cart_items;
CREATE POLICY "catalog_cart_items: own cart"
ON public.catalog_cart_items FOR ALL
USING (
  cart_id IN (SELECT c.id FROM public.catalog_carts c WHERE c.user_id = auth.uid())
)
WITH CHECK (
  cart_id IN (SELECT c.id FROM public.catalog_carts c WHERE c.user_id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_superadmin, false) = true
    )
    OR company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- Notificações in-app por usuário/tenant
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations(id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  entity text,
  entity_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_company
  ON public.notifications (company_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Remetente no mesmo tenant; destinatário deve pertencer à mesma empresa da linha
CREATE POLICY "Users insert notifications for same-company recipients"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = user_id
      AND pr.company_id = company_id
  )
);

-- Tipo de portal: comprador (buyer) ou fornecedor (supplier)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'buyer';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_type_check
  CHECK (profile_type IN ('buyer', 'supplier'));

UPDATE public.profiles SET profile_type = 'buyer' WHERE profile_type IS NULL;

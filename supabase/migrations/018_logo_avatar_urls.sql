ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;

-- Descrição detalhada no catálogo e snapshot na cotação
alter table public.items add column if not exists long_description text;

alter table public.quotation_items add column if not exists long_description text;

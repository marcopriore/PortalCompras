create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  code text not null,
  description text not null,
  status text not null default 'draft',
  category text,
  payment_condition text,
  response_deadline date not null,
  attachment_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  material_code text not null,
  material_description text not null,
  unit_of_measure text,
  quantity numeric not null,
  complementary_spec text,
  created_at timestamptz default now(),
  constraint quotation_items_complementary_spec_length check (char_length(complementary_spec) <= 2000)
);

create table public.quotation_suppliers (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  supplier_id uuid not null,
  supplier_name text not null,
  supplier_cnpj text,
  created_at timestamptz default now()
);

create or replace function public.generate_quotation_code()
returns trigger
language plpgsql
as $$
declare
  year_text text := to_char(current_date, 'YYYY');
  seq int;
begin
  select coalesce(max(substring(q.code from 10 for 4)::int), 0) + 1
  into seq
  from public.quotations q
  where q.company_id = new.company_id
    and substring(q.code from 5 for 4) = year_text;

  new.code := format('COT-%s-%s', year_text, lpad(seq::text, 4, '0'));

  return new;
end;
$$;

create trigger quotations_generate_code
before insert on public.quotations
for each row
execute function public.generate_quotation_code();

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'update_updated_at_column'
      and pg_function_is_visible(oid)
  ) then
    create or replace function public.update_updated_at_column()
    returns trigger
    language plpgsql
    as $func$
    begin
      new.updated_at = now();
      return new;
    end;
    $func$;
  end if;
end;
$$;

create trigger quotations_set_updated_at
before update on public.quotations
for each row
execute function public.update_updated_at_column();

alter table public.quotations enable row level security;

create policy "Quotations are readable only within user's company"
on public.quotations
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotations.company_id
  )
);

create policy "Quotations are insertable only within user's company"
on public.quotations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotations.company_id
  )
);

create policy "Quotations are updatable only within user's company"
on public.quotations
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotations.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotations.company_id
  )
);

create policy "Quotations are deletable only within user's company"
on public.quotations
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotations.company_id
  )
);

alter table public.quotation_items enable row level security;

create policy "Quotation items are readable only within user's company"
on public.quotation_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_items.company_id
  )
);

create policy "Quotation items are insertable only within user's company"
on public.quotation_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_items.company_id
  )
);

create policy "Quotation items are updatable only within user's company"
on public.quotation_items
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_items.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_items.company_id
  )
);

create policy "Quotation items are deletable only within user's company"
on public.quotation_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_items.company_id
  )
);

alter table public.quotation_suppliers enable row level security;

create policy "Quotation suppliers are readable only within user's company"
on public.quotation_suppliers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_suppliers.company_id
  )
);

create policy "Quotation suppliers are insertable only within user's company"
on public.quotation_suppliers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_suppliers.company_id
  )
);

create policy "Quotation suppliers are updatable only within user's company"
on public.quotation_suppliers
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_suppliers.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_suppliers.company_id
  )
);

create policy "Quotation suppliers are deletable only within user's company"
on public.quotation_suppliers
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = quotation_suppliers.company_id
  )
);


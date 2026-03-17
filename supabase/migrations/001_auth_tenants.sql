-- Tabela de empresas (tenants)
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text unique,
  status text not null default 'active',
  created_at timestamptz default now()
);

-- Tabela de perfis de usuário
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  full_name text,
  role text not null default 'buyer',
  status text not null default 'active',
  created_at timestamptz default now()
);

-- Função para auto-criar perfil ao registrar usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
as $$
begin
  insert into public.profiles (id, company_id, full_name)
  values (
    new.id,
    (new.raw_user_meta_data->>'company_id')::uuid,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );

  return new;
end;
$$;

-- Trigger para chamar handle_new_user após inserir em auth.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- RLS para companies
alter table public.companies enable row level security;

create policy "Companies are visible only to users with a profile in them"
on public.companies
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = companies.id
  )
);

-- RLS para profiles
alter table public.profiles enable row level security;

create policy "Profiles are visible only within same company"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p_self
    where p_self.id = auth.uid()
      and p_self.company_id = profiles.company_id
  )
);

create policy "Users can update only their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());


-- Livro-caixa — schema do banco de dados
-- Cole este script inteiro no Supabase: SQL Editor → New query → Run

create table public.recurring (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  descricao text not null default '',
  dia int not null default 1,
  valor numeric not null default 0
);

create table public.expenses (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recurring_id text references public.recurring(id) on delete set null,
  mes int not null,
  ano int not null,
  descricao text not null default '',
  dia int not null default 1,
  valor numeric not null default 0,
  pago boolean not null default false
);

create table public.income_categories (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null
);

create table public.incomes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria text not null,
  mes int not null,
  ano int not null,
  dia int not null default 1,
  valor numeric not null default 0
);

-- Segurança: cada pessoa só enxerga e mexe nas próprias linhas
alter table public.recurring enable row level security;
alter table public.expenses enable row level security;
alter table public.income_categories enable row level security;
alter table public.incomes enable row level security;

create policy "own rows only" on public.recurring
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.income_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

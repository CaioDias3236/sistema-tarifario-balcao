-- ============================================================================
-- Vantagens Locadora — schema de preparação para o Supabase
-- NÃO integrado ainda. Rodar manualmente no SQL Editor do Supabase quando
-- formos migrar a persistência local (db.json / Express) para o banco.
-- ============================================================================

create table if not exists public.vantagens (
  id          bigint generated always as identity primary key,
  descricao   text        not null,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- Row Level Security (mesma lógica do resto do app: papel vem da tabela perfis)
alter table public.vantagens enable row level security;

-- Leitura: qualquer usuário autenticado pode listar as vantagens.
create policy "vantagens_select_autenticado"
  on public.vantagens
  for select
  to authenticated
  using (true);

-- Escrita (insert/update/delete): apenas SUPERVISOR.
create policy "vantagens_write_supervisor"
  on public.vantagens
  for all
  to authenticated
  using (
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and upper(p.role) = 'SUPERVISOR'
    )
  )
  with check (
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and upper(p.role) = 'SUPERVISOR'
    )
  );

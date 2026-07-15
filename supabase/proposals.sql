-- ============================================================================
-- Migração de proposals (histórico de propostas) do db.json para o Supabase
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar mais de uma vez).
--
-- Notas (mesmas convenções dos demais arquivos):
--  - Colunas em camelCase ("clientName", "clientPhone", "createdBy") vão entre
--    aspas, senão o Postgres rebaixa para minúsculas e o frontend leria undefined.
--  - Sem seed: o histórico começa vazio e é alimentado pela tela do Vendedor.
--  - O backend fala com o banco via service_role (ignora RLS); por isso o POST
--    do VENDEDOR funciona mesmo com a política de escrita restrita a SUPERVISOR
--    abaixo (que só protege acessos diretos com a anon key). A listagem/filtro
--    por papel é feita no server.ts, não no RLS.
-- ============================================================================

-- ---------- proposals ----------
create table if not exists public.proposals (
  id            bigint generated always as identity primary key,
  "clientName"  text        not null,
  "clientPhone" text        not null default '',
  "createdBy"   text        not null default '',
  user_id       text        not null default '',
  created_at    timestamptz not null default now()
);

-- ---------- RLS: leitura para autenticados, escrita só para SUPERVISOR ----------
alter table public.proposals enable row level security;

drop policy if exists proposals_select_autenticado on public.proposals;
create policy proposals_select_autenticado on public.proposals
  for select to authenticated using (true);

drop policy if exists proposals_write_supervisor on public.proposals;
create policy proposals_write_supervisor on public.proposals
  for all to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and upper(p.role) = 'SUPERVISOR'))
  with check (exists (select 1 from public.perfis p where p.id = auth.uid() and upper(p.role) = 'SUPERVISOR'));

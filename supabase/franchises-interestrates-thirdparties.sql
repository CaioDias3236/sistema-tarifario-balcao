-- ============================================================================
-- Migração de franchises, interestRates e thirdParties do db.json para o Supabase
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar mais de uma vez).
--
-- Notas (mesmas convenções de categorias-taxas-regras.sql):
--  - As colunas espelham EXATAMENTE as chaves do frontend. Aqui são todas
--    minúsculas de uma palavra (combo, valor, parcelas, taxa, de, ate), então
--    não precisam de aspas.
--  - Valores monetários/percentuais usam double precision (não numeric): o
--    PostgREST devolve numeric como STRING e quebraria o .toFixed()/cálculos.
--  - O backend fala com o banco via service_role (ignora RLS); as políticas
--    abaixo protegem acessos diretos com a anon key, igual aos demais.
--  - Nomes de tabela: interest_rates / third_parties (snake_case) para evitar
--    aspas; o endpoint da API continua interest-rates / third-parties.
-- ============================================================================

-- ---------- franchises ----------
create table if not exists public.franchises (
  id         bigint generated always as identity primary key,
  combo      text             not null,
  tipo       text             not null default 'padrao',
  valor      double precision not null default 0,
  created_at timestamptz      not null default now()
);

-- ---------- interest_rates ----------
create table if not exists public.interest_rates (
  id         bigint generated always as identity primary key,
  parcelas   integer          not null default 1,
  taxa       double precision not null default 0,
  created_at timestamptz      not null default now()
);

-- ---------- third_parties ----------
create table if not exists public.third_parties (
  id         bigint generated always as identity primary key,
  de         integer          not null default 0,
  ate        integer          not null default 0,
  valor      double precision not null default 0,
  created_at timestamptz      not null default now()
);

-- ---------- Seed (só quando a tabela está vazia) ----------
insert into public.franchises (combo, tipo, valor)
select v.combo, v.tipo, v.valor from (values
  ('REDUZIDA', 'padrao', 50),
  ('REDUZIDA', 'alcada', 40),
  ('ZERO',     'padrao', 100),
  ('ZERO',     'alcada', 80)
) as v(combo, tipo, valor)
where not exists (select 1 from public.franchises);

insert into public.interest_rates (parcelas, taxa)
select v.parcelas, v.taxa from (values
  (1, 0),
  (2, 3),
  (3, 5),
  (4, 6),
  (5, 8),
  (6, 10)
) as v(parcelas, taxa)
where not exists (select 1 from public.interest_rates);

insert into public.third_parties (de, ate, valor)
select v.de, v.ate, v.valor from (values
  (1, 999, 20)
) as v(de, ate, valor)
where not exists (select 1 from public.third_parties);

-- ---------- RLS: leitura para autenticados, escrita só para SUPERVISOR ----------
do $$
declare t text;
begin
  foreach t in array array['franchises', 'interest_rates', 'third_parties'] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I on public.%I;', t || '_select_autenticado', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true);',
      t || '_select_autenticado', t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_write_supervisor', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (exists (select 1 from public.perfis p where p.id = auth.uid() and upper(p.role) = ''SUPERVISOR'')) '
      'with check (exists (select 1 from public.perfis p where p.id = auth.uid() and upper(p.role) = ''SUPERVISOR''));',
      t || '_write_supervisor', t
    );
  end loop;
end $$;

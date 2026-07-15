-- ============================================================================
-- Migração de categories, taxes e rules do db.json para o Supabase
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar mais de uma vez).
--
-- Notas:
--  - As colunas espelham EXATAMENTE as chaves que o frontend usa. "cobrancaDias"
--    está em camelCase, por isso vai entre aspas (senão o Postgres rebaixa para
--    minúsculas e o client leria undefined).
--  - Valores monetários usam double precision (não numeric): o PostgREST devolve
--    numeric como STRING, o que quebraria o .toFixed() do Vendedor.
--  - O backend fala com o banco via service_role (ignora RLS); as políticas
--    abaixo protegem acessos diretos com a anon key, igual ao vantagens.
-- ============================================================================

-- ---------- categories ----------
create table if not exists public.categories (
  id         bigint generated always as identity primary key,
  sigla      text             not null,
  padrao     double precision not null default 0,
  piso       double precision not null default 0,
  active     boolean          not null default true,
  created_at timestamptz      not null default now()
);

-- ---------- taxes ----------
create table if not exists public.taxes (
  id         bigint generated always as identity primary key,
  nome       text             not null,
  valor      double precision not null default 0,
  tipo       text             not null default 'fixo',
  flex_mode  boolean          not null default false,
  flex_value double precision not null default 0,
  active     boolean          not null default true,
  created_at timestamptz      not null default now()
);

-- ---------- rules ----------
create table if not exists public.rules (
  id             bigint generated always as identity primary key,
  campo          text             not null,
  de             integer          not null default 0,
  ate            integer          not null default 0,
  "cobrancaDias" double precision not null default 0,
  texto          text             not null default '',
  created_at     timestamptz      not null default now()
);

-- ---------- Seed (só quando a tabela está vazia) ----------
insert into public.categories (sigla, padrao, piso, active)
select v.sigla, v.padrao, v.piso, v.active from (values
  ('C', 100, 80, true),
  ('M', 120, 90, true),
  ('S', 150, 110, true),
  ('LX', 200, 150, true),
  ('D', 300, 250, true)
) as v(sigla, padrao, piso, active)
where not exists (select 1 from public.categories);

insert into public.taxes (nome, valor, tipo, flex_mode, flex_value, active)
select v.nome, v.valor, v.tipo, v.flex_mode, v.flex_value, v.active from (values
  ('Lavagem Padrão', 38, 'fixo', false, 0, true),
  ('Retorno entre Lojas', 90, 'fixo', false, 0, true),
  ('Taxa Balcão', 0, 'flex', true, 0, true)
) as v(nome, valor, tipo, flex_mode, flex_value, active)
where not exists (select 1 from public.taxes);

insert into public.rules (campo, de, ate, "cobrancaDias", texto)
select v.campo, v.de, v.ate, v."cobrancaDias", v.texto from (values
  ('dias', 16, 999, 0, '⚠️ CUIDADO COM ALUGUEL: Contratos longos requerem checagem de cadastro estrito.'),
  ('horas', 0, 3, 0, 'ℹ️ Tolerância comercial: Período curto de relógio. Não cobrar hora extra.'),
  ('horas', 4, 6, 0.5, '🌓 Meia Diária Ativada: Rebarba de relógio gera acréscimo de 0.5 diária no contrato.'),
  ('horas', 7, 999, 1, '🚨 Outra Diária Integrada: Limite de tolerância estourado. Cobrança de 1 diária extra.')
) as v(campo, de, ate, "cobrancaDias", texto)
where not exists (select 1 from public.rules);

-- ---------- RLS: leitura para autenticados, escrita só para SUPERVISOR ----------
do $$
declare t text;
begin
  foreach t in array array['categories', 'taxes', 'rules'] loop
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

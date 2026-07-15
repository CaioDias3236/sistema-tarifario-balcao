-- ============================================================================
-- Migração de settings (minuta/contrato) do db.json para o Supabase
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar mais de uma vez).
--
-- Notas (mesmas convenções dos demais arquivos):
--  - "apeloComercial" é camelCase, por isso vai entre aspas (senão o Postgres
--    rebaixa para minúsculas e o frontend leria undefined). "template" e "key"
--    são minúsculas de uma palavra e não precisam de aspas.
--  - Só há uma linha (key='minuta'); o Supervisor edita template + apeloComercial.
--  - Backend fala via service_role (ignora RLS); as políticas protegem acessos
--    diretos com a anon key, igual aos demais.
-- ============================================================================

-- ---------- settings ----------
create table if not exists public.settings (
  id               bigint generated always as identity primary key,
  key              text        not null,
  template         text        not null default '',
  "apeloComercial" text        not null default '',
  created_at       timestamptz not null default now()
);

-- ---------- Seed (só quando a tabela está vazia) ----------
insert into public.settings (key, template, "apeloComercial")
select v.key, v.template, v."apeloComercial" from (values
  (
    'minuta',
    'FEITO POR {{FEITO_POR}} - COMPOSIÇÃO DO FECHAMENTO: [{{PAGTO_BREAKDOWN}}] - KM LIVRE COM COBERTURA PARA NATAL E LITORAL/RN COM PROTEÇÃO COM RAIO DE 200KM DE NATAL/RN. ATENÇÃO PRORROGAÇÃO DE CONTRATO SOMENTE EM LOJA PARA VERIFICARMOS. DEVOLUÇÃO MESMO LOCAL DA RETIRADA - OBS EXTRA: {{OBS_EXTRA}}',
    '🚨 RISCO CIVIL PATRIMONIAL ATIVADO: Contrato sem amparo de frota! O locatário assume responsabilidade integral com o próprio patrimônio por danos causados a terceiros.'
  )
) as v(key, template, "apeloComercial")
where not exists (select 1 from public.settings);

-- ---------- RLS: leitura para autenticados, escrita só para SUPERVISOR ----------
alter table public.settings enable row level security;

drop policy if exists settings_select_autenticado on public.settings;
create policy settings_select_autenticado on public.settings
  for select to authenticated using (true);

drop policy if exists settings_write_supervisor on public.settings;
create policy settings_write_supervisor on public.settings
  for all to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and upper(p.role) = 'SUPERVISOR'))
  with check (exists (select 1 from public.perfis p where p.id = auth.uid() and upper(p.role) = 'SUPERVISOR'));

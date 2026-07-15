import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Button } from '@/src/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/table';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Save, Sun, Moon, Pencil, Check, X } from 'lucide-react';

// Célula que alterna entre modo leitura (texto) e edição (campo). Mantém os mesmos
// value/onChange do call site; `display` permite mostrar um rótulo amigável no modo leitura.
function EditableCell({ editing, value, onChange, type = 'text', display, ...rest }: any) {
  if (!editing) {
    const shown = display ?? (value === '' || value === null || value === undefined ? '—' : value);
    return <span className="text-zinc-300">{shown}</span>;
  }
  return <Input type={type} value={value} onChange={onChange} {...rest} />;
}

const TIPO_LABEL: Record<string, string> = { fixo: 'Fixo', diario: 'Diário', flex: 'Flexível' };
const CAMPO_LABEL: Record<string, string> = { dias: 'Dias', horas: 'Horas' };
const ROLE_LABEL: Record<string, string> = { VENDEDOR: 'Vendedor', SUPERVISOR: 'Supervisor' };

export default function Supervisor({ user }: { user: any }) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [thirdParties, setThirdParties] = useState<any[]>([]);
  const [interestRates, setInterestRates] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [vantagens, setVantagens] = useState<any[]>([]);
  const [novaVantagem, setNovaVantagem] = useState('');
  const [propostas, setPropostas] = useState<any[]>([]);
  const [novoUsuario, setNovoUsuario] = useState({ name: '', login: '', password: '', role: 'VENDEDOR', loginTouched: false });

  // Linhas em modo edição: chave `${endpoint}:${id}`.
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  // Toasts discretos (canto inferior direito), removidos sozinhos.
  const [toasts, setToasts] = useState<{ id: number; type: 'success' | 'error'; msg: string }[]>([]);

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [c, t, f, tp, ir, r, u, s, v, p] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/taxes').then(r => r.json()),
      fetch('/api/franchises').then(r => r.json()),
      fetch('/api/third-parties').then(r => r.json()),
      fetch('/api/interest-rates').then(r => r.json()),
      fetch('/api/rules').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/vantagens').then(r => r.json()),
      fetch('/api/proposals').then(r => r.json())
    ]);
    setCategories(Array.isArray(c) ? c : []);
    setTaxes(Array.isArray(t) ? t : []);
    setFranchises(Array.isArray(f) ? f : []);
    setThirdParties(Array.isArray(tp) ? tp : []);
    setInterestRates(Array.isArray(ir) ? ir : []);
    setRules(Array.isArray(r) ? r : []);
    setUsers(Array.isArray(u) ? u : []);
    setSettings(Array.isArray(s) ? s : []);
    setVantagens(Array.isArray(v) ? v : []);
    setPropostas(Array.isArray(p) ? p : []);
  };

  // --- Toasts -------------------------------------------------------------
  const notify = (type: 'success' | 'error', msg: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
  };

  // --- Modo edição por linha ----------------------------------------------
  const isEditing = (endpoint: string, id: any) => !!editing[`${endpoint}:${id}`];
  const toggleEdit = (endpoint: string, id: any) =>
    setEditing(prev => ({ ...prev, [`${endpoint}:${id}`]: !prev[`${endpoint}:${id}`] }));
  const clearEditingKey = (endpoint: string, id: any) =>
    setEditing(prev => { const n = { ...prev }; delete n[`${endpoint}:${id}`]; return n; });
  const clearEditingFor = (endpoint: string) =>
    setEditing(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(endpoint + ':'))));

  // Adiciona uma linha nova (temporária, já em edição). Só é gravada no "Salvar Todos".
  const addRow = (endpoint: string, rows: any[], setRows: (v: any[]) => void, template: any) => {
    const tmpId = `tmp-${Date.now()}`;
    setRows([...rows, { ...template, id: tmpId, __new: true }]);
    setEditing(prev => ({ ...prev, [`${endpoint}:${tmpId}`]: true }));
  };

  // --- Persistência genérica (Supabase) -----------------------------------
  // POST quando é novo (sem id ou id temporário); PUT quando já existe. Retorna
  // {ok,error} SEM refetch (quem chama decide quando recarregar).
  const saveRow = async (endpoint: string, row: any): Promise<{ ok: boolean; error?: string }> => {
    const isNew = row.__new || row.id == null || String(row.id).startsWith('tmp-');
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? `/api/${endpoint}` : `/api/${endpoint}/${row.id}`;
    const { __new, ...clean } = row;
    let body: any = clean;
    if (isNew) { const { id, ...rest } = clean; body = rest; }
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return { ok: false, error: e.error || `HTTP ${res.status}` }; }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  const saveUserRow = async (u: any): Promise<{ ok: boolean; error?: string }> => {
    const body: any = { name: u.name, login: u.login, role: u.role };
    if (u.password) body.password = u.password;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return { ok: false, error: e.error || `HTTP ${res.status}` }; }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  // Salva todas as linhas em edição de uma aba de uma vez.
  const handleSaveAll = async (endpoint: string, rows: any[], saver: (row: any) => Promise<{ ok: boolean; error?: string }>) => {
    const inEdit = rows.filter(r => isEditing(endpoint, r.id));
    if (inEdit.length === 0) { notify('error', 'Nada em edição. Clique em ✏️ para editar uma linha.'); return; }
    let ok = 0;
    let firstErr = '';
    for (const row of inEdit) {
      const res = await saver(row);
      if (res.ok) ok++; else if (!firstErr) firstErr = res.error || 'erro';
    }
    clearEditingFor(endpoint);
    if (!firstErr) notify('success', `${ok} ${ok === 1 ? 'alteração salva' : 'alterações salvas'} ✓`);
    else notify('error', `Falha ao salvar: ${firstErr}`);
    fetchData();
  };

  // Apagar uma linha: descarta localmente se for nova (temp); senão chama a API.
  const handleRowDelete = (endpoint: string, rows: any[], setRows: (v: any[]) => void, row: any) => {
    if (row.__new || String(row.id).startsWith('tmp-')) {
      setRows(rows.filter(r => r.id !== row.id));
      clearEditingKey(endpoint, row.id);
      notify('success', 'Linha descartada');
      return;
    }
    handleDelete(endpoint, row.id);
  };

  const handleDelete = async (endpoint: string, id: any) => {
    const res = await fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); notify('error', 'Erro ao excluir: ' + (e.error || res.status)); return; }
    notify('success', 'Registro excluído ✓');
    fetchData();
  };

  const handleAddVantagem = async () => {
    const descricao = novaVantagem.trim();
    if (!descricao) return;
    const res = await saveRow('vantagens', { descricao });
    notify(res.ok ? 'success' : 'error', res.ok ? 'Vantagem adicionada ✓' : 'Erro: ' + res.error);
    setNovaVantagem('');
    fetchData();
  };

  const handleSaveMinuta = async (s: any) => {
    const res = await saveRow('settings', s);
    notify(res.ok ? 'success' : 'error', res.ok ? 'Minuta salva ✓' : 'Erro: ' + res.error);
    fetchData();
  };

  // --- Usuários (Supabase Auth + perfis) ----------------------------------
  const gerarLogin = (nome: string) => {
    const base = nome.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    return base ? `${base}@sda.com` : '';
  };

  const handleCreateUser = async () => {
    const { name, login, password, role } = novoUsuario;
    if (!name.trim() || !login.trim() || password.length < 6) {
      notify('error', 'Preencha Nome e Login, e senha com ao menos 6 caracteres.');
      return;
    }
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, login, password, role }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      notify('error', 'Erro ao criar usuário: ' + (e.error || res.status));
      return;
    }
    setNovoUsuario({ name: '', login: '', password: '', role: 'VENDEDOR', loginTouched: false });
    notify('success', 'Usuário criado ✓');
    fetchData();
  };

  const handleDeleteUser = async (id: string) => {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      notify('error', 'Erro ao excluir usuário: ' + (e.error || res.status));
      return;
    }
    notify('success', 'Usuário excluído ✓');
    fetchData();
  };

  // Botões de ação por linha (Editar + Apagar), reaproveitados nas abas CRUD.
  const RowActions = ({ endpoint, rows, setRows, row, canDelete = true }: any) => (
    <TableCell className="flex gap-2 justify-end">
      <Button
        size="icon"
        variant="ghost"
        className={isEditing(endpoint, row.id) ? 'text-amber-400 bg-amber-500/10' : 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10'}
        title={isEditing(endpoint, row.id) ? 'Em edição' : 'Editar'}
        onClick={() => toggleEdit(endpoint, row.id)}
      >
        <Pencil className="w-4 h-4" />
      </Button>
      {canDelete && (
        <Button
          size="icon"
          variant="ghost"
          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
          title="Apagar"
          onClick={() => handleRowDelete(endpoint, rows, setRows, row)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </TableCell>
  );

  const SalvarTodos = ({ endpoint, rows, saver }: any) => (
    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleSaveAll(endpoint, rows, saver)}>
      <Save className="w-4 h-4 mr-2" /> Salvar Todos
    </Button>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 p-4">
      <div className="flex justify-between items-center mb-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Painel do Supervisor</h1>
          <p className="text-zinc-500">Administração do Sistema</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" size="icon" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="outline" onClick={() => navigate('/vendedor')}>
            <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Cotação
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="categorias" className="w-full">
          <TabsList className="mb-4 bg-zinc-900 border-zinc-800 flex flex-wrap h-auto">
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="franquias">Franquias</TabsTrigger>
            <TabsTrigger value="terceiros">Terceiros</TabsTrigger>
            <TabsTrigger value="taxas">Taxas e Serviços</TabsTrigger>
            <TabsTrigger value="juros">Juros</TabsTrigger>
            <TabsTrigger value="regras">Regras</TabsTrigger>
            <TabsTrigger value="minuta">Minuta</TabsTrigger>
            <TabsTrigger value="vantagens">Vantagens Locadora</TabsTrigger>
            <TabsTrigger value="propostas">Propostas</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="categorias">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Categorias da Frota</CardTitle>
                <div className="flex gap-2">
                  <SalvarTodos endpoint="categories" rows={categories} saver={(row: any) => saveRow('categories', row)} />
                  <Button size="sm" variant="outline" onClick={() => addRow('categories', categories, setCategories, { sigla: '', padrao: 0, piso: 0, active: true })}>
                    <Plus className="w-4 h-4 mr-2"/> Nova
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sigla</TableHead>
                      <TableHead>Padrão (R$)</TableHead>
                      <TableHead>Piso/Alçada (R$)</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map(c => {
                      const ed = isEditing('categories', c.id);
                      return (
                        <TableRow key={c.id}>
                          <TableCell><EditableCell editing={ed} value={c.sigla} onChange={(e: any) => setCategories(categories.map(x => x.id === c.id ? {...x, sigla: e.target.value} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={c.padrao} onChange={(e: any) => setCategories(categories.map(x => x.id === c.id ? {...x, padrao: parseFloat(e.target.value)||0} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={c.piso} onChange={(e: any) => setCategories(categories.map(x => x.id === c.id ? {...x, piso: parseFloat(e.target.value)||0} : x))} /></TableCell>
                          <TableCell>
                            {ed
                              ? <Checkbox checked={c.active} onCheckedChange={v => setCategories(categories.map(x => x.id === c.id ? {...x, active: v as boolean} : x))} />
                              : <span className="text-zinc-300">{c.active ? 'Sim' : 'Não'}</span>}
                          </TableCell>
                          <RowActions endpoint="categories" rows={categories} setRows={setCategories} row={c} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="taxas">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Serviços e Taxas</CardTitle>
                <div className="flex gap-2">
                  <SalvarTodos endpoint="taxes" rows={taxes} saver={(row: any) => saveRow('taxes', row)} />
                  <Button size="sm" variant="outline" onClick={() => addRow('taxes', taxes, setTaxes, { nome: '', valor: 0, tipo: 'fixo', flex_mode: false, flex_value: 0, active: true })}>
                    <Plus className="w-4 h-4 mr-2"/> Nova
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Valor Fixo Base</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxes.map(t => {
                      const ed = isEditing('taxes', t.id);
                      return (
                        <TableRow key={t.id}>
                          <TableCell><EditableCell editing={ed} value={t.nome} onChange={(e: any) => setTaxes(taxes.map(x => x.id === t.id ? {...x, nome: e.target.value} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={t.valor} onChange={(e: any) => setTaxes(taxes.map(x => x.id === t.id ? {...x, valor: parseFloat(e.target.value)||0} : x))} /></TableCell>
                          <TableCell>
                            {ed
                              ? (
                                <Select value={t.tipo} onValueChange={v => setTaxes(taxes.map(x => x.id === t.id ? {...x, tipo: v} : x))}>
                                  <SelectTrigger><SelectValue/></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixo">Fixo</SelectItem>
                                    <SelectItem value="diario">Diário</SelectItem>
                                    <SelectItem value="flex">Flexível</SelectItem>
                                  </SelectContent>
                                </Select>
                              )
                              : <span className="text-zinc-300">{TIPO_LABEL[t.tipo] ?? t.tipo}</span>}
                          </TableCell>
                          <TableCell>
                            {ed
                              ? <Checkbox checked={t.active} onCheckedChange={v => setTaxes(taxes.map(x => x.id === t.id ? {...x, active: v as boolean} : x))} />
                              : <span className="text-zinc-300">{t.active ? 'Sim' : 'Não'}</span>}
                          </TableCell>
                          <RowActions endpoint="taxes" rows={taxes} setRows={setTaxes} row={t} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="franquias">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Configuração de Franquias (Diárias)</CardTitle>
                <SalvarTodos endpoint="franchises" rows={franchises} saver={(row: any) => saveRow('franchises', row)} />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Combo</TableHead>
                      <TableHead>Tipo (Padrão/Alçada)</TableHead>
                      <TableHead>Valor Diário (R$)</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {franchises.map(f => {
                      const ed = isEditing('franchises', f.id);
                      return (
                        <TableRow key={f.id}>
                          <TableCell>{f.combo}</TableCell>
                          <TableCell>{f.tipo}</TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={f.valor} onChange={(e: any) => setFranchises(franchises.map(x => x.id === f.id ? {...x, valor: parseFloat(e.target.value)||0} : x))} /></TableCell>
                          <RowActions endpoint="franchises" rows={franchises} setRows={setFranchises} row={f} canDelete={false} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terceiros">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Regras de Proteção a Terceiros</CardTitle>
                <div className="flex gap-2">
                  <SalvarTodos endpoint="third-parties" rows={thirdParties} saver={(row: any) => saveRow('third-parties', row)} />
                  <Button size="sm" variant="outline" onClick={() => addRow('third-parties', thirdParties, setThirdParties, { de: 1, ate: 1, valor: 0 })}>
                    <Plus className="w-4 h-4 mr-2"/> Nova Regra
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De (Dias)</TableHead>
                      <TableHead>Até (Dias)</TableHead>
                      <TableHead>Valor Diário (R$)</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {thirdParties.map(tp => {
                      const ed = isEditing('third-parties', tp.id);
                      return (
                        <TableRow key={tp.id}>
                          <TableCell><EditableCell editing={ed} type="number" value={tp.de} onChange={(e: any) => setThirdParties(thirdParties.map(x => x.id === tp.id ? {...x, de: parseInt(e.target.value)||0} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={tp.ate} onChange={(e: any) => setThirdParties(thirdParties.map(x => x.id === tp.id ? {...x, ate: parseInt(e.target.value)||0} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={tp.valor} onChange={(e: any) => setThirdParties(thirdParties.map(x => x.id === tp.id ? {...x, valor: parseFloat(e.target.value)||0} : x))} /></TableCell>
                          <RowActions endpoint="third-parties" rows={thirdParties} setRows={setThirdParties} row={tp} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regras">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Regras de Negócio</CardTitle>
                <div className="flex gap-2">
                  <SalvarTodos endpoint="rules" rows={rules} saver={(row: any) => saveRow('rules', row)} />
                  <Button size="sm" variant="outline" onClick={() => addRow('rules', rules, setRules, { campo: 'dias', de: 0, ate: 0, cobrancaDias: 0, texto: '' })}>
                    <Plus className="w-4 h-4 mr-2"/> Nova Regra
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Até</TableHead>
                      <TableHead>Cobrança (Dias)</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map(r => {
                      const ed = isEditing('rules', r.id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            {ed
                              ? (
                                <Select value={r.campo} onValueChange={v => setRules(rules.map(x => x.id === r.id ? {...x, campo: v} : x))}>
                                  <SelectTrigger><SelectValue/></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="dias">Dias</SelectItem>
                                    <SelectItem value="horas">Horas</SelectItem>
                                  </SelectContent>
                                </Select>
                              )
                              : <span className="text-zinc-300">{CAMPO_LABEL[r.campo] ?? r.campo}</span>}
                          </TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={r.de} onChange={(e: any) => setRules(rules.map(x => x.id === r.id ? {...x, de: parseInt(e.target.value)||0} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={r.ate} onChange={(e: any) => setRules(rules.map(x => x.id === r.id ? {...x, ate: parseInt(e.target.value)||0} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" step="0.1" min="0" max="999" value={r.cobrancaDias ?? 0} onChange={(e: any) => setRules(rules.map(x => x.id === r.id ? {...x, cobrancaDias: parseFloat(e.target.value) || 0} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} value={r.texto} onChange={(e: any) => setRules(rules.map(x => x.id === r.id ? {...x, texto: e.target.value} : x))} /></TableCell>
                          <RowActions endpoint="rules" rows={rules} setRows={setRules} row={r} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="minuta">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Editor de Minuta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const s = settings.find(x => x.key === 'minuta') || { id: Date.now(), key: 'minuta', template: 'FEITO POR {{FEITO_POR}} - COMPOSIÇÃO DO FECHAMENTO: [{{PAGTO_BREAKDOWN}}] - KM LIVRE COM COBERTURA PARA NATAL E LITORAL/RN COM PROTEÇÃO COM RAIO DE 200KM DE NATAL/RN. ATENÇÃO PRORROGAÇÃO DE CONTRATO SOMENTE EM LOJA PARA VERIFICARMOS. DEVOLUÇÃO MESMO LOCAL DA RETIRADA - OBS EXTRA: {{OBS_EXTRA}}', apeloComercial: '🚨 RISCO CIVIL PATRIMONIAL ATIVADO: Contrato sem amparo de frota! O locatário assume responsabilidade integral com o próprio patrimônio por danos causados a terceiros.' };
                  return (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-zinc-400">Texto Base</Label>
                        <textarea
                          className="w-full h-32 p-3 text-sm font-mono bg-[#09090b] text-zinc-300 rounded-md border border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={s.template}
                          onChange={e => {
                            if (!settings.find(x => x.key === 'minuta')) {
                                setSettings([...settings, { ...s, template: e.target.value }]);
                            } else {
                                setSettings(settings.map(x => x.id === s.id ? {...x, template: e.target.value} : x));
                            }
                          }}
                        />
                        <p className="text-xs text-zinc-500">💡 Tokens: {'{{FEITO_POR}}'} {'{{PAGTO_BREAKDOWN}}'} {'{{OBS_EXTRA}}'}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-400">Mensagem de Apelo</Label>
                        <textarea
                          className="w-full h-20 p-3 text-sm bg-red-500/10 text-red-400 font-bold rounded-md border border-red-500/30 focus:ring-2 focus:ring-red-500 outline-none"
                          value={s.apeloComercial}
                          onChange={e => {
                            if (!settings.find(x => x.key === 'minuta')) {
                                setSettings([...settings, { ...s, apeloComercial: e.target.value }]);
                            } else {
                                setSettings(settings.map(x => x.id === s.id ? {...x, apeloComercial: e.target.value} : x));
                            }
                          }}
                        />
                      </div>
                      <Button onClick={() => handleSaveMinuta(s)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Save className="w-4 h-4 mr-2" /> Salvar Textos
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="juros">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Juros por Parcela</CardTitle>
                <div className="flex gap-2">
                  <SalvarTodos endpoint="interest-rates" rows={interestRates} saver={(row: any) => saveRow('interest-rates', row)} />
                  <Button size="sm" variant="outline" onClick={() => addRow('interest-rates', interestRates, setInterestRates, { parcelas: 1, taxa: 0 })}>
                    <Plus className="w-4 h-4 mr-2"/> Nova Faixa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Juros (%)</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interestRates.map(ir => {
                      const ed = isEditing('interest-rates', ir.id);
                      return (
                        <TableRow key={ir.id}>
                          <TableCell><EditableCell editing={ed} type="number" value={ir.parcelas} onChange={(e: any) => setInterestRates(interestRates.map(x => x.id === ir.id ? {...x, parcelas: parseInt(e.target.value)||0} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} type="number" value={ir.taxa} onChange={(e: any) => setInterestRates(interestRates.map(x => x.id === ir.id ? {...x, taxa: parseFloat(e.target.value)||0} : x))} /></TableCell>
                          <RowActions endpoint="interest-rates" rows={interestRates} setRows={setInterestRates} row={ir} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vantagens">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-white">Vantagens Locadora</CardTitle>
                  <p className="text-sm text-zinc-500">Benefícios exibidos ao cliente na tela de cotação.</p>
                </div>
                <SalvarTodos endpoint="vantagens" rows={vantagens} saver={(row: any) => saveRow('vantagens', row)} />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Descreva uma nova vantagem (ex.: KM livre em todo o RN)"
                    value={novaVantagem}
                    onChange={e => setNovaVantagem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddVantagem(); }}
                  />
                  <Button onClick={handleAddVantagem} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição da Vantagem</TableHead>
                      <TableHead className="w-[110px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vantagens.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-zinc-500 py-6">
                          Nenhuma vantagem cadastrada ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {vantagens.map(v => {
                      const ed = isEditing('vantagens', v.id);
                      return (
                        <TableRow key={v.id}>
                          <TableCell><EditableCell editing={ed} value={v.descricao ?? ''} onChange={(e: any) => setVantagens(vantagens.map(x => x.id === v.id ? {...x, descricao: e.target.value} : x))} /></TableCell>
                          <RowActions endpoint="vantagens" rows={vantagens} setRows={setVantagens} row={v} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="propostas">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white">Propostas</CardTitle>
                <p className="text-sm text-zinc-500">Histórico de propostas geradas pelos vendedores.</p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-zinc-500 py-6">
                          Nenhuma proposta registrada ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {propostas.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-zinc-200">{p.clientName}</TableCell>
                        <TableCell>{p.clientPhone || '—'}</TableCell>
                        <TableCell>{p.createdBy || '—'}</TableCell>
                        <TableCell>{p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—'}</TableCell>
                        <TableCell className="flex gap-2 justify-end">
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" title="Apagar" onClick={() => handleDelete('proposals', p.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-white">Gerenciar Usuários</CardTitle>
                  <p className="text-sm text-zinc-500">Usuários reais do sistema (login via Supabase). O Nome preenche o {'{{FEITO_POR}}'} da minuta. A senha só é definida na criação ou redefinida na edição — nunca é exibida.</p>
                </div>
                <SalvarTodos endpoint="users" rows={users} saver={saveUserRow} />
              </CardHeader>
              <CardContent>
                {/* Formulário de criação */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-zinc-400">Nome</Label>
                    <Input
                      value={novoUsuario.name}
                      placeholder="João Silva"
                      onChange={e => setNovoUsuario(s => ({ ...s, name: e.target.value, login: s.loginTouched ? s.login : gerarLogin(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-400">Login</Label>
                    <Input
                      value={novoUsuario.login}
                      placeholder="joao.silva@sda.com"
                      onChange={e => setNovoUsuario(s => ({ ...s, login: e.target.value, loginTouched: true }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-400">Senha</Label>
                    <Input
                      value={novoUsuario.password}
                      placeholder="mín. 6 dígitos"
                      onChange={e => setNovoUsuario(s => ({ ...s, password: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-400">Papel</Label>
                    <Select value={novoUsuario.role} onValueChange={v => setNovoUsuario(s => ({ ...s, role: v }))}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                        <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateUser} className="shrink-0">
                    <Plus className="w-4 h-4 mr-2"/> Criar
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Nova Senha</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="w-[110px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-zinc-500 py-6">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {users.map(u => {
                      const ed = isEditing('users', u.id);
                      return (
                        <TableRow key={u.id}>
                          <TableCell><EditableCell editing={ed} value={u.name ?? ''} onChange={(e: any) => setUsers(users.map(x => x.id === u.id ? {...x, name: e.target.value} : x))} /></TableCell>
                          <TableCell><EditableCell editing={ed} value={u.login ?? ''} onChange={(e: any) => setUsers(users.map(x => x.id === u.id ? {...x, login: e.target.value} : x))} /></TableCell>
                          <TableCell>
                            {ed
                              ? <Input value={u.password ?? ''} placeholder="(manter)" onChange={e => setUsers(users.map(x => x.id === u.id ? {...x, password: e.target.value} : x))} />
                              : <span className="text-zinc-500">••••••</span>}
                          </TableCell>
                          <TableCell>
                            {ed
                              ? (
                                <Select value={u.role} onValueChange={v => setUsers(users.map(x => x.id === u.id ? {...x, role: v} : x))}>
                                  <SelectTrigger><SelectValue/></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                                    <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                                  </SelectContent>
                                </Select>
                              )
                              : <span className="text-zinc-300">{ROLE_LABEL[String(u.role).toUpperCase()] ?? u.role}</span>}
                          </TableCell>
                          <TableCell className="flex gap-2 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className={ed ? 'text-amber-400 bg-amber-500/10' : 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10'}
                              title={ed ? 'Em edição' : 'Editar'}
                              onClick={() => toggleEdit('users', u.id)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {u.id !== user.id && (
                              <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" title="Excluir" onClick={() => handleDeleteUser(u.id)}><Trash2 className="w-4 h-4" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* Toasts discretos */}
      <style>{`@keyframes sda-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            style={{ animation: 'sda-toast-in 180ms ease-out' }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg text-sm bg-zinc-900 ${t.type === 'success' ? 'border-emerald-600/40 text-emerald-300' : 'border-red-600/40 text-red-300'}`}
          >
            {t.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

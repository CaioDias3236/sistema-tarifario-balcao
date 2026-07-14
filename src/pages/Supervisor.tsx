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
import { ArrowLeft, Plus, Trash2, Save, Sun, Moon } from 'lucide-react';

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
    const [c, t, f, tp, ir, r, u, s] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/taxes').then(r => r.json()),
      fetch('/api/franchises').then(r => r.json()),
      fetch('/api/third-parties').then(r => r.json()),
      fetch('/api/interest-rates').then(r => r.json()),
      fetch('/api/rules').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/settings').then(r => r.json())
    ]);
    setCategories(c);
    setTaxes(t);
    setFranchises(f);
    setThirdParties(tp);
    setInterestRates(ir);
    setRules(r);
    setUsers(u);
    setSettings(s);
  };

  const handleSave = async (endpoint: string, data: any) => {
    const method = data.id && typeof data.id === 'number' && data.id > 1000 ? 'PUT' : 'POST';
    const url = method === 'PUT' ? `/api/${endpoint}/${data.id}` : `/api/${endpoint}`;
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    fetchData();
  };

  const handleDelete = async (endpoint: string, id: number) => {
    await fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' });
    fetchData();
  };

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
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>
          
          <TabsContent value="categorias">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Categorias da Frota</CardTitle>
                <Button size="sm" onClick={() => handleSave('categories', { sigla: 'Nova', padrao: 0, piso: 0, active: true })}>
                  <Plus className="w-4 h-4 mr-2"/> Nova
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sigla</TableHead>
                      <TableHead>Padrão (R$)</TableHead>
                      <TableHead>Piso/Alçada (R$)</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map(c => (
                      <TableRow key={c.id}>
                        <TableCell><Input value={c.sigla} onChange={e => setCategories(categories.map(x => x.id === c.id ? {...x, sigla: e.target.value} : x))} /></TableCell>
                        <TableCell><Input type="number" value={c.padrao} onChange={e => setCategories(categories.map(x => x.id === c.id ? {...x, padrao: parseFloat(e.target.value)||0} : x))} /></TableCell>
                        <TableCell><Input type="number" value={c.piso} onChange={e => setCategories(categories.map(x => x.id === c.id ? {...x, piso: parseFloat(e.target.value)||0} : x))} /></TableCell>
                        <TableCell><Checkbox checked={c.active} onCheckedChange={v => setCategories(categories.map(x => x.id === c.id ? {...x, active: v as boolean} : x))} /></TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleSave('categories', c)}><Save className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete('categories', c.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="taxas">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Serviços e Taxas</CardTitle>
                <Button size="sm" onClick={() => handleSave('taxes', { nome: 'Nova Taxa', valor: 0, tipo: 'fixo', flex_mode: false, flex_value: 0, active: true })}>
                  <Plus className="w-4 h-4 mr-2"/> Nova
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Valor Fixo Base</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxes.map(t => (
                      <TableRow key={t.id}>
                        <TableCell><Input value={t.nome} onChange={e => setTaxes(taxes.map(x => x.id === t.id ? {...x, nome: e.target.value} : x))} /></TableCell>
                        <TableCell><Input type="number" value={t.valor} onChange={e => setTaxes(taxes.map(x => x.id === t.id ? {...x, valor: parseFloat(e.target.value)||0} : x))} /></TableCell>
                        <TableCell>
                          <Select value={t.tipo} onValueChange={v => setTaxes(taxes.map(x => x.id === t.id ? {...x, tipo: v} : x))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixo">Fixo</SelectItem>
                              <SelectItem value="diario">Diário</SelectItem>
                              <SelectItem value="flex">Flexível</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Checkbox checked={t.active} onCheckedChange={v => setTaxes(taxes.map(x => x.id === t.id ? {...x, active: v as boolean} : x))} /></TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleSave('taxes', t)}><Save className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete('taxes', t.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="franquias">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white">Configuração de Franquias (Diárias)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Combo</TableHead>
                      <TableHead>Tipo (Padrão/Alçada)</TableHead>
                      <TableHead>Valor Diário (R$)</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {franchises.map(f => (
                      <TableRow key={f.id}>
                        <TableCell>{f.combo}</TableCell>
                        <TableCell>{f.tipo}</TableCell>
                        <TableCell><Input type="number" value={f.valor} onChange={e => setFranchises(franchises.map(x => x.id === f.id ? {...x, valor: parseFloat(e.target.value)||0} : x))} /></TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleSave('franchises', f)}><Save className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terceiros">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Regras de Proteção a Terceiros</CardTitle>
                <Button size="sm" onClick={() => handleSave('third-parties', { de: 1, ate: 1, valor: 0 })}>
                  <Plus className="w-4 h-4 mr-2"/> Nova Regra
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De (Dias)</TableHead>
                      <TableHead>Até (Dias)</TableHead>
                      <TableHead>Valor Diário (R$)</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {thirdParties.map(tp => (
                      <TableRow key={tp.id}>
                        <TableCell><Input type="number" value={tp.de} onChange={e => setThirdParties(thirdParties.map(x => x.id === tp.id ? {...x, de: parseInt(e.target.value)||0} : x))} /></TableCell>
                        <TableCell><Input type="number" value={tp.ate} onChange={e => setThirdParties(thirdParties.map(x => x.id === tp.id ? {...x, ate: parseInt(e.target.value)||0} : x))} /></TableCell>
                        <TableCell><Input type="number" value={tp.valor} onChange={e => setThirdParties(thirdParties.map(x => x.id === tp.id ? {...x, valor: parseFloat(e.target.value)||0} : x))} /></TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleSave('third-parties', tp)}><Save className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete('third-parties', tp.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regras">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Regras de Negócio</CardTitle>
                <Button size="sm" onClick={() => handleSave('rules', { campo: 'dias', de: 0, ate: 0, texto: 'Nova Regra' })}>
                  <Plus className="w-4 h-4 mr-2"/> Nova Regra
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Até</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Select value={r.campo} onValueChange={v => setRules(rules.map(x => x.id === r.id ? {...x, campo: v} : x))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dias">Dias</SelectItem>
                              <SelectItem value="horas">Horas</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" value={r.de} onChange={e => setRules(rules.map(x => x.id === r.id ? {...x, de: parseInt(e.target.value)||0} : x))} /></TableCell>
                        <TableCell><Input type="number" value={r.ate} onChange={e => setRules(rules.map(x => x.id === r.id ? {...x, ate: parseInt(e.target.value)||0} : x))} /></TableCell>
                        <TableCell><Input value={r.texto} onChange={e => setRules(rules.map(x => x.id === r.id ? {...x, texto: e.target.value} : x))} /></TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleSave('rules', r)}><Save className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete('rules', r.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                      <Button onClick={() => handleSave('settings', s)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
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
                <Button size="sm" onClick={() => handleSave('interest-rates', { parcelas: 1, taxa: 0 })}>
                  <Plus className="w-4 h-4 mr-2"/> Nova Faixa
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Juros (%)</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interestRates.map(ir => (
                      <TableRow key={ir.id}>
                        <TableCell><Input type="number" value={ir.parcelas} onChange={e => setInterestRates(interestRates.map(x => x.id === ir.id ? {...x, parcelas: parseInt(e.target.value)||0} : x))} /></TableCell>
                        <TableCell><Input type="number" value={ir.taxa} onChange={e => setInterestRates(interestRates.map(x => x.id === ir.id ? {...x, taxa: parseFloat(e.target.value)||0} : x))} /></TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleSave('interest-rates', ir)}><Save className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete('interest-rates', ir.id)}><Trash2 className="w-4 h-4" /></Button>
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
                <CardTitle className="text-white">Gerenciar Usuários</CardTitle>
                <Button size="sm" onClick={() => handleSave('users', { name: 'Novo Usuário', username: 'novo_user', password: '123', role: 'VENDEDOR' })}>
                  <Plus className="w-4 h-4 mr-2"/> Novo Usuário
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Username (Login)</TableHead>
                      <TableHead>Senha</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell><Input value={u.name} onChange={e => setUsers(users.map(x => x.id === u.id ? {...x, name: e.target.value} : x))} /></TableCell>
                        <TableCell><Input value={u.username} onChange={e => setUsers(users.map(x => x.id === u.id ? {...x, username: e.target.value} : x))} /></TableCell>
                        <TableCell><Input type="text" value={u.password} onChange={e => setUsers(users.map(x => x.id === u.id ? {...x, password: e.target.value} : x))} /></TableCell>
                        <TableCell>
                          <Select value={u.role} onValueChange={v => setUsers(users.map(x => x.id === u.id ? {...x, role: v} : x))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                              <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleSave('users', u)}><Save className="w-4 h-4" /></Button>
                          {u.id !== user.id && (
                            <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete('users', u.id)}><Trash2 className="w-4 h-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

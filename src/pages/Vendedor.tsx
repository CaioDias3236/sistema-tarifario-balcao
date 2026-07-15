import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Button } from '@/src/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { LogOut, Trash2, MonitorPlay, ArrowLeft, Sun, Moon, LogOut as LogOutIcon, CheckCircle2, Send } from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';
import confetti from 'canvas-confetti';
import { supabase } from '@/src/lib/supabase';

export default function Vendedor({ user }: { user: any }) {
  const navigate = useNavigate();
  const [params, setParams] = useState<any>(null);
  
  // Form State
  const today = new Date().toISOString().split('T')[0];
  const [retiradaData, setRetiradaData] = useState(today);
  const [retiradaHora, setRetiradaHora] = useState('');
  const [devolucaoData, setDevolucaoData] = useState('');
  const [devolucaoHora, setDevolucaoHora] = useState('');
  const [patioRetirada, setPatioRetirada] = useState('LOJA_CENTRO');
  const [patioDevolucao, setPatioDevolucao] = useState('LOJA_CENTRO');
  
  const [ativarAlcada, setAtivarAlcada] = useState(false);
  const [ativarTerceiro, setAtivarTerceiro] = useState(true);
  
  // Taxas e Servicos Extras State
  const [taxasState, setTaxasState] = useState<Record<number, boolean>>({});
  const [taxasFlexValues, setTaxasFlexValues] = useState<Record<number, number>>({});
  
  // Pagamento State
  const [pagamentos, setPagamentos] = useState<Array<{ id: number, tipo: string, valor: number, semJuros: boolean }>>([
    { id: Date.now(), tipo: 'PIX', valor: 0, semJuros: false }
  ]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState<number | null>(null);
  const [comboSelecionado, setComboSelecionado] = useState<string | null>(null);

  // Dados do Cliente State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [presentationMode, setPresentationMode] = useState(false);
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
    fetch('/api/system-params')
      .then(res => res.json())
      .then(data => setParams(data));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();            // encerra a sessão do Supabase
    await fetch('/api/auth/logout', { method: 'POST' }); // limpa o cookie do Express
    window.location.href = '/';
  };

  // Máscara de telefone BR em tempo real: (84) 99981-1619 (11 díg.) ou
  // (84) 3221-1619 (10 díg.). Formata parcialmente enquanto o usuário digita.
  const formatTelefone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  // Salva a proposta (dados básicos do cliente) e comemora com confete.
  const handleEnviarProposta = async () => {
    if (!clientName.trim() || enviando) return;
    setEnviando(true);
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now(),
          clientName: clientName.trim(),
          clientPhone,
          createdBy: user.name,
          createdAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`POST /api/proposals falhou (${res.status})`);
    } catch (err) {
      console.error(err);
      alert('Não foi possível salvar a proposta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (!params) return <div className="p-8">Carregando parâmetros do sistema...</div>;

  // Cálculos
  let diarias = 1;
  let horasExtras = 0;
  let taxaHorasExtras = 0; // 0, 0.5 (meia diária), 1 (uma diária)
  
  if (retiradaData && devolucaoData) {
    const startHourStr = retiradaHora || '00:00';
    const endHourStr = devolucaoHora || '00:00';
    const start = parseISO(`${retiradaData}T${startHourStr}`);
    const end = parseISO(`${devolucaoData}T${endHourStr}`);
    
    // Check if dates are valid
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      // Diferença precisa usando frações reais de horas (minutos / 60), para que
      // truncagens de arredondamento não somem nem percam diárias no limite.
      const diffHoras = differenceInMinutes(end, start) / 60;

      if (diffHoras > 0) {
        diarias = Math.floor(diffHoras / 24);
        horasExtras = diffHoras - diarias * 24; // horas remanescentes reais, em [0, 24)

        if (diarias >= 1) {
          // Cobrança de horas extras 100% dinâmica: encontra a regra do tipo
          // "horas" cuja faixa (de/ate) contém as horas remanescentes e usa o
          // multiplicador configurado no campo cobrancaDias daquela regra.
          const horasCheias = Math.floor(horasExtras);
          const regraHoras = (params.rules || []).find(
            (r: any) => r.campo === 'horas' && horasCheias >= r.de && horasCheias <= r.ate
          );
          taxaHorasExtras = regraHoras ? (Number(regraHoras.cobrancaDias) || 0) : 0;
        } else {
          // Locação sub-diária: cobra no mínimo 1 diária, sem acréscimo de horas extras.
          diarias = 1;
          horasExtras = 0;
          taxaHorasExtras = 0;
        }
      } else if (diffHoras === 0) {
        diarias = 1;
      }
    }
  }

  // Rótulo inteiro das horas extras remanescentes (apenas para exibição), no
  // mesmo critério (piso) usado para casar a faixa da regra de horas.
  const horasExtrasLabel = Math.floor(horasExtras);

  const getValorTerceiro = (dias: number) => {
    if (!ativarTerceiro) return 0;
    const third = params.thirdParties.find((t: any) => dias >= t.de && dias <= t.ate);
    return third ? third.valor : 0;
  };

  const thirdPartyValorDiario = getValorTerceiro(diarias);

  const calcularProposta = (cat: any, comboNome: string) => {
    const diariaBase = ativarAlcada ? cat.piso : cat.padrao;
    const valorDiariaCobrado = (diariaBase * diarias) + (diariaBase * taxaHorasExtras);
    
    let valorFranquiaDiario = 0;
    if (comboNome !== 'NORMAL') {
      const tipoFranquia = ativarAlcada ? 'alcada' : 'padrao';
      const f = params.franchises.find((f: any) => f.combo === comboNome && f.tipo === tipoFranquia);
      if (f) valorFranquiaDiario = f.valor;
    }
    const valorFranquiaCobrado = valorFranquiaDiario * diarias;
    
    const valorTerceirosCobrado = thirdPartyValorDiario * diarias;

    let valorTaxas = 0;
    params.taxes.forEach((t: any) => {
      let aplicada = false;
      if (t.nome === 'Retorno entre Lojas' && patioRetirada !== patioDevolucao) aplicada = true;
      else if (taxasState[t.id]) aplicada = true;

      if (aplicada) {
        let v = t.tipo === 'flex' ? (taxasFlexValues[t.id] || 0) : t.valor;
        if (t.tipo === 'diario' || t.tipo === 'flex') {
          valorTaxas += v * diarias;
        } else {
          valorTaxas += v;
        }
      }
    });

    const subtotal = valorDiariaCobrado + valorFranquiaCobrado + valorTerceirosCobrado + valorTaxas;
    
    // Juros
    let totalJuros = 0;
    pagamentos.forEach(pag => {
      if (!pag.semJuros && pag.tipo.startsWith('Cartão')) {
        const parcelas = parseInt(pag.tipo.replace('Cartão ', '')) || 1;
        const taxaObj = params.interestRates.find((ir: any) => ir.parcelas === parcelas);
        if (taxaObj) {
          totalJuros += pag.valor * (taxaObj.taxa / 100);
        }
      }
    });

    const total = subtotal + totalJuros;

    return { total, subtotal, diariaBase, valorFranquiaDiario, totalJuros, valorTaxas, valorTerceirosCobrado };
  };

  const getMinuta = () => {
    if (!categoriaSelecionada || !comboSelecionado) return "";
    const cat = params.categories.find((c: any) => c.id === categoriaSelecionada);
    if (!cat) return "";
    
    let template = "FEITO POR {{FEITO_POR}} - COMPOSIÇÃO DO FECHAMENTO: [{{PAGTO_BREAKDOWN}}] - OBS EXTRA: {{OBS_EXTRA}}";
    if (params.settings) {
      const minutaSetting = params.settings.find((s: any) => s.key === 'minuta');
      if (minutaSetting) {
        template = minutaSetting.template;
      }
    }

    const pagBreakdown = pagamentos.filter(p => p.valor > 0).map(pag => {
      if (pag.tipo === 'PIX') return `PIX À VISTA: R$ ${pag.valor.toFixed(2)}`;
      const parcelas = parseInt(pag.tipo.replace('Cartão ', '')) || 1;
      let juros = 0;
      if (!pag.semJuros) {
        const taxaObj = params.interestRates?.find((ir: any) => ir.parcelas === parcelas);
        if (taxaObj) juros = pag.valor * (taxaObj.taxa / 100);
      }
      return `CARTÃO DE CRÉDITO EM ${parcelas}X DE R$ ${((pag.valor + juros) / parcelas).toFixed(2)}`;
    }).join(' + ');
    
    let result = template
      .replace('{{FEITO_POR}}', user.name)
      .replace('{{PAGTO_BREAKDOWN}}', pagBreakdown)
      .replace('{{OBS_EXTRA}}', "NENHUMA");

    if (!ativarTerceiro) {
      result += " | [ATENÇÃO CONTRATUAL: RESPONSABILIDADE PATRIMONIAL INTEGRAL DO CLIENTE PARA DANOS A TERCEIROS - SEM AMPARO DE FROTA]";
    }

    return result;
  };

  return (
    <div className={`min-h-screen bg-[#09090b] text-zinc-300 ${presentationMode ? 'p-0' : 'p-4'}`}>
      {/* Header */}
      {!presentationMode && (
        <div className="flex justify-between items-center mb-6 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">SDA-V8 Cotação</h1>
            <p className="text-zinc-500">Operador: {user.name} | Perfil: {user.role}</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="icon" className="border-zinc-700 hover:bg-zinc-800" onClick={() => setPresentationMode(true)} title="Apresentar ao Cliente">
              <MonitorPlay className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Alternar Tema">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            {user.role === 'SUPERVISOR' && (
              <Button variant="outline" onClick={() => navigate('/supervisor')}>Configurações</Button>
            )}
            <Button variant="ghost" onClick={handleLogout}><LogOutIcon className="w-4 h-4 mr-2"/> Sair</Button>
          </div>
        </div>
      )}

      {/* Modo Apresentação Header */}
      {presentationMode && (
        <div className="bg-zinc-900/50 border-b border-zinc-800 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-emerald-600 rounded flex items-center justify-center font-bold">V8</div>
            <h1 className="text-xl font-bold">Proposta de Locação{clientName.trim() ? ` para: ${clientName.trim()}` : ''}</h1>
          </div>
          <Button variant="outline" onClick={() => setPresentationMode(false)}>
            <ArrowLeft className="w-4 h-4 mr-2"/> Voltar
          </Button>
        </div>
      )}

      <div className={`grid ${presentationMode ? 'grid-cols-1' : 'grid-cols-12'} gap-6 max-w-7xl mx-auto ${presentationMode ? 'p-6' : ''}`}>
        
        {/* Lado Esquerdo - Controles (Oculto no modo apresentação) */}
        {!presentationMode && (
          <div className="col-span-12 lg:col-span-4 space-y-6">

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Dados do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <div className="flex gap-2">
                    <Input
                      value={clientPhone}
                      onChange={e => setClientPhone(formatTelefone(e.target.value))}
                      placeholder="(84) 99981-1619"
                      inputMode="tel"
                    />
                    <Button
                      size="icon"
                      className="shrink-0"
                      disabled={!clientName.trim() || enviando}
                      onClick={handleEnviarProposta}
                      title={clientName.trim() ? 'Enviar proposta' : 'Preencha o nome do cliente'}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">1. Período de Locação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Retirada (Data)</Label>
                    <Input type="date" value={retiradaData} onChange={e => setRetiradaData(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Hora</Label>
                    <Input type="time" value={retiradaHora} onChange={e => setRetiradaHora(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Devolução (Data)</Label>
                    <Input type="date" value={devolucaoData} onChange={e => setDevolucaoData(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Hora</Label>
                    <Input type="time" value={devolucaoHora} onChange={e => setDevolucaoHora(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Pátio de Retirada</Label>
                  <Select value={patioRetirada} onValueChange={setPatioRetirada}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOJA_CENTRO">Loja Centro</SelectItem>
                      <SelectItem value="AERO">Aeroporto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Pátio de Devolução</Label>
                  <Select value={patioDevolucao} onValueChange={setPatioDevolucao}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOJA_CENTRO">Loja Centro</SelectItem>
                      <SelectItem value="AERO">Aeroporto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">2. Controles de Negociação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 bg-zinc-800/40 p-3 rounded border border-zinc-800">
                  <Checkbox id="alcada" checked={ativarAlcada} onCheckedChange={(c) => setAtivarAlcada(c as boolean)} />
                  <Label htmlFor="alcada" className="cursor-pointer font-semibold text-zinc-300">Ativar Alçada (Preço Piso)</Label>
                </div>
                <div className={`flex items-center space-x-2 p-3 rounded border ${!ativarTerceiro ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-800/40 border-zinc-800'}`}>
                  <Checkbox id="terceiro" checked={ativarTerceiro} onCheckedChange={(c) => setAtivarTerceiro(c as boolean)} />
                  <Label htmlFor="terceiro" className="cursor-pointer font-semibold text-zinc-300">
                    Ativar Proteção a Terceiros
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">3. Serviços Adicionais e Taxas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {params.taxes.map((t: any) => {
                  const isRetorno = t.nome === 'Retorno entre Lojas';
                  const forcado = isRetorno && patioRetirada !== patioDevolucao;
                  return (
                    <div key={t.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id={`tax-${t.id}`} 
                          checked={forcado || taxasState[t.id] || false}
                          disabled={forcado}
                          onCheckedChange={(c) => setTaxasState(s => ({...s, [t.id]: c as boolean}))}
                        />
                        <Label htmlFor={`tax-${t.id}`} className="cursor-pointer">{t.nome}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.tipo === 'flex' ? (
                          <Input 
                            type="number" 
                            className="w-24 h-8" 
                            placeholder="R$ 0,00"
                            value={taxasFlexValues[t.id] || ''}
                            onChange={(e) => setTaxasFlexValues(s => ({...s, [t.id]: parseFloat(e.target.value) || 0}))}
                          />
                        ) : (
                          <span className="text-sm font-medium text-zinc-300">R$ {t.valor.toFixed(2)}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] uppercase">{t.tipo}</Badge>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">4. Pagamento (Fatiamento)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pagamentos.map((pag, index) => (
                  <div key={pag.id} className="flex items-center gap-2">
                    <Select value={pag.tipo} onValueChange={(val) => {
                      const newPags = [...pagamentos];
                      newPags[index].tipo = val;
                      setPagamentos(newPags);
                    }}>
                      <SelectTrigger className="w-[140px] h-9"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Cartão 1">Cartão 1x</SelectItem>
                        <SelectItem value="Cartão 2">Cartão 2x</SelectItem>
                        <SelectItem value="Cartão 3">Cartão 3x</SelectItem>
                        <SelectItem value="Cartão 4">Cartão 4x</SelectItem>
                        <SelectItem value="Cartão 5">Cartão 5x</SelectItem>
                        <SelectItem value="Cartão 6">Cartão 6x</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-2 text-zinc-500 text-sm">R$</span>
                      <Input 
                        type="number" 
                        className="pl-7 h-9"
                        value={pag.valor || ''}
                        onChange={(e) => {
                          const newPags = [...pagamentos];
                          newPags[index].valor = parseFloat(e.target.value) || 0;
                          setPagamentos(newPags);
                        }}
                      />
                    </div>
                    <div className="flex items-center space-x-1" title="Sem Juros">
                      <Checkbox 
                        checked={pag.semJuros}
                        onCheckedChange={(c) => {
                          const newPags = [...pagamentos];
                          newPags[index].semJuros = c as boolean;
                          setPagamentos(newPags);
                        }}
                      />
                      <span className="text-xs text-zinc-500">S/J</span>
                    </div>
                    {pagamentos.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => {
                        setPagamentos(pagamentos.filter(p => p.id !== pag.id));
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => {
                  setPagamentos([...pagamentos, { id: Date.now(), tipo: 'PIX', valor: 0, semJuros: false }]);
                }}>
                  + Adicionar Canal
                </Button>
              </CardContent>
            </Card>

            <Button className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white" size="lg" onClick={() => setPresentationMode(true)}>
              <MonitorPlay className="w-5 h-5 mr-2" />
              Apresentar ao Cliente
            </Button>

          </div>
        )}

        {/* Lado Direito - Resultados (Visível no modo apresentação tb) */}
        <div className={`col-span-12 ${presentationMode ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-6`}>
          
          {(() => {
            const rules = params.rules || [];
            const ruleDias = rules.find((r: any) => r.campo === 'dias' && diarias >= r.de && diarias <= r.ate);
            // O banner de horas só reflete acréscimos PARCIAIS (meia diária / tolerância).
            // Quando o período fecha em diárias cheias (resto incorporado), taxaHorasExtras
            // e horasExtras ficam zerados, então nenhum alerta de "estouro" é exibido.
            // Casa a faixa inteira da regra usando o teto do resto fracionário (ex.: 4.2h -> 4).
            const ruleHoras = horasExtras > 0
              ? rules.find((r: any) => r.campo === 'horas' && Math.floor(horasExtras) >= r.de && Math.floor(horasExtras) <= r.ate)
              : null;
            const minutaConfig = params.settings?.find((s: any) => s.key === 'minuta') || { apeloComercial: '🚨 RISCO CIVIL PATRIMONIAL ATIVADO: Contrato sem amparo de frota! O locatário assume responsabilidade integral com o próprio patrimônio por danos causados a terceiros.' };

            return (
              <div className="space-y-2">
                {!ativarTerceiro && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-md font-semibold flex justify-center items-center text-center">
                    {minutaConfig.apeloComercial}
                  </div>
                )}
                {ativarAlcada && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 p-3 rounded-md font-semibold flex items-center">
                    🚨 ALÇADA DE BALCÃO ATIVADA: Utilizando preços e tarifas de piso!
                  </div>
                )}
                {ruleDias && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-md font-semibold">
                    {ruleDias.texto}
                  </div>
                )}
                {ruleHoras && (
                  <div className={`p-3 rounded-md font-semibold border ${taxaHorasExtras === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-500'}`}>
                    {ruleHoras.texto}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={`col-span-12 ${presentationMode && categoriaSelecionada && comboSelecionado ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle>Tabela de Preços e Combos</CardTitle>
                </CardHeader>
                <CardContent className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Categoria</TableHead>
                        <TableHead className="text-center">⚪ Combo NORMAL<br/><span className="text-xs font-normal text-zinc-500">Franquia Total</span></TableHead>
                        <TableHead className="text-center">🟡 Combo REDUZIDA<br/><span className="text-xs font-normal text-zinc-500">Franquia Parcial</span></TableHead>
                        <TableHead className="text-center bg-emerald-500/10">⚫ Combo ZERO<br/><span className="text-xs font-normal text-zinc-500">Sem Franquia</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {params.categories.map((cat: any) => (
                        <TableRow key={cat.id}>
                          <TableCell className="font-semibold bg-zinc-900/50 text-white">
                            {cat.sigla}
                            <div className="text-xs font-normal text-zinc-500 mt-1">
                              R$ {(ativarAlcada ? cat.piso : cat.padrao).toFixed(2)}
                            </div>
                          </TableCell>
                          {['NORMAL', 'REDUZIDA', 'ZERO'].map((combo) => {
                            const prop = calcularProposta(cat, combo);
                            const isSelected = categoriaSelecionada === cat.id && comboSelecionado === combo;
                            return (
                              <TableCell 
                                key={combo} 
                                className={`text-center cursor-pointer transition-colors hover:bg-zinc-800/50 ${isSelected ? 'bg-emerald-500/10 ring-2 ring-emerald-500 ring-inset border-y border-emerald-500/20' : ''} ${combo==='ZERO' && !isSelected ? 'bg-emerald-500/5' : ''}`}
                                onClick={() => {
                                  setCategoriaSelecionada(cat.id);
                                  setComboSelecionado(combo);
                                }}
                              >
                                <div className={`font-bold text-lg ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}`}>R$ {prop.total.toFixed(2)}</div>
                                <div className="text-xs text-zinc-500 mt-1">
                                  {diarias}d {horasExtrasLabel > 0 ? `+ ${horasExtrasLabel}h` : ''}
                                </div>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {categoriaSelecionada && comboSelecionado && (() => {
              const cat = params.categories.find((c: any) => c.id === categoriaSelecionada);
              const prop = calcularProposta(cat, comboSelecionado);
              const totalAlocado = pagamentos.reduce((acc, p) => acc + p.valor, 0);
              const saldoRestante = prop.total - totalAlocado;

              return (
                <>
                <div className={`col-span-12 ${presentationMode ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
                  <div className={`grid grid-cols-1 gap-6 ${!presentationMode ? 'md:grid-cols-2' : ''}`}>
                    {presentationMode && (
                      <Card className="bg-zinc-900 border-emerald-500/20 h-fit">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg text-emerald-400">Vantagens Locadora</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {params.vantagens && params.vantagens.length > 0 ? (
                            <ul className="space-y-2">
                              {params.vantagens.map((v: any) => (
                                <li key={v.id} className="flex items-start gap-2 text-sm text-zinc-300">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                  <span>{v.descricao}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-zinc-500">Nenhuma vantagem cadastrada.</p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                    <Card className="border-emerald-500/30 shadow-sm bg-zinc-900 h-fit">
                      <CardHeader className="bg-emerald-500/5 border-b border-emerald-500/20 pb-4">
                        <CardTitle className="text-emerald-400">Resumo da Proposta</CardTitle>
                      </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400">Categoria</span>
                      <span className="font-bold text-lg text-white">{cat.sigla}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400">Combo de Franquia</span>
                      <Badge variant={comboSelecionado === 'ZERO' ? 'default' : 'secondary'}>
                        {comboSelecionado}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400">Quantidade de Dias</span>
                      <span className="font-medium text-white">{diarias} diárias {horasExtrasLabel > 0 ? `e ${horasExtrasLabel} horas extras` : ''}</span>
                    </div>
                    
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Composição de Valores</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Diárias Base (R$ {prop.diariaBase.toFixed(2)})</span>
                          <span>R$ {(prop.diariaBase * diarias).toFixed(2)}</span>
                        </div>
                        {taxaHorasExtras > 0 && (
                          <div className="flex justify-between">
                            <span>Horas Extras (Taxa: {taxaHorasExtras * 100}%)</span>
                            <span>R$ {(prop.diariaBase * taxaHorasExtras).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Franquia Diária (R$ {prop.valorFranquiaDiario.toFixed(2)})</span>
                          <span>R$ {(prop.valorFranquiaDiario * diarias).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Terceiros {ativarTerceiro ? `(R$ ${thirdPartyValorDiario.toFixed(2)}/d)` : '(Removido)'}</span>
                          <span className={!ativarTerceiro ? 'text-red-500 font-bold' : ''}>
                            R$ {prop.valorTerceirosCobrado.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxas Adicionais</span>
                          <span>R$ {prop.valorTaxas.toFixed(2)}</span>
                        </div>
                        {prop.totalJuros > 0 && !presentationMode && (
                          <div className="flex justify-between text-amber-500">
                            <span>Juros de Parcelamento</span>
                            <span>R$ {prop.totalJuros.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t-2 border-zinc-800 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-white">TOTAL</span>
                        <span className="text-2xl font-black text-emerald-400 font-mono">R$ {prop.total.toFixed(2)}</span>
                      </div>

                      <div className="bg-emerald-500/10 p-3 rounded-md text-emerald-500 font-semibold border border-emerald-500/20">
                        {pagamentos.filter(p => p.valor > 0).map(pag => {
                          if (pag.tipo === 'PIX') return `R$ ${pag.valor.toFixed(2)} no PIX`;
                          const parcelas = parseInt(pag.tipo.replace('Cartão ', '')) || 1;
                          let juros = 0;
                          if (!pag.semJuros) {
                            const taxaObj = params?.interestRates?.find((ir: any) => ir.parcelas === parcelas);
                            if (taxaObj) juros = pag.valor * (taxaObj.taxa / 100);
                          }
                          return `${parcelas}x no Cartão de R$ ${((pag.valor + juros) / parcelas).toFixed(2)}`;
                        }).join(' + ') || 'Pagamento não configurado'}
                      </div>
                      
                      {presentationMode && (
                        <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                          <Button 
                            className={`flex-1 font-bold ${ativarTerceiro ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                            onClick={() => setAtivarTerceiro(true)}
                          >
                            🛡️ Aderir Terceiros
                          </Button>
                          <Button 
                            className={`flex-1 font-bold ${!ativarTerceiro ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                            onClick={() => setAtivarTerceiro(false)}
                          >
                            ❌ Retirar Terceiros
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {!presentationMode && (
                  <div className="space-y-6">
                    <Card className={Math.abs(saldoRestante) > 0.01 ? 'border-amber-500/30 bg-zinc-900' : 'border-emerald-500/30 bg-zinc-900'}>
                      <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Status do Pagamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total do Contrato:</span>
                          <span className="font-bold">R$ {prop.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Alocado:</span>
                          <span className="font-bold text-emerald-400">R$ {totalAlocado.toFixed(2)}</span>
                        </div>
                        <div className={`flex justify-between pt-2 border-t border-zinc-800 font-bold text-lg ${Math.abs(saldoRestante) > 0.01 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          <span>{saldoRestante > 0 ? 'Faltam alocar:' : saldoRestante < 0 ? 'Excesso alocado:' : 'Pagamento Coberto!'}</span>
                          <span>R$ {Math.abs(saldoRestante).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Minuta Contratual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <textarea 
                        className="w-full h-40 p-3 text-xs font-mono bg-[#09090b] text-zinc-300 rounded-md border border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none" 
                        readOnly 
                        value={getMinuta()} 
                      />
                      <Button variant="secondary" className="w-full mt-3" onClick={() => {
                        navigator.clipboard.writeText(getMinuta());
                        alert("Minuta copiada!");
                      }}>Copiar Minuta</Button>
                    </CardContent>
                  </Card>
                </div>
                )}
              </div>
            </div>
            </>
            );
          })()}
          </div>
        </div>
      </div>
    </div>
  );
}

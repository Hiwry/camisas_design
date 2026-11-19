import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Wallet, Package, FileText, TrendingDown, Plus, Trash2, Pencil, Loader2, Save, X, ExternalLink, CheckCircle2, Clock } from 'lucide-react'
import { financeiroService, type OrigemFin } from '@/services/api'
import { brl, fmtData, parseValor } from '@/lib/pdfOrcamento'

// Paleta do sistema: fundo #0B0B0C · card #151516 · superfície #1D1D1F · borda #303034 · primária #E7B32C
const CARD = { background: '#151516', borderColor: '#303034' }
const FIELD = { background: '#1D1D1F', borderColor: '#303034' }
const fieldCls = 'w-full rounded-lg border px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#E7B32C]'
const CATEGORIAS = ['Material', 'Impressão', 'Papel / Tinta', 'Terceiros / Freelancer', 'Frete', 'Software', 'Marketing', 'Salário', 'Outros']
const PEDIDO_STATUS: Record<string, string> = {
  aguardando_briefing: 'Aguardando briefing', em_producao: 'Em produção', aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado', finalizado: 'Finalizado', cancelado: 'Cancelado',
}
const PERIODOS = [['mes', 'Este mês'], ['3m', 'Últimos 3 meses'], ['6m', 'Últimos 6 meses'], ['ano', 'Últimos 12 meses'], ['tudo', 'Tudo']] as const
const ORIGEM_LABEL: Record<OrigemFin, string> = { pedidos: 'Pedidos normais', orcamentos: 'Pedidos de orçamento' }
const ORIGEM_COR: Record<OrigemFin, string> = { pedidos: '#60a5fa', orcamentos: '#E7B32C' }
const VERDE = '#45DB92', VERMELHO = '#f87171', AMARELO = '#E7B32C', LARANJA = '#fb923c'

type Aba = 'pedidos' | 'orcamentos' | 'saidas'
interface Saida { id: number; descricao: string; categoria: string | null; valor: number; data: string; origem: OrigemFin; observacoes: string | null }

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/* eslint-disable @typescript-eslint/no-explicit-any */
const msgErro = (e: any, padrao: string) => e?.response?.data?.message || Object.values(e?.response?.data?.errors ?? {})[0]?.toString() || padrao

export default function FinanceiroPage() {
  const [sp] = useSearchParams()
  const abaIni = sp.get('aba')
  const [aba, setAba] = useState<Aba>(abaIni === 'orcamentos' || abaIni === 'saidas' ? abaIni : 'pedidos')
  const [origemNova, setOrigemNova] = useState<OrigemFin>(sp.get('origem') === 'orcamentos' ? 'orcamentos' : 'pedidos')

  const Tab = ({ id, icon: Icon, children, cor }: { id: Aba; icon: any; children: React.ReactNode; cor?: string }) => (
    <button type="button" onClick={() => setAba(id)} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold"
      style={aba === id ? { background: cor ?? '#E7B32C', color: '#0B0B0C' } : { background: '#151516', color: '#a1a1aa', border: '1px solid #303034' }}>
      <Icon className="w-4 h-4" /> {children}
    </button>
  )

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(231,179,44,0.12)' }}>
          <Wallet className="w-5 h-5" style={{ color: '#E7B32C' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Financeiro</h1>
          <p className="text-xs" style={{ color: '#909098' }}>Entradas, saídas e resultado: pedidos normais e pedidos de orçamento em dashboards separados.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Tab id="pedidos" icon={Package} cor={ORIGEM_COR.pedidos}>Dashboard · Pedidos normais</Tab>
        <Tab id="orcamentos" icon={FileText} cor={ORIGEM_COR.orcamentos}>Dashboard · Orçamentos</Tab>
        <Tab id="saidas" icon={TrendingDown} cor={VERMELHO}>Saídas</Tab>
      </div>

      {aba !== 'saidas' && (
        <DashboardFin key={aba} origem={aba} onNovaSaida={() => { setOrigemNova(aba); setAba('saidas') }} />
      )}
      {aba === 'saidas' && <SaidasTab origemInicial={origemNova} />}
    </div>
  )
}

/* ───────────────────────── Dashboard ───────────────────────── */
export function DashboardFin({ origem, onNovaSaida }: { origem: OrigemFin; onNovaSaida: () => void }) {
  const qc = useQueryClient()
  const [periodo, setPeriodo] = useState('mes')
  const [filtroPg, setFiltroPg] = useState<'todos' | 'pago' | 'pendente'>('todos')
  const { data, isLoading, isError } = useQuery({ queryKey: ['fin-dashboard', origem, periodo], queryFn: () => financeiroService.dashboard(origem, periodo) })
  const cor = ORIGEM_COR[origem]
  const marcar = useMutation({
    mutationFn: ({ id, pago }: { id: number; pago: boolean }) => financeiroService.marcarPago(id, pago),
    onSuccess: (_r, v) => { toast.success(v.pago ? 'Marcado como pago' : 'Marcado como a receber'); qc.invalidateQueries({ queryKey: ['fin-dashboard'] }); qc.invalidateQueries({ queryKey: ['orcamentos'] }) },
    onError: (e) => toast.error(msgErro(e, 'Não consegui alterar o pagamento.')),
  })
  const pedidosFiltrados = (data?.recentes_pedidos ?? []).filter((p: any) =>
    filtroPg === 'todos' || (filtroPg === 'pago' ? p.pago : !p.pago && p.valor > 0 && p.status !== 'cancelado'))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-zinc-300">
          <b style={{ color: cor }}>{ORIGEM_LABEL[origem]}</b>
          <span className="ml-2 text-xs" style={{ color: '#909098' }}>
            {origem === 'pedidos' ? 'pedidos criados direto no sistema (sem orçamento)' : 'pedidos gerados ao converter um orçamento'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select className={fieldCls + ' !w-auto'} style={FIELD} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="button" onClick={onNovaSaida} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
            <Plus className="w-4 h-4" /> Nova saída
          </button>
        </div>
      </div>

      {isLoading && <div className="text-sm" style={{ color: '#909098' }}><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Carregando…</div>}
      {isError && <div className="text-sm text-red-400">Não consegui carregar o dashboard.</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Faturado (valor dos pedidos)" big={brl(data.resumo.entradas)} cor={AMARELO} sub={`${data.resumo.pedidos} pedido(s) · ticket ${brl(data.resumo.ticket_medio)}`} />
            <Kpi label="Recebido (pago)" big={brl(data.resumo.recebido)} cor={VERDE} sub={`${data.resumo.pedidos_pagos} pedido(s) pago(s)`} />
            <Kpi label="A receber (não pago)" big={brl(data.resumo.a_receber)} cor={LARANJA} sub={`${data.resumo.pedidos_pendentes} pedido(s) pendente(s)`} />
            <Kpi label="Saídas" big={brl(data.resumo.saidas)} cor={VERMELHO} sub={`${data.resumo.qtd_saidas} lançamento(s)`} />
            <Kpi label="Resultado em caixa" big={brl(data.resumo.resultado_caixa)} cor={data.resumo.resultado_caixa >= 0 ? VERDE : VERMELHO} sub="recebido − saídas" />
            <Kpi label="Resultado previsto" big={brl(data.resumo.resultado)} cor={data.resumo.resultado >= 0 ? VERDE : VERMELHO} sub={`faturado − saídas · ${data.resumo.cancelados} cancelado(s) fora`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border p-4" style={CARD}>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Faturado, recebido e saídas por mês</h2>
              <Grafico meses={data.meses} />
            </section>

            <section className="rounded-xl border p-4" style={CARD}>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Saídas por categoria</h2>
              {data.saidas_por_categoria.length === 0 ? <p className="text-sm" style={{ color: '#909098' }}>Nenhuma saída neste período.</p> : (
                <div className="space-y-2">
                  {data.saidas_por_categoria.map((c: any) => {
                    const pct = data.resumo.saidas > 0 ? (c.total / data.resumo.saidas) * 100 : 0
                    return (
                      <div key={c.categoria}>
                        <div className="flex justify-between text-xs text-zinc-300 mb-0.5"><span>{c.categoria}</span><span>{brl(c.total)} · {pct.toFixed(0)}%</span></div>
                        <div className="h-1.5 rounded-full" style={{ background: '#2a2a2a' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: VERMELHO }} /></div>
                      </div>
                    )
                  })}
                </div>
              )}
              <h2 className="text-xs font-bold uppercase tracking-wider mt-5 mb-2" style={{ color: '#909098' }}>Pedidos por status</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.pedidos_por_status as Record<string, number>).filter(([, n]) => n > 0).map(([st, n]) => (
                  <span key={st} className="rounded-full border px-2.5 py-1 text-xs text-zinc-200" style={{ borderColor: '#303034' }}>{PEDIDO_STATUS[st] ?? st}: <b>{n}</b></span>
                ))}
                {data.resumo.pedidos + data.resumo.cancelados === 0 && <span className="text-sm" style={{ color: '#909098' }}>Sem pedidos neste período.</span>}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border p-4" style={CARD}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider mr-auto" style={{ color: '#909098' }}>Pedidos do período</h2>
                {(['todos', 'pago', 'pendente'] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFiltroPg(f)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                    style={filtroPg === f ? { background: f === 'pago' ? VERDE : f === 'pendente' ? LARANJA : AMARELO, color: '#0B0B0C', borderColor: 'transparent' } : { borderColor: '#303034', color: '#a1a1aa' }}>
                    {f === 'todos' ? 'Todos' : f === 'pago' ? 'Pagos' : 'A receber'}
                  </button>
                ))}
              </div>
              {pedidosFiltrados.length === 0 ? <p className="text-sm" style={{ color: '#909098' }}>Nenhum pedido neste filtro.</p> : (
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full text-sm"><tbody>
                    {pedidosFiltrados.map((p: any) => (
                      <tr key={p.id} className="border-t first:border-0" style={{ borderColor: '#303034' }}>
                        <td className="py-2 pr-2 text-zinc-100 max-w-[150px] truncate">
                          <Link to={`/pedidos/${p.id}`} className="hover:underline">{p.titulo}</Link>
                          <div className="text-[11px]" style={{ color: '#909098' }}>{PEDIDO_STATUS[p.status] ?? p.status}</div>
                        </td>
                        <td className="pr-2 text-right font-semibold whitespace-nowrap" style={{ color: p.pago ? VERDE : LARANJA }}>{brl(p.valor)}</td>
                        <td className="text-right whitespace-nowrap">
                          {p.status === 'cancelado' || !(p.valor > 0) ? <span className="text-[11px]" style={{ color: '#909098' }}>{p.status === 'cancelado' ? 'cancelado' : 'sem valor'}</span> : p.pago ? (
                            <button type="button" disabled={marcar.isPending} onClick={() => marcar.mutate({ id: p.id, pago: false })} title="Clique para desfazer"
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ color: VERDE, background: VERDE + '1f' }}>
                              <CheckCircle2 className="w-3 h-3" /> Pago
                            </button>
                          ) : (
                            <button type="button" disabled={marcar.isPending} onClick={() => marcar.mutate({ id: p.id, pago: true })} title="Marcar como pago"
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold hover:bg-white/5" style={{ color: LARANJA, borderColor: LARANJA + '55' }}>
                              <Clock className="w-3 h-3" /> Marcar pago
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
            </section>
            <section className="rounded-xl border p-4" style={CARD}>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Últimas saídas</h2>
              {data.recentes_saidas.length === 0 ? <p className="text-sm" style={{ color: '#909098' }}>Nenhuma saída neste período.</p> : (
                <table className="w-full text-sm"><tbody>
                  {data.recentes_saidas.map((s: any) => (
                    <tr key={s.id} className="border-t first:border-0" style={{ borderColor: '#303034' }}>
                      <td className="py-2 pr-2 text-zinc-100">{s.descricao}<div className="text-[11px]" style={{ color: '#909098' }}>{s.categoria || 'Sem categoria'}</div></td>
                      <td className="pr-2 text-xs text-zinc-400">{fmtData(s.data)}</td>
                      <td className="text-right font-semibold" style={{ color: VERMELHO }}>−{brl(s.valor)}</td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, big, sub, cor }: { label: string; big: string; sub?: string; cor?: string }) {
  return (
    <div className="rounded-xl border p-3" style={CARD}>
      <div className="text-[11px]" style={{ color: '#909098' }}>{label}</div>
      <div className="text-xl font-bold mt-0.5" style={{ color: cor ?? '#F5F5F6' }}>{big}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#909098' }}>{sub}</div>}
    </div>
  )
}

function Grafico({ meses }: { meses: { mes: string; entradas: number; recebido: number; saidas: number; resultado: number }[] }) {
  const max = Math.max(1, ...meses.map((m) => Math.max(m.entradas, m.recebido, m.saidas)))
  const nome = (m: string) => { const [y, mm] = m.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+mm - 1]}/${y.slice(2)}` }
  return (
    <div>
      <div className="flex items-end gap-2 h-40">
        {meses.map((m) => (
          <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${nome(m.mes)}: faturado ${brl(m.entradas)} · recebido ${brl(m.recebido)} · saídas ${brl(m.saidas)}`}>
            <div className="flex items-end gap-0.5 w-full justify-center flex-1">
              <div className="w-1/3 max-w-[14px] rounded-t" style={{ height: `${(m.entradas / max) * 100}%`, minHeight: m.entradas ? 3 : 0, background: AMARELO }} />
              <div className="w-1/3 max-w-[14px] rounded-t" style={{ height: `${(m.recebido / max) * 100}%`, minHeight: m.recebido ? 3 : 0, background: VERDE }} />
              <div className="w-1/3 max-w-[14px] rounded-t" style={{ height: `${(m.saidas / max) * 100}%`, minHeight: m.saidas ? 3 : 0, background: VERMELHO }} />
            </div>
            <span className="text-[10px]" style={{ color: '#909098' }}>{nome(m.mes)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-zinc-300">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: AMARELO }} /> Faturado</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: VERDE }} /> Recebido</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: VERMELHO }} /> Saídas</span>
      </div>
    </div>
  )
}

/* ───────────────────────── Saídas ───────────────────────── */
function SaidasTab({ origemInicial }: { origemInicial: OrigemFin }) {
  const qc = useQueryClient()
  const vazio = () => ({ id: 0, descricao: '', categoria: '', valor: '', data: hoje(), origem: origemInicial as OrigemFin, observacoes: '' })
  const [f, setF] = useState(vazio)
  const [filtroOrigem, setFiltroOrigem] = useState<'todas' | OrigemFin>('todas')
  const [mes, setMes] = useState('')

  const { data: lista, isLoading } = useQuery<Saida[]>({
    queryKey: ['saidas', filtroOrigem, mes],
    queryFn: () => financeiroService.saidas({ origem: filtroOrigem === 'todas' ? undefined : filtroOrigem, mes: mes || undefined }),
  })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['saidas'] }); qc.invalidateQueries({ queryKey: ['fin-dashboard'] }) }

  const salvar = useMutation({
    mutationFn: () => {
      const body = { descricao: f.descricao.trim(), categoria: f.categoria.trim() || null, valor: parseValor(f.valor), data: f.data, origem: f.origem, observacoes: f.observacoes.trim() || null }
      return f.id ? financeiroService.atualizarSaida(f.id, body) : financeiroService.criarSaida(body)
    },
    onSuccess: () => { toast.success(f.id ? 'Saída atualizada' : 'Saída cadastrada'); setF({ ...vazio(), origem: f.origem, data: f.data }); refresh() },
    onError: (e) => toast.error(msgErro(e, 'Não consegui salvar a saída.')),
  })
  const excluir = useMutation({
    mutationFn: (id: number) => financeiroService.excluirSaida(id),
    onSuccess: () => { toast.success('Saída excluída'); refresh() },
    onError: (e) => toast.error(msgErro(e, 'Não consegui excluir.')),
  })

  const categorias = useMemo(() => [...new Set([...CATEGORIAS, ...((lista ?? []).map((s) => s.categoria).filter(Boolean) as string[])])], [lista])
  const totalLista = useMemo(() => (lista ?? []).reduce((a, s) => a + s.valor, 0), [lista])

  function enviar() {
    if (!f.descricao.trim()) return toast.error('Informe a descrição da saída.')
    if (!(parseValor(f.valor) > 0)) return toast.error('Informe um valor maior que zero.')
    salvar.mutate()
  }
  function editar(s: Saida) {
    setF({ id: s.id, descricao: s.descricao, categoria: s.categoria ?? '', valor: String(s.valor).replace('.', ','), data: s.data, origem: s.origem, observacoes: s.observacoes ?? '' })
    window.scrollTo?.({ top: 0 })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[400px_1fr] items-start">
      <section className="rounded-xl border p-4" style={CARD}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>{f.id ? `Editar saída #${f.id}` : 'Nova saída'}</h2>
        <div className="space-y-3">
          <label className="text-xs text-zinc-400 space-y-1 block">Descrição
            <input className={fieldCls} style={FIELD} placeholder="Ex.: Papel sublimático, freelancer, frete…" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-zinc-400 space-y-1">Valor (R$)
              <input className={fieldCls + ' text-right'} style={FIELD} inputMode="decimal" placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-400 space-y-1">Data
              <input className={fieldCls} style={FIELD} type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            </label>
          </div>
          <label className="text-xs text-zinc-400 space-y-1 block">Categoria
            <input className={fieldCls} style={FIELD} list="cats-saida" placeholder="Escolha ou digite" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} />
            <datalist id="cats-saida">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Esta saída é de qual fluxo?</div>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: '#303034' }}>
              {(['pedidos', 'orcamentos'] as OrigemFin[]).map((o) => (
                <button key={o} type="button" onClick={() => setF({ ...f, origem: o })} className="flex-1 py-2 text-xs font-semibold"
                  style={f.origem === o ? { background: ORIGEM_COR[o], color: '#0B0B0C' } : { background: '#151516', color: '#909098' }}>
                  {ORIGEM_LABEL[o]}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs text-zinc-400 space-y-1 block">Observações (opcional)
            <textarea className={fieldCls} style={FIELD} rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={enviar} disabled={salvar.isPending} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold disabled:opacity-60" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
              {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {f.id ? 'Salvar alterações' : 'Cadastrar saída'}
            </button>
            {f.id > 0 && <button type="button" onClick={() => setF(vazio())} className="rounded-lg border px-3 text-zinc-300" style={{ borderColor: '#303034' }} title="Cancelar edição"><X className="w-4 h-4" /></button>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-4 min-w-0" style={CARD}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(['todas', 'pedidos', 'orcamentos'] as const).map((o) => (
            <button key={o} type="button" onClick={() => setFiltroOrigem(o)} className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={filtroOrigem === o ? { background: o === 'todas' ? '#E7B32C' : ORIGEM_COR[o], color: '#0B0B0C', borderColor: 'transparent' } : { borderColor: '#303034', color: '#a1a1aa' }}>
              {o === 'todas' ? 'Todas' : ORIGEM_LABEL[o]}
            </button>
          ))}
          <input type="month" className={fieldCls + ' !w-auto ml-auto'} style={FIELD} value={mes} onChange={(e) => setMes(e.target.value)} title="Filtrar por mês" />
          {mes && <button type="button" onClick={() => setMes('')} className="text-xs text-zinc-400 hover:text-zinc-200">limpar</button>}
        </div>

        {isLoading ? <div className="text-sm" style={{ color: '#909098' }}>Carregando…</div> : !lista?.length ? (
          <p className="text-sm py-6 text-center" style={{ color: '#909098' }}>Nenhuma saída {filtroOrigem !== 'todas' || mes ? 'neste filtro' : 'cadastrada ainda'}.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs" style={{ color: '#909098' }}><th className="py-1.5 pr-3">Data</th><th className="pr-3">Descrição</th><th className="pr-3">Fluxo</th><th className="pr-3 text-right">Valor</th><th /></tr></thead>
                <tbody>
                  {lista.map((s) => (
                    <tr key={s.id} className="border-t" style={{ borderColor: '#303034' }}>
                      <td className="py-2 pr-3 text-zinc-300 whitespace-nowrap">{fmtData(s.data)}</td>
                      <td className="pr-3 text-zinc-100">{s.descricao}<div className="text-[11px]" style={{ color: '#909098' }}>{s.categoria || 'Sem categoria'}</div></td>
                      <td className="pr-3"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: ORIGEM_COR[s.origem], background: ORIGEM_COR[s.origem] + '1f' }}>{s.origem === 'pedidos' ? 'Pedidos' : 'Orçamentos'}</span></td>
                      <td className="pr-3 text-right font-semibold whitespace-nowrap" style={{ color: VERMELHO }}>−{brl(s.valor)}</td>
                      <td className="text-right whitespace-nowrap">
                        <button type="button" title="Editar" onClick={() => editar(s)} className="p-1.5 text-zinc-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" title="Excluir" onClick={() => { if (window.confirm(`Excluir a saída "${s.descricao}"?`)) excluir.mutate(s.id) }} className="p-1.5 text-zinc-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-sm" style={{ borderColor: '#303034' }}>
              <span style={{ color: '#909098' }}>{lista.length} lançamento(s)</span>
              <b style={{ color: VERMELHO }}>Total: −{brl(totalLista)}</b>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

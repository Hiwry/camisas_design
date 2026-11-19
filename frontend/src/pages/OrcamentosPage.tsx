import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  FileText, Plus, Trash2, Download, Copy, Save, FolderOpen, X, ArrowRightCircle, XCircle, RotateCcw,
  LayoutDashboard, List, Loader2, ExternalLink, Search,
} from 'lucide-react'
import clsx from 'clsx'
import { confeccaoService, orcamentoService } from '@/services/api'
import { DashboardFin } from '@/pages/FinanceiroPage'
import {
  brl, fmtData, gerarPdfOrcamento, parseValor, textoWhatsapp, totalOrcamento,
  type Orcamento, type OrcamentoItem,
} from '@/lib/pdfOrcamento'

// Paleta do sistema: fundo #0B0B0C · card #151516 · superfície #1D1D1F · borda #303034 · primária #E7B32C
const CARD = { background: '#151516', borderColor: '#303034' }
const FIELD = { background: '#1D1D1F', borderColor: '#303034' }
const fieldCls = 'w-full rounded-lg border px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#E7B32C] disabled:opacity-60'
const SERVICOS = ['Criação de arte', 'Ajuste de arte', 'Vetorização', 'Mockup', 'Arte de goleiro', 'Arte de time completo', 'Alteração de nome/número', 'Pacote de artes']
const LEGACY_KEY = 'orcamentosArtes'

type StatusOrc = 'aberto' | 'convertido' | 'perdido'
interface PedidoMini { id: number; titulo: string; status: string; valor: number; pagamento_status?: string }
interface Registro extends Orcamento { status: StatusOrc; pedidos: PedidoMini[]; total: number }

const STATUS_COR: Record<StatusOrc, { label: string; cor: string }> = {
  aberto: { label: 'Em aberto', cor: '#E7B32C' },
  convertido: { label: 'Convertido', cor: '#45DB92' },
  perdido: { label: 'Perdido', cor: '#f87171' },
}
const PEDIDO_STATUS: Record<string, string> = {
  aguardando_briefing: 'Aguardando briefing', em_producao: 'Em produção', aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado', finalizado: 'Finalizado', cancelado: 'Cancelado',
}

const hoje = () => {
  const d = new Date() // data local (toISOString usaria UTC e viraria o dia à noite)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
let seq = 1
const novoItem = (): OrcamentoItem => ({ id: Date.now() + seq++, arte: '', servico: '', data: hoje(), valor: '' })
const vazio = (): Registro => ({ id: 0, numero: 0, cliente: '', whatsapp: '', data: hoje(), obs: '', itens: [novoItem()], criadoEm: '', status: 'aberto', pedidos: [], total: 0 })

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromApi(a: any): Registro {
  return {
    id: a.id, numero: a.numero, cliente: a.cliente_nome ?? '', whatsapp: a.cliente_whatsapp ?? '', data: a.data, obs: a.observacoes ?? '',
    itens: (a.itens ?? []).map((i: any, idx: number) => ({
      id: idx + 1, arte: i.arte, servico: i.servico ?? '', data: i.data ?? '', valor: String(i.valor ?? '').replace('.', ','), pedido_id: i.pedido_id,
    })),
    criadoEm: a.created_at, status: a.status, pedidos: a.pedidos ?? [], total: a.total ?? 0,
  }
}
function toPayload(o: Registro) {
  return {
    cliente_nome: o.cliente || null,
    cliente_whatsapp: o.whatsapp || null,
    data: o.data,
    observacoes: o.obs || null,
    itens: o.itens.filter((i) => i.arte.trim()).map((i) => ({ arte: i.arte.trim(), servico: i.servico, data: i.data || null, valor: parseValor(i.valor) })),
  }
}
const msgErro = (e: any, padrao: string) => e?.response?.data?.message || Object.values(e?.response?.data?.errors ?? {})[0]?.toString() || padrao

export default function OrcamentosPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [aba, setAba] = useState<'dashboard' | 'lista' | 'editor'>('dashboard')
  const [orc, setOrc] = useState<Registro>(vazio)
  const [convertendo, setConvertendo] = useState<Registro | null>(null)
  const [filtro, setFiltro] = useState<'todos' | StatusOrc>('todos')
  const [busca, setBusca] = useState('')
  const [legado, setLegado] = useState(0)

  const { data: listaRaw, isLoading } = useQuery({ queryKey: ['orcamentos'], queryFn: orcamentoService.listar })
  const { data: dash } = useQuery({ queryKey: ['orcamentos-dashboard'], queryFn: orcamentoService.dashboard })
  const lista: Registro[] = useMemo(() => (listaRaw ?? []).map(fromApi), [listaRaw])
  const refresh = () => { qc.invalidateQueries({ queryKey: ['orcamentos'] }); qc.invalidateQueries({ queryKey: ['orcamentos-dashboard'] }); qc.invalidateQueries({ queryKey: ['pedidos'] }) }

  // orçamentos antigos guardados só no navegador
  useEffect(() => {
    try { setLegado((JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]') as unknown[]).length) } catch { setLegado(0) }
  }, [])
  async function importarLegado() {
    try {
      const antigos = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]') as any[]
      for (const a of antigos.slice().reverse()) {
        await orcamentoService.criar(toPayload({ ...vazio(), cliente: a.cliente, whatsapp: a.whatsapp, data: a.data, obs: a.obs, itens: a.itens }))
      }
      localStorage.removeItem(LEGACY_KEY); setLegado(0); refresh()
      toast.success(`${antigos.length} orçamento(s) importado(s)`)
    } catch (e) { toast.error(msgErro(e, 'Não consegui importar. Tente de novo.')) }
  }

  const salvar = useMutation({
    mutationFn: (o: Registro) => (o.id ? orcamentoService.atualizar(o.id, toPayload(o)) : orcamentoService.criar(toPayload(o))),
    onSuccess: (a) => { refresh(); setOrc(fromApi(a)) },
    onError: (e) => toast.error(msgErro(e, 'Não consegui salvar o orçamento.')),
  })
  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'aberto' | 'perdido' }) => orcamentoService.status(id, status),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(msgErro(e, 'Não consegui alterar o status.')),
  })
  const excluir = useMutation({
    mutationFn: (id: number) => orcamentoService.excluir(id),
    onSuccess: (_d, id) => { refresh(); if (orc.id === id) setOrc(vazio()); toast.success('Orçamento excluído') },
    onError: (e) => toast.error(msgErro(e, 'Não consegui excluir.')),
  })

  const travado = orc.status === 'convertido'
  const total = useMemo(() => totalOrcamento(orc), [orc])
  const patch = (p: Partial<Registro>) => setOrc((o) => ({ ...o, ...p }))
  const patchItem = (id: number, p: Partial<OrcamentoItem>) => setOrc((o) => ({ ...o, itens: o.itens.map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const addItem = () => setOrc((o) => ({ ...o, itens: [...o.itens, novoItem()] }))
  const delItem = (id: number) => setOrc((o) => ({ ...o, itens: o.itens.length > 1 ? o.itens.filter((i) => i.id !== id) : o.itens }))

  function validar(o: Registro): boolean {
    if (!o.itens.some((i) => i.arte.trim())) { toast.error('Informe o nome de pelo menos uma arte.'); return false }
    if (o.itens.some((i) => i.arte.trim() && !(parseValor(i.valor) >= 0 && i.valor.trim() !== ''))) { toast.error('Informe o valor de todas as artes.'); return false }
    return true
  }
  /** Garante que o orçamento esteja salvo (para ter número) antes de PDF/WhatsApp/conversão. */
  async function garantirSalvo(): Promise<Registro | null> {
    if (!validar(orc)) return null
    if (orc.status === 'convertido') return orc
    try { return fromApi(await salvar.mutateAsync(orc)) } catch { return null }
  }
  async function onSalvar() { const r = await garantirSalvo(); if (r) toast.success(`Orçamento Nº ${String(r.numero).padStart(4, '0')} salvo`) }
  async function onPdf() { const r = await garantirSalvo(); if (r) gerarPdfOrcamento(r) }
  async function onCopiar() {
    const r = await garantirSalvo(); if (!r) return
    try { await navigator.clipboard.writeText(textoWhatsapp(r)); toast.success('Texto copiado. É só colar no WhatsApp.') } catch { toast.error('Não consegui copiar. Use o PDF.') }
  }
  async function onConverter() { const r = await garantirSalvo(); if (r) setConvertendo(r) }
  function abrir(o: Registro) { setOrc(o); setAba('editor'); window.scrollTo?.({ top: 0 }) }
  function confirmarExcluir(o: Registro) {
    if (window.confirm(`Excluir o orçamento Nº ${String(o.numero).padStart(4, '0')}?`)) excluir.mutate(o.id)
  }

  const filtrada = useMemo(() => lista.filter((o) =>
    (filtro === 'todos' || o.status === filtro) &&
    (!busca.trim() || `${o.cliente} ${String(o.numero)} ${o.itens.map((i) => i.arte).join(' ')}`.toLowerCase().includes(busca.toLowerCase())),
  ), [lista, filtro, busca])

  const Aba = ({ id, icon: Icon, children }: { id: typeof aba; icon: any; children: React.ReactNode }) => (
    <button type="button" onClick={() => setAba(id)}
      className={clsx('flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors')}
      style={aba === id ? { background: '#E7B32C', color: '#0B0B0C' } : { background: '#151516', color: '#a1a1aa', border: '1px solid #303034' }}>
      <Icon className="w-4 h-4" /> {children}
    </button>
  )

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(231,179,44,0.12)' }}>
          <FileText className="w-5 h-5" style={{ color: '#E7B32C' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Orçamentos de Artes</h1>
          <p className="text-xs" style={{ color: '#909098' }}>Monte o orçamento, envie ao cliente e converta em pedido quando for aprovado.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Aba id="dashboard" icon={LayoutDashboard}>Dashboard</Aba>
        <Aba id="lista" icon={List}>Orçamentos{lista.length ? ` (${lista.length})` : ''}</Aba>
        <button type="button" onClick={() => { setOrc(vazio()); setAba('editor') }}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold border" style={{ borderColor: '#E7B32C', color: '#E7B32C' }}>
          <Plus className="w-4 h-4" /> Novo orçamento
        </button>
      </div>

      {legado > 0 && (
        <div className="mb-4 rounded-xl border p-3 flex flex-wrap items-center gap-3 text-sm" style={{ borderColor: '#E7B32C55', background: 'rgba(231,179,44,0.07)' }}>
          <span className="text-zinc-200">Você tem <b>{legado}</b> orçamento(s) salvo(s) só neste navegador (versão antiga).</span>
          <button type="button" onClick={importarLegado} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: '#E7B32C', color: '#0B0B0C' }}>Importar para o sistema</button>
          <button type="button" onClick={() => { localStorage.removeItem(LEGACY_KEY); setLegado(0) }} className="text-xs text-zinc-400 hover:text-zinc-200">Descartar</button>
        </div>
      )}

      {/* ───────── DASHBOARD ───────── */}
      {aba === 'dashboard' && (
        <div className="space-y-4">
          {!dash ? <div className="text-sm" style={{ color: '#909098' }}><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Carregando…</div> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Kpi label="Orçamentos feitos" big={String(dash.orcamentos.total)} sub={brl(dash.orcamentos.valor_orcado)} />
                <Kpi label="Em aberto" big={String(dash.orcamentos.abertos)} sub={brl(dash.orcamentos.valor_aberto)} cor="#E7B32C" />
                <Kpi label="Convertidos em pedido" big={String(dash.orcamentos.convertidos)} sub={brl(dash.orcamentos.valor_convertido)} cor="#45DB92" />
                <Kpi label="Perdidos" big={String(dash.orcamentos.perdidos)} sub={brl(dash.orcamentos.valor_perdido)} cor="#f87171" />
                <Kpi label="Taxa de conversão" big={dash.orcamentos.taxa_conversao == null ? '—' : `${String(dash.orcamentos.taxa_conversao).replace('.', ',')}%`} sub="convertidos ÷ (convertidos + perdidos)" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border p-4" style={CARD}>
                  <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Orçado x convertido (6 meses)</h2>
                  <Grafico meses={dash.meses} />
                </section>

                <section className="rounded-xl border p-4" style={CARD}>
                  <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Pedidos gerados por orçamento</h2>
                  <div className="flex items-end gap-6 mb-3">
                    <div><div className="text-2xl font-bold text-white">{dash.pedidos.total}</div><div className="text-xs" style={{ color: '#909098' }}>pedidos</div></div>
                    <div><div className="text-2xl font-bold" style={{ color: '#45DB92' }}>{brl(dash.pedidos.valor_total)}</div><div className="text-xs" style={{ color: '#909098' }}>valor total</div></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(dash.pedidos.por_status as Record<string, number>).filter(([, n]) => n > 0).map(([st, n]) => (
                      <span key={st} className="rounded-full border px-2.5 py-1 text-xs text-zinc-200" style={{ borderColor: '#303034' }}>{PEDIDO_STATUS[st] ?? st}: <b>{n}</b></span>
                    ))}
                    {dash.pedidos.total === 0 && <span className="text-sm" style={{ color: '#909098' }}>Nenhum pedido gerado ainda.</span>}
                  </div>
                </section>
              </div>

              <section className="pt-2">
                <h2 className="text-sm font-bold text-white mb-1">Financeiro dos orçamentos</h2>
                <p className="text-xs mb-3" style={{ color: '#909098' }}>Saídas, valores pagos e a receber dos pedidos gerados por orçamento.</p>
                <DashboardFin origem="orcamentos" onNovaSaida={() => navigate('/financeiro?aba=saidas&origem=orcamentos')} />
              </section>
            </>
          )}
        </div>
      )}

      {/* ───────── LISTA ───────── */}
      {aba === 'lista' && (
        <section className="rounded-xl border p-4" style={CARD}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(['todos', 'aberto', 'convertido', 'perdido'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFiltro(f)} className="rounded-full border px-3 py-1 text-xs font-semibold"
                style={filtro === f ? { background: '#E7B32C', color: '#0B0B0C', borderColor: '#E7B32C' } : { borderColor: '#303034', color: '#a1a1aa' }}>
                {f === 'todos' ? 'Todos' : STATUS_COR[f].label}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input className={fieldCls + ' pl-8 w-56'} style={FIELD} placeholder="Buscar cliente, nº ou arte" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          {isLoading ? <div className="text-sm" style={{ color: '#909098' }}>Carregando…</div> : filtrada.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: '#909098' }}>Nenhum orçamento {filtro !== 'todos' || busca ? 'neste filtro' : 'ainda. Clique em “Novo orçamento”'}.</p>
          ) : (
            <div className="space-y-2">
              {filtrada.map((o) => (
                <div key={o.id} className="rounded-lg border p-3" style={{ borderColor: '#303034', background: '#1D1D1F' }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-zinc-100">Nº {String(o.numero).padStart(4, '0')} · {o.cliente || 'Sem cliente'}</span>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: STATUS_COR[o.status].cor, background: STATUS_COR[o.status].cor + '1f' }}>{STATUS_COR[o.status].label}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#909098' }}>{fmtData(o.data)} · {o.itens.length} {o.itens.length > 1 ? 'artes' : 'arte'}: {o.itens.map((i) => i.arte).join(', ')}</div>
                      {o.pedidos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {o.pedidos.map((p) => (
                            <Link key={p.id} to={`/pedidos/${p.id}`} className="rounded border px-2 py-0.5 text-[11px] hover:border-[#E7B32C]" style={{ borderColor: '#303034', color: '#d4d4d8' }}>
                              Pedido #{p.id} · {PEDIDO_STATUS[p.status] ?? p.status} ·{' '}
                              <b style={{ color: p.pagamento_status === 'pago' ? '#45DB92' : '#fb923c' }}>{p.pagamento_status === 'pago' ? 'Pago' : 'A receber'}</b>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-lg font-bold" style={{ color: '#E7B32C' }}>{brl(o.total)}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <Btn onClick={() => abrir(o)} icon={FolderOpen}>{o.status === 'convertido' ? 'Ver' : 'Editar'}</Btn>
                    <Btn onClick={() => gerarPdfOrcamento(o)} icon={Download}>PDF</Btn>
                    <Btn onClick={async () => { try { await navigator.clipboard.writeText(textoWhatsapp(o)); toast.success('Texto copiado') } catch { toast.error('Não consegui copiar') } }} icon={Copy}>WhatsApp</Btn>
                    {o.status === 'aberto' && <Btn onClick={() => setConvertendo(o)} icon={ArrowRightCircle} destaque>Converter em pedido</Btn>}
                    {o.status === 'aberto' && <Btn onClick={() => mudarStatus.mutate({ id: o.id, status: 'perdido' })} icon={XCircle}>Marcar perdido</Btn>}
                    {o.status === 'perdido' && <Btn onClick={() => mudarStatus.mutate({ id: o.id, status: 'aberto' })} icon={RotateCcw}>Reabrir</Btn>}
                    {o.status !== 'convertido' && <Btn onClick={() => confirmarExcluir(o)} icon={Trash2} perigo>Excluir</Btn>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ───────── EDITOR ───────── */}
      {aba === 'editor' && (
        <div className="space-y-3 max-w-5xl">
          {travado && (
            <div className="rounded-xl border p-3 text-sm flex flex-wrap items-center gap-2" style={{ borderColor: '#45DB9255', background: 'rgba(69,219,146,0.07)', color: '#d4d4d8' }}>
              Este orçamento já virou pedido e não pode mais ser editado.
              {orc.pedidos.map((p) => <Link key={p.id} to={`/pedidos/${p.id}`} className="underline" style={{ color: '#45DB92' }}>Pedido #{p.id}</Link>)}
            </div>
          )}
          <fieldset disabled={travado} className="space-y-3 min-w-0">
            <section className="rounded-xl border p-4" style={CARD}>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>
                {orc.id ? `Orçamento Nº ${String(orc.numero).padStart(4, '0')}` : 'Novo orçamento'}
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-zinc-400 space-y-1">Cliente
                  <input className={fieldCls} style={FIELD} placeholder="Nome do cliente" value={orc.cliente} onChange={(e) => patch({ cliente: e.target.value })} />
                </label>
                <label className="text-xs text-zinc-400 space-y-1">WhatsApp (opcional)
                  <input className={fieldCls} style={FIELD} placeholder="(00) 00000-0000" value={orc.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} />
                </label>
                <label className="text-xs text-zinc-400 space-y-1">Data do orçamento
                  <input className={fieldCls} style={FIELD} type="date" value={orc.data} onChange={(e) => patch({ data: e.target.value })} />
                </label>
              </div>
            </section>

            <section className="rounded-xl border p-4" style={CARD}>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Artes</h2>
              <datalist id="servicos-lista">{SERVICOS.map((s) => <option key={s} value={s} />)}</datalist>
              <div className="hidden md:grid grid-cols-[1.4fr_1.2fr_150px_130px_36px] gap-2 text-[11px] mb-1.5 px-1" style={{ color: '#909098' }}>
                <span>Nome da arte</span><span>Serviço</span><span>Data (prazo)</span><span>Valor (R$)</span><span />
              </div>
              <div className="space-y-2">
                {orc.itens.map((i) => (
                  <div key={i.id} className="grid gap-2 md:grid-cols-[1.4fr_1.2fr_150px_130px_36px] rounded-lg border p-2 md:p-1.5 md:border-0" style={{ borderColor: '#303034' }}>
                    <input className={fieldCls} style={FIELD} placeholder="Nome da arte" value={i.arte} onChange={(e) => patchItem(i.id, { arte: e.target.value })} />
                    <input className={fieldCls} style={FIELD} list="servicos-lista" placeholder="Serviço" value={i.servico} onChange={(e) => patchItem(i.id, { servico: e.target.value })} />
                    <input className={fieldCls} style={FIELD} type="date" value={i.data} onChange={(e) => patchItem(i.id, { data: e.target.value })} />
                    <input className={fieldCls + ' text-right'} style={FIELD} inputMode="decimal" placeholder="0,00" value={i.valor} onChange={(e) => patchItem(i.id, { valor: e.target.value })} />
                    <button type="button" title="Remover linha" onClick={() => delItem(i.id)} disabled={orc.itens.length === 1}
                      className="flex items-center justify-center text-zinc-500 hover:text-red-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} className="mt-3 flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#E7B32C' }}>
                <Plus className="w-4 h-4" /> Adicionar arte
              </button>
              <label className="text-xs text-zinc-400 space-y-1 block mt-4">Observações (opcional)
                <textarea className={fieldCls} style={FIELD} rows={2} placeholder="Ex.: validade de 7 dias, pagamento via Pix…" value={orc.obs} onChange={(e) => patch({ obs: e.target.value })} />
              </label>
            </section>
          </fieldset>

          <section className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3" style={CARD}>
            <div>
              <div className="text-xs" style={{ color: '#909098' }}>Total</div>
              <div className="text-2xl font-bold" style={{ color: '#E7B32C' }}>{brl(total)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onCopiar} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-zinc-200" style={{ borderColor: '#303034' }}><Copy className="w-4 h-4" /> Copiar p/ WhatsApp</button>
              <button type="button" onClick={onPdf} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-zinc-200" style={{ borderColor: '#303034' }}><Download className="w-4 h-4" /> PDF</button>
              {!travado && (
                <>
                  <button type="button" onClick={onSalvar} disabled={salvar.isPending} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-60" style={{ borderColor: '#303034' }}>
                    {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                  </button>
                  <button type="button" onClick={onConverter} disabled={salvar.isPending} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
                    <ArrowRightCircle className="w-4 h-4" /> Converter em pedido
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {convertendo && <ModalConverter orc={convertendo} onClose={() => setConvertendo(null)} onFeito={(a) => { setConvertendo(null); refresh(); if (orc.id === a.id) setOrc(fromApi(a)); setAba('lista') }} />}
    </div>
  )
}

function Kpi({ label, big, sub, cor }: { label: string; big: string; sub?: string; cor?: string }) {
  return (
    <div className="rounded-xl border p-3" style={CARD}>
      <div className="text-[11px]" style={{ color: '#909098' }}>{label}</div>
      <div className="text-2xl font-bold mt-0.5" style={{ color: cor ?? '#F5F5F6' }}>{big}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#909098' }}>{sub}</div>}
    </div>
  )
}

function Btn({ children, icon: Icon, onClick, destaque, perigo }: { children: React.ReactNode; icon: any; onClick: () => void; destaque?: boolean; perigo?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
      style={destaque ? { background: '#E7B32C', color: '#0B0B0C', borderColor: '#E7B32C' } : { borderColor: '#303034', color: perigo ? '#f87171' : '#d4d4d8' }}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  )
}

function Grafico({ meses }: { meses: { mes: string; valor_orcado: number; valor_convertido: number; qtd_orcamentos: number; qtd_convertidos: number }[] }) {
  const max = Math.max(1, ...meses.map((m) => m.valor_orcado))
  const nome = (m: string) => { const [y, mm] = m.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+mm - 1]}/${y.slice(2)}` }
  return (
    <div>
      <div className="flex items-end gap-3 h-40">
        {meses.map((m) => (
          <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${nome(m.mes)}: orçado ${brl(m.valor_orcado)} (${m.qtd_orcamentos}) · convertido ${brl(m.valor_convertido)} (${m.qtd_convertidos})`}>
            <div className="flex items-end gap-1 w-full justify-center flex-1">
              <div className="w-1/2 max-w-[22px] rounded-t" style={{ height: `${(m.valor_orcado / max) * 100}%`, minHeight: m.valor_orcado ? 3 : 0, background: '#E7B32C' }} />
              <div className="w-1/2 max-w-[22px] rounded-t" style={{ height: `${(m.valor_convertido / max) * 100}%`, minHeight: m.valor_convertido ? 3 : 0, background: '#45DB92' }} />
            </div>
            <span className="text-[10px]" style={{ color: '#909098' }}>{nome(m.mes)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-zinc-300">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: '#E7B32C' }} /> Orçado</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: '#45DB92' }} /> Convertido em pedido</span>
      </div>
    </div>
  )
}

function ModalConverter({ orc, onClose, onFeito }: { orc: Registro; onClose: () => void; onFeito: (o: any) => void }) {
  const [confeccaoId, setConfeccaoId] = useState('')
  const [tipo, setTipo] = useState('sublimacao')
  const { data: raw } = useQuery({ queryKey: ['confeccoes-lista'], queryFn: () => confeccaoService.listar({ per_page: 100 }) })
  const confeccoes: { id: number; nome: string }[] = useMemo(() => (Array.isArray(raw) ? raw : raw?.data ?? []), [raw])
  const conv = useMutation({
    mutationFn: () => orcamentoService.converter(orc.id, { confeccao_id: +confeccaoId, tipo_impressao: tipo }),
    onSuccess: (r) => { toast.success(`${r.criados.length} pedido(s) criado(s)`); onFeito(r.orcamento) },
    onError: (e) => toast.error(msgErro(e, 'Não consegui converter em pedido.')),
  })
  const n = orc.itens.filter((i) => i.arte.trim()).length
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border p-5" style={{ background: '#151516', borderColor: '#303034' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-white">Converter em pedido</h3>
            <p className="text-xs mt-0.5" style={{ color: '#909098' }}>Orçamento Nº {String(orc.numero).padStart(4, '0')} · {orc.cliente || 'Sem cliente'} · {brl(orc.total)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-zinc-300 mb-3">Vai criar <b>{n} {n > 1 ? 'pedidos' : 'pedido'}</b> (um por arte), com o valor e a data de cada linha.</p>
        <label className="text-xs text-zinc-400 space-y-1 block mb-3">Confecção do pedido
          <select className={fieldCls} style={FIELD} value={confeccaoId} onChange={(e) => setConfeccaoId(e.target.value)}>
            <option value="">Selecione…</option>
            {confeccoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-400 space-y-1 block mb-4">Tipo de impressão
          <select className={fieldCls} style={FIELD} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="sublimacao">Sublimação</option><option value="bordado">Bordado</option><option value="serigrafia">Serigrafia</option>
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-semibold text-zinc-300" style={{ borderColor: '#303034' }}>Cancelar</button>
          <button type="button" disabled={!confeccaoId || conv.isPending} onClick={() => conv.mutate()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
            {conv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />} Criar pedido{n > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

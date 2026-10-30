import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { pedidoService, confeccaoService, shopService, ShopItem } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, ClipboardList, Calendar, AlertCircle, X, Paperclip, FileText, ImageIcon, Ban, Zap, Clock, ShoppingBag, Sparkles, Clipboard, DollarSign } from 'lucide-react'
import { format, parseISO, isPast, addHours } from 'date-fns'
import clsx from 'clsx'

/* ── Configuração de planos (SLA) ── */
const PLANO_CFG: Record<string, { label: string; sla: number; expresso: number; cor: string }> = {
  avulso:       { label: 'AVULSO', sla: 48, expresso: 6, cor: '#71717a' },
  basico:       { label: 'START',  sla: 48, expresso: 6, cor: '#6366f1' },
  profissional: { label: 'PRO',    sla: 24, expresso: 6, cor: '#d4a020' },
  premium:      { label: 'VIP',    sla: 12, expresso: 6, cor: '#8b5cf6' },
}

function calcularPrazo(slaHoras: number): string {
  return format(addHours(new Date(), slaHoras), 'yyyy-MM-dd')
}

const STATUS_LABELS: Record<string, string> = {
  aguardando_briefing:  'Aguardando Briefing',
  em_producao:          'Em Produção',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado:             'Aprovado',
  finalizado:           'Finalizado',
  cancelado:            'Cancelado',
}
const STATUS_BADGE: Record<string, string> = {
  aguardando_briefing:  'bg-indigo-950 text-indigo-400 border-indigo-900',
  em_producao:          'bg-blue-950 text-blue-400 border-blue-900',
  aguardando_aprovacao: 'bg-amber-950 text-amber-400 border-amber-900',
  aprovado:             'bg-emerald-950 text-emerald-400 border-emerald-900',
  finalizado:           'bg-purple-950 text-purple-400 border-purple-900',
  cancelado:            'bg-red-950 text-red-400 border-red-900',
}
const TIPO_LABEL: Record<string, string> = {
  sublimacao: 'Sublimação', bordado: 'Bordado', serigrafia: 'Serigrafia',
}

export default function PedidosPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { isAdmin, user } = useAuthStore()
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState('')
  const [showForm, setShowForm]             = useState(false)
  const [referencias, setReferencias]       = useState<File[]>([])
  const [expresso, setExpresso]             = useState(false)
  const [confeccaoSel, setConfeccaoSel]     = useState<{ plano: string } | null>(null)
  const [valorPedido, setValorPedido]       = useState<string>('')
  const [shopItemSel, setShopItemSel]       = useState<string>('')
  const refInputRef                         = useRef<HTMLInputElement>(null)

  // Consulta itens ativos do Shop para seleção rápida de serviços
  const { data: shopData } = useQuery({
    queryKey: ['shop-itens-lista'],
    queryFn: shopService.listarItens,
  })
  const shopItens: ShopItem[] = shopData?.itens ?? (Array.isArray(shopData) ? (shopData as any) : [])

  // Suporte para colar imagens diretamente da Área de Transferência (Ctrl + V)
  useEffect(() => {
    if (!showForm) return

    function handleWindowPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return

      const pasted: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png'
            const newFile = new File([blob], `print_${Date.now()}.${ext}`, { type: blob.type })
            pasted.push(newFile)
          }
        }
      }

      if (pasted.length > 0) {
        e.preventDefault()
        setReferencias((prev) => [...prev, ...pasted])
        toast.success(`${pasted.length} imagem(ns) colada(s) da área de transferência!`, { icon: '📋' })
      }
    }

    window.addEventListener('paste', handleWindowPaste)
    return () => window.removeEventListener('paste', handleWindowPaste)
  }, [showForm])

  // SLA do pedido atual: admin usa plano da confecção selecionada, confecção usa o seu
  const planoAtual = isAdmin()
    ? (confeccaoSel?.plano ?? 'basico')
    : (user?.confeccao?.plano ?? 'basico')
  const cfg = PLANO_CFG[planoAtual] ?? PLANO_CFG.basico
  const prazoCalculado = calcularPrazo(expresso ? cfg.expresso : cfg.sla)

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos', search, statusFilter],
    queryFn: () => pedidoService.listar({ search, status: statusFilter }),
  })

  const { data: confeccoesRaw } = useQuery({
    queryKey: ['confeccoes-lista'],
    queryFn: () => confeccaoService.listar({ per_page: 100 }),
    enabled: isAdmin(),
  })
  const confeccoesList: { id: number; nome: string; plano: string }[] =
    Array.isArray(confeccoesRaw) ? confeccoesRaw : (confeccoesRaw?.data ?? [])

  const criarMutation = useMutation({
    mutationFn: pedidoService.criar,
    onSuccess: () => {
      toast.success('Pedido criado!')
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setShowForm(false)
      setReferencias([])
      setExpresso(false)
      setConfeccaoSel(null)
      setValorPedido('')
      setShopItemSel('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar pedido.')
    },
  })

  const cancelarMutation = useMutation({
    mutationFn: (id: number) => pedidoService.cancelar(id),
    onSuccess: () => {
      toast.success('Pedido cancelado.')
      qc.invalidateQueries({ queryKey: ['pedidos'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao cancelar pedido.')
    },
  })

  function handleShopItemChange(itemId: string) {
    setShopItemSel(itemId)
    if (!itemId) return
    const found = shopItens.find((it) => it.id === itemId || String(it.db_id) === itemId)
    if (found && found.valor > 0) {
      setValorPedido(String(found.valor))
      toast.success(`Serviço selecionado: ${found.nome} — R$ ${found.valor.toFixed(2).replace('.', ',')}`, { icon: '🛒' })
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Injeta prazo calculado pelo plano (sobrescreve campo do form)
    fd.set('prazo', prazoCalculado)
    if (expresso) fd.set('expresso', '1')
    if (valorPedido) fd.set('valor', valorPedido)
    referencias.forEach((file) => fd.append('referencias[]', file))
    criarMutation.mutate(fd as unknown as Record<string, unknown>)
  }

  function addReferencias(files: FileList | null) {
    if (!files) return
    const novos = Array.from(files).filter(
      (f) => !referencias.find((r) => r.name === f.name && r.size === f.size)
    )
    setReferencias((prev) => [...prev, ...novos])
  }

  function removeReferencia(index: number) {
    setReferencias((prev) => prev.filter((_, i) => i !== index))
  }

  function isImage(file: File) {
    return file.type.startsWith('image/')
  }

  const pedidos = Array.isArray(data) ? data : (data?.data ?? [])

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(212,160,32,0.12)', border: '1px solid rgba(212,160,32,0.2)' }}
          >
            <ClipboardList className="w-4 h-4" style={{ color: '#d4a020' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Pedidos</h1>
            <p className="text-xs text-zinc-500">{pedidos.length} pedidos</p>
          </div>
        </div>
        <button className="btn-primary text-xs px-4 py-2" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5" /> Novo Pedido
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-5 md:p-6 space-y-4">

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              className="input pl-9"
              placeholder="Buscar pedidos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-52"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Tabela */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <svg className="animate-spin w-5 h-5 text-zinc-600" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-zinc-600">
              <ClipboardList className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Nenhum pedido encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#161616', borderBottom: '1px solid #2a2a2a' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Pedido</th>
                  {isAdmin() && <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Confecção</th>}
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Tipo</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Prazo</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p: {
                  id: number; titulo: string; tipo_impressao: string;
                  status: string; prazo: string | null;
                  confeccao: { nome: string }
                }, i: number) => {
                  const atrasado = p.prazo && isPast(parseISO(p.prazo)) &&
                    !['aprovado', 'finalizado', 'cancelado'].includes(p.status)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/pedidos/${p.id}`)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid #1e1e1e',
                        background: i % 2 === 0 ? '#111' : '#141414',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#111' : '#141414')}
                    >
                      <td className="px-5 py-3.5 font-medium text-zinc-100">
                        <div className="flex items-center gap-2">
                          <span>{p.titulo}</span>
                          {(p as any).valor > 0 && (
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                              R$ {Number((p as any).valor).toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdmin() && <td className="px-5 py-3.5 text-zinc-500">{p.confeccao?.nome}</td>}
                      <td className="px-5 py-3.5 text-zinc-500">{TIPO_LABEL[p.tipo_impressao]}</td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('badge border text-[10px]', STATUS_BADGE[p.status])}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.prazo ? (
                          <div className={clsx('flex items-center gap-1 text-xs', atrasado ? 'text-red-400' : 'text-zinc-500')}>
                            {atrasado ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                            {format(parseISO(p.prazo), "dd/MM/yyyy")}
                          </div>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        {p.status !== 'cancelado' && p.status !== 'finalizado' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Cancelar o pedido "${p.titulo}"?`)) {
                                cancelarMutation.mutate(p.id)
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-950/40"
                            title="Cancelar pedido"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal novo pedido */}
      {showForm && (
        <DarkModal title="Novo Pedido" onClose={() => { setShowForm(false); setReferencias([]); setExpresso(false); setConfeccaoSel(null); setValorPedido(''); setShopItemSel('') }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isAdmin() && user?.confeccao && (() => {
              const conf = user.confeccao
              const artesPlano = Math.max(0, conf.limite_mensal - conf.artes_usadas_mes)
              const extras = conf.artes_extras ?? 0
              const total = artesPlano + extras
              return (
                <div
                  className="rounded-xl p-3 border flex items-center justify-between"
                  style={{
                    background: total > 0 ? 'rgba(212,160,32,0.06)' : 'rgba(239,68,68,0.1)',
                    borderColor: total > 0 ? 'rgba(212,160,32,0.2)' : 'rgba(239,68,68,0.3)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#d4a020]" />
                    <span className="text-xs text-zinc-300">
                      Saldo disponível:{' '}
                      <strong className="text-white">
                        {total} arte{total !== 1 ? 's' : ''}
                      </strong>{' '}
                      ({artesPlano} do plano + {extras} extras)
                    </span>
                  </div>
                  <Link
                    to="/shop"
                    className="text-[11px] font-bold text-[#d4a020] hover:underline flex items-center gap-1"
                  >
                    <ShoppingBag className="w-3 h-3" /> Shop Avulso
                  </Link>
                </div>
              )
            })()}
            <div>
              <label className="label">Título do pedido</label>
              <input name="titulo" className="input" required placeholder="Ex: Camiseta Time Alfa" />
            </div>
            {isAdmin() && (
              <div>
                <label className="label">Confecção</label>
                <select
                  name="confeccao_id"
                  className="input"
                  required
                  onChange={(e) => {
                    const sel = confeccoesList.find((c) => String(c.id) === e.target.value)
                    setConfeccaoSel(sel ?? null)
                    setExpresso(false)
                  }}
                >
                  <option value="">Selecionar confecção...</option>
                  {confeccoesList.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome} — {PLANO_CFG[c.plano]?.label ?? c.plano}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Tipo de impressão</label>
              <select name="tipo_impressao" className="input" required>
                <option value="">Selecionar...</option>
                <option value="sublimacao">Sublimação</option>
                <option value="bordado">Bordado</option>
                <option value="serigrafia">Serigrafia</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nome do cliente</label>
                <input name="nome_cliente" className="input" placeholder="Opcional" />
              </div>
              <div>
                <label className="label">Email do cliente</label>
                <input name="email_cliente" type="email" className="input" placeholder="Opcional" />
              </div>
            </div>

            {/* ── Prazo automático por plano ── */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Prazo de entrega
              </label>

              {/* Card de prazo padrão */}
              <div
                className="rounded-lg p-3 border mb-2 flex items-center justify-between"
                style={{ background: '#1a1a1a', borderColor: expresso ? '#2a2a2a' : 'rgba(212,160,32,0.35)' }}
              >
                <div>
                  <p className="text-xs text-zinc-400 font-medium">
                    Prazo padrão — Plano <span className="font-bold" style={{ color: cfg.cor }}>{cfg.label}</span>
                  </p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {format(parseISO(prazoCalculado), 'dd/MM/yyyy')}
                    <span className="text-xs font-normal text-zinc-500 ml-2">({cfg.sla}h a partir de agora)</span>
                  </p>
                </div>
                {!expresso && (
                  <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: '#d4a020' }} />
                )}
              </div>

              {/* Toggle expresso */}
              <button
                type="button"
                onClick={() => setExpresso(!expresso)}
                className={clsx(
                  'w-full flex items-center justify-between rounded-lg px-3 py-2.5 border transition-all text-left',
                  expresso
                    ? 'border-amber-500/50 bg-amber-950/30'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Zap className={clsx('w-4 h-4', expresso ? 'text-amber-400' : 'text-zinc-600')} />
                  <div>
                    <p className={clsx('text-sm font-semibold', expresso ? 'text-amber-300' : 'text-zinc-400')}>
                      Entrega expresso — {cfg.expresso}h
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      {expresso
                        ? `Prazo: ${format(parseISO(calcularPrazo(cfg.expresso)), 'dd/MM/yyyy HH:mm')}`
                        : `+R$30/arte avulsa · prazo: ${format(parseISO(calcularPrazo(cfg.expresso)), 'dd/MM/yyyy HH:mm')}`
                      }
                    </p>
                  </div>
                </div>
                <div
                  className={clsx(
                    'w-9 h-5 rounded-full flex items-center transition-all px-0.5',
                    expresso ? 'bg-amber-500 justify-end' : 'bg-zinc-700 justify-start'
                  )}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </div>
              </button>
              {expresso && (
                <p className="text-[11px] text-amber-400/70 mt-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Adicional de R$30/arte será cobrado no fechamento do mês.
                </p>
              )}
            </div>

            {/* ── Item do Shop & Valor a Cobrar ── */}
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-[#161619] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#d4a020]" />
                  Item do Shop / Serviço Adicional
                  <span className="text-zinc-500 font-normal">(opcional)</span>
                </label>
                {valorPedido && Number(valorPedido) > 0 && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 font-mono">
                    R$ {Number(valorPedido).toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>

              <select
                className="input text-xs"
                value={shopItemSel}
                onChange={(e) => handleShopItemChange(e.target.value)}
              >
                <option value="">Nenhum item do shop (Definir valor manual ou incluso)</option>
                {shopItens.map((it) => (
                  <option key={it.id || it.db_id} value={it.id || it.db_id}>
                    {it.nome} — R$ {it.valor.toFixed(2).replace('.', ',')}
                  </option>
                ))}
              </select>

              <div>
                <label className="label text-[11px] text-zinc-400">
                  Valor a Cobrar do Cliente (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                    R$
                  </span>
                  <input
                    name="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={valorPedido}
                    onChange={(e) => setValorPedido(e.target.value)}
                    className="input pl-9 font-mono text-sm"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Defina o valor para este pedido (ex: R$ 35,00 para arte avulsa) ou deixe 0 se já incluso no plano.
                </p>
              </div>
            </div>

            <div>
              <label className="label">Observações</label>
              <textarea name="observacoes" className="textarea" placeholder="Informações adicionais..." />
            </div>

            {/* ── Referências ── */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Paperclip className="w-3 h-3" /> Referências para o design
                <span className="text-zinc-700 font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <input
                ref={refInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.cdr,.ai,.psd,.eps,.svg,.tiff,.bmp"
                className="hidden"
                onChange={(e) => addReferencias(e.target.files)}
              />

              {/* Dropzone com suporte a colar imagens da área de transferência */}
              <div
                className="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors"
                style={{ borderColor: '#2a2a2a', background: '#111' }}
                onClick={() => refInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#d4a020' }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a' }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#2a2a2a'
                  addReferencias(e.dataTransfer.files)
                }}
              >
                <Paperclip className="w-5 h-5 mx-auto mb-1 text-zinc-700" />
                <p className="text-xs text-zinc-400">
                  Arraste imagens/PDFs ou <span style={{ color: '#d4a020' }}>clique para selecionar</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4a020]/10 text-[#d4a020] border border-[#d4a020]/25 text-[11px] font-semibold">
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Você pode colar imagens direto com Ctrl + V</span>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1.5">PNG, JPG, PDF, CDR, AI, PSD... · até 50MB cada</p>
              </div>

              {/* Lista de arquivos selecionados */}
              {referencias.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {referencias.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                      style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
                    >
                      {isImage(file) ? (
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-zinc-800">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-zinc-800">
                          <FileText className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{file.name}</p>
                        <p className="text-[10px] text-zinc-600">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReferencia(i)}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => { setShowForm(false); setReferencias([]) }}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? 'Criando...' : 'Criar Pedido'}
              </button>
            </div>
          </form>
        </DarkModal>
      )}
    </div>
  )
}

export function DarkModal({ title, children, onClose }: {
  title: string; children: React.ReactNode; onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl animate-[slideUp_0.2s_ease-out]"
        style={{ background: '#141414', border: '1px solid #2a2a2a', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

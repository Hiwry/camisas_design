import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { pedidoService, confeccaoService, shopService, ShopItem } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { resolveMediaUrl } from '@/lib/url'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Eye,
  Edit3,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ShoppingBag,
  Ban,
  Link2,
  Copy,
  ExternalLink,
  Columns,
  Paperclip,
  X,
  FileText,
  Clipboard,
  Zap,
  Download,
  Check,
} from 'lucide-react'
import { format, parseISO, isPast, isBefore, startOfToday, addDays, addHours } from 'date-fns'
import clsx from 'clsx'

// ── DESIGN SYSTEM TOKENS ──
// Background: #0B0B0C
// Sidebar: #121213
// Cards: #151516
// Superfícies secundárias: #1D1D1F
// Bordas: #303034
// Primária: #E7B32C
// Texto Principal: #F5F5F6
// Texto Secundário: #909098

export interface PedidoItem {
  id: number
  titulo: string
  confeccao_id: number
  confeccao?: { id: number; nome: string; plano: string }
  tipo_impressao: 'sublimacao' | 'bordado' | 'serigrafia' | string
  status: 'aguardando_briefing' | 'em_producao' | 'aguardando_aprovacao' | 'aprovado' | 'finalizado' | 'cancelado' | string
  prazo: string | null
  valor?: number | null
  observacoes?: string | null
  nome_cliente?: string | null
  email_cliente?: string | null
  whatsapp_cliente?: string | null
  cliente_nome?: string | null
  cliente_email?: string | null
  cliente_whatsapp?: string | null
  token_aprovacao?: string | null
  arte_ativa?: { id: number; imagem_url?: string; mockup_url?: string; versao?: number } | null
  arteAtiva?: { id: number; imagem_url?: string; mockup_url?: string; versao?: number } | null
  artes?: Array<{ id: number; versao: number; imagem_url?: string; mockup_url?: string; status?: string }> | null
  referencias?: Array<{ url: string; nome: string; tipo: string; tamanho: number }> | null
  created_at: string
}

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

const TIPO_LABELS: Record<string, string> = {
  sublimacao: 'Sublimação',
  bordado:    'Bordado',
  serigrafia: 'Serigrafia',
  dtf:        'DTF',
  silkscreen: 'Silk-Screen',
}

// Badges de Status estilizados com bordas sutis e fundo translúcido
const STATUS_BADGE_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  aguardando_briefing:  { bg: '#1E1E22', border: '#383840', text: '#909098' },
  em_producao:          { bg: '#0E243A', border: '#1A4A76', text: '#60A5FA' },
  aguardando_aprovacao: { bg: '#2D200A', border: '#6E4E10', text: '#FBBF24' },
  aprovado:             { bg: '#0E291C', border: '#175E38', text: '#45DB92' },
  finalizado:           { bg: '#231533', border: '#54287E', text: '#C084FC' },
  cancelado:            { bg: '#2B1216', border: '#6E1F27', text: '#F87171' },
}

export default function PedidosPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { isAdmin, user } = useAuthStore()

  // ── ESTADOS DE FILTROS E PAGINAÇÃO ──
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [tipoFilter, setTipoFilter]     = useState('todos')
  const [prazoFilter, setPrazoFilter]   = useState('todos') // 'todos' | 'atrasados' | 'proximos' | 'no_prazo'
  const [paginaAtual, setPaginaAtual]   = useState(1)
  const ITENS_POR_PAGINA = 10

  // ── MODAIS ──
  const [showNovoPedidoModal, setShowNovoPedidoModal] = useState(false)
  const [pedidoParaEditar, setPedidoParaEditar]       = useState<PedidoItem | null>(null)
  const [pedidoParaCancelar, setPedidoParaCancelar]   = useState<PedidoItem | null>(null)
  const [previewArte, setPreviewArte]                 = useState<{ url: string; titulo: string; versao?: number } | null>(null)

  // ── FORM NOVO PEDIDO ──
  const [referencias, setReferencias]     = useState<File[]>([])
  const [expresso, setExpresso]           = useState(false)
  const [confeccaoSel, setConfeccaoSel]   = useState<{ id: number; nome: string; plano: string } | null>(null)
  const [valorPedido, setValorPedido]     = useState<string>('')
  const [shopItemSel, setShopItemSel]     = useState<string>('')
  const refInputRef                       = useRef<HTMLInputElement>(null)

  // ── MENU CONTEXTUAL FLUTUANTE (FIXED, FORA DO OVERFLOW) ──
  const [menuAnchor, setMenuAnchor] = useState<{
    top: number
    right: number
    openUpwards: boolean
    pedido: PedidoItem
  } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Fecha menu dropdown ao clicar fora, rolar ou pressionar Esc
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAnchor(null)
      }
    }
    function handleScrollOrResize() {
      setMenuAnchor(null)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAnchor(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Suporte a colar imagens (Ctrl + V) no modal de Novo Pedido
  useEffect(() => {
    if (!showNovoPedidoModal) return

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
  }, [showNovoPedidoModal])

  // ── BUSCAS DE DADOS ──
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => pedidoService.listar({ per_page: 100 }),
  })

  const { data: confeccoesRaw } = useQuery({
    queryKey: ['confeccoes-lista'],
    queryFn: () => confeccaoService.listar({ per_page: 100 }),
    enabled: isAdmin(),
  })
  const confeccoesList: { id: number; nome: string; plano: string }[] = useMemo(() => {
    if (!confeccoesRaw) return []
    return Array.isArray(confeccoesRaw) ? confeccoesRaw : (confeccoesRaw?.data ?? [])
  }, [confeccoesRaw])

  const { data: shopData } = useQuery({
    queryKey: ['shop-itens-lista'],
    queryFn: shopService.listarItens,
  })
  const shopItens: ShopItem[] = useMemo(() => {
    if (!shopData) return []
    return shopData?.itens ?? (Array.isArray(shopData) ? (shopData as any) : [])
  }, [shopData])

  const pedidos: PedidoItem[] = useMemo(() => {
    if (!rawData) return []
    return Array.isArray(rawData) ? rawData : (rawData?.data ?? [])
  }, [rawData])

  // SLA e Prazo do formulário de criação
  const planoAtual = isAdmin()
    ? (confeccaoSel?.plano ?? 'basico')
    : (user?.confeccao?.plano ?? 'basico')
  const cfg = PLANO_CFG[planoAtual] ?? PLANO_CFG.basico
  const prazoCalculado = calcularPrazo(expresso ? cfg.expresso : cfg.sla)

  // ── INDICADORES SUPERIORES COM DADOS REAIS ──
  const totalPedidos = pedidos.length

  const emAndamentoCount = useMemo(() => {
    return pedidos.filter((p) =>
      ['aguardando_briefing', 'em_producao', 'aguardando_aprovacao'].includes(p.status)
    ).length
  }, [pedidos])

  const aprovadosCount = useMemo(() => {
    return pedidos.filter((p) => p.status === 'aprovado').length
  }, [pedidos])

  const finalizadosCount = useMemo(() => {
    return pedidos.filter((p) => p.status === 'finalizado').length
  }, [pedidos])

  // ── FILTRAGEM INTELIGENTE DOS PEDIDOS ──
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      // 1. Busca textual (nome do pedido, #id, confecção, cliente)
      const termo = search.toLowerCase().trim()
      const matchBusca =
        !termo ||
        p.titulo.toLowerCase().includes(termo) ||
        String(p.id).includes(termo) ||
        `#${p.id}`.includes(termo) ||
        (p.confeccao?.nome && p.confeccao.nome.toLowerCase().includes(termo)) ||
        (p.nome_cliente && p.nome_cliente.toLowerCase().includes(termo)) ||
        (p.cliente_nome && p.cliente_nome.toLowerCase().includes(termo))

      // 2. Filtro de Status
      const matchStatus = statusFilter === 'todos' || p.status === statusFilter

      // 3. Filtro de Tipo
      const matchTipo = tipoFilter === 'todos' || p.tipo_impressao === tipoFilter

      // 4. Filtro de Prazo
      let matchPrazo = true
      if (prazoFilter !== 'todos' && p.prazo) {
        const isFinalizadoOuCancelado = ['finalizado', 'cancelado'].includes(p.status)
        const prazoDate = parseISO(p.prazo)
        const atrasado = !isFinalizadoOuCancelado && isBefore(prazoDate, startOfToday())
        const proximo = !isFinalizadoOuCancelado && !atrasado && isBefore(prazoDate, addDays(startOfToday(), 2))

        if (prazoFilter === 'atrasados') matchPrazo = atrasado
        else if (prazoFilter === 'proximos') matchPrazo = proximo
        else if (prazoFilter === 'no_prazo') matchPrazo = !atrasado
      } else if (prazoFilter !== 'todos' && !p.prazo) {
        matchPrazo = false
      }

      return matchBusca && matchStatus && matchTipo && matchPrazo
    })
  }, [pedidos, search, statusFilter, tipoFilter, prazoFilter])

  // ── PAGINAÇÃO ──
  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / ITENS_POR_PAGINA))
  const pedidosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return pedidosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [pedidosFiltrados, paginaAtual])

  // Reset da página quando filtros mudam
  useEffect(() => {
    setPaginaAtual(1)
  }, [search, statusFilter, tipoFilter, prazoFilter])

  // ── MUTAÇÕES ──
  const criarMutation = useMutation({
    mutationFn: pedidoService.criar,
    onSuccess: () => {
      toast.success('Pedido criado com sucesso!')
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setShowNovoPedidoModal(false)
      setReferencias([])
      setExpresso(false)
      setConfeccaoSel(null)
      setValorPedido('')
      setShopItemSel('')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao criar pedido.'
      toast.error(msg)
    },
  })

  const editarMutation = useMutation({
    mutationFn: (payload: { id: number; data: Record<string, any> }) =>
      pedidoService.atualizar(payload.id, payload.data),
    onSuccess: () => {
      toast.success('Pedido atualizado com sucesso!')
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setPedidoParaEditar(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao atualizar pedido.'
      toast.error(msg)
    },
  })

  const cancelarMutation = useMutation({
    mutationFn: (id: number) => pedidoService.cancelar(id),
    onSuccess: () => {
      toast.success('Pedido cancelado com sucesso.')
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setPedidoParaCancelar(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao cancelar pedido.'
      toast.error(msg)
    },
  })

  // ── HANDLERS ──
  function handleShopItemChange(itemId: string) {
    setShopItemSel(itemId)
    if (!itemId) return
    const found = shopItens.find((it) => String(it.id) === itemId || String(it.db_id) === itemId)
    if (found && found.valor > 0) {
      setValorPedido(String(found.valor))
      toast.success(`Serviço selecionado: ${found.nome} — R$ ${found.valor.toFixed(2).replace('.', ',')}`, { icon: '🛒' })
    }
  }

  function handleNovoPedidoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('prazo', prazoCalculado)
    if (expresso) fd.set('expresso', '1')
    if (valorPedido) fd.set('valor', valorPedido)
    referencias.forEach((file) => fd.append('referencias[]', file))
    criarMutation.mutate(fd as unknown as Record<string, unknown>)
  }

  function handleEditarSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!pedidoParaEditar) return
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd)
    editarMutation.mutate({ id: pedidoParaEditar.id, data })
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

  function handleCopiarLinkAprovacao(p: PedidoItem) {
    if (p.token_aprovacao) {
      const url = `${window.location.origin}/aprovar/${p.token_aprovacao}`
      navigator.clipboard.writeText(url)
      toast.success('Link de aprovação copiado!', { icon: '🔗' })
    } else {
      pedidoService.linkAprovacao(p.id).then((res) => {
        if (res?.link) {
          navigator.clipboard.writeText(res.link)
          toast.success('Link de aprovação copiado!', { icon: '🔗' })
        } else {
          toast.error('Token de aprovação não encontrado para este pedido.')
        }
      }).catch(() => toast.error('Não foi possível gerar o link de aprovação.'))
    }
  }

  // Helper para renderização do Prazo
  function renderPrazo(p: PedidoItem) {
    if (!p.prazo) {
      return <span className="text-[#909098]">—</span>
    }

    const prazoDate = parseISO(p.prazo)
    const isFinalizadoOuCancelado = ['finalizado', 'cancelado'].includes(p.status)

    if (isFinalizadoOuCancelado) {
      return (
        <span className="text-xs text-[#909098]">
          {format(prazoDate, 'dd/MM/yyyy')}
        </span>
      )
    }

    const atrasado = isBefore(prazoDate, startOfToday())
    const proximo = !atrasado && isBefore(prazoDate, addDays(startOfToday(), 2))

    if (atrasado) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-[#F87171] font-medium" title="Pedido Atrasado">
          <AlertCircle className="w-3.5 h-3.5 text-[#F87171] flex-shrink-0" />
          <span>{format(prazoDate, 'dd/MM/yyyy')}</span>
        </div>
      )
    }

    if (proximo) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-[#FBBF24] font-medium" title="Prazo Próximo (menos de 48h)">
          <Clock className="w-3.5 h-3.5 text-[#FBBF24] flex-shrink-0" />
          <span>{format(prazoDate, 'dd/MM/yyyy')}</span>
        </div>
      )
    }

    return (
      <span className="text-xs text-[#F5F5F6]">
        {format(prazoDate, 'dd/MM/yyyy')}
      </span>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-screen overflow-y-auto px-4 sm:px-6 md:px-8 py-6"
      style={{ backgroundColor: '#0B0B0C' }}
    >
      {/* ── 1. BREADCRUMB ── */}
      <nav className="flex items-center gap-2 text-xs text-[#909098] mb-3 select-none">
        <span
          className="hover:text-[#F5F5F6] cursor-pointer transition-colors"
          onClick={() => navigate('/dashboard')}
        >
          Painel
        </span>
        <span className="text-zinc-600">/</span>
        <span>Gestão</span>
        <span className="text-zinc-600">/</span>
        <span className="text-[#F5F5F6] font-medium">Pedidos</span>
      </nav>

      {/* ── 2. CABEÇALHO ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F6]">
            Pedidos
          </h1>
          <p className="text-sm text-[#909098] mt-1">
            Gerencie prazos, produção e aprovações dos seus pedidos.
          </p>
        </div>

        <button
          onClick={() => setShowNovoPedidoModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 shadow-sm active:scale-[0.98] select-none"
          style={{
            backgroundColor: '#E7B32C',
            color: '#0B0B0C',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3c13e')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E7B32C')}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Novo pedido</span>
        </button>
      </div>

      {/* ── 3. 4 INDICADORES SUPERIORES (GRID) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total de Pedidos */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
              TOTAL DE PEDIDOS
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: '#E7B32C',
                boxShadow: '0 0 8px rgba(231,179,44,0.6)',
              }}
            />
          </div>
          <div className="my-2 text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {isLoading ? (
              <div className="h-9 w-16 bg-[#1D1D1F] rounded animate-pulse" />
            ) : (
              totalPedidos
            )}
          </div>
          <span className="text-xs text-[#909098]">Pedidos cadastrados</span>
        </div>

        {/* Card 2: Em Andamento */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
              EM ANDAMENTO
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: '#3B82F6',
                boxShadow: '0 0 8px rgba(59,130,246,0.6)',
              }}
            />
          </div>
          <div className="my-2 text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {isLoading ? (
              <div className="h-9 w-16 bg-[#1D1D1F] rounded animate-pulse" />
            ) : (
              emAndamentoCount
            )}
          </div>
          <span className="text-xs text-[#909098]">Em produção / aprovação</span>
        </div>

        {/* Card 3: Aprovados */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
              APROVADOS
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: '#45DB92',
                boxShadow: '0 0 8px rgba(69,219,146,0.6)',
              }}
            />
          </div>
          <div className="my-2 text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {isLoading ? (
              <div className="h-9 w-16 bg-[#1D1D1F] rounded animate-pulse" />
            ) : (
              aprovadosCount
            )}
          </div>
          <span className="text-xs text-[#909098]">Prontos para produzir</span>
        </div>

        {/* Card 4: Finalizados */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
              FINALIZADOS
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: '#A855F7',
                boxShadow: '0 0 8px rgba(168,85,247,0.6)',
              }}
            />
          </div>
          <div className="my-2 text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {isLoading ? (
              <div className="h-9 w-16 bg-[#1D1D1F] rounded animate-pulse" />
            ) : (
              finalizadosCount
            )}
          </div>
          <span className="text-xs text-[#909098]">Pedidos concluídos</span>
        </div>
      </div>

      {/* ── 4. CONTAINER DA LISTAGEM DE PEDIDOS ── */}
      <div
        className="rounded-xl border flex flex-col overflow-hidden shadow-sm"
        style={{ backgroundColor: '#151516', borderColor: '#303034' }}
      >
        {/* Header da Seção: Título e Filtros */}
        <div
          className="p-4 sm:p-5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          style={{ borderColor: '#303034' }}
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#F5F5F6]">
              Lista de pedidos
            </h2>
            <p className="text-xs sm:text-sm text-[#909098] mt-0.5">
              Acompanhe e gerencie todos os pedidos em um só lugar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Campo de Busca */}
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#909098]" />
              <input
                type="text"
                placeholder="Buscar pedido ou confecção..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg border focus:outline-none transition-colors"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#909098] hover:text-[#F5F5F6]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro de Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none cursor-pointer"
              style={{
                backgroundColor: '#1D1D1F',
                borderColor: '#303034',
                color: '#F5F5F6',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
            >
              <option value="todos">Todos os status</option>
              <option value="aguardando_briefing">Aguardando Briefing</option>
              <option value="em_producao">Em Produção</option>
              <option value="aguardando_aprovacao">Aguardando Aprovação</option>
              <option value="aprovado">Aprovado</option>
              <option value="finalizado">Finalizado</option>
              <option value="cancelado">Cancelado</option>
            </select>

            {/* Filtro de Tipo */}
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none cursor-pointer"
              style={{
                backgroundColor: '#1D1D1F',
                borderColor: '#303034',
                color: '#F5F5F6',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
            >
              <option value="todos">Todos os tipos</option>
              <option value="sublimacao">Sublimação</option>
              <option value="bordado">Bordado</option>
              <option value="serigrafia">Serigrafia</option>
            </select>

            {/* Filtro de Prazo */}
            <select
              value={prazoFilter}
              onChange={(e) => setPrazoFilter(e.target.value)}
              className="text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none cursor-pointer hidden md:block"
              style={{
                backgroundColor: '#1D1D1F',
                borderColor: '#303034',
                color: '#F5F5F6',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
            >
              <option value="todos">Todos os prazos</option>
              <option value="atrasados">Atrasados</option>
              <option value="proximos">Próximos (48h)</option>
              <option value="no_prazo">No prazo</option>
            </select>
          </div>
        </div>

        {/* ── TABELA DESKTOP ── */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[780px]">
            <thead>
              <tr style={{ backgroundColor: '#151516', borderBottom: '1px solid #303034' }}>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  PEDIDO
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  CONFECÇÃO
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  TIPO
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  STATUS
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  PRAZO
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  AÇÕES
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                // Skeleton loading state
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #202024' }}>
                    <td className="px-5 py-4">
                      <div className="space-y-1.5">
                        <div className="w-32 h-4 bg-[#1D1D1F] rounded animate-pulse" />
                        <div className="w-20 h-3 bg-[#1D1D1F] rounded animate-pulse" />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-28 h-4 bg-[#1D1D1F] rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-20 h-4 bg-[#1D1D1F] rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-24 h-6 bg-[#1D1D1F] rounded-full animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-20 h-4 bg-[#1D1D1F] rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="w-32 h-7 bg-[#1D1D1F] rounded-lg ml-auto animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : pedidosPaginados.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={6} className="text-center py-16 px-4">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                        style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034' }}
                      >
                        <Search className="w-5 h-5 text-[#909098]" />
                      </div>
                      <p className="text-sm font-semibold text-[#F5F5F6]">
                        Nenhum pedido encontrado
                      </p>
                      <p className="text-xs text-[#909098] mt-1 text-center">
                        {search || statusFilter !== 'todos' || tipoFilter !== 'todos' || prazoFilter !== 'todos'
                          ? 'Tente ajustar os filtros ou a busca para encontrar o que procura.'
                          : 'Nenhum pedido cadastrado no momento. Clique em "+ Novo pedido" para começar.'}
                      </p>
                      {(search || statusFilter !== 'todos' || tipoFilter !== 'todos' || prazoFilter !== 'todos') && (
                        <button
                          onClick={() => {
                            setSearch('')
                            setStatusFilter('todos')
                            setTipoFilter('todos')
                            setPrazoFilter('todos')
                          }}
                          className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium text-[#E7B32C] border border-[#E7B32C]/30 hover:bg-[#E7B32C]/10 transition-colors"
                        >
                          Limpar todos os filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pedidosPaginados.map((p) => {
                  const badgeStyle = STATUS_BADGE_STYLE[p.status] ?? STATUS_BADGE_STYLE.aguardando_briefing
                  const statusLabel = STATUS_LABELS[p.status] ?? p.status
                  const tipoLabel = TIPO_LABELS[p.tipo_impressao] ?? p.tipo_impressao

                  return (
                    <tr
                      key={p.id}
                      className="transition-colors group hover:bg-[#1A1A1D]"
                      style={{ borderBottom: '1px solid #202024' }}
                    >
                      {/* 1. PEDIDO */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#F5F5F6] group-hover:text-[#E7B32C] transition-colors">
                              {p.titulo}
                            </span>
                            {p.valor && Number(p.valor) > 0 && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                                R$ {Number(p.valor).toFixed(2).replace('.', ',')}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#909098] mt-0.5">
                            Pedido #{p.id}
                          </span>
                        </div>
                      </td>

                      {/* 2. CONFECÇÃO */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-[#D1D1D6] font-medium">
                          {p.confeccao?.nome || '—'}
                        </span>
                      </td>

                      {/* 3. TIPO */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-[#909098]">
                          {tipoLabel}
                        </span>
                      </td>

                      {/* 4. STATUS */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold select-none"
                          style={{
                            backgroundColor: badgeStyle.bg,
                            border: `1px solid ${badgeStyle.border}`,
                            color: badgeStyle.text,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      {/* 5. PRAZO */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {renderPrazo(p)}
                      </td>

                      {/* 6. AÇÕES */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Botão Detalhes */}
                          <button
                            type="button"
                            onClick={() => navigate(`/pedidos/${p.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none"
                            style={{
                              backgroundColor: '#1D1D1F',
                              border: '1px solid #303034',
                              color: '#F5F5F6',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#E7B32C'
                              e.currentTarget.style.color = '#E7B32C'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#303034'
                              e.currentTarget.style.color = '#F5F5F6'
                            }}
                            title="Ver detalhes do pedido"
                          >
                            <span>Detalhes</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Ações com Menu Contextual */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (menuAnchor?.pedido.id === p.id) {
                                setMenuAnchor(null)
                                return
                              }
                              const rect = e.currentTarget.getBoundingClientRect()
                              const spaceBelow = window.innerHeight - rect.bottom
                              const openUpwards = spaceBelow < 320 && rect.top > 320
                              setMenuAnchor({
                                top: openUpwards ? rect.top - 8 : rect.bottom + 8,
                                right: Math.max(16, window.innerWidth - rect.right),
                                openUpwards,
                                pedido: p,
                              })
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none"
                            style={{
                              backgroundColor: menuAnchor?.pedido.id === p.id ? '#241C10' : '#1D1D1F',
                              border: `1px solid ${menuAnchor?.pedido.id === p.id ? '#E7B32C' : '#303034'}`,
                              color: menuAnchor?.pedido.id === p.id ? '#E7B32C' : '#F5F5F6',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#E7B32C'
                              e.currentTarget.style.color = '#E7B32C'
                            }}
                            onMouseLeave={(e) => {
                              if (menuAnchor?.pedido.id !== p.id) {
                                e.currentTarget.style.borderColor = '#303034'
                                e.currentTarget.style.color = '#F5F5F6'
                              }
                            }}
                            title="Mais ações para o pedido"
                          >
                            <span>Ações</span>
                            <span className="text-[#909098]">...</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── FOOTER DA TABELA: PAGINAÇÃO ── */}
        <div
          className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#909098]"
          style={{ borderColor: '#303034' }}
        >
          <span>
            Exibindo {pedidosPaginados.length} de {pedidosFiltrados.length}{' '}
            {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}
          </span>

          <div className="flex items-center gap-2">
            <span>
              Página {paginaAtual} de {totalPaginas}
            </span>
            <div className="flex items-center gap-1 ml-2">
              <button
                disabled={paginaAtual <= 1}
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={paginaAtual >= totalPaginas}
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. MENU CONTEXTUAL FLUTUANTE (FIXO NO VIEWPORT) ── */}
      {menuAnchor && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuAnchor.openUpwards ? undefined : `${menuAnchor.top}px`,
            bottom: menuAnchor.openUpwards ? `${window.innerHeight - menuAnchor.top}px` : undefined,
            right: `${menuAnchor.right}px`,
            backgroundColor: '#151516',
            borderColor: '#303034',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
          className="w-60 rounded-xl py-1.5 z-[100] animate-[slideUp_0.15s_ease-out] text-left border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b mb-1" style={{ borderColor: '#202024' }}>
            <p className="text-[10px] uppercase font-semibold text-[#909098] tracking-wider">
              Ações do pedido
            </p>
            <p className="text-xs font-bold text-[#F5F5F6] truncate">
              #{menuAnchor.pedido.id} — {menuAnchor.pedido.titulo}
            </p>
          </div>

          {/* 1. Ver detalhes */}
          <button
            onClick={() => {
              navigate(`/pedidos/${menuAnchor.pedido.id}`)
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#909098]" />
            <span>Ver detalhes</span>
          </button>

          {/* 2. Editar pedido */}
          <button
            onClick={() => {
              setPedidoParaEditar(menuAnchor.pedido)
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#909098]" />
            <span>Editar pedido</span>
          </button>

          {/* 3. Visualizar arte ou mockup */}
          <button
            onClick={() => {
              const arte = menuAnchor.pedido.arte_ativa || menuAnchor.pedido.arteAtiva
              if (arte?.imagem_url || arte?.mockup_url) {
                setPreviewArte({
                  url: arte.imagem_url || arte.mockup_url || '',
                  titulo: menuAnchor.pedido.titulo,
                  versao: arte.versao,
                })
              } else {
                toast('Nenhuma arte enviada ainda para este pedido.', { icon: 'ℹ️' })
                navigate(`/pedidos/${menuAnchor.pedido.id}`)
              }
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#E7B32C]" />
            <span>Visualizar arte ou mockup</span>
          </button>

          {/* 4. Acessar histórico de versões */}
          <button
            onClick={() => {
              navigate(`/pedidos/${menuAnchor.pedido.id}`)
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-[#909098]" />
            <span>Histórico de versões</span>
          </button>

          {/* 5. Acompanhar aprovação */}
          <button
            onClick={() => {
              handleCopiarLinkAprovacao(menuAnchor.pedido)
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Link2 className="w-3.5 h-3.5 text-[#45DB92]" />
            <span>Copiar link de aprovação</span>
          </button>

          {/* 6. Visualizar no Kanban */}
          {isAdmin() && (
            <button
              onClick={() => {
                navigate('/kanban')
                setMenuAnchor(null)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
            >
              <Columns className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Visualizar no Kanban</span>
            </button>
          )}

          {/* Separador */}
          <div className="my-1 border-t" style={{ borderColor: '#202024' }} />

          {/* 7. Cancelar pedido */}
          {menuAnchor.pedido.status !== 'cancelado' && menuAnchor.pedido.status !== 'finalizado' ? (
            <button
              onClick={() => {
                setPedidoParaCancelar(menuAnchor.pedido)
                setMenuAnchor(null)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F87171] hover:bg-[#2B1216]/50 transition-colors"
            >
              <Ban className="w-3.5 h-3.5 text-[#F87171]" />
              <span>Cancelar pedido</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 text-[11px] text-[#909098] italic">
              {menuAnchor.pedido.status === 'cancelado'
                ? 'Pedido já cancelado'
                : 'Pedido finalizado'}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: NOVO PEDIDO ── */}
      {showNovoPedidoModal && (
        <DarkModal
          title="Novo Pedido"
          onClose={() => {
            setShowNovoPedidoModal(false)
            setReferencias([])
            setExpresso(false)
            setConfeccaoSel(null)
            setValorPedido('')
            setShopItemSel('')
          }}
        >
          <form onSubmit={handleNovoPedidoSubmit} className="space-y-4">
            {/* Saldo de Artes (Para usuário Confecção) */}
            {!isAdmin() && user?.confeccao && (() => {
              const conf = user.confeccao
              const artesPlano = Math.max(0, conf.limite_mensal - conf.artes_usadas_mes)
              const extras = conf.artes_extras ?? 0
              const total = artesPlano + extras
              return (
                <div
                  className="rounded-xl p-3 border flex items-center justify-between"
                  style={{
                    backgroundColor: total > 0 ? 'rgba(231,179,44,0.06)' : 'rgba(239,68,68,0.1)',
                    borderColor: total > 0 ? 'rgba(231,179,44,0.25)' : 'rgba(239,68,68,0.3)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#E7B32C]" />
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
                    className="text-[11px] font-bold text-[#E7B32C] hover:underline flex items-center gap-1"
                  >
                    <ShoppingBag className="w-3 h-3" /> Shop Avulso
                  </Link>
                </div>
              )
            })()}

            {/* Título */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Título do pedido *
              </label>
              <input
                name="titulo"
                required
                placeholder="Ex: Camiseta Time Alfa"
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              />
            </div>

            {/* Confecção (Se admin) */}
            {isAdmin() && (
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Confecção *
                </label>
                <select
                  name="confeccao_id"
                  required
                  onChange={(e) => {
                    const sel = confeccoesList.find((c) => String(c.id) === e.target.value)
                    setConfeccaoSel(sel ?? null)
                    setExpresso(false)
                  }}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                >
                  <option value="">Selecionar confecção...</option>
                  {confeccoesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} — {PLANO_CFG[c.plano]?.label ?? c.plano}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo de Impressão */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Tipo de impressão *
              </label>
              <select
                name="tipo_impressao"
                required
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                <option value="">Selecionar...</option>
                <option value="sublimacao">Sublimação</option>
                <option value="bordado">Bordado</option>
                <option value="serigrafia">Serigrafia</option>
              </select>
            </div>

            {/* Cliente (Opcional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Nome do cliente <span className="text-[#909098] font-normal">(opcional)</span>
                </label>
                <input
                  name="nome_cliente"
                  placeholder="Ex: João da Silva"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Email do cliente <span className="text-[#909098] font-normal">(opcional)</span>
                </label>
                <input
                  name="email_cliente"
                  type="email"
                  placeholder="joao@exemplo.com"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
            </div>

            {/* Prazo Automático por Plano */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#E7B32C]" /> Prazo de entrega
              </label>

              <div
                className="rounded-lg p-3 border mb-2 flex items-center justify-between"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: expresso ? '#303034' : 'rgba(231,179,44,0.35)',
                }}
              >
                <div>
                  <p className="text-xs text-[#909098] font-medium">
                    Prazo padrão — Plano <span className="font-bold" style={{ color: cfg.cor }}>{cfg.label}</span>
                  </p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {format(parseISO(prazoCalculado), 'dd/MM/yyyy')}
                    <span className="text-xs font-normal text-[#909098] ml-2">({cfg.sla}h a partir de agora)</span>
                  </p>
                </div>
                {!expresso && <Calendar className="w-5 h-5 flex-shrink-0 text-[#E7B32C]" />}
              </div>

              {/* Toggle expresso */}
              <button
                type="button"
                onClick={() => setExpresso(!expresso)}
                className={clsx(
                  'w-full flex items-center justify-between rounded-lg px-3 py-2.5 border transition-all text-left',
                  expresso
                    ? 'border-amber-500/50 bg-amber-950/30'
                    : 'border-[#303034] bg-[#1D1D1F] hover:border-zinc-700'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Zap className={clsx('w-4 h-4', expresso ? 'text-amber-400' : 'text-zinc-600')} />
                  <div>
                    <p className={clsx('text-xs font-semibold', expresso ? 'text-amber-300' : 'text-zinc-300')}>
                      Entrega expresso — {cfg.expresso}h
                    </p>
                    <p className="text-[11px] text-[#909098]">
                      {expresso
                        ? `Prazo: ${format(parseISO(calcularPrazo(cfg.expresso)), 'dd/MM/yyyy HH:mm')}`
                        : `+R$30/arte avulsa · prazo: ${format(parseISO(calcularPrazo(cfg.expresso)), 'dd/MM/yyyy HH:mm')}`}
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
            </div>

            {/* Item do Shop & Valor a Cobrar */}
            <div
              className="p-3.5 rounded-xl border space-y-3"
              style={{ backgroundColor: '#18181A', borderColor: '#303034' }}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#E7B32C]" />
                  Item do Shop / Serviço Adicional <span className="text-[#909098] font-normal">(opcional)</span>
                </label>
                {valorPedido && Number(valorPedido) > 0 && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 font-mono">
                    R$ {Number(valorPedido).toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>

              <select
                className="w-full text-xs px-3 py-2 rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
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
                <label className="block text-[11px] text-[#909098] mb-1">
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
                    className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg border focus:outline-none font-mono"
                    style={{
                      backgroundColor: '#1D1D1F',
                      borderColor: '#303034',
                      color: '#F5F5F6',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Observações
              </label>
              <textarea
                name="observacoes"
                rows={3}
                placeholder="Instruções de cores, fontes, posicionamento..."
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none resize-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              />
            </div>

            {/* Referências de Arte */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[#E7B32C]" />
                Referências para o design <span className="text-[#909098] font-normal">(opcional)</span>
              </label>
              <input
                ref={refInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.cdr,.ai,.psd,.eps,.svg,.tiff,.bmp"
                className="hidden"
                onChange={(e) => addReferencias(e.target.files)}
              />

              <div
                className="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors"
                style={{ borderColor: '#303034', backgroundColor: '#1D1D1F' }}
                onClick={() => refInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#E7B32C'
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = '#303034'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#303034'
                  addReferencias(e.dataTransfer.files)
                }}
              >
                <Paperclip className="w-5 h-5 mx-auto mb-1 text-[#909098]" />
                <p className="text-xs text-zinc-300">
                  Arraste arquivos ou <span style={{ color: '#E7B32C' }}>clique para selecionar</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E7B32C]/10 text-[#E7B32C] border border-[#E7B32C]/25 text-[11px] font-semibold">
                  <Clipboard className="w-3 h-3" />
                  <span>Dica: cole imagens direto com Ctrl + V</span>
                </div>
                <p className="text-[10px] text-[#909098] mt-1.5">PNG, JPG, PDF, CDR, AI, PSD... · até 50MB</p>
              </div>

              {referencias.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                  {referencias.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                      style={{ backgroundColor: '#18181A', borderColor: '#303034' }}
                    >
                      <FileText className="w-4 h-4 text-[#909098] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{file.name}</p>
                        <p className="text-[10px] text-[#909098]">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReferencia(i)}
                        className="text-[#909098] hover:text-[#F87171] p-1 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações do Modal */}
            <div className="flex gap-3 pt-3 border-t" style={{ borderColor: '#303034' }}>
              <button
                type="button"
                onClick={() => {
                  setShowNovoPedidoModal(false)
                  setReferencias([])
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={criarMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                style={{
                  backgroundColor: '#E7B32C',
                  color: '#0B0B0C',
                }}
              >
                {criarMutation.isPending ? 'Criando pedido...' : 'Criar Pedido'}
              </button>
            </div>
          </form>
        </DarkModal>
      )}

      {/* ── MODAL: EDITAR PEDIDO ── */}
      {pedidoParaEditar && (
        <DarkModal
          title={`Editar Pedido #${pedidoParaEditar.id}`}
          onClose={() => setPedidoParaEditar(null)}
        >
          <form onSubmit={handleEditarSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Título do pedido *
              </label>
              <input
                name="titulo"
                defaultValue={pedidoParaEditar.titulo}
                required
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Tipo de impressão
              </label>
              <select
                name="tipo_impressao"
                defaultValue={pedidoParaEditar.tipo_impressao}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                <option value="sublimacao">Sublimação</option>
                <option value="bordado">Bordado</option>
                <option value="serigrafia">Serigrafia</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Nome do cliente
                </label>
                <input
                  name="nome_cliente"
                  defaultValue={pedidoParaEditar.nome_cliente || pedidoParaEditar.cliente_nome || ''}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Email do cliente
                </label>
                <input
                  name="email_cliente"
                  type="email"
                  defaultValue={pedidoParaEditar.email_cliente || pedidoParaEditar.cliente_email || ''}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  WhatsApp do cliente
                </label>
                <input
                  name="whatsapp_cliente"
                  defaultValue={pedidoParaEditar.whatsapp_cliente || pedidoParaEditar.cliente_whatsapp || ''}
                  placeholder="(00) 00000-0000"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Prazo de entrega
                </label>
                <input
                  name="prazo"
                  type="date"
                  defaultValue={pedidoParaEditar.prazo ? format(parseISO(pedidoParaEditar.prazo), 'yyyy-MM-dd') : ''}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Valor cobrado (R$)
              </label>
              <input
                name="valor"
                type="number"
                step="0.01"
                min="0"
                defaultValue={pedidoParaEditar.valor ?? ''}
                placeholder="0.00"
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none font-mono"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Observações
              </label>
              <textarea
                name="observacoes"
                rows={3}
                defaultValue={pedidoParaEditar.observacoes || ''}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none resize-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              />
            </div>

            <div className="flex gap-3 pt-3 border-t" style={{ borderColor: '#303034' }}>
              <button
                type="button"
                onClick={() => setPedidoParaEditar(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editarMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                style={{
                  backgroundColor: '#E7B32C',
                  color: '#0B0B0C',
                }}
              >
                {editarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </DarkModal>
      )}

      {/* ── MODAL: CONFIRMAR CANCELAMENTO ── */}
      {pedidoParaCancelar && (
        <DarkModal
          title="Confirmar Cancelamento"
          onClose={() => setPedidoParaCancelar(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-red-950/20 border-red-900/50">
              <AlertTriangle className="w-5 h-5 text-[#F87171] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-300">
                <p className="font-semibold text-white mb-1">
                  Atenção: Ação Irreversível
                </p>
                <p>
                  Você está prestes a cancelar o pedido{' '}
                  <strong className="text-white">#{pedidoParaCancelar.id} — {pedidoParaCancelar.titulo}</strong>.
                </p>
                <p className="mt-1 text-[#909098]">
                  O cancelamento interromperá a produção e desabilitará novas aprovações. Pedidos cancelados não podem ser reabertos automaticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPedidoParaCancelar(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={cancelarMutation.isPending}
                onClick={() => cancelarMutation.mutate(pedidoParaCancelar.id)}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {cancelarMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </DarkModal>
      )}

      {/* ── MODAL: PREVIEW DE ARTE / MOCKUP ── */}
      {previewArte && (
        <DarkModal
          title={`Arte: ${previewArte.titulo} ${previewArte.versao ? `(v${previewArte.versao})` : ''}`}
          onClose={() => setPreviewArte(null)}
        >
          <div className="space-y-4">
            <div
              className="rounded-xl overflow-hidden border flex items-center justify-center p-2 bg-[#0E0E10]"
              style={{ borderColor: '#303034', maxHeight: '60vh' }}
            >
              <img
                src={resolveMediaUrl(previewArte.url)}
                alt={previewArte.titulo}
                className="max-h-[55vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="flex justify-between items-center gap-2">
              <a
                href={resolveMediaUrl(previewArte.url)}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                <Download className="w-3.5 h-3.5 text-[#E7B32C]" />
                <span>Baixar Imagem</span>
              </a>

              <button
                type="button"
                onClick={() => setPreviewArte(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: '#E7B32C', color: '#0B0B0C' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </DarkModal>
      )}
    </div>
  )
}

/**
 * Componente de Modal Dark consistente com o Design System da página Confecções
 */
export function DarkModal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl animate-[slideUp_0.15s_ease-out] border"
        style={{
          backgroundColor: '#151516',
          borderColor: '#303034',
          boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <h3 className="text-sm font-bold text-[#F5F5F6]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#909098] hover:text-[#F5F5F6] transition-colors p-1 rounded-lg hover:bg-[#1D1D1F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

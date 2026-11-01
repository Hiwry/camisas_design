import { useState, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kanbanService, confeccaoService } from '@/services/api'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import toast from 'react-hot-toast'
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react'
import { parseISO, isBefore, startOfToday, addDays } from 'date-fns'

export interface KanbanPedido {
  id: number
  titulo: string
  tipo_impressao: string
  status: string
  prazo: string | null
  valor?: number | null
  token_aprovacao?: string | null
  confeccao: { id: number; nome: string }
  cliente_nome?: string | null
  cliente_whatsapp?: string | null
  arte_ativa?: {
    arquivo_url: string
    arquivo_tipo: string
    preview_url?: string | null
    versao: number
  } | null
  referencias?: Array<{ url?: string; arquivo_url?: string; preview_url?: string; nome?: string; tipo?: string }> | null
  ultima_aprovacao?: { status: string; comentario?: string } | null
  updated_at?: string
  created_at?: string
}

export interface KanbanColuna {
  id: string
  titulo: string
  cards: KanbanPedido[]
}

const ETAPAS_LABELS: Record<string, string> = {
  aguardando_briefing:  'Aguardando Briefing',
  em_producao:          'Em Produção',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado:             'Aprovado',
  finalizado:           'Finalizado',
}

export default function KanbanBoard() {
  const queryClient = useQueryClient()
  const [activeCard, setActiveCard] = useState<KanbanPedido | null>(null)

  // ── ESTADOS DE FILTROS ──
  const [search, setSearch]             = useState('')
  const [confeccaoFilter, setConfeccao] = useState('todas')
  const [prazoFilter, setPrazoFilter]   = useState('todos')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // ── CARREGAMENTO DE DADOS ──
  const { data: colunasRaw = {}, isLoading } = useQuery<Record<string, KanbanColuna>>({
    queryKey: ['kanban'],
    queryFn: kanbanService.buscar,
  })

  // Lista de todas as confecções presentes para o dropdown
  const confeccoesDisponiveis = useMemo(() => {
    const map = new Map<string, string>()
    for (const col of Object.values(colunasRaw)) {
      for (const card of col.cards) {
        if (card.confeccao?.nome && card.confeccao.nome !== '—') {
          map.set(card.confeccao.nome, card.confeccao.nome)
        }
      }
    }
    return Array.from(map.values()).sort()
  }, [colunasRaw])

  // ── MUTAÇÃO DE MOVIMENTO ──
  const moverMutation = useMutation({
    mutationFn: ({ pedidoId, novoStatus }: { pedidoId: number; novoStatus: string }) =>
      kanbanService.mover(pedidoId, novoStatus),
    onSuccess: (_, vars) => {
      const etapaNome = ETAPAS_LABELS[vars.novoStatus] ?? vars.novoStatus
      toast.success(`Pedido movido para "${etapaNome}"! WhatsApp disparado.`, { icon: '🚀' })
      queryClient.invalidateQueries({ queryKey: ['kanban'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao mover pedido. Operação revertida.'
      toast.error(msg)
      queryClient.invalidateQueries({ queryKey: ['kanban'] })
    },
  })

  // ── HANDLERS DRAG AND DROP ──
  function handleDragStart(event: DragStartEvent) {
    setActiveCard(findCard(event.active.id as number) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)
    if (!over) return

    const pedidoId = active.id as number
    let novoStatus = over.id as string

    // Se dropou em cima de outro card ao invés da coluna diretamente
    if (typeof over.id === 'number') {
      const cardDestino = findCard(over.id as number)
      if (cardDestino) {
        novoStatus = cardDestino.status
      }
    }

    if (typeof novoStatus === 'string' && Object.keys(colunasRaw).includes(novoStatus)) {
      const cardAtual = findCard(pedidoId)
      if (cardAtual && cardAtual.status !== novoStatus) {
        // Atualização Otimista
        queryClient.setQueryData(['kanban'], (old: Record<string, KanbanColuna> | undefined) => {
          if (!old) return old
          const updated: Record<string, KanbanColuna> = {}
          for (const key of Object.keys(old)) {
            updated[key] = {
              ...old[key],
              cards: old[key].cards.filter((c) => c.id !== pedidoId),
            }
          }
          if (updated[novoStatus] && cardAtual) {
            updated[novoStatus] = {
              ...updated[novoStatus],
              cards: [{ ...cardAtual, status: novoStatus }, ...updated[novoStatus].cards],
            }
          }
          return updated
        })

        moverMutation.mutate({ pedidoId, novoStatus })
      }
    }
  }

  function handleMoverDireto(pedidoId: number, novoStatus: string) {
    const cardAtual = findCard(pedidoId)
    if (cardAtual && cardAtual.status !== novoStatus) {
      queryClient.setQueryData(['kanban'], (old: Record<string, KanbanColuna> | undefined) => {
        if (!old) return old
        const updated: Record<string, KanbanColuna> = {}
        for (const key of Object.keys(old)) {
          updated[key] = {
            ...old[key],
            cards: old[key].cards.filter((c) => c.id !== pedidoId),
          }
        }
        if (updated[novoStatus] && cardAtual) {
          updated[novoStatus] = {
            ...updated[novoStatus],
            cards: [{ ...cardAtual, status: novoStatus }, ...updated[novoStatus].cards],
          }
        }
        return updated
      })
      moverMutation.mutate({ pedidoId, novoStatus })
    }
  }

  function findCard(id: number): KanbanPedido | undefined {
    for (const col of Object.values(colunasRaw)) {
      const card = col.cards.find((c) => c.id === id)
      if (card) return card
    }
  }

  // ── CÁLCULO DOS 4 INDICADORES (DADOS REAIS) ──
  const { totalNoQuadro, emAndamentoTotal, aguardandoAprovacaoTotal, concluidosTotal } = useMemo(() => {
    let total = 0
    let andamento = 0
    let aprovacao = 0
    let concluidos = 0

    for (const col of Object.values(colunasRaw)) {
      for (const card of col.cards) {
        total++
        if (['aguardando_briefing', 'em_producao'].includes(card.status)) {
          andamento++
        } else if (card.status === 'aguardando_aprovacao') {
          aprovacao++
        } else if (card.status === 'finalizado') {
          concluidos++
        }
      }
    }

    return {
      totalNoQuadro: total,
      emAndamentoTotal: andamento,
      aguardandoAprovacaoTotal: aprovacao,
      concluidosTotal: concluidos,
    }
  }, [colunasRaw])

  // ── FILTRAGEM INTELIGENTE DOS CARDS POR COLUNA ──
  const colunasFiltradas = useMemo(() => {
    const resultado: Record<string, KanbanColuna> = {}

    for (const [colId, col] of Object.entries(colunasRaw)) {
      const cardsFiltrados = col.cards.filter((card) => {
        // 1. Busca textual
        const termo = search.toLowerCase().trim()
        const matchBusca =
          !termo ||
          card.titulo.toLowerCase().includes(termo) ||
          String(card.id).includes(termo) ||
          `#${card.id}`.includes(termo) ||
          (card.confeccao?.nome && card.confeccao.nome.toLowerCase().includes(termo)) ||
          (card.cliente_nome && card.cliente_nome.toLowerCase().includes(termo)) ||
          (card.tipo_impressao && card.tipo_impressao.toLowerCase().includes(termo))

        // 2. Filtro de Confecção
        const matchConfeccao =
          confeccaoFilter === 'todas' || card.confeccao?.nome === confeccaoFilter

        // 3. Filtro de Prazo
        let matchPrazo = true
        if (prazoFilter !== 'todos' && card.prazo) {
          const isFinalizado = card.status === 'finalizado'
          const prazoDate = parseISO(card.prazo)
          const atrasado = !isFinalizado && isBefore(prazoDate, startOfToday())
          const proximo = !isFinalizado && !atrasado && isBefore(prazoDate, addDays(startOfToday(), 2))

          if (prazoFilter === 'atrasados') matchPrazo = atrasado
          else if (prazoFilter === 'proximos') matchPrazo = proximo
          else if (prazoFilter === 'no_prazo') matchPrazo = !atrasado
        } else if (prazoFilter !== 'todos' && !card.prazo) {
          matchPrazo = false
        }

        return matchBusca && matchConfeccao && matchPrazo
      })

      resultado[colId] = {
        ...col,
        cards: cardsFiltrados,
      }
    }

    return resultado
  }, [colunasRaw, search, confeccaoFilter, prazoFilter])

  const temFiltroAtivo = search !== '' || confeccaoFilter !== 'todas' || prazoFilter !== 'todos'

  function limparFiltros() {
    setSearch('')
    setConfeccao('todas')
    setPrazoFilter('todos')
  }

  // ── ESTADO DE CARREGAMENTO ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-zinc-400">Carregando quadro de produção...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6 w-full">
      {/* ── 3. CARDS DE INDICADORES (4 INDICADORES REAIS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Indicador 1: Pedidos no quadro */}
        <div
          className="p-5 rounded-2xl border transition-all shadow-sm"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#909098]">
              Pedidos no quadro
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {totalNoQuadro}
          </div>
        </div>

        {/* Indicador 2: Em andamento */}
        <div
          className="p-5 rounded-2xl border transition-all shadow-sm"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#909098]">
              Em andamento
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {emAndamentoTotal}
          </div>
        </div>

        {/* Indicador 3: Aguardando aprovação */}
        <div
          className="p-5 rounded-2xl border transition-all shadow-sm"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#909098]">
              Aguardando aprovação
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {aguardandoAprovacaoTotal}
          </div>
        </div>

        {/* Indicador 4: Concluídos */}
        <div
          className="p-5 rounded-2xl border transition-all shadow-sm"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#909098]">
              Concluídos
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {concluidosTotal}
          </div>
        </div>
      </div>

      {/* ── 4. BARRA DE FERRAMENTAS E FILTROS ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Pesquisa por pedido ou confecção */}
          <div className="relative flex-1 max-w-md min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#909098]" />
            <input
              type="text"
              placeholder="Buscar por pedido ou confecção..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none transition-colors"
              style={{
                backgroundColor: '#151516',
                borderColor: '#303034',
                color: '#F5F5F6',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#909098] hover:text-[#F5F5F6]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por confecção */}
          <div className="relative min-w-[160px]">
            <select
              value={confeccaoFilter}
              onChange={(e) => setConfeccao(e.target.value)}
              className="w-full appearance-none text-xs sm:text-sm pl-3 pr-8 py-2.5 rounded-xl border focus:outline-none transition-colors cursor-pointer"
              style={{
                backgroundColor: '#151516',
                borderColor: '#303034',
                color: '#F5F5F6',
              }}
            >
              <option value="todas">Todas confecções</option>
              {confeccoesDisponiveis.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#909098] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filtro por prazo */}
          <div className="relative min-w-[150px]">
            <select
              value={prazoFilter}
              onChange={(e) => setPrazoFilter(e.target.value)}
              className="w-full appearance-none text-xs sm:text-sm pl-3 pr-8 py-2.5 rounded-xl border focus:outline-none transition-colors cursor-pointer"
              style={{
                backgroundColor: '#151516',
                borderColor: '#303034',
                color: '#F5F5F6',
              }}
            >
              <option value="todos">Todos os prazos</option>
              <option value="no_prazo">No prazo</option>
              <option value="proximos">Próximos do vencimento</option>
              <option value="atrasados">Atrasados</option>
            </select>
            <ChevronDown className="w-4 h-4 text-[#909098] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Botão Limpar Filtros / Status de Filtros */}
        {temFiltroAtivo && (
          <button
            onClick={limparFiltros}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-amber-400 hover:bg-amber-500/10"
            style={{
              borderColor: 'rgba(231,179,44,0.3)',
              backgroundColor: 'rgba(231,179,44,0.06)',
            }}
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar filtros</span>
          </button>
        )}

        {!temFiltroAtivo && (
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border text-[#909098]"
            style={{ backgroundColor: '#151516', borderColor: '#303034' }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
          </div>
        )}
      </div>

      {/* ── 5. QUADRO KANBAN (5 COLUNAS COM DRAG & DROP) ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 items-start w-full">
          {Object.values(colunasFiltradas).map((coluna) => (
            <KanbanColumn
              key={coluna.id}
              coluna={coluna}
              onMover={handleMoverDireto}
            />
          ))}
        </div>

        {/* Overlay enquanto arrasta */}
        <DragOverlay>
          {activeCard && <KanbanCard card={activeCard} overlay />}
        </DragOverlay>
      </DndContext>

      {/* ── RODAPÉ SUTIL ── */}
      <p className="text-xs text-[#909098] select-none pt-1">
        Prévia visual — indicadores e pedidos demonstrativos baseados na captura enviada.
      </p>
    </div>
  )
}

import { useState } from 'react'
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
import { kanbanService } from '@/services/api'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import toast from 'react-hot-toast'

export interface KanbanPedido {
  id: number
  titulo: string
  tipo_impressao: string
  status: string
  prazo: string | null
  confeccao: { id: number; nome: string }
  cliente_nome?: string | null
  cliente_whatsapp?: string | null
  arte_ativa: { arquivo_url: string; arquivo_tipo: string; preview_url?: string; versao: number } | null
  ultima_aprovacao: { status: string; comentario?: string } | null
}

export interface KanbanColuna {
  id: string
  titulo: string
  cards: KanbanPedido[]
}

export default function KanbanBoard() {
  const queryClient  = useQueryClient()
  const [activeCard, setActiveCard] = useState<KanbanPedido | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const { data: colunas = {}, isLoading } = useQuery<Record<string, KanbanColuna>>({
    queryKey: ['kanban'],
    queryFn: kanbanService.buscar,
  })

  const moverMutation = useMutation({
    mutationFn: ({ pedidoId, novoStatus }: { pedidoId: number; novoStatus: string }) =>
      kanbanService.mover(pedidoId, novoStatus),
    onSuccess: () => {
      toast.success('Card movido! WhatsApp enviado ao número cadastrado.')
      queryClient.invalidateQueries({ queryKey: ['kanban'] })
    },
    onError: () => {
      toast.error('Erro ao mover card.')
      queryClient.invalidateQueries({ queryKey: ['kanban'] })
    },
  })

  function handleDragStart(event: DragStartEvent) {
    setActiveCard(findCard(event.active.id as number) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)
    if (!over) return

    const pedidoId   = active.id as number
    const novoStatus = over.id as string

    if (typeof novoStatus === 'string' && Object.keys(colunas).includes(novoStatus)) {
      const cardAtual = findCard(pedidoId)
      if (cardAtual && cardAtual.status !== novoStatus) {
        moverMutation.mutate({ pedidoId, novoStatus })
        // Optimistic update
        queryClient.setQueryData(['kanban'], (old: Record<string, KanbanColuna>) => {
          if (!old) return old
          const updated = { ...old }
          for (const key of Object.keys(updated)) {
            updated[key] = { ...updated[key], cards: updated[key].cards.filter((c) => c.id !== pedidoId) }
          }
          if (updated[novoStatus] && cardAtual) {
            updated[novoStatus] = {
              ...updated[novoStatus],
              cards: [...updated[novoStatus].cards, { ...cardAtual, status: novoStatus }],
            }
          }
          return updated
        })
      }
    }
  }

  function findCard(id: number): KanbanPedido | undefined {
    for (const col of Object.values(colunas)) {
      const card = col.cards.find((c) => c.id === id)
      if (card) return card
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="text-sm">Carregando kanban...</span>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 h-full items-start">
        {Object.values(colunas).map((coluna) => (
          <KanbanColumn key={coluna.id} coluna={coluna} />
        ))}
      </div>

      <DragOverlay>
        {activeCard && <KanbanCard card={activeCard} overlay />}
      </DragOverlay>
    </DndContext>
  )
}

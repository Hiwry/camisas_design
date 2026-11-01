import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { KanbanColuna, KanbanPedido } from './KanbanBoard'
import KanbanCard from './KanbanCard'
import clsx from 'clsx'

// Cores e estilos exclusivos por coluna
const COLUMN_STYLES: Record<
  string,
  { dot: string; countBg: string; countText: string; border: string; glow: string }
> = {
  aguardando_briefing: {
    dot: '#6366F1',
    countBg: 'rgba(99,102,241,0.12)',
    countText: '#818CF8',
    border: 'rgba(99,102,241,0.3)',
    glow: 'rgba(99,102,241,0.5)',
  },
  em_producao: {
    dot: '#3B82F6',
    countBg: 'rgba(59,130,246,0.12)',
    countText: '#60A5FA',
    border: 'rgba(59,130,246,0.3)',
    glow: 'rgba(59,130,246,0.5)',
  },
  aguardando_aprovacao: {
    dot: '#E7B32C',
    countBg: 'rgba(231,179,44,0.12)',
    countText: '#FBBF24',
    border: 'rgba(231,179,44,0.3)',
    glow: 'rgba(231,179,44,0.5)',
  },
  aprovado: {
    dot: '#45DB92',
    countBg: 'rgba(69,219,146,0.12)',
    countText: '#45DB92',
    border: 'rgba(69,219,146,0.3)',
    glow: 'rgba(69,219,146,0.5)',
  },
  finalizado: {
    dot: '#A855F7',
    countBg: 'rgba(168,85,247,0.12)',
    countText: '#C084FC',
    border: 'rgba(168,85,247,0.3)',
    glow: 'rgba(168,85,247,0.5)',
  },
}

interface Props {
  coluna: KanbanColuna
  onMover?: (pedidoId: number, novoStatus: string) => void
}

export default function KanbanColumn({ coluna, onMover }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })
  const style = COLUMN_STYLES[coluna.id] ?? COLUMN_STYLES['aguardando_briefing']

  return (
    <div
      className={clsx(
        'w-[280px] sm:w-[300px] flex-shrink-0 flex flex-col rounded-2xl border transition-all duration-200',
        isOver && 'ring-2 ring-amber-500/50'
      )}
      style={{
        backgroundColor: '#151516',
        borderColor: isOver ? style.dot : '#303034',
        boxShadow: isOver
          ? `0 0 24px ${style.glow}`
          : '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* ── CABEÇALHO DA COLUNA ── */}
      <div
        className="flex items-center justify-between px-4 py-3.5 border-b"
        style={{ borderColor: '#26262B' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: style.dot,
              boxShadow: `0 0 10px ${style.glow}`,
            }}
          />
          <h3 className="text-xs font-bold tracking-wider text-[#F5F5F6] uppercase truncate">
            {coluna.titulo}
          </h3>
        </div>

        {/* Quantidade de pedidos na coluna */}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full border"
          style={{
            backgroundColor: style.countBg,
            color: style.countText,
            borderColor: style.border,
          }}
        >
          {coluna.cards.length}
        </span>
      </div>

      {/* ── ÁREA DROPPABLE DE CARDS ── */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 p-3 space-y-3 min-h-[420px] transition-colors duration-200 overflow-y-auto max-h-[calc(100vh-280px)] rounded-b-2xl',
          isOver && 'bg-amber-500/[0.03]'
        )}
      >
        <SortableContext
          items={coluna.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {coluna.cards.map((card) => (
            <KanbanCard key={card.id} card={card} onMover={onMover} />
          ))}
        </SortableContext>

        {/* Estado Vazio Amigável */}
        {coluna.cards.length === 0 && (
          <div
            className={clsx(
              'flex flex-col items-center justify-center p-8 rounded-xl border border-dashed transition-all duration-150 text-center my-1',
              isOver ? 'border-amber-400 bg-amber-500/10' : 'border-[#303034] bg-[#1A1A1D]/40'
            )}
          >
            {isOver ? (
              <span className="text-xs font-bold text-amber-400 animate-pulse">
                Soltar pedido aqui
              </span>
            ) : (
              <>
                <span className="text-xs font-medium text-[#F5F5F6]">
                  Nenhum pedido
                </span>
                <span className="text-[11px] text-[#909098] mt-1">
                  Arraste um card para cá
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

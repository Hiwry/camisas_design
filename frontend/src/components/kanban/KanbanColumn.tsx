import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { KanbanColuna } from './KanbanBoard'
import KanbanCard from './KanbanCard'

// Paleta de cores por coluna (dark premium)
const COLUMN_STYLES: Record<string, { dot: string; count: string; border: string }> = {
  aguardando_briefing:  { dot: '#6366f1', count: 'bg-indigo-950 text-indigo-400 border-indigo-900',  border: 'rgba(99,102,241,0.2)'  },
  em_producao:          { dot: '#3b82f6', count: 'bg-blue-950   text-blue-400   border-blue-900',    border: 'rgba(59,130,246,0.2)'  },
  aguardando_aprovacao: { dot: '#d4a020', count: 'bg-amber-950  text-amber-400  border-amber-900',   border: 'rgba(212,160,32,0.25)' },
  aprovado:             { dot: '#10b981', count: 'bg-emerald-950 text-emerald-400 border-emerald-900', border: 'rgba(16,185,129,0.2)' },
  finalizado:           { dot: '#8b5cf6', count: 'bg-purple-950 text-purple-400 border-purple-900',  border: 'rgba(139,92,246,0.2)'  },
}

interface Props {
  coluna: KanbanColuna
}

export default function KanbanColumn({ coluna }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })
  const style = COLUMN_STYLES[coluna.id] ?? COLUMN_STYLES['aguardando_briefing']

  return (
    <div className="flex flex-col w-[272px] flex-shrink-0">

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0"
        style={{
          background: '#141414',
          borderColor: style.border,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: style.dot, boxShadow: `0 0 6px ${style.dot}` }}
          />
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            {coluna.titulo}
          </h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${style.count}`}>
          {coluna.cards.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-[200px] p-2 space-y-2 rounded-b-xl border border-t-0 transition-all duration-150"
        style={{
          background: isOver ? 'rgba(212,160,32,0.04)' : '#111111',
          borderColor: isOver ? style.border : '#1e1e1e',
        }}
      >
        <SortableContext
          items={coluna.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {coluna.cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {coluna.cards.length === 0 && (
          <div
            className="flex items-center justify-center h-20 rounded-lg text-xs text-zinc-700 border-2 border-dashed transition-colors"
            style={{ borderColor: isOver ? style.dot : '#2a2a2a' }}
          >
            {isOver ? 'Soltar aqui' : 'Vazio'}
          </div>
        )}
      </div>
    </div>
  )
}

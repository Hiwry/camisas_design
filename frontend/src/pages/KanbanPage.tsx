import KanbanBoard from '@/components/kanban/KanbanBoard'
import { Columns } from 'lucide-react'

export default function KanbanPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(212,160,32,0.12)', border: '1px solid rgba(212,160,32,0.2)' }}
          >
            <Columns className="w-4 h-4" style={{ color: '#d4a020' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Kanban</h1>
            <p className="text-xs text-zinc-500">Gerencie os pedidos por status</p>
          </div>
        </div>
        <p className="text-xs text-zinc-600 hidden md:block">
          Arraste os cards para mover entre colunas
        </p>
      </div>
      <div className="flex-1 overflow-hidden p-3 sm:p-5 md:p-6">
        <KanbanBoard />
      </div>
    </div>
  )
}

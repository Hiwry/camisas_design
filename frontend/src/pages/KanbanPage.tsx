import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import KanbanBoard from '@/components/kanban/KanbanBoard'
import ModalNovoPedido from '@/components/pedido/ModalNovoPedido'
import { Plus } from 'lucide-react'

export default function KanbanPage() {
  const navigate = useNavigate()
  const [showNovoPedidoModal, setShowNovoPedidoModal] = useState(false)

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
        <span>Produção</span>
        <span className="text-zinc-600">/</span>
        <span className="text-[#F5F5F6] font-medium">Kanban</span>
      </nav>

      {/* ── 2. CABEÇALHO ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F6]">
            Quadro de produção
          </h1>
          <p className="text-sm text-[#909098] mt-1">
            Acompanhe e mova seus pedidos entre as etapas de produção.
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

      {/* ── 3. QUADRO KANBAN COM INDICADORES E FERRAMENTAS ── */}
      <div className="flex-1 pb-6">
        <KanbanBoard />
      </div>

      {/* ── 4. MODAL NOVO PEDIDO ── */}
      {showNovoPedidoModal && (
        <ModalNovoPedido onClose={() => setShowNovoPedidoModal(false)} />
      )}
    </div>
  )
}

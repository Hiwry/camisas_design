import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import type { KanbanPedido } from './KanbanBoard'
import { format, parseISO, isBefore, startOfToday, addDays } from 'date-fns'
import { resolveMediaUrl } from '@/lib/url'
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  ExternalLink,
  MessageCircle,
  Copy,
  ChevronRight,
  Eye,
  ArrowRight,
  FileText,
  Phone,
  User,
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const TIPO_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  sublimacao: { label: 'Sublimação', bg: '#0E243A', text: '#60A5FA', border: '#1A4A76' },
  bordado:    { label: 'Bordado',    bg: '#231533', text: '#C084FC', border: '#54287E' },
  serigrafia: { label: 'Serigrafia', bg: '#331C0E', text: '#FB923C', border: '#7C3615' },
  dtf:        { label: 'DTF',        bg: '#18261F', text: '#34D399', border: '#1C5338' },
  silkscreen: { label: 'Silk-Screen',bg: '#331C0E', text: '#FB923C', border: '#7C3615' },
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  aguardando_briefing:  { label: 'AGUARDANDO BRIEFING',  bg: '#1E1E22', text: '#909098', border: '#383840' },
  em_producao:          { label: 'EM PRODUÇÃO',          bg: '#0E243A', text: '#60A5FA', border: '#1A4A76' },
  aguardando_aprovacao: { label: 'AGUARDANDO APROVAÇÃO', bg: '#2D200A', text: '#FBBF24', border: '#6E4E10' },
  aprovado:             { label: 'APROVADO',             bg: '#0E291C', text: '#45DB92', border: '#175E38' },
  finalizado:           { label: 'CONCLUÍDO',            bg: '#231533', text: '#C084FC', border: '#54287E' },
}

const TODAS_COLUNAS: { id: string; titulo: string }[] = [
  { id: 'aguardando_briefing',  titulo: 'Aguardando Briefing' },
  { id: 'em_producao',          titulo: 'Em Produção' },
  { id: 'aguardando_aprovacao', titulo: 'Aguardando Aprovação' },
  { id: 'aprovado',             titulo: 'Aprovado' },
  { id: 'finalizado',           titulo: 'Finalizado' },
]

interface Props {
  card: KanbanPedido
  overlay?: boolean
  onMover?: (pedidoId: number, novoStatus: string) => void
}

export default function KanbanCard({ card, overlay, onMover }: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [imgError, setImgError] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: overlay })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  // Fecha menu de ações ao clicar fora
  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Lógica de Prazo
  const isFinalizado = card.status === 'finalizado'
  const prazoDate = card.prazo ? parseISO(card.prazo) : null
  const atrasado = !isFinalizado && prazoDate && isBefore(prazoDate, startOfToday())
  const proximo = !isFinalizado && !atrasado && prazoDate && isBefore(prazoDate, addDays(startOfToday(), 2))

  // Preview da Arte ou Mockup
  const tipoArte = card.arte_ativa?.arquivo_tipo?.toLowerCase() ?? ''
  const isImageFile = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(tipoArte) || tipoArte.startsWith('image/')
  const previewRaw = card.capa_url || card.arte_ativa?.preview_url || (isImageFile ? card.arte_ativa?.arquivo_url : null)
  const previewUrl = previewRaw ? resolveMediaUrl(previewRaw) : null
  const hasPreview = Boolean(previewUrl && !imgError)
  const isPdf = !hasPreview && tipoArte === 'pdf'

  const tipoCfg = TIPO_CONFIG[card.tipo_impressao?.toLowerCase()] ?? {
    label: card.tipo_impressao || 'Serviço',
    bg: '#1E1E22',
    text: '#909098',
    border: '#383840',
  }

  const statusCfg = STATUS_BADGES[card.status] ?? STATUS_BADGES.aguardando_briefing

  function handleCopiarLinkAprovacao(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    if (card.token_aprovacao) {
      const url = `${window.location.origin}/aprovar/${card.token_aprovacao}`
      navigator.clipboard.writeText(url)
      toast.success('Link de aprovação copiado!', { icon: '🔗' })
    } else {
      toast.error('Token de aprovação não disponível para este pedido.')
    }
  }

  function handleMoverStatus(novoStatus: string, e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    if (onMover && novoStatus !== card.status) {
      onMover(card.id, novoStatus)
    }
  }

  function handleAbrirWhatsapp(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    if (card.cliente_whatsapp) {
      const cleanPhone = card.cliente_whatsapp.replace(/\D/g, '')
      window.open(`https://wa.me/55${cleanPhone}`, '_blank')
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: '#1E1E20',
        borderColor: overlay ? '#E7B32C' : '#303034',
        boxShadow: overlay
          ? '0 20px 48px rgba(0,0,0,0.85), 0 0 0 1px #E7B32C'
          : '0 4px 12px rgba(0,0,0,0.25)',
      }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!overlay) {
          navigate(`/pedidos/${card.id}`)
        }
      }}
      className={clsx(
        'group relative rounded-xl border p-3.5 transition-all duration-200 select-none cursor-grab active:cursor-grabbing',
        !overlay && 'hover:border-[#E7B32C]/50 hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)] hover:-translate-y-0.5',
        overlay && 'rotate-1 scale-[1.02] cursor-grabbing z-50'
      )}
    >
      {/* ── 1. TOPO: MINIATURA DE ARTE / MOCKUP (se disponível) ── */}
      {hasPreview && (
        <div
          className="w-full h-36 rounded-lg mb-3 overflow-hidden flex items-center justify-center p-2 transition-transform duration-200 group-hover:scale-[1.01]"
          style={{ backgroundColor: '#121213', border: '1px solid #27272A' }}
        >
          <img
            src={previewUrl!}
            alt={card.titulo}
            className="max-h-full max-w-full object-contain rounded drop-shadow-md"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Miniatura alternativa para PDF */}
      {isPdf && (
        <div
          className="w-full h-12 rounded-lg mb-3 flex items-center justify-center gap-2 border"
          style={{ backgroundColor: 'rgba(231,179,44,0.06)', borderColor: 'rgba(231,179,44,0.18)' }}
        >
          <FileText className="w-4 h-4 text-[#E7B32C]" />
          <span className="text-xs font-semibold text-[#E7B32C]">
            PDF de Produção · v{card.arte_ativa?.versao ?? 1}
          </span>
        </div>
      )}

      {/* ── 2. STATUS BADGE & MENU DE AÇÕES ── */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border uppercase"
          style={{
            backgroundColor: statusCfg.bg,
            color: statusCfg.text,
            borderColor: statusCfg.border,
          }}
        >
          {statusCfg.label}
        </span>

        {/* Menu Contextual de Ações */}
        <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="p-1 rounded-md text-[#909098] hover:text-[#F5F5F6] hover:bg-[#2A2A2E] transition-colors"
            title="Ações do pedido"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-52 rounded-xl border p-1 z-50 shadow-2xl animate-[fadeIn_0.1s_ease-out]"
              style={{ backgroundColor: '#151516', borderColor: '#303034' }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  navigate(`/pedidos/${card.id}`)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors text-left"
              >
                <Eye className="w-3.5 h-3.5 text-[#E7B32C]" />
                <span>Ver detalhes completos</span>
              </button>

              {card.token_aprovacao && (
                <button
                  type="button"
                  onClick={handleCopiarLinkAprovacao}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors text-left"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-400" />
                  <span>Copiar link aprovação</span>
                </button>
              )}

              {card.cliente_whatsapp && (
                <button
                  type="button"
                  onClick={handleAbrirWhatsapp}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors text-left"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Chamar no WhatsApp</span>
                </button>
              )}

              {/* Submenu Mover para Status (Acessibilidade) */}
              <div className="pt-1 mt-1 border-t border-zinc-800">
                <span className="block px-3 py-1 text-[10px] font-semibold uppercase text-zinc-500">
                  Mover para etapa
                </span>
                {TODAS_COLUNAS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    disabled={col.id === card.status}
                    onClick={(e) => handleMoverStatus(col.id, e)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors text-left',
                      col.id === card.status
                        ? 'opacity-40 cursor-default text-zinc-500'
                        : 'text-zinc-300 hover:text-white hover:bg-[#1D1D1F]'
                    )}
                  >
                    <span>{col.titulo}</span>
                    {col.id === card.status && <span className="text-[10px] text-amber-500">atual</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. NOME DO PEDIDO ── */}
      <h4 className="text-sm font-bold text-[#F5F5F6] leading-snug line-clamp-2 mb-1 group-hover:text-amber-300 transition-colors">
        {card.titulo}
      </h4>

      {/* ── 4. CONFECÇÃO & CLIENTE ── */}
      <div className="text-xs space-y-0.5 mb-2.5">
        <p className="text-[#909098] truncate">
          {card.confeccao?.nome || 'Confecção'}
        </p>
        {(() => {
          const nome = card.cliente_nome || (card as any).nome_cliente
          const whats = card.cliente_whatsapp || (card as any).whatsapp_cliente
          const cleanWhats = whats ? whats.replace(/\D/g, '') : ''
          if (!nome && !whats) return null
          return (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
              <span className="truncate font-medium">{nome || 'Cliente'}</span>
              {cleanWhats && (
                <button
                  type="button"
                  onClick={handleAbrirWhatsapp}
                  className="inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 ml-auto flex-shrink-0"
                  title="Abrir WhatsApp"
                >
                  <Phone className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── 5. TAGS & BADGES (Tipo de serviço, etc) ── */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border"
          style={{
            backgroundColor: tipoCfg.bg,
            color: tipoCfg.text,
            borderColor: tipoCfg.border,
          }}
        >
          {tipoCfg.label}
        </span>

        {isFinalizado && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border"
            style={{
              backgroundColor: '#0E291C',
              color: '#45DB92',
              borderColor: '#175E38',
            }}
          >
            Concluído
          </span>
        )}

        {Boolean(card.valor && card.valor > 0) && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border"
            style={{
              backgroundColor: 'rgba(231,179,44,0.1)',
              color: '#E7B32C',
              borderColor: 'rgba(231,179,44,0.25)',
            }}
          >
            R$ {Number(card.valor).toFixed(2).replace('.', ',')}
          </span>
        )}
      </div>

      {/* ── 6. RODAPÉ: PRAZO DE ENTREGA & AÇÃO ── */}
      <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: '#2A2A2E' }}>
        {/* Indicador de Prazo */}
        {card.prazo ? (
          <div className="flex items-center gap-1.5">
            {isFinalizado ? (
              <div className="flex items-center gap-1.5 text-zinc-500 font-medium text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                <span>Finalizado em {format(prazoDate!, 'dd/MM')}</span>
              </div>
            ) : atrasado ? (
              <div className="flex items-center gap-1 text-[#F87171] font-semibold text-[11px]" title="Pedido Atrasado">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-[#F87171]" />
                <span>Prazo: {format(prazoDate!, 'dd/MM/yyyy')}</span>
              </div>
            ) : proximo ? (
              <div className="flex items-center gap-1 text-[#FBBF24] font-semibold text-[11px]" title="Prazo Próximo (menos de 48h)">
                <Clock className="w-3.5 h-3.5 flex-shrink-0 text-[#FBBF24]" />
                <span>Prazo: {format(prazoDate!, 'dd/MM/yyyy')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[#909098] font-medium text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                <span>Prazo: {format(prazoDate!, 'dd/MM/yyyy')}</span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-[#909098] text-[11px]">Sem prazo</span>
        )}

        {/* Link Ver Detalhes */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/pedidos/${card.id}`)
          }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline transition-colors"
          style={{ color: '#E7B32C' }}
        >
          <span>Ver detalhes</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

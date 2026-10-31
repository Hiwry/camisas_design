import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import type { KanbanPedido } from './KanbanBoard'
import { format, isPast, parseISO } from 'date-fns'
import { resolveMediaUrl } from '@/lib/url'
import { Calendar, CheckCircle2, AlertCircle, RefreshCw, FileText, MessageCircle } from 'lucide-react'
import clsx from 'clsx'

const TIPO_STYLE: Record<string, string> = {
  sublimacao: 'bg-blue-950   text-blue-400   border-blue-900',
  bordado:    'bg-purple-950 text-purple-400 border-purple-900',
  serigrafia: 'bg-orange-950 text-orange-400 border-orange-900',
}
const TIPO_LABEL: Record<string, string> = {
  sublimacao: 'Sublimação',
  bordado:    'Bordado',
  serigrafia: 'Serigrafia',
}

interface Props {
  card: KanbanPedido
  overlay?: boolean
}

export default function KanbanCard({ card, overlay }: Props) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const atrasado =
    card.prazo && isPast(parseISO(card.prazo)) && !['aprovado', 'finalizado'].includes(card.status)

  // Preview usa preview_url (novo campo), com fallback para arquivo_url se for imagem
  const tipoArte    = card.arte_ativa?.arquivo_tipo?.toLowerCase() ?? ''
  const rawPreview  = card.arte_ativa?.preview_url
    ?? (['png','jpg','jpeg','webp'].includes(tipoArte) ? card.arte_ativa?.arquivo_url : null)
  const previewUrl  = rawPreview ? resolveMediaUrl(rawPreview) : null
  const temPreview  = !!previewUrl
  const ehFontePdf  = !previewUrl && tipoArte === 'pdf'

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: '#1a1a1a',
        border: `1px solid ${overlay ? 'rgba(212,160,32,0.4)' : '#2a2a2a'}`,
        boxShadow: overlay
          ? '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,160,32,0.2)'
          : undefined,
      }}
      {...attributes}
      {...listeners}
      onClick={() => !overlay && navigate(`/pedidos/${card.id}`)}
      className={clsx(
        'rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-150',
        !overlay && 'hover:border-[rgba(212,160,32,0.3)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
        overlay && 'rotate-1',
      )}
    >
      {/* Capa da arte — preview image */}
      {temPreview && (
        <div className="w-full h-32 overflow-hidden" style={{ background: '#111' }}>
          <img
            src={previewUrl!}
            alt="Arte"
            className="w-full h-full object-cover opacity-90"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}
      {ehFontePdf && (
        <div
          className="w-full h-12 flex items-center justify-center gap-2 border-b"
          style={{ background: 'rgba(212,160,32,0.06)', borderColor: 'rgba(212,160,32,0.12)' }}
        >
          <FileText className="w-4 h-4" style={{ color: '#d4a020' }} />
          <span className="text-xs font-medium" style={{ color: '#d4a020' }}>
            PDF · v{card.arte_ativa?.versao}
          </span>
        </div>
      )}

      {/* Corpo */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug">
          {card.titulo}
        </p>
        <p className="text-xs text-zinc-600 truncate">{card.confeccao.nome}</p>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx('badge text-[10px] border', TIPO_STYLE[card.tipo_impressao])}>
            {TIPO_LABEL[card.tipo_impressao]}
          </span>
          {(card as any).valor > 0 && (
            <span className="badge text-[10px] border font-bold font-mono bg-emerald-950/70 text-emerald-400 border-emerald-800">
              R$ {Number((card as any).valor).toFixed(2).replace('.', ',')}
            </span>
          )}
          {card.ultima_aprovacao && (
            <span className={clsx(
              'badge text-[10px] border flex items-center gap-1',
              card.ultima_aprovacao.status === 'aprovado'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-900'
                : 'bg-amber-950 text-amber-400 border-amber-900'
            )}>
              {card.ultima_aprovacao.status === 'aprovado'
                ? <><CheckCircle2 className="w-3 h-3" /> Aprovado</>
                : <><RefreshCw className="w-3 h-3" /> Revisão</>
              }
            </span>
          )}
        </div>

        {/* Rodapé: Prazo & WhatsApp */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800/60 text-[11px]">
          {card.prazo ? (
            <div className={clsx(
              'flex items-center gap-1 font-medium',
              atrasado ? 'text-red-400' : 'text-zinc-500'
            )}>
              {atrasado
                ? <AlertCircle className="w-3 h-3 flex-shrink-0" />
                : <Calendar className="w-3 h-3 flex-shrink-0" />
              }
              <span>{format(parseISO(card.prazo), "dd/MM")}</span>
              {atrasado && (
                <span className="badge text-[9px] bg-red-950 text-red-400 border-red-900 py-0 px-1">
                  Atrasado
                </span>
              )}
            </div>
          ) : <span />}

          {card.cliente_whatsapp && (
            <div
              className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-medium px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/40"
              title={`Notificação automática ativa para ${card.cliente_whatsapp}`}
            >
              <MessageCircle className="w-2.5 h-2.5 flex-shrink-0 text-emerald-400" />
              <span className="truncate max-w-[90px]">{card.cliente_whatsapp}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { CheckCircle2, Clock, Factory, CheckCheck, Truck, Lock, Sparkles, Image as ImageIcon } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/url'

interface Props {
  status: string
  datasStatus?: Record<string, string>
  fotoCamisaPronta?: string | null
}

const ETAPAS = [
  { key: 'aberto', label: 'Aberto', icon: Clock, desc: 'Amigos preenchendo o formulário' },
  { key: 'prazo_encerrado', label: 'Prazo Encerrado', icon: Lock, desc: 'Período de inscrições finalizado' },
  { key: 'confirmado', label: 'Confirmado', icon: CheckCircle2, desc: 'Trava de alterações e envio para confecção' },
  { key: 'em_producao', label: 'Em Produção', icon: Factory, desc: 'Corte, estampa e costura' },
  { key: 'pronto', label: 'Pronto', icon: Sparkles, desc: 'Peças produzidas e embaladas' },
  { key: 'entregue', label: 'Entregue', icon: Truck, desc: 'Pedido entregue com sucesso' },
]

export default function LinhaDoTempoGrupo({ status, datasStatus = {}, fotoCamisaPronta }: Props) {
  const statusIndexMap: Record<string, number> = {
    aberto: 0,
    prazo_encerrado: 1,
    confirmado: 2,
    em_producao: 3,
    pronto: 4,
    entregue: 5,
  }

  const currentIndex = statusIndexMap[status] ?? 0

  function formatarDataHora(isoString?: string) {
    if (!isoString) return null
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
    }
  }

  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Linha do Tempo da Produção
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5">
            Acompanhe o status e a evolução do seu pedido em tempo real
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Etapa: {ETAPAS[currentIndex]?.label}
        </span>
      </div>

      {/* Linha horizontal para Desktop / Vertical para Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {ETAPAS.map((etapa, idx) => {
          const isPassed = idx < currentIndex
          const isCurrent = idx === currentIndex
          const isPending = idx > currentIndex
          const Icon = etapa.icon
          const dataHora = formatarDataHora(datasStatus[etapa.key])

          return (
            <div
              key={etapa.key}
              className={`relative flex flex-col p-3 rounded-xl border transition-all ${
                isCurrent
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5'
                  : isPassed
                  ? 'bg-zinc-950/80 border-emerald-500/30'
                  : 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isCurrent
                      ? 'bg-amber-400 text-black font-bold'
                      : isPassed
                      ? 'bg-emerald-500 text-black font-bold'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isPassed && <CheckCheck className="w-4 h-4 text-emerald-400" />}
                {isCurrent && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
              </div>

              <div className="text-xs font-bold text-white leading-tight">{etapa.label}</div>
              <div className="text-[10px] text-zinc-400 mt-1 line-clamp-2">{etapa.desc}</div>

              {dataHora && (
                <div className="mt-2 text-[10px] text-amber-300/80 font-mono font-medium">
                  {dataHora}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Foto da Camisa Pronta enviada pela Confecção */}
      {fotoCamisaPronta && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700 flex-shrink-0">
            <img
              src={resolveMediaUrl(fotoCamisaPronta)}
              alt="Camisa Pronta"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-400 tracking-wider">
              <ImageIcon className="w-4 h-4" />
              Foto da Peça Pronta enviada pela confecção!
            </div>
            <p className="text-xs text-zinc-300 mt-1">
              A confecção finalizou a confecção e enviou a prévia da peça pronta para conferência.
            </p>
            <a
              href={resolveMediaUrl(fotoCamisaPronta)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
            >
              Ver imagem em alta resolução →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}


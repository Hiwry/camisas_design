import { useState, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { arteService, creditoService } from '@/services/api'
import ModalComprarCreditos from '@/components/ModalComprarCreditos'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  X, Sparkles, CheckCircle2, AlertTriangle, Info,
  XCircle, Eye, Palette, AlignLeft, Image, Award, Coins,
} from 'lucide-react'
import clsx from 'clsx'

/* ── Tipos ── */
interface ErroRevisao {
  tipo: 'ortografico' | 'visual' | 'cor' | 'layout' | 'logo'
  gravidade: 'critico' | 'atencao' | 'informativo'
  descricao: string
  localizacao: string
  imagem_referencia: 'imagem_1' | 'imagem_2' | 'ambas'
  sugestao: string
}

interface ResultadoRevisao {
  erros: ErroRevisao[]
  resumo: string
  aprovada: boolean
  comparacao?: boolean
  arte_versao?: number
  comparar_versao?: number
}

interface Arte {
  id: number
  versao: number
  preview_url?: string
  preview_nome?: string
  arquivo_url?: string
  arquivo_tipo?: string
  enviada_em?: string
  ativa: boolean
}

function temImagem(a: Arte): boolean {
  if (a.preview_url) return true
  return ['png','jpg','jpeg','webp'].includes(a.arquivo_tipo?.toLowerCase() ?? '')
}

function thumbUrl(a: Arte): string | undefined {
  return a.preview_url ?? (temImagem(a) ? a.arquivo_url : undefined)
}

interface Props {
  pedidoId: number
  arteAtiva: Arte
  todasArtes: Arte[]
  onClose: () => void
}

/* ── Config visual por tipo/gravidade ── */
const TIPO_CFG: Record<string, { label: string; icon: ReactNode; cls: string }> = {
  ortografico: { label: 'Ortográfico',  icon: <AlignLeft className="w-3 h-3" />,   cls: 'bg-orange-950 text-orange-400 border-orange-900' },
  visual:      { label: 'Visual',       icon: <Eye className="w-3 h-3" />,          cls: 'bg-blue-950 text-blue-400 border-blue-900' },
  cor:         { label: 'Cor',          icon: <Palette className="w-3 h-3" />,      cls: 'bg-pink-950 text-pink-400 border-pink-900' },
  layout:      { label: 'Layout',       icon: <Image className="w-3 h-3" />,        cls: 'bg-indigo-950 text-indigo-400 border-indigo-900' },
  logo:        { label: 'Logo',         icon: <Award className="w-3 h-3" />,        cls: 'bg-purple-950 text-purple-400 border-purple-900' },
}

const GRAV_CFG: Record<string, { label: string; icon: ReactNode; cls: string; border: string }> = {
  critico:     { label: 'Crítico',     icon: <XCircle className="w-4 h-4" />,       cls: 'text-red-400',    border: 'border-red-900/60 bg-red-950/30' },
  atencao:     { label: 'Atenção',     icon: <AlertTriangle className="w-4 h-4" />, cls: 'text-amber-400',  border: 'border-amber-900/60 bg-amber-950/20' },
  informativo: { label: 'Informativo', icon: <Info className="w-4 h-4" />,          cls: 'text-blue-400',   border: 'border-blue-900/60 bg-blue-950/20' },
}

export default function RevisaoArteModal({ pedidoId, arteAtiva, todasArtes, onClose }: Props) {
  const qc = useQueryClient()
  const { isAdmin } = useAuthStore()
  const [arteCompararId, setArteCompararId] = useState<number | null>(null)
  const [resultado, setResultado] = useState<ResultadoRevisao | null>(null)
  const [showComprarModal, setShowComprarModal] = useState(false)

  /* Saldo de créditos de IA */
  const { data: saldoData } = useQuery({
    queryKey: ['creditos-saldo'],
    queryFn: creditoService.saldo,
  })

  const saldoCreditos = saldoData?.creditos ?? 0
  const isAdm = saldoData?.is_admin ?? isAdmin()
  const temCreditosSuficientes = isAdm || saldoCreditos > 0

  const versoesPrev = todasArtes.filter((a) => a.id !== arteAtiva.id && temImagem(a))

  const revisarMutation = useMutation({
    mutationFn: () =>
      arteService.revisar(pedidoId, arteAtiva.id, arteCompararId ?? undefined),
    onSuccess: (data) => {
      setResultado(data)
      qc.invalidateQueries({ queryKey: ['creditos-saldo'] })
    },
    onError: (err: unknown) => {
      const res = (err as { response?: { data?: { message?: string; sem_creditos?: boolean } } })?.response?.data
      if (res?.sem_creditos) {
        toast.error(res.message || 'Você não possui créditos suficientes.')
        setShowComprarModal(true)
        return
      }
      toast.error(res?.message ?? 'Erro ao revisar arte. Verifique a configuração da IA.')
    },
  })

  const criticos    = resultado?.erros.filter((e) => e.gravidade === 'critico')    ?? []
  const atencoes    = resultado?.erros.filter((e) => e.gravidade === 'atencao')    ?? []
  const informativos = resultado?.erros.filter((e) => e.gravidade === 'informativo') ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border overflow-hidden"
        style={{ background: '#0f0f0f', borderColor: '#2a2a2a', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div
          className="flex flex-wrap items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4 border-b flex-shrink-0 gap-2"
          style={{ background: '#141414', borderColor: '#242424' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(212,160,32,0.12)', border: '1px solid rgba(212,160,32,0.2)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: '#d4a020' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Revisão com IA</h2>
              <p className="text-[11px] text-zinc-500">IA analisa sua arte automaticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
              style={{
                background: isAdm ? 'rgba(99,102,241,0.1)' : saldoCreditos > 0 ? 'rgba(212,160,32,0.1)' : 'rgba(239,68,68,0.1)',
                borderColor: isAdm ? 'rgba(99,102,241,0.3)' : saldoCreditos > 0 ? 'rgba(212,160,32,0.3)' : 'rgba(239,68,68,0.3)',
              }}
            >
              <Coins className="w-3.5 h-3.5" style={{ color: isAdm ? '#818cf8' : saldoCreditos > 0 ? '#d4a020' : '#ef4444' }} />
              <span className="text-[11px] font-bold text-white">
                {isAdm ? 'Admin: Ilimitado' : `${saldoCreditos} análises`}
              </span>
            </div>

            {!isAdm && (
              <button
                type="button"
                onClick={() => setShowComprarModal(true)}
                className="btn-primary text-[11px] px-2.5 py-1 whitespace-nowrap"
              >
                + Comprar (R$ 5)
              </button>
            )}

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Conteúdo scrollável ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Configuração (antes de analisar) ── */}
          {!resultado && !revisarMutation.isPending && (
            <div className="p-3.5 sm:p-5 space-y-4 sm:space-y-5">

              {/* Arte que será analisada */}
              <div
                className="rounded-xl p-4 border"
                style={{ background: '#161616', borderColor: '#2a2a2a' }}
              >
                <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider font-semibold">Arte a analisar</p>
                <div className="flex items-center gap-3">
                  {thumbUrl(arteAtiva) && (
                    <img
                      src={thumbUrl(arteAtiva)}
                      alt="Preview"
                      className="w-14 h-14 object-cover rounded-lg border"
                      style={{ borderColor: '#2a2a2a' }}
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">Versão {arteAtiva.versao}</p>
                    <p className="text-xs text-zinc-600">{arteAtiva.preview_nome ?? 'Arte atual'}</p>
                    <span
                      className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(212,160,32,0.12)', color: '#d4a020', border: '1px solid rgba(212,160,32,0.2)' }}
                    >
                      Atual
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparação com versão anterior (opcional) */}
              {versoesPrev.length > 0 && (
                <div>
                  <label className="label">
                    Comparar com versão anterior
                    <span className="text-zinc-700 font-normal normal-case tracking-normal ml-1">(opcional)</span>
                  </label>
                  <select
                    className="input text-sm"
                    value={arteCompararId ?? ''}
                    onChange={(e) => setArteCompararId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Não comparar — analisar apenas versão atual</option>
                    {versoesPrev.map((a) => (
                      <option key={a.id} value={a.id}>Versão {a.versao}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-700 mt-1.5">
                    Quando comparadas, a IA identifica diferenças entre as duas versões.
                  </p>
                </div>
              )}

              {/* Info */}
              <div
                className="rounded-xl p-3.5 border flex gap-3"
                style={{ background: 'rgba(212,160,32,0.04)', borderColor: 'rgba(212,160,32,0.15)' }}
              >
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#d4a020' }} />
                <p className="text-[12px] text-zinc-500 leading-relaxed">
                  A IA vai verificar <strong className="text-zinc-300">erros ortográficos</strong>,{' '}
                  <strong className="text-zinc-300">inconsistências visuais</strong>,{' '}
                  <strong className="text-zinc-300">diferenças de cor</strong>,{' '}
                  <strong className="text-zinc-300">layout</strong> e{' '}
                  <strong className="text-zinc-300">logos</strong>.
                  A análise leva cerca de 10–30 segundos.
                </p>
              </div>

              {/* Alerta sem créditos */}
              {!isAdm && saldoCreditos === 0 && (
                <div
                  className="rounded-xl p-3 border flex items-center justify-between gap-3"
                  style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-300">
                      Você precisa de créditos para analisar (<strong>R$ 5,00 cada</strong>).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowComprarModal(true)}
                    className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
                  >
                    Recarregar
                  </button>
                </div>
              )}

              {/* Botão */}
              <button
                className="btn-primary w-full py-3"
                onClick={() => {
                  if (!temCreditosSuficientes) {
                    setShowComprarModal(true)
                    return
                  }
                  revisarMutation.mutate()
                }}
                style={!temCreditosSuficientes ? {
                  background: 'linear-gradient(135deg, #d4a020, #e8b430)',
                  color: '#000',
                  fontWeight: 700,
                } : {}}
              >
                {!temCreditosSuficientes ? (
                  <>
                    <Coins className="w-4 h-4 text-black" />
                    Adicionar Créditos para Analisar (R$ 5,00)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Iniciar Análise com IA {!isAdm && '(1 crédito)'}
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Loading ── */}
          {revisarMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-20 gap-5 px-8 text-center">
              <div className="relative">
                <svg className="animate-spin w-12 h-12" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#2a2a2a" strokeWidth="2.5"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <Sparkles className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: '#d4a020' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Analisando sua arte...</p>
                <p className="text-xs text-zinc-600 mt-1">O Claude está verificando erros e inconsistências</p>
              </div>
              <div className="flex gap-1.5 mt-2">
                {['Ortografia', 'Cores', 'Layout', 'Logo'].map((item, i) => (
                  <span
                    key={item}
                    className="text-[10px] px-2 py-0.5 rounded-full border animate-pulse"
                    style={{
                      borderColor: '#2a2a2a', color: '#555',
                      animationDelay: `${i * 0.3}s`,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Resultado ── */}
          {resultado && (
            <div className="p-5 space-y-5">

              {/* Veredicto */}
              <div
                className="rounded-xl p-4 border flex items-start gap-4"
                style={{
                  background: resultado.aprovada ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                  borderColor: resultado.aprovada ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: resultado.aprovada ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${resultado.aprovada ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}
                >
                  {resultado.aprovada
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    : <XCircle className="w-5 h-5 text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('text-sm font-bold', resultado.aprovada ? 'text-emerald-400' : 'text-red-400')}>
                      {resultado.aprovada ? 'Arte Aprovada pela IA' : 'Arte Reprovada pela IA'}
                    </span>
                    {resultado.comparacao && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border text-zinc-500" style={{ borderColor: '#2a2a2a' }}>
                        v{resultado.arte_versao} vs v{resultado.comparar_versao}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{resultado.resumo}</p>
                </div>
              </div>

              {/* Contador de erros por gravidade */}
              {resultado.erros.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Críticos', count: criticos.length, cls: 'text-red-400', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
                    { label: 'Atenção',  count: atencoes.length, cls: 'text-amber-400', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
                    { label: 'Informativos', count: informativos.length, cls: 'text-blue-400', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl p-3 text-center border"
                      style={{ background: item.bg, borderColor: item.border }}
                    >
                      <p className={clsx('text-xl font-black', item.cls)}>{item.count}</p>
                      <p className="text-[10px] text-zinc-600 font-medium mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Nenhum erro */}
              {resultado.erros.length === 0 && (
                <div
                  className="rounded-xl p-5 text-center border"
                  style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}
                >
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-400">Nenhum problema encontrado!</p>
                  <p className="text-xs text-zinc-600 mt-1">A arte parece estar pronta para produção.</p>
                </div>
              )}

              {/* Lista de erros */}
              {[
                { key: 'critico',     items: criticos,     title: 'Erros Críticos' },
                { key: 'atencao',     items: atencoes,     title: 'Pontos de Atenção' },
                { key: 'informativo', items: informativos,  title: 'Informativos' },
              ].map(({ key, items, title }) => items.length > 0 && (
                <div key={key}>
                  <h3 className={clsx('text-xs font-bold uppercase tracking-wider mb-2.5', GRAV_CFG[key].cls)}>
                    {title} ({items.length})
                  </h3>
                  <div className="space-y-2">
                    {items.map((erro, i) => (
                      <ErroCard key={i} erro={erro} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Analisar novamente */}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn-secondary flex-1 text-xs"
                  onClick={() => { setResultado(null); revisarMutation.reset() }}
                >
                  Nova análise
                </button>
                <button className="btn-primary flex-1 text-xs" onClick={onClose}>
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showComprarModal && (
        <ModalComprarCreditos onClose={() => setShowComprarModal(false)} />
      )}
    </div>
  )
}

/* ── Card de erro individual ── */
function ErroCard({ erro }: { erro: ErroRevisao }) {
  const tipoCfg  = TIPO_CFG[erro.tipo]  ?? { label: erro.tipo,  icon: <Info className="w-3 h-3" />, cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' }
  const gravCfg  = GRAV_CFG[erro.gravidade] ?? GRAV_CFG['informativo']

  return (
    <div
      className={clsx('rounded-xl p-3.5 border', gravCfg.border)}
    >
      {/* Header do card */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border', tipoCfg.cls)}>
            {tipoCfg.icon}
            {tipoCfg.label}
          </span>
          <span className={clsx('text-[10px] font-semibold', gravCfg.cls)}>
            {gravCfg.icon && <span className="inline-flex items-center gap-0.5">{gravCfg.icon} {gravCfg.label}</span>}
          </span>
        </div>
        {erro.localizacao && (
          <span className="text-[10px] text-zinc-600 flex-shrink-0 text-right">📍 {erro.localizacao}</span>
        )}
      </div>

      {/* Descrição */}
      <p className="text-xs text-zinc-300 leading-relaxed mb-2">{erro.descricao}</p>

      {/* Sugestão */}
      {erro.sugestao && (
        <div
          className="rounded-lg px-3 py-2 text-[11px] leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#888' }}
        >
          <span className="text-zinc-500 font-semibold">Sugestão: </span>
          {erro.sugestao}
        </div>
      )}
    </div>
  )
}

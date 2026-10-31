import { useRef, useState, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { revisaoService, creditoService } from '@/services/api'
import ModalComprarCreditos from '@/components/ModalComprarCreditos'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  Sparkles, Upload, X, CheckCircle2, XCircle,
  AlertTriangle, Info, Eye, Palette, AlignLeft,
  Image, Award, RotateCcw, FileImage, ArrowLeftRight,
  History, ChevronDown, ChevronUp, Clock, Coins, Plus,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

/* ── Tipos ── */
interface Erro {
  tipo: 'ortografico' | 'visual' | 'cor' | 'layout' | 'logo'
  gravidade: 'critico' | 'atencao' | 'informativo'
  descricao: string
  localizacao: string
  imagem_referencia: string
  sugestao: string
}
interface Resultado {
  erros: Erro[]
  resumo: string
  aprovada: boolean
}

/* ── Config visual ── */
const TIPO_CFG: Record<string, { label: string; icon: ReactNode; cls: string }> = {
  ortografico: { label: 'Ortográfico',  icon: <AlignLeft className="w-3 h-3" />,  cls: 'bg-orange-950 text-orange-400 border-orange-900' },
  visual:      { label: 'Visual',       icon: <Eye className="w-3 h-3" />,         cls: 'bg-blue-950 text-blue-400 border-blue-900' },
  cor:         { label: 'Cor',          icon: <Palette className="w-3 h-3" />,     cls: 'bg-pink-950 text-pink-400 border-pink-900' },
  layout:      { label: 'Layout',       icon: <Image className="w-3 h-3" />,       cls: 'bg-indigo-950 text-indigo-400 border-indigo-900' },
  logo:        { label: 'Logo',         icon: <Award className="w-3 h-3" />,       cls: 'bg-purple-950 text-purple-400 border-purple-900' },
}
const GRAV_CFG: Record<string, { label: string; icon: ReactNode; textCls: string; cardCls: string }> = {
  critico:     { label: 'Crítico',     icon: <XCircle className="w-3.5 h-3.5" />,       textCls: 'text-red-400',   cardCls: 'border-red-900/50 bg-red-950/25' },
  atencao:     { label: 'Atenção',     icon: <AlertTriangle className="w-3.5 h-3.5" />, textCls: 'text-amber-400', cardCls: 'border-amber-900/50 bg-amber-950/20' },
  informativo: { label: 'Informativo', icon: <Info className="w-3.5 h-3.5" />,          textCls: 'text-blue-400',  cardCls: 'border-blue-900/50 bg-blue-950/20' },
}

/* ── Tipo do histórico ── */
interface ItemHistorico {
  id: number
  aprovada: boolean
  resumo: string
  contexto: string | null
  total_erros: number
  criticos: number
  atencoes: number
  informativos: number
  erros: Erro[]
  pedido: { id: number; titulo: string } | null
  created_at: string
}

export default function RevisaoArtePage() {
  const refInputRef  = useRef<HTMLInputElement>(null)
  const arteInputRef = useRef<HTMLInputElement>(null)
  const qc           = useQueryClient()
  const { isAdmin }  = useAuthStore()

  const [refImg,            setRefImg]            = useState<File | null>(null)
  const [arteImg,           setArteImg]           = useState<File | null>(null)
  const [contexto,          setContexto]          = useState('')
  const [dragRef,           setDragRef]           = useState(false)
  const [dragArte,          setDragArte]          = useState(false)
  const [resultado,         setResultado]         = useState<Resultado | null>(null)
  const [histAberto,        setHistAberto]        = useState(false)
  const [itemExpandido,     setItemExpandido]     = useState<number | null>(null)
  const [showComprarModal,  setShowComprarModal]  = useState(false)

  /* Saldo de créditos de IA */
  const { data: saldoData } = useQuery({
    queryKey: ['creditos-saldo'],
    queryFn: creditoService.saldo,
  })

  /* Histórico do backend */
  const { data: historico = [] } = useQuery<ItemHistorico[]>({
    queryKey: ['revisao-historico'],
    queryFn: revisaoService.historico,
  })

  const saldoCreditos = saldoData?.creditos ?? 0
  const isAdm = saldoData?.is_admin ?? isAdmin()
  const temCreditosSuficientes = isAdm || saldoCreditos > 0

  const analisarMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('imagem_referencia', refImg!)
      fd.append('imagem_arte', arteImg!)
      if (contexto.trim()) fd.append('contexto', contexto.trim())
      return revisaoService.comparar(fd)
    },
    onSuccess: (data) => {
      setResultado(data)
      qc.invalidateQueries({ queryKey: ['revisao-historico'] })
      qc.invalidateQueries({ queryKey: ['creditos-saldo'] })
      setTimeout(() => {
        document.getElementById('resultado-ia')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    },
    onError: (err: unknown) => {
      const res = (err as { response?: { data?: { message?: string; sem_creditos?: boolean } } })?.response?.data
      if (res?.sem_creditos) {
        toast.error(res.message || 'Você não possui créditos suficientes.')
        setShowComprarModal(true)
        return
      }
      toast.error(res?.message ?? 'Erro ao analisar. Verifique a configuração da IA.')
    },
  })

  function handleDrop(e: React.DragEvent, target: 'ref' | 'arte') {
    e.preventDefault()
    target === 'ref' ? setDragRef(false) : setDragArte(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast.error('Use JPG, PNG ou WebP.')
      return
    }
    target === 'ref' ? setRefImg(file) : setArteImg(file)
  }

  function resolucaoBaixa(file: File): boolean {
    return file.size < 50 * 1024
  }

  function trocarImagens() {
    const tmp = refImg
    setRefImg(arteImg)
    setArteImg(tmp)
    // Se já havia resultado, limpa para forçar nova análise
    if (resultado) {
      setResultado(null)
      analisarMutation.reset()
      toast('Imagens trocadas — clique em Analisar novamente.', { icon: '🔄' })
    }
  }

  function resetar() {
    setRefImg(null)
    setArteImg(null)
    setContexto('')
    setResultado(null)
    analisarMutation.reset()
  }

  const criticos     = resultado?.erros.filter(e => e.gravidade === 'critico')     ?? []
  const atencoes     = resultado?.erros.filter(e => e.gravidade === 'atencao')     ?? []
  const informativos = resultado?.erros.filter(e => e.gravidade === 'informativo') ?? []
  const podeComecar  = !!refImg && !!arteImg && !analisarMutation.isPending

  return (
    <div className="min-h-full p-3.5 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-[fadeIn_0.2s_ease-out]">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,rgba(212,160,32,0.2),rgba(212,160,32,0.08))', border: '1px solid rgba(212,160,32,0.3)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: '#d4a020' }} />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white">Revisão de Arte com IA</h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 sm:ml-12">
            Envie a referência e a arte final — a IA detecta erros antes da entrega.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Card de Créditos */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
            style={{
              background: isAdm ? 'rgba(99,102,241,0.1)' : saldoCreditos > 0 ? 'rgba(212,160,32,0.1)' : 'rgba(239,68,68,0.1)',
              borderColor: isAdm ? 'rgba(99,102,241,0.3)' : saldoCreditos > 0 ? 'rgba(212,160,32,0.3)' : 'rgba(239,68,68,0.3)',
            }}
          >
            <Coins className="w-4 h-4" style={{ color: isAdm ? '#818cf8' : saldoCreditos > 0 ? '#d4a020' : '#ef4444' }} />
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-semibold leading-tight">SALDO IA</span>
              <span className="font-bold text-white leading-tight">
                {isAdm ? 'Ilimitado (Admin)' : `${saldoCreditos} ${saldoCreditos === 1 ? 'análise' : 'análises'}`}
              </span>
            </div>
          </div>

          {!isAdm && (
            <button
              onClick={() => setShowComprarModal(true)}
              className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Comprar Créditos (R$ 5)
            </button>
          )}

          {resultado && (
            <button onClick={resetar} className="btn-secondary text-xs gap-1.5 flex-shrink-0">
              <RotateCcw className="w-3.5 h-3.5" /> Nova análise
            </button>
          )}
        </div>
      </div>

      {/* Banner se cliente estiver sem créditos */}
      {!isAdm && saldoCreditos === 0 && (
        <div
          className="rounded-2xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800/60 flex items-center justify-center flex-shrink-0">
              <Coins className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-200">Você está sem créditos para análise de IA</h3>
              <p className="text-xs text-red-300/80 mt-0.5">
                Para analisar a sua arte com inteligência artificial, adquira créditos por <strong>R$ 5,00 cada análise</strong> via Pix com liberação instantânea.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowComprarModal(true)}
            className="w-full sm:w-auto justify-center btn-primary text-xs px-4 py-2.5 whitespace-nowrap flex-shrink-0 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Créditos
          </button>
        </div>
      )}

      {/* ── Uploads ── */}
      {!resultado && (
        <>
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Referência */}
              <UploadZone
                label="Imagem de Referência"
                sublabel="Briefing / o que o cliente pediu"
                badge="REFERÊNCIA"
                badgeColor="#6366f1"
                file={refImg}
                dragging={dragRef}
                inputRef={refInputRef}
                accept=".jpg,.jpeg,.png,.webp"
                onClear={() => setRefImg(null)}
                onDragOver={(e) => { e.preventDefault(); setDragRef(true) }}
                onDragLeave={() => setDragRef(false)}
                onDrop={(e) => handleDrop(e, 'ref')}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setRefImg(f); e.target.value = '' }}
              />

              {/* Arte Final */}
              <UploadZone
                label="Arte Final"
                sublabel="O que o designer criou"
                badge="ARTE FINAL"
                badgeColor="#d4a020"
                file={arteImg}
                dragging={dragArte}
                inputRef={arteInputRef}
                accept=".jpg,.jpeg,.png,.webp"
                onClear={() => setArteImg(null)}
                onDragOver={(e) => { e.preventDefault(); setDragArte(true) }}
                onDragLeave={() => setDragArte(false)}
                onDrop={(e) => handleDrop(e, 'arte')}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setArteImg(f); e.target.value = '' }}
              />
            </div>

            {/* Botão trocar — só aparece quando ambas têm imagem */}
            {refImg && arteImg && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:block">
                <button
                  onClick={trocarImagens}
                  className="w-9 h-9 rounded-full flex items-center justify-center border transition-all hover:scale-110"
                  style={{ background: '#1a1a1a', borderColor: '#3a3a3a', color: '#888' }}
                  title="Trocar referência ↔ arte final"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Botão trocar mobile */}
          {refImg && arteImg && (
            <button
              onClick={trocarImagens}
              className="md:hidden w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs text-zinc-500 transition-all hover:text-zinc-300"
              style={{ borderColor: '#2a2a2a', background: '#111' }}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Trocar referência ↔ arte final
            </button>
          )}

          {/* Alerta de resolução baixa */}
          {(refImg && resolucaoBaixa(refImg)) || (arteImg && resolucaoBaixa(arteImg)) ? (
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-3 border"
              style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.25)' }}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300 leading-relaxed">
                <p className="font-semibold mb-0.5">Imagem pequena detectada</p>
                <p className="text-amber-400/70">
                  Para textos curvados, selos e brasões, envie a imagem com pelo menos <strong>1400px</strong> de largura.
                  O backend faz upscale automático, mas imagens maiores garantem mais precisão.
                </p>
              </div>
            </div>
          ) : null}

          {/* Contexto opcional */}
          <div>
            <label className="label">Contexto do pedido <span className="text-zinc-700 font-normal normal-case tracking-normal">(opcional)</span></label>
            <input
              className="input"
              placeholder="Ex: Camiseta de time, nome do time é Leões do Norte, cor azul royal..."
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
            />
          </div>

          {/* Botão analisar */}
          <button
            className="btn-primary w-full py-4 text-base font-bold gap-2.5 transition-all"
            onClick={() => {
              if (!temCreditosSuficientes) {
                setShowComprarModal(true)
                return
              }
              analisarMutation.mutate()
            }}
            disabled={analisarMutation.isPending || (temCreditosSuficientes && !podeComecar)}
            style={!temCreditosSuficientes ? {
              background: 'linear-gradient(135deg, #d4a020, #e8b430)',
              color: '#000',
              boxShadow: '0 4px 20px rgba(212,160,32,0.3)',
            } : {}}
          >
            {analisarMutation.isPending ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Analisando com IA... (10–30 segundos)
              </span>
            ) : !temCreditosSuficientes ? (
              <span className="flex items-center justify-center gap-2.5">
                <Coins className="w-5 h-5 text-black" />
                Adicionar Créditos para Analisar (R$ 5,00 cada)
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2.5">
                <Sparkles className="w-5 h-5" />
                Analisar com IA {!isAdm && '(1 crédito)'}
              </span>
            )}
          </button>

          {!refImg || !arteImg ? (
            <p className="text-center text-xs text-zinc-700">
              {!refImg && !arteImg ? 'Envie as duas imagens para começar' : !refImg ? 'Falta a imagem de referência' : 'Falta a arte final'}
            </p>
          ) : null}
        </>
      )}

      {/* ── Loading animado ── */}
      {analisarMutation.isPending && (
        <div
          className="rounded-2xl border p-10 flex flex-col items-center gap-5 text-center"
          style={{ background: '#111', borderColor: '#2a2a2a' }}
        >
          <div className="relative">
            <svg className="animate-spin w-16 h-16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#2a2a2a" strokeWidth="2"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <Sparkles className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: '#d4a020' }} />
          </div>
          <div>
            <p className="text-base font-bold text-white">Claude está analisando sua arte...</p>
            <p className="text-sm text-zinc-600 mt-1">Verificando ortografia, cores, layout e logo</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {['Ortografia', 'Inconsistências', 'Cores', 'Layout', 'Logo'].map((item, i) => (
              <span
                key={item}
                className="text-xs px-3 py-1 rounded-full border animate-pulse"
                style={{ borderColor: '#2a2a2a', color: '#555', animationDelay: `${i * 0.25}s` }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Resultado ── */}
      {resultado && (
        <div id="resultado-ia" className="space-y-5">

          {/* Preview das duas imagens lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            {refImg && (
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
                <div className="px-3 py-2 text-[10px] font-bold tracking-widest" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>REFERÊNCIA</div>
                <img src={URL.createObjectURL(refImg)} alt="Referência" className="w-full max-h-52 object-contain" style={{ background: '#0d0d0d' }} />
              </div>
            )}
            {arteImg && (
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(212,160,32,0.3)' }}>
                <div className="px-3 py-2 text-[10px] font-bold tracking-widest" style={{ background: 'rgba(212,160,32,0.08)', color: '#d4a020' }}>ARTE FINAL</div>
                <img src={URL.createObjectURL(arteImg)} alt="Arte final" className="w-full max-h-52 object-contain" style={{ background: '#0d0d0d' }} />
              </div>
            )}
          </div>

          {/* Veredicto */}
          <div
            className="rounded-2xl p-5 border flex items-start gap-4"
            style={{
              background: resultado.aprovada ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              borderColor: resultado.aprovada ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: resultado.aprovada ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${resultado.aprovada ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}
            >
              {resultado.aprovada
                ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                : <XCircle className="w-6 h-6 text-red-400" />}
            </div>
            <div>
              <p className={clsx('text-lg font-black', resultado.aprovada ? 'text-emerald-400' : 'text-red-400')}>
                {resultado.aprovada ? '✅ Arte aprovada pela IA' : '❌ Arte reprovada pela IA'}
              </p>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{resultado.resumo}</p>
            </div>
          </div>

          {/* Contadores */}
          {resultado.erros.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Críticos',     count: criticos.length,     color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)' },
                { label: 'Atenção',      count: atencoes.length,     color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.25)' },
                { label: 'Informativos', count: informativos.length, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.25)' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl p-4 text-center border" style={{ background: item.bg, borderColor: item.border }}>
                  <p className="text-3xl font-black" style={{ color: item.color }}>{item.count}</p>
                  <p className="text-xs text-zinc-600 font-medium mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sem erros */}
          {resultado.erros.length === 0 && (
            <div className="rounded-2xl p-8 text-center border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-base font-bold text-emerald-400">Nenhum problema encontrado!</p>
              <p className="text-sm text-zinc-600 mt-1">A arte está fiel à referência e pronta para produção.</p>
            </div>
          )}

          {/* Lista de erros por gravidade */}
          {[
            { key: 'critico',     items: criticos,     title: '🔴 Erros Críticos' },
            { key: 'atencao',     items: atencoes,     title: '🟡 Pontos de Atenção' },
            { key: 'informativo', items: informativos, title: '🔵 Informativos' },
          ].map(({ key, items, title }) => items.length > 0 && (
            <div key={key}>
              <h3 className={clsx('text-sm font-bold mb-3', GRAV_CFG[key].textCls)}>{title}</h3>
              <div className="space-y-2.5">
                {items.map((erro, i) => <ErroCard key={i} erro={erro} />)}
              </div>
            </div>
          ))}

          {/* Ações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                trocarImagens()
                // trocarImagens já limpa resultado, mas precisamos reanalisar
                setTimeout(() => analisarMutation.mutate(), 50)
              }}
              className="btn-secondary py-3 gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" /> Inverter e reanalisar
            </button>
            <button onClick={resetar} className="btn-primary py-3 gap-2">
              <RotateCcw className="w-4 h-4" /> Analisar outra arte
            </button>
          </div>

          {/* Dica sobre inversão */}
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-2.5 border"
            style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)' }}
          >
            <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-500 leading-relaxed">
              <strong className="text-zinc-400">Os erros parecem invertidos?</strong> Use{' '}
              <strong className="text-indigo-400">Inverter e reanalisar</strong> — a IA compara
              sempre Referência → Arte Final. Se enviou as imagens ao contrário, isso corrige automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          HISTÓRICO DE CONSULTAS
      ══════════════════════════════════════════════ */}
      {historico.length > 0 && (
        <div className="card overflow-hidden">
          {/* Header clicável */}
          <button
            onClick={() => setHistAberto(!histAberto)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <History className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-semibold text-zinc-200">Histórico de Consultas</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(212,160,32,0.12)', color: '#d4a020', border: '1px solid rgba(212,160,32,0.2)' }}
              >
                {historico.length}
              </span>
            </div>
            {histAberto
              ? <ChevronUp className="w-4 h-4 text-zinc-600" />
              : <ChevronDown className="w-4 h-4 text-zinc-600" />
            }
          </button>

          {histAberto && (
            <div className="border-t" style={{ borderColor: '#2a2a2a' }}>
              {historico.map((item) => (
                <div
                  key={item.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: '#1e1e1e' }}
                >
                  {/* Linha resumo */}
                  <button
                    onClick={() => setItemExpandido(itemExpandido === item.id ? null : item.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Ícone status */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: item.aprovada ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      }}
                    >
                      {item.aprovada
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <XCircle      className="w-4 h-4 text-red-400" />
                      }
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">
                        {item.contexto || (item.pedido ? item.pedido.titulo : 'Sem contexto')}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(item.created_at), "dd/MM/yyyy HH:mm")}
                        </span>
                        {item.pedido && (
                          <span className="text-[11px] text-zinc-600">
                            Pedido: {item.pedido.titulo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contadores de erros */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.criticos > 0 && (
                        <span className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />{item.criticos}
                        </span>
                      )}
                      {item.atencoes > 0 && (
                        <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{item.atencoes}
                        </span>
                      )}
                      {item.informativos > 0 && (
                        <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1">
                          <Info className="w-3 h-3" />{item.informativos}
                        </span>
                      )}
                      {item.total_erros === 0 && (
                        <span className="text-[11px] font-semibold text-emerald-400">Sem erros</span>
                      )}
                      {itemExpandido === item.id
                        ? <ChevronUp className="w-3.5 h-3.5 text-zinc-700 ml-1" />
                        : <ChevronDown className="w-3.5 h-3.5 text-zinc-700 ml-1" />
                      }
                    </div>
                  </button>

                  {/* Detalhe expandido */}
                  {itemExpandido === item.id && (
                    <div
                      className="px-5 pb-4 space-y-3"
                      style={{ background: '#0f0f0f' }}
                    >
                      {/* Resumo */}
                      <p className="text-sm text-zinc-400 leading-relaxed pt-1">{item.resumo}</p>

                      {/* Erros detalhados */}
                      {item.erros && item.erros.length > 0 && (
                        <div className="space-y-2">
                          {item.erros.map((erro, i) => {
                            const grav = GRAV_CFG[erro.gravidade] ?? GRAV_CFG['informativo']
                            const tipo = TIPO_CFG[erro.tipo]    ?? { label: erro.tipo, icon: <Info className="w-3 h-3" />, cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' }
                            return (
                              <div key={i} className={clsx('rounded-lg p-3 border text-xs', grav.cardCls)}>
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className={clsx('inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded border', tipo.cls)}>
                                    {tipo.icon}{tipo.label}
                                  </span>
                                  <span className={clsx('inline-flex items-center gap-1 font-bold', grav.textCls)}>
                                    {grav.icon}{grav.label}
                                  </span>
                                  {erro.localizacao && (
                                    <span className="text-zinc-600 ml-auto">📍 {erro.localizacao}</span>
                                  )}
                                </div>
                                <p className="text-zinc-300">{erro.descricao}</p>
                                {erro.sugestao && (
                                  <p className="mt-1 text-zinc-600">
                                    <span className="text-zinc-500 font-semibold">Sugestão:</span> {erro.sugestao}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de Compra de Créditos ── */}
      {showComprarModal && (
        <ModalComprarCreditos onClose={() => setShowComprarModal(false)} />
      )}

    </div>
  )
}

/* ── Zona de upload ── */
function UploadZone({
  label, sublabel, badge, badgeColor, file, dragging,
  inputRef, accept, onClear, onDragOver, onDragLeave, onDrop, onChange,
}: {
  label: string; sublabel: string; badge: string; badgeColor: string
  file: File | null; dragging: boolean
  inputRef: React.RefObject<HTMLInputElement>
  accept: string
  onClear: () => void
  onDragOver: React.DragEventHandler
  onDragLeave: React.DragEventHandler
  onDrop: React.DragEventHandler
  onChange: React.ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded tracking-widest"
          style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}30` }}
        >
          {badge}
        </span>
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
      </div>
      <p className="text-[11px] text-zinc-600 mb-2">{sublabel}</p>

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />

      {file ? (
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: `${badgeColor}40` }}
        >
          <div className="relative group">
            <img
              src={URL.createObjectURL(file)}
              alt={label}
              className="w-full max-h-56 object-contain"
              style={{ background: '#0d0d0d' }}
            />
            <button
              onClick={onClear}
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.75)' }}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div
            className="px-3 py-2 flex items-center justify-between border-t"
            style={{ background: '#111', borderColor: '#2a2a2a' }}
          >
            <p className="text-[11px] text-zinc-400 truncate">{file.name}</p>
            <p className="text-[10px] text-zinc-700 ml-2 flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 py-10 select-none"
          style={{
            borderColor: dragging ? badgeColor : '#2a2a2a',
            background: dragging ? `${badgeColor}08` : '#0d0d0d',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
            style={{
              background: dragging ? `${badgeColor}15` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${dragging ? `${badgeColor}40` : '#2a2a2a'}`,
            }}
          >
            {dragging
              ? <Upload className="w-6 h-6" style={{ color: badgeColor }} />
              : <FileImage className="w-6 h-6 text-zinc-600" />
            }
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-400 font-medium">
              {dragging ? 'Solte aqui' : 'Arraste ou clique para enviar'}
            </p>
            <p className="text-xs text-zinc-700 mt-0.5">JPG · PNG · WebP · até 10MB</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Card individual de erro ── */
function ErroCard({ erro }: { erro: Erro }) {
  const tipo = TIPO_CFG[erro.tipo]  ?? { label: erro.tipo,  icon: <Info className="w-3 h-3" />, cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' }
  const grav = GRAV_CFG[erro.gravidade] ?? GRAV_CFG['informativo']

  return (
    <div className={clsx('rounded-xl p-4 border', grav.cardCls)}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border', tipo.cls)}>
            {tipo.icon}{tipo.label}
          </span>
          <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold', grav.textCls)}>
            {grav.icon}{grav.label}
          </span>
        </div>
        {erro.localizacao && (
          <span className="text-[10px] text-zinc-600 text-right flex-shrink-0">📍 {erro.localizacao}</span>
        )}
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed">{erro.descricao}</p>
      {erro.sugestao && (
        <div className="mt-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)', color: '#888' }}>
          <span className="font-semibold text-zinc-500">Sugestão: </span>{erro.sugestao}
        </div>
      )}
    </div>
  )
}

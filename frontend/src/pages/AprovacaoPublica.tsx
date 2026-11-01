import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aprovacaoService } from '@/services/api'
import toast from 'react-hot-toast'
import { resolveMediaUrl } from '@/lib/url'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'
import {
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  X,
  ShieldCheck,
  Ban,
  ImageIcon,
  ChevronDown,
  Info,
  CheckCheck,
  Send,
  AlertTriangle,
  Lock,
  Check,
  Shirt,
  MessageCircle,
} from 'lucide-react'

/* ── Tipagens ─────────────────────────────────────────────────── */
interface ArteArquivo {
  url: string
  nome?: string
  eh_preview?: boolean
  tipo?: string
  tamanho?: number
}

interface ArteItem {
  id: number
  pedido_id: number
  versao: number
  arquivo_url?: string | null
  arquivo_nome?: string | null
  arquivo_tipo?: string | null
  arquivo_tamanho?: number | null
  preview_url?: string | null
  preview_nome?: string | null
  arquivos?: ArteArquivo[] | null
  notas?: string | null
  ativa: boolean
  is_final: boolean
  enviada_em?: string | null
  created_at?: string
}

interface AprovacaoRegistro {
  id: number
  pedido_id: number
  arte_id: number
  status: 'aprovado' | 'revisao'
  comentario?: string | null
  aprovado_por_nome?: string | null
  aprovado_por_ip?: string | null
  aprovado_em?: string | null
  created_at?: string
}

interface PedidoPublico {
  id: number
  titulo: string
  tipo_impressao: string
  status: 'aguardando_briefing' | 'em_producao' | 'aguardando_aprovacao' | 'aprovado' | 'finalizado' | 'cancelado'
  prazo?: string | null
  confeccao: {
    nome: string
    telefone?: string | null
  }
  observacoes?: string | null
}

interface RespostaPublica {
  pedido: PedidoPublico
  arte_ativa?: ArteItem | null
  historico_artes?: ArteItem[]
  ultima_aprovacao?: AprovacaoRegistro | null
}

const TIPO_LABEL: Record<string, string> = {
  sublimacao: 'Sublimação',
  bordado: 'Bordado',
  serigrafia: 'Silk-Screen',
  dtf: 'DTF',
  transfer: 'Transfer',
}

/* ── Componente Principal ─────────────────────────────────────── */
export default function AprovacaoPublica() {
  const { token } = useParams<{ token: string }>()
  const qc = useQueryClient()

  // Estados de Interface
  const [activePreviewIdx, setActivePreviewIdx] = useState(0)
  const [previewMatteDark, setPreviewMatteDark] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const [histOpen, setHistOpen] = useState(false)
  const [versaoSelecionadaId, setVersaoSelecionadaId] = useState<number | null>(null)

  // Modais de Ação
  const [modalAprovarOpen, setModalAprovarOpen] = useState(false)
  const [modalRevisaoOpen, setModalRevisaoOpen] = useState(false)

  // Formulários
  const [nomeAprovador, setNomeAprovador] = useState('')
  const [comentarioRevisao, setComentarioRevisao] = useState('')
  const [recemAprovado, setRecemAprovado] = useState<AprovacaoRegistro | null>(null)
  const [recemRevisado, setRecemRevisado] = useState(false)

  // Atalho Esc para fechar modais e lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false)
        setModalAprovarOpen(false)
        setModalRevisaoOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /* ── Requisição do Pedido ── */
  const { data, isLoading, error } = useQuery<RespostaPublica>({
    queryKey: ['aprovacao', token],
    queryFn: () => aprovacaoService.buscarPorToken(token!),
    enabled: !!token,
    retry: 1,
  })

  /* ── Mutações de Aprovação e Revisão ── */
  const aprovarMutation = useMutation({
    mutationFn: () => aprovacaoService.aprovar(token!, nomeAprovador.trim() || undefined),
    onSuccess: (res) => {
      toast.success('Arte aprovada com sucesso!')
      setModalAprovarOpen(false)
      setRecemAprovado(
        res.aprovacao || {
          id: Date.now(),
          pedido_id: data?.pedido.id || 0,
          arte_id: data?.arte_ativa?.id || 0,
          status: 'aprovado',
          aprovado_por_nome: nomeAprovador.trim() || 'Cliente Responsável',
          aprovado_em: new Date().toISOString(),
        }
      )
      qc.invalidateQueries({ queryKey: ['aprovacao', token] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao registrar aprovação. Tente novamente.'
      toast.error(msg)
    },
  })

  const revisaoMutation = useMutation({
    mutationFn: () =>
      aprovacaoService.pedirRevisao(token!, comentarioRevisao.trim(), nomeAprovador.trim() || undefined),
    onSuccess: () => {
      toast.success('Solicitação de alteração enviada com sucesso!')
      setModalRevisaoOpen(false)
      setRecemRevisado(true)
      qc.invalidateQueries({ queryKey: ['aprovacao', token] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao enviar alteração. Tente novamente.'
      toast.error(msg)
    },
  })

  /* ── Estado de Carregamento ── */
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#0B0B0C] text-[#F5F5F6] box-border">
        <div className="w-14 h-14 rounded-2xl bg-[#151516] border border-[#303034] flex items-center justify-center shadow-2xl mb-4">
          <svg className="animate-spin w-7 h-7 text-[#E7B32C]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.15" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-base font-bold tracking-tight text-[#F5F5F6]">Carregando aprovação de arte...</p>
        <p className="text-xs text-[#909098] mt-1 text-center">Buscando detalhes do pedido e mockups</p>
      </div>
    )
  }

  /* ── Estado de Erro / Token Inválido ── */
  if (error || !data || !data.pedido) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0B0B0C] text-[#F5F5F6] box-border">
        <div className="rounded-2xl border border-[#303034] bg-[#151516] p-6 sm:p-8 max-w-md w-full text-center shadow-2xl box-border">
          <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-900/60 flex items-center justify-center mx-auto mb-4 text-red-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[#F5F5F6] mb-2 tracking-tight">
            Link de aprovação indisponível
          </h1>
          <p className="text-xs sm:text-sm text-[#909098] leading-relaxed mb-6">
            Este link pode ter expirado, sido revogado ou digitado incorretamente. Solicite à sua confecção um novo link de aprovação.
          </p>
          <div className="p-3 rounded-xl bg-[#1D1D1F] border border-[#303034] text-xs text-[#909098] flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#E7B32C]" />
            <span>Ambiente Seguro Camiseta Design</span>
          </div>
        </div>
      </div>
    )
  }

  const { pedido, arte_ativa, historico_artes = [], ultima_aprovacao } = data
  const isCancelado = pedido.status === 'cancelado'
  const isJaAprovado = pedido.status === 'aprovado' || pedido.status === 'finalizado' || !!recemAprovado
  const isEmRevisao = (pedido.status === 'em_producao' || recemRevisado) && !isJaAprovado && !isCancelado
  const isAguardando = pedido.status === 'aguardando_aprovacao' && !recemAprovado && !recemRevisado

  // Versão em exibição (ativa ou histórico selecionado)
  const versaoExibida: ArteItem | null =
    (versaoSelecionadaId ? historico_artes.find((a) => a.id === versaoSelecionadaId) : null) ||
    arte_ativa ||
    (historico_artes.length > 0 ? historico_artes[historico_artes.length - 1] : null)

  const isVisualizandoHistorica = !!versaoExibida && arte_ativa && versaoExibida.id !== arte_ativa.id

  // Extrai lista de visualizações / mockups
  const listaPreviews: { url: string; nome: string }[] = (() => {
    if (!versaoExibida) return []
    const arquivos = Array.isArray(versaoExibida.arquivos) ? versaoExibida.arquivos : []
    const previews = arquivos.filter((a: any) => a.eh_preview)

    if (previews.length > 0) {
      return previews.map((p: any, idx: number) => ({
        url: resolveMediaUrl(p.url),
        nome: p.nome || `Ângulo ${idx + 1}`,
      }))
    }

    if (versaoExibida.preview_url) {
      return [
        {
          url: resolveMediaUrl(versaoExibida.preview_url),
          nome: versaoExibida.preview_nome || 'Visualização da Arte',
        },
      ]
    }

    const tipo = versaoExibida.arquivo_tipo?.toLowerCase() || ''
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(tipo) && versaoExibida.arquivo_url) {
      return [
        {
          url: resolveMediaUrl(versaoExibida.arquivo_url),
          nome: versaoExibida.arquivo_nome || 'Visualização da Arte',
        },
      ]
    }

    return []
  })()

  const curPreview = listaPreviews[activePreviewIdx] || listaPreviews[0]
  const previewSrc = curPreview?.url ? resolveMediaUrl(curPreview.url) : null
  const registroAprovacaoValido = recemAprovado || ultima_aprovacao

  // Quantidade de versões no histórico além da exibida
  const qtdOutrasVersoes = historico_artes.filter((a) => a.id !== versaoExibida?.id).length

  return (
    <div className="min-h-screen w-full bg-[#0B0B0C] text-[#F5F5F6] flex flex-col font-sans box-border selection:bg-[#E7B32C]/30 selection:text-[#F5F5F6]">
      {/* ── 1. CABEÇALHO SUPERIOR (Fiel ao Mockup) ── */}
      <header className="w-full bg-[#0B0B0C] border-b border-[#303034] px-4 sm:px-6 py-3.5 box-border">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Logo e Nome da Confecção */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#E7B32C] flex items-center justify-center flex-shrink-0 shadow-md">
              <Shirt className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#909098] leading-tight">Aprovação de arte</p>
              <p className="text-sm font-bold text-[#F5F5F6] truncate mt-0.5">
                {pedido.confeccao.nome} <span className="text-[#909098] font-normal">· Camiseta Design</span>
              </p>
            </div>
          </div>

          {/* Badge Direita: Link de aprovação */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#151516] border border-[#303034] text-xs text-zinc-300 font-medium shadow-sm">
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Link de aprovação</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 box-border flex-1">
        {/* ── BANNER DE PEDIDO CANCELADO (Se aplicável) ── */}
        {isCancelado && (
          <div className="w-full rounded-2xl border border-[#4A1D24] bg-[#1B1416] p-4 sm:p-5 flex items-start gap-3.5 text-red-400 shadow-xl box-border">
            <div className="w-9 h-9 rounded-xl bg-[#2A1618] border border-red-500/30 flex items-center justify-center flex-shrink-0 text-[#F87171] mt-0.5">
              <Ban className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[#F87171] leading-snug">
                Pedido cancelado — somente leitura
              </h2>
              <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                Versões e arquivos permanecem disponíveis para consulta; alterações e aprovações estão bloqueadas.
              </p>
            </div>
          </div>
        )}

        {/* ── BANNER DE CONSULTA HISTÓRICA ── */}
        {isVisualizandoHistorica && (
          <div className="w-full rounded-2xl border border-blue-900/60 bg-blue-950/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-300 shadow-md box-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <Info className="w-4 h-4 flex-shrink-0 text-blue-400" />
              <span className="leading-relaxed">
                Você está consultando a <strong>Versão {versaoExibida?.versao}</strong> do histórico. A versão ativa para decisão é a <strong>Versão {arte_ativa?.versao}</strong>.
              </span>
            </div>
            <button
              onClick={() => {
                setVersaoSelecionadaId(null)
                setActivePreviewIdx(0)
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-900/50 hover:bg-blue-800/60 border border-blue-700/60 text-white font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Voltar à Versão Atual
            </button>
          </div>
        )}

        {/* ── 2. TÍTULO E SUBTÍTULO DA PÁGINA (Idêntico ao Mockup) ── */}
        <section className="space-y-1">
          <p className="text-xs font-bold tracking-wider text-[#E7B32C] uppercase">
            REVISÃO DE ARTE / PEDIDO
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F6] tracking-tight">
            Confira sua arte antes de aprovar
          </h1>
          <p className="text-xs sm:text-sm text-[#909098] leading-relaxed max-w-2xl">
            Amplie a imagem e verifique nomes, cores, números, logotipos e demais detalhes antes de confirmar.
          </p>
        </section>

        {/* ── 3. CARD DE INFORMAÇÕES DO PEDIDO (Idêntico ao Mockup) ── */}
        <section className="w-full rounded-2xl border border-[#303034] bg-[#151516] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm box-border">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-10 min-w-0">
            {/* Pedido */}
            <div className="min-w-0">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#909098] block">
                PEDIDO
              </span>
              <p className="text-sm sm:text-base font-bold text-[#F5F5F6] mt-0.5 truncate">
                {pedido.titulo}
              </p>
            </div>

            {/* Serviço */}
            <div className="min-w-0">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#909098] block">
                SERVIÇO
              </span>
              <p className="text-sm sm:text-base font-semibold text-[#F5F5F6] mt-0.5 truncate">
                {TIPO_LABEL[pedido.tipo_impressao] || pedido.tipo_impressao}
              </p>
            </div>

            {/* Prazo informado */}
            <div className="min-w-0">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#909098] block">
                PRAZO INFORMADO
              </span>
              <p className="text-sm sm:text-base font-semibold text-[#F5F5F6] mt-0.5 truncate">
                {pedido.prazo ? format(parseISO(pedido.prazo), 'dd/MM/yyyy') : 'A combinar'}
              </p>
            </div>
          </div>

          {/* Badge: Versão X para conferência */}
          <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#282110] border border-[#E7B32C]/40 text-[#E7B32C] shadow-sm">
              Versão {versaoExibida?.versao || 1} para conferência
            </span>
          </div>
        </section>

        {/* ── 4. GRID PRINCIPAL: PRÉVIA DA ARTE (ESQ) + SUA DECISÃO (DIR) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── COLUNA ESQUERDA: PRÉVIA DA ARTE (lg:col-span-7) ── */}
          <div className="lg:col-span-7 space-y-4">
            <section className="w-full rounded-2xl border border-[#303034] bg-[#151516] p-4 sm:p-5 shadow-xl space-y-4 box-border">
              {/* Header do Card */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#303034] min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="w-4 h-4 text-[#E7B32C] flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-[#F5F5F6] truncate">
                    Prévia da arte · {listaPreviews.length === 1 ? '1 imagem' : `${listaPreviews.length} imagens`}
                  </span>
                </div>

                {previewSrc && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Botão de Contraste */}
                    <button
                      type="button"
                      onClick={() => setPreviewMatteDark(!previewMatteDark)}
                      className="px-2.5 py-1 rounded-lg bg-[#1D1D1F] border border-[#303034] text-xs text-zinc-400 hover:text-[#F5F5F6] transition-colors"
                      title={previewMatteDark ? 'Alternar para fundo claro' : 'Alternar para fundo escuro'}
                    >
                      {previewMatteDark ? 'Fundo claro' : 'Fundo escuro'}
                    </button>

                    {/* Botão Ampliar arte */}
                    <button
                      type="button"
                      onClick={() => {
                        setLightboxZoom(1)
                        setLightboxOpen(true)
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#E7B32C] hover:text-[#f3c242] transition-colors px-2 py-1"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Ampliar arte</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mensagem da Confecção / Designer se houver notas */}
              {versaoExibida?.notas && (
                <div className="p-3 rounded-xl bg-[#1D1D1F] border border-[#303034] text-xs text-zinc-300 flex items-start gap-2.5">
                  <span className="text-sm leading-none flex-shrink-0">💬</span>
                  <p className="min-w-0 break-words leading-relaxed">
                    <strong className="text-[#E7B32C]">Mensagem do Designer:</strong> {versaoExibida.notas}
                  </p>
                </div>
              )}

              {/* ── Box da Imagem com Proporção Preservada ── */}
              <div
                onClick={() => previewSrc && setLightboxOpen(true)}
                className={clsx(
                  'art-preview w-full min-w-0 rounded-xl border border-[#303034] p-3 sm:p-5 flex items-center justify-center overflow-hidden transition-colors box-border',
                  previewMatteDark ? 'bg-[#0E0E0F]' : 'bg-[#F2F2F4]',
                  previewSrc ? 'cursor-zoom-in hover:border-[#E7B32C]/60' : 'cursor-default'
                )}
              >
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt={curPreview?.nome || 'Arte da camiseta para aprovação'}
                    className="block w-full max-w-full h-auto max-h-[460px] object-contain rounded-lg"
                  />
                ) : versaoExibida?.arquivo_tipo === 'pdf' ? (
                  <iframe
                    src={resolveMediaUrl(versaoExibida.arquivo_url)}
                    className="w-full h-[400px] rounded-lg border-0"
                    title="Visualização da arte em PDF"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2.5 text-zinc-600 py-12 text-center p-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] border border-[#303034] flex items-center justify-center text-zinc-500">
                      <ImageIcon className="w-6 h-6 opacity-40" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-400">
                      Nenhuma imagem de prévia disponível
                    </p>
                    <p className="text-xs text-zinc-600 max-w-xs">
                      Aguarde o envio do mockup oficial pela confecção.
                    </p>
                  </div>
                )}
              </div>

              {/* Legenda inferior da imagem como no mockup */}
              <p className="text-center text-[11px] text-[#909098]">
                Imagem de referência da captura enviada · visualização com proporção preservada
              </p>

              {/* Seletor de Múltiplos Ângulos (se houver) */}
              {listaPreviews.length > 1 && (
                <div className="pt-3 border-t border-[#303034] space-y-2">
                  <span className="text-[11px] font-bold text-[#909098] uppercase tracking-wider block">
                    Ângulos disponíveis ({listaPreviews.length}):
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {listaPreviews.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePreviewIdx(idx)}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs flex-shrink-0',
                          activePreviewIdx === idx
                            ? 'bg-[#1D1D1F] border-[#E7B32C] text-[#E7B32C] ring-1 ring-[#E7B32C]/40'
                            : 'bg-[#151516] border-[#303034] text-zinc-400 hover:text-white'
                        )}
                      >
                        <div className="w-5 h-5 rounded-md overflow-hidden bg-black/50 border border-zinc-700 flex-shrink-0">
                          <img src={p.url} alt={p.nome} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-semibold whitespace-nowrap">{p.nome}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── COLUNA DIREITA: SUA DECISÃO (lg:col-span-5) ── */}
          <div className="lg:col-span-5 space-y-4">
            <section className="w-full rounded-2xl border border-[#303034] bg-[#151516] p-4 sm:p-6 shadow-xl space-y-5 box-border">
              {/* Header do Card: Sua decisão / 1 de 2 opções */}
              <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F6]">
                  <Check className="w-4 h-4 text-[#E7B32C]" />
                  <span>Sua decisão</span>
                </div>
                <span className="text-xs text-zinc-400 bg-[#1D1D1F] px-2.5 py-0.5 rounded-full border border-[#303034]">
                  1 de 2 opções
                </span>
              </div>

              {isJaAprovado ? (
                /* Estado Já Aprovado */
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <CheckCheck className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Arte aprovada com sucesso!</h2>
                      <p className="text-xs text-emerald-400 font-medium">Liberado para produção têxtil</p>
                    </div>
                  </div>

                  <div className="rounded-xl p-3.5 bg-[#1D1D1F] border border-[#303034] space-y-2 text-xs">
                    <div className="flex justify-between border-b border-[#303034] pb-1.5">
                      <span className="text-[#909098]">Versão Aprovada:</span>
                      <strong className="text-[#E7B32C]">
                        Versão {registroAprovacaoValido?.arte_id ? (historico_artes.find(a => a.id === registroAprovacaoValido.arte_id)?.versao || arte_ativa?.versao || 1) : (arte_ativa?.versao || 1)}
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-[#303034] pb-1.5">
                      <span className="text-[#909098]">Aprovado por:</span>
                      <strong className="text-[#F5F5F6] truncate max-w-[180px]">
                        {registroAprovacaoValido?.aprovado_por_nome || nomeAprovador || 'Cliente Responsável'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#909098]">Data e Hora:</span>
                      <strong className="text-[#F5F5F6]">
                        {registroAprovacaoValido?.aprovado_em
                          ? format(parseISO(registroAprovacaoValido.aprovado_em), "dd/MM/yyyy 'às' HH:mm")
                          : format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : isCancelado ? (
                /* Estado Cancelado */
                <div className="text-center py-4 space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#2A1618] border border-red-500/30 flex items-center justify-center text-[#F87171] mx-auto">
                    <Ban className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#F87171]">Aprovações Bloqueadas</h3>
                  <p className="text-xs text-[#909098]">Pedido cancelado no sistema.</p>
                </div>
              ) : isEmRevisao ? (
                /* Estado em Revisão */
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                      <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Revisão Solicitada</h3>
                      <p className="text-xs text-blue-400">Designer preparando nova versão</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#909098] leading-relaxed">
                    Sua solicitação de alteração foi recebida. Você será notificado assim que o próximo layout estiver pronto.
                  </p>
                </div>
              ) : (
                /* Estado Aguardando Aprovação (Idêntico ao Mockup) */
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-bold text-[#E7B32C] uppercase tracking-wider block">
                      CONFIRMAÇÃO DO CLIENTE
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-[#F5F5F6] mt-1 tracking-tight">
                      A arte está correta para produção?
                    </h2>
                    <p className="text-xs text-[#909098] mt-1.5 leading-relaxed">
                      Revise todos os detalhes da estampa. Você pode aprovar a versão apresentada ou solicitar um ajuste antes da produção.
                    </p>
                  </div>

                  {/* Campo de Nome do Cliente */}
                  <div className="space-y-1.5">
                    <label className="block text-xs text-zinc-300 font-medium">
                      Seu nome <span className="text-zinc-500 font-normal">(opcional, conforme configuração)</span>
                    </label>
                    <input
                      type="text"
                      value={nomeAprovador}
                      onChange={(e) => setNomeAprovador(e.target.value)}
                      placeholder="Ex.: João Silva"
                      className="w-full rounded-xl px-4 py-3 text-sm bg-[#1D1D1F] border border-[#303034] text-[#F5F5F6] placeholder-zinc-600 focus:outline-none focus:border-[#E7B32C] box-border"
                    />
                  </div>

                  {/* Botões de Ação */}
                  <div className="space-y-2.5 pt-1">
                    {/* Botão Dourado Principal: Aprovar esta arte */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isVisualizandoHistorica) {
                          toast.error('Retorne à versão atual para aprovar.')
                          return
                        }
                        setModalAprovarOpen(true)
                      }}
                      className="w-full min-h-[46px] py-3 px-4 rounded-xl font-bold text-sm bg-[#E7B32C] text-[#0B0B0C] hover:bg-[#f3c242] active:scale-[0.99] transition-all flex items-center justify-center gap-2 select-none shadow-md"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Aprovar esta arte</span>
                    </button>

                    {/* Botão Secundário: Solicitar alteração */}
                    <button
                      type="button"
                      onClick={() => setModalRevisaoOpen(true)}
                      className="w-full min-h-[46px] py-3 px-4 rounded-xl font-semibold text-sm bg-[#1D1D1F] border border-[#303034] text-[#F5F5F6] hover:bg-[#252528] active:scale-[0.99] transition-all flex items-center justify-center gap-2 select-none"
                    >
                      <RotateCcw className="w-4 h-4 text-zinc-400" />
                      <span>Solicitar alteração</span>
                    </button>
                  </div>

                  {/* Card "Aprovação consciente" como no mockup */}
                  <div className="rounded-xl p-3.5 bg-[#201B11]/60 border border-[#E7B32C]/25 text-xs space-y-1">
                    <p className="font-bold text-[#E7B32C] text-xs">Aprovação consciente</p>
                    <p className="text-[11px] text-[#909098] leading-relaxed">
                      Ao confirmar, você autoriza a produção com base nesta versão específica. O sistema exibirá um resumo para confirmação final.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ── 5. VERSÕES ANTERIORES (ACCORDION COMO NO MOCKUP) ── */}
        <section className="w-full rounded-2xl border border-[#303034] bg-[#151516] p-4 sm:p-5 shadow-sm box-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <RotateCcw className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#F5F5F6]">Versões anteriores</h3>
                <p className="text-xs text-[#909098] mt-0.5">
                  Consulte as versões anteriores para entender as alterações da arte.
                </p>
              </div>
            </div>

            {qtdOutrasVersoes > 0 ? (
              <button
                type="button"
                onClick={() => setHistOpen(!histOpen)}
                className="px-3.5 py-2 rounded-xl bg-[#1D1D1F] hover:bg-zinc-800 border border-[#303034] text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
              >
                <span>Ver {qtdOutrasVersoes} {qtdOutrasVersoes === 1 ? 'versão' : 'versões'}</span>
                <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', histOpen && 'rotate-180')} />
              </button>
            ) : (
              <span className="text-xs text-zinc-600 self-start sm:self-auto">
                Primeira versão do projeto
              </span>
            )}
          </div>

          {/* Accordion Expandido */}
          {histOpen && qtdOutrasVersoes > 0 && (
            <div className="mt-4 pt-4 border-t border-[#303034] divide-y divide-[#303034]">
              {historico_artes
                .filter((a) => a.id !== versaoExibida?.id)
                .map((arte) => (
                  <div
                    key={arte.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#F5F5F6]">Versão {arte.versao}</span>
                        {arte.ativa && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#E7B32C] text-black">
                            Versão Oficial
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#909098] mt-0.5">
                        {arte.enviada_em
                          ? `Enviada em ${format(parseISO(arte.enviada_em), "dd/MM/yyyy 'às' HH:mm")}`
                          : 'Versão registrada'}
                        {arte.notas ? ` — "${arte.notas}"` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setVersaoSelecionadaId(arte.id)
                        setActivePreviewIdx(0)
                        window.scrollTo({ top: 120, behavior: 'smooth' })
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#1D1D1F] hover:bg-zinc-800 border border-[#303034] text-xs font-semibold text-zinc-200 self-start sm:self-auto flex-shrink-0"
                    >
                      Consultar arte desta versão
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      </main>

      {/* ── 6. RODAPÉ (Idêntico ao Mockup) ── */}
      <footer className="w-full border-t border-[#303034]/60 py-5 px-4 text-center text-xs text-zinc-600 box-border mt-8">
        <p>Camiseta Design · Sistema de aprovação de artes</p>
      </footer>

      {/* ── MODAL DE CONFIRMAÇÃO DE APROVAÇÃO ── */}
      {modalAprovarOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] overflow-y-auto box-border"
          onClick={() => !aprovarMutation.isPending && setModalAprovarOpen(false)}
        >
          <div
            className="rounded-2xl border border-[#303034] bg-[#151516] p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 my-auto box-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#282110] border border-[#E7B32C]/40 flex items-center justify-center text-[#E7B32C] flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#F5F5F6] tracking-tight">
                    Confirmar Aprovação da Arte
                  </h3>
                  <p className="text-xs text-[#909098] truncate">
                    Versão {arte_ativa?.versao || 1} · {pedido.titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAprovarOpen(false)}
                disabled={aprovarMutation.isPending}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl p-3.5 bg-[#1D1D1F] border border-[#303034] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#909098]">Pedido:</span>
                <span className="font-bold text-white truncate max-w-[180px]">{pedido.titulo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#909098]">Versão autorizada:</span>
                <span className="font-bold text-[#E7B32C]">Versão {arte_ativa?.versao || 1}</span>
              </div>
              {nomeAprovador.trim() && (
                <div className="flex justify-between">
                  <span className="text-[#909098]">Responsável:</span>
                  <span className="font-bold text-white truncate max-w-[180px]">{nomeAprovador.trim()}</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[#282110]/50 border border-[#E7B32C]/30 text-xs text-[#E7B32C] leading-relaxed">
              <strong>Importante:</strong> Ao confirmar, você atesta que conferiu todos os nomes, ortografia, cores e números, e autoriza o envio definitivo para produção.
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setModalAprovarOpen(false)}
                disabled={aprovarMutation.isPending}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl font-semibold text-xs bg-[#1D1D1F] border border-[#303034] text-zinc-300 hover:bg-[#252528] order-2 sm:order-1"
              >
                Voltar e revisar
              </button>
              <button
                type="button"
                onClick={() => aprovarMutation.mutate()}
                disabled={aprovarMutation.isPending}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-[#E7B32C] text-[#0B0B0C] hover:bg-[#f3c242] shadow-lg shadow-[#E7B32C]/20 flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                {aprovarMutation.isPending ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span>Gravando aprovação...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar aprovação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE SOLICITAÇÃO DE ALTERAÇÃO ── */}
      {modalRevisaoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] overflow-y-auto box-border"
          onClick={() => !revisaoMutation.isPending && setModalRevisaoOpen(false)}
        >
          <div
            className="rounded-2xl border border-[#303034] bg-[#151516] p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 my-auto box-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] border border-[#303034] flex items-center justify-center text-[#E7B32C] flex-shrink-0">
                  <RotateCcw className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#F5F5F6] tracking-tight">
                    Solicitar Alterações
                  </h3>
                  <p className="text-xs text-[#909098] truncate">
                    Versão {versaoExibida?.versao || 1} · {pedido.titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalRevisaoOpen(false)}
                disabled={revisaoMutation.isPending}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Seu nome ou cargo
              </label>
              <input
                type="text"
                value={nomeAprovador}
                onChange={(e) => setNomeAprovador(e.target.value)}
                placeholder="Ex.: Carlos (Capitão)"
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-[#1D1D1F] border border-[#303034] text-[#F5F5F6] placeholder-zinc-600 focus:outline-none focus:border-[#E7B32C] box-border"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  O que precisa ser alterado? <span className="text-red-400">*</span>
                </label>
                <span className="text-[11px] text-zinc-500">Mín. 5 letras</span>
              </div>
              <textarea
                value={comentarioRevisao}
                onChange={(e) => setComentarioRevisao(e.target.value)}
                rows={4}
                placeholder="Descreva o que precisa ser alterado. Ex.: corrigir nome, mudar cor da manga ou ajustar o logotipo."
                className="w-full rounded-xl px-4 py-3 text-sm bg-[#1D1D1F] border border-[#303034] text-[#F5F5F6] placeholder-zinc-600 focus:outline-none focus:border-[#E7B32C] resize-none box-border"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setModalRevisaoOpen(false)}
                disabled={revisaoMutation.isPending}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl font-semibold text-xs bg-[#1D1D1F] border border-[#303034] text-zinc-300 hover:bg-[#252528] order-2 sm:order-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => revisaoMutation.mutate()}
                disabled={revisaoMutation.isPending || comentarioRevisao.trim().length < 5}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-[#E7B32C] text-[#0B0B0C] hover:bg-[#f3c242] disabled:opacity-40 flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                {revisaoMutation.isPending ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar solicitação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX EM TELA CHEIA (AMPLIAÇÃO SEM CORTES) ── */}
      {lightboxOpen && previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 box-border select-none"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Barra Superior */}
          <div
            className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#151516]/90 px-3.5 py-1.5 rounded-xl border border-[#303034] text-xs font-bold text-[#E7B32C]">
              Versão {versaoExibida?.versao || 1}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#151516]/90 px-2 py-1 rounded-xl border border-[#303034]">
                <button
                  type="button"
                  onClick={() => setLightboxZoom((s) => Math.max(s - 0.25, 0.75))}
                  className="p-1 text-zinc-400 hover:text-[#E7B32C]"
                  title="Afastar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1 text-zinc-200">
                  {Math.round(lightboxZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxZoom((s) => Math.min(s + 0.25, 3))}
                  className="p-1 text-zinc-400 hover:text-[#E7B32C]"
                  title="Aproximar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxZoom(1)}
                  className="p-1 text-zinc-400 hover:text-[#E7B32C]"
                  title="100%"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="p-2 rounded-xl bg-[#151516]/90 border border-[#303034] text-zinc-300 hover:text-red-400"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Imagem Ampliada */}
          <div
            className="w-full h-full flex items-center justify-center overflow-auto p-4 box-border"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => setLightboxZoom((z) => (z === 1 ? 2 : 1))}
          >
            <img
              src={previewSrc}
              alt="Arte ampliada"
              style={{ transform: `scale(${lightboxZoom})` }}
              className="max-h-[85vh] max-w-[92vw] object-contain transition-transform duration-150 rounded-lg shadow-2xl"
            />
          </div>

          {/* Miniaturas no Lightbox */}
          {listaPreviews.length > 1 && (
            <div
              className="absolute bottom-4 flex items-center gap-2 bg-[#151516]/90 px-3 py-2 rounded-2xl border border-[#303034] overflow-x-auto max-w-[90vw] z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {listaPreviews.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActivePreviewIdx(idx)
                    setLightboxZoom(1)
                  }}
                  className={clsx(
                    'w-10 h-10 rounded-lg overflow-hidden border flex-shrink-0 transition-all',
                    activePreviewIdx === idx
                      ? 'border-[#E7B32C] ring-2 ring-[#E7B32C]/40 scale-105'
                      : 'border-zinc-800 opacity-60'
                  )}
                >
                  <img src={p.url} alt={p.nome} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

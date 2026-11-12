import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidoService, arteService } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Upload,
  Link2,
  FileText,
  CheckCircle2,
  Clock,
  CloudUpload,
  History,
  Paperclip,
  Image as ImageIcon,
  Package,
  X,
  Ban,
  AlertTriangle,
  Sparkles,
  Star,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  ExternalLink,
  Download,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Printer,
  Lock,
  ShieldCheck,
  ChevronRight,
  Copy,
  Calendar,
  Layers,
  Factory,
  Eye,
  Info,
  Smartphone,
  HardDrive,
  FileCode,
  FileArchive,
  Share2,
  Phone,
} from 'lucide-react'
import RevisaoArteModal from '@/components/RevisaoArteModal'
import { resolveMediaUrl } from '@/lib/url'
import { format, parseISO, isPast, differenceInDays } from 'date-fns'
import clsx from 'clsx'

// ── DESIGN SYSTEM TOKENS ──
// Background principal: #0B0B0C
// Cards: #151516
// Superfícies secundárias: #1D1D1F
// Bordas: #303034
// Dourado: #E7B32C
// Texto principal: #F5F5F6
// Texto secundário: #909098

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    sublabel: string
    textCls: string
    badgeCls: string
    dotCls: string
    icon: typeof Clock
  }
> = {
  aguardando_briefing: {
    label: 'Aguardando Briefing',
    sublabel: 'Aguardando detalhes e logotipos do cliente',
    textCls: 'text-indigo-400',
    badgeCls: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60 shadow-[0_0_12px_rgba(99,102,241,0.15)]',
    dotCls: 'bg-indigo-400',
    icon: Clock,
  },
  em_producao: {
    label: 'Em Produção',
    sublabel: 'Designer desenvolvendo estampa e mockups',
    textCls: 'text-blue-400',
    badgeCls: 'bg-blue-950/70 text-blue-300 border-blue-800/60 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
    dotCls: 'bg-blue-400',
    icon: Layers,
  },
  aguardando_aprovacao: {
    label: 'Aguardando Aprovação',
    sublabel: 'Link enviado, aguardando validação do cliente',
    textCls: 'text-amber-400',
    badgeCls: 'bg-amber-950/70 text-amber-300 border-amber-800/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    dotCls: 'bg-amber-400',
    icon: Eye,
  },
  aprovado: {
    label: 'Aprovado',
    sublabel: 'Arte aprovada para separação e estamparia',
    textCls: 'text-emerald-400',
    badgeCls: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    dotCls: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  finalizado: {
    label: 'Finalizado',
    sublabel: 'Produção concluída e pedido entregue',
    textCls: 'text-purple-400',
    badgeCls: 'bg-purple-950/70 text-purple-300 border-purple-800/60 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
    dotCls: 'bg-purple-400',
    icon: CheckCircle2,
  },
  cancelado: {
    label: 'Cancelado',
    sublabel: 'Operações e aprovações suspensas',
    textCls: 'text-red-400',
    badgeCls: 'bg-red-950/70 text-red-400 border-red-800/60 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
    dotCls: 'bg-red-400',
    icon: Ban,
  },
}

const TIPO_LABEL: Record<string, string> = {
  sublimacao: 'Sublimação Total',
  bordado: 'Bordado Computadorizado',
  serigrafia: 'Silk-Screen / Serigrafia',
}

interface TimelineItem {
  id: string
  tipo: 'criacao' | 'versao' | 'aprovacao' | 'revisao' | 'cancelamento' | 'finalizado'
  titulo: string
  subtitulo?: string
  data: string
  detalhe?: string
  badge?: string
}

interface ConfirmModalState {
  tipo: 'cancelar' | 'ativar' | 'marcarFinal' | 'desmarcarFinal' | 'excluir'
  titulo: string
  descricao: string
  arteId?: number
  actionText: string
  destructive?: boolean
}

function getFileExtensionColor(ext: string): { bg: string; text: string; border: string } {
  const e = ext.toUpperCase()
  switch (e) {
    case 'CDR':
      return { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/50' }
    case 'AI':
    case 'EPS':
      return { bg: 'bg-orange-950/60', text: 'text-orange-400', border: 'border-orange-800/50' }
    case 'PSD':
      return { bg: 'bg-sky-950/60', text: 'text-sky-400', border: 'border-sky-800/50' }
    case 'PDF':
      return { bg: 'bg-red-950/60', text: 'text-red-400', border: 'border-red-800/50' }
    case 'ZIP':
    case 'RAR':
    case '7Z':
      return { bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-800/50' }
    case 'PNG':
    case 'JPG':
    case 'JPEG':
    case 'WEBP':
      return { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/50' }
    default:
      return { bg: 'bg-zinc-800', text: 'text-zinc-300', border: 'border-zinc-700' }
  }
}

export default function PedidoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isAdmin } = useAuthStore()

  const previewRef = useRef<HTMLInputElement>(null)
  const fonteRef = useRef<HTMLInputElement>(null)

  // Upload state
  const [notas, setNotas] = useState('')
  const [isFinal, setIsFinal] = useState(false)
  const [previewFiles, setPreviewFiles] = useState<File[]>([])
  const [fonteFiles, setFonteFiles] = useState<File[]>([])
  const [activePreviewIdx, setActivePreviewIdx] = useState(0)
  const [draggingPreview, setDraggingPreview] = useState(false)
  const [draggingFonte, setDraggingFonte] = useState(false)

  // Visualização e histórico
  const [versaoSelecionadaId, setVersaoSelecionadaId] = useState<number | null>(null)
  const [showUploadSection, setShowUploadSection] = useState(false)
  const [showRevisaoIA, setShowRevisaoIA] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showResumoModal, setShowResumoModal] = useState(false)
  const [previewMatteDark, setPreviewMatteDark] = useState(true)

  // Modais de confirmação e Lightbox
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => pedidoService.buscar(Number(id)),
  })

  // Listener para colar imagens da área de transferência (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (pedido?.status === 'cancelado') return
      const items = e.clipboardData?.items
      if (!items) return
      let colou = false
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            const pastedFile = new File([blob], `preview_${Date.now()}.png`, { type: blob.type })
            setPreviewFiles((prev) => [...prev, pastedFile])
            colou = true
          }
        }
      }
      if (colou) {
        setShowUploadSection(true)
        toast.success('📸 Imagem colada na nova versão!')
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [pedido?.status])

  // Fecha modais com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false)
        setConfirmModal(null)
        setShowResumoModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Mutações ──
  const cancelarMutation = useMutation({
    mutationFn: () => pedidoService.cancelar(Number(id)),
    onSuccess: () => {
      toast.success('Pedido cancelado com sucesso.')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setConfirmModal(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao cancelar pedido.')
      setConfirmModal(null)
    },
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (previewFiles.length === 0 && fonteFiles.length === 0) {
        throw new Error('Selecione ao menos um arquivo de visualização ou produção.')
      }
      const fd = new FormData()
      previewFiles.forEach((file) => fd.append('previews[]', file))
      fonteFiles.forEach((file) => fd.append('arquivos[]', file))
      if (notas) fd.append('notas', notas)
      if (isFinal) fd.append('is_final', 'true')
      return arteService.enviar(Number(id), fd)
    },
    onSuccess: () => {
      toast.success(isFinal ? '⭐ Versão Final enviada com sucesso!' : 'Nova versão enviada com sucesso!')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setNotas('')
      setIsFinal(false)
      setPreviewFiles([])
      setFonteFiles([])
      setActivePreviewIdx(0)
      setShowUploadSection(false)
      setVersaoSelecionadaId(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao enviar arte.')
    },
  })

  const marcarFinalMutation = useMutation({
    mutationFn: (arteId: number) => arteService.marcarFinal(arteId),
    onSuccess: () => {
      toast.success('⭐ Versão definida como Versão Final para produção!')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setConfirmModal(null)
    },
    onError: () => {
      toast.error('Erro ao definir versão final.')
      setConfirmModal(null)
    },
  })

  const desmarcarFinalMutation = useMutation({
    mutationFn: (arteId: number) => arteService.desmarcarFinal(arteId),
    onSuccess: () => {
      toast.success('Marcação de versão final removida.')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setConfirmModal(null)
    },
    onError: () => {
      toast.error('Erro ao remover marcação.')
      setConfirmModal(null)
    },
  })

  const ativarVersaoMutation = useMutation({
    mutationFn: (arteId: number) => arteService.ativar(arteId),
    onSuccess: () => {
      toast.success('Versão ativada como a versão atual!')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setConfirmModal(null)
      setVersaoSelecionadaId(null)
    },
    onError: () => {
      toast.error('Erro ao ativar versão.')
      setConfirmModal(null)
    },
  })

  const excluirVersaoMutation = useMutation({
    mutationFn: (arteId: number) => arteService.excluir(arteId),
    onSuccess: () => {
      toast.success('Versão removida.')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setConfirmModal(null)
      setVersaoSelecionadaId(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao excluir versão.')
      setConfirmModal(null)
    },
  })

  const copiarLink = async () => {
    if (!pedido) return
    try {
      const { link } = await pedidoService.linkAprovacao(pedido.id)
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      toast.success('Link de aprovação copiado!')
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      // Fallback
      if (pedido.token_aprovacao) {
        const fallbackUrl = `${window.location.origin}/aprovar/${pedido.token_aprovacao}`
        await navigator.clipboard.writeText(fallbackUrl)
        setCopiedLink(true)
        toast.success('Link de aprovação copiado!')
        setTimeout(() => setCopiedLink(false), 2500)
      } else {
        toast.error('Erro ao copiar link de aprovação.')
      }
    }
  }

  function handleDropPreview(e: React.DragEvent) {
    e.preventDefault()
    setDraggingPreview(false)
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(f.name)
    )
    if (files.length > 0) {
      setPreviewFiles((prev) => [...prev, ...files])
      toast.success(`${files.length} imagem(ns) adicionada(s)!`)
    } else {
      toast.error('Selecione arquivos de imagem válidos (JPG, PNG ou WebP).')
    }
  }

  function handleDropFonte(e: React.DragEvent) {
    e.preventDefault()
    setDraggingFonte(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) {
      setFonteFiles((prev) => [...prev, ...files])
      toast.success(`${files.length} arquivo(s) de produção adicionado(s)!`)
    }
  }

  // ── Processamento dos Dados do Pedido ──
  const isCancelado = pedido?.status === 'cancelado'
  const isFinalizado = pedido?.status === 'finalizado'
  const statusCfg = pedido ? (STATUS_CONFIG[pedido.status] ?? STATUS_CONFIG['aguardando_briefing']) : STATUS_CONFIG['aguardando_briefing']

  const arteAtiva = pedido?.artes?.find((a: { ativa: boolean }) => a.ativa) || pedido?.artes?.[0]
  const arteFinal = pedido?.artes?.find((a: { is_final: boolean }) => a.is_final)

  const artesOrdenadas = useMemo(() => {
    if (!pedido?.artes) return []
    return [...pedido.artes].sort((a: any, b: any) => b.versao - a.versao)
  }, [pedido?.artes])

  // Versão exibida no painel central (selecionada ou ativa)
  const versaoExibida = useMemo(() => {
    if (!pedido?.artes?.length) return null
    if (versaoSelecionadaId) {
      const encontrada = pedido.artes.find((a: any) => a.id === versaoSelecionadaId)
      if (encontrada) return encontrada
    }
    return arteAtiva || pedido.artes[0]
  }, [pedido?.artes, versaoSelecionadaId, arteAtiva])

  // Arquivos da versão exibida
  const { listaPreviews, listaFontes, totalArquivosVersao } = useMemo(() => {
    if (!versaoExibida) {
      if (pedido?.capa_url) {
        return {
          listaPreviews: [{ id: 'capa', url: resolveMediaUrl(pedido.capa_url), nome: 'Imagem de Capa' }],
          listaFontes: [],
          totalArquivosVersao: 1,
        }
      }
      return { listaPreviews: [], listaFontes: [], totalArquivosVersao: 0 }
    }

    const arquivos = Array.isArray(versaoExibida.arquivos) ? versaoExibida.arquivos : []
    const previewsAtivos = arquivos.filter((a: any) => a.eh_preview)
    const fontesAtivos = arquivos.filter((a: any) => !a.eh_preview)

    // Fallbacks para campos legados
    const rawPreviewSrc =
      versaoExibida.preview_url ??
      (versaoExibida &&
      ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(versaoExibida.arquivo_tipo?.toLowerCase() ?? '')
        ? versaoExibida.arquivo_url
        : null)

    const previewsFinal = (
      previewsAtivos.length > 0
        ? previewsAtivos
        : rawPreviewSrc
        ? [{ url: rawPreviewSrc, nome: versaoExibida.preview_nome || `Visualização V${versaoExibida.versao}` }]
        : []
    ).map((p: any) => ({
      ...p,
      url: resolveMediaUrl(p.url),
      nome: p.nome || `Visualização V${versaoExibida.versao}`,
    }))

    const temFonteLegado = !!versaoExibida.arquivo_url && versaoExibida.arquivo_url !== rawPreviewSrc
    const fontesFinal = (
      fontesAtivos.length > 0
        ? fontesAtivos
        : temFonteLegado
        ? [
            {
              url: versaoExibida.arquivo_url,
              nome: versaoExibida.arquivo_nome || `Arquivo de Produção V${versaoExibida.versao}`,
              tipo: versaoExibida.arquivo_tipo,
              tamanho: versaoExibida.arquivo_tamanho,
              extensao: versaoExibida.arquivo_nome?.split('.').pop() || versaoExibida.arquivo_tipo || 'ARQ',
            },
          ]
        : fontesAtivos.length === 0 && previewsAtivos.length === 0 && versaoExibida.arquivo_url
        ? [
            {
              url: versaoExibida.arquivo_url,
              nome: versaoExibida.arquivo_nome || `Arquivo de Produção V${versaoExibida.versao}`,
              tipo: versaoExibida.arquivo_tipo,
              tamanho: versaoExibida.arquivo_tamanho,
              extensao: versaoExibida.arquivo_nome?.split('.').pop() || versaoExibida.arquivo_tipo || 'ARQ',
            },
          ]
        : []
    ).map((f: any) => ({
      ...f,
      url: resolveMediaUrl(f.url),
      nome: f.nome || `Arquivo de Produção V${versaoExibida.versao}`,
      extensao: f.extensao || f.nome?.split('.').pop() || 'ARQ',
    }))

    return {
      listaPreviews: previewsFinal,
      listaFontes: fontesFinal,
      totalArquivosVersao: previewsFinal.length + fontesFinal.length,
    }
  }, [versaoExibida])

  const currentPreview = listaPreviews[activePreviewIdx] ?? listaPreviews[0]

  // Linha do tempo construída com eventos estritamente reais
  const timelineEvents = useMemo<TimelineItem[]>(() => {
    if (!pedido) return []
    const events: TimelineItem[] = []

    // 1. Cancelamento ou finalização do pedido
    if (pedido.status === 'cancelado') {
      events.push({
        id: 'cancelado',
        tipo: 'cancelamento',
        titulo: 'Pedido cancelado',
        subtitulo: 'Ações operacionais e aprovações foram suspensas',
        badge: 'Cancelado',
        data: pedido.updated_at || pedido.created_at,
      })
    } else if (pedido.status === 'finalizado') {
      events.push({
        id: 'finalizado',
        tipo: 'finalizado',
        titulo: 'Pedido finalizado',
        subtitulo: 'Produção concluída e entregue',
        badge: 'Concluído',
        data: pedido.updated_at || pedido.created_at,
      })
    }

    // 2. Histórico de aprovações/revisões registradas no banco
    if (Array.isArray(pedido.aprovacoes)) {
      pedido.aprovacoes.forEach((ap: any) => {
        const dataAprov = ap.aprovado_em || ap.created_at
        if (dataAprov) {
          const isAprovado = ap.status === 'aprovado'
          const autor = ap.nome_aprovador || ap.aprovado_por_nome
          const ip = ap.aprovado_por_ip
          events.push({
            id: `aprov-${ap.id}`,
            tipo: isAprovado ? 'aprovacao' : 'revisao',
            titulo: isAprovado ? 'Arte aprovada pelo cliente' : 'Ajustes solicitados pelo cliente',
            subtitulo: autor ? `Por ${autor}${ip ? ` (${ip})` : ''}` : 'Pelo link público',
            detalhe: ap.comentario || undefined,
            badge: isAprovado ? 'Aprovado' : 'Ajuste solicitado',
            data: dataAprov,
          })
        }
      })
    }

    // 3. Envio de versões registradas
    if (Array.isArray(pedido.artes)) {
      pedido.artes.forEach((arte: any) => {
        const dataEnvio = arte.enviada_em || arte.created_at
        if (dataEnvio) {
          const badge = arte.is_final
            ? 'Versão Final'
            : arte.ativa
            ? 'Versão Ativa'
            : undefined

          events.push({
            id: `versao-${arte.id}`,
            tipo: 'versao',
            titulo: `Versão ${arte.versao} enviada`,
            subtitulo: arte.is_final
              ? 'Definida como versão final para produção'
              : arte.ativa
              ? 'Ativada como versão em andamento'
              : 'Versão do histórico de desenvolvimento',
            detalhe: arte.notas ? `"${arte.notas}"` : undefined,
            badge,
            data: dataEnvio,
          })
        }
      })
    }

    // 4. Criação do pedido
    if (pedido.created_at) {
      events.push({
        id: 'criacao',
        tipo: 'criacao',
        titulo: 'Pedido criado no sistema',
        subtitulo: `${pedido.confeccao?.nome || 'Confecção'} · ${TIPO_LABEL[pedido.tipo_impressao] || pedido.tipo_impressao}`,
        badge: 'Criação',
        data: pedido.created_at,
      })
    }

    // Ordenar de forma decrescente: o evento mais recente fica no topo
    return events.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [pedido])

  // Cálculo de SLA estritamente real para o card de prazo
  const slaStatus = useMemo(() => {
    if (!pedido?.prazo) return null
    if (isCancelado) return { texto: 'Pedido Cancelado', cls: 'text-zinc-500' }
    if (isFinalizado) return { texto: 'Concluído', cls: 'text-purple-400' }

    const prazoDate = parseISO(pedido.prazo)
    if (isPast(prazoDate)) {
      const dias = differenceInDays(new Date(), prazoDate)
      return {
        texto: dias === 0 ? 'Vence hoje' : `Atrasado há ${dias} dia${dias !== 1 ? 's' : ''}`,
        cls: 'text-red-400 font-semibold',
      }
    } else {
      const dias = differenceInDays(prazoDate, new Date())
      return {
        texto: dias === 0 ? 'Vence hoje' : `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`,
        cls: 'text-emerald-400',
      }
    }
  }, [pedido?.prazo, isCancelado, isFinalizado])

  // Carregamento
  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[600px] w-full"
        style={{ backgroundColor: '#0B0B0C' }}
      >
        <div className="flex flex-col items-center gap-3.5 p-8 rounded-2xl border border-[#303034] bg-[#151516] shadow-xl">
          <div className="w-10 h-10 rounded-full border-2 border-[#E7B32C] border-t-transparent animate-spin" />
          <p className="text-sm font-semibold text-[#F5F5F6]">Carregando detalhes do pedido...</p>
          <span className="text-xs text-[#909098]">Recuperando artes, matrizes e histórico</span>
        </div>
      </div>
    )
  }

  // Não encontrado
  if (!pedido) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[500px] w-full p-4"
        style={{ backgroundColor: '#0B0B0C' }}
      >
        <div className="max-w-md w-full p-8 rounded-2xl border border-[#303034] bg-[#151516] text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#1D1D1F] border border-[#303034] flex items-center justify-center mx-auto text-zinc-500">
            <Package className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#F5F5F6]">Pedido não encontrado</h2>
          <p className="text-xs text-[#909098] leading-relaxed">
            O pedido solicitado não existe ou você não tem permissão para acessá-lo.
          </p>
          <button
            onClick={() => navigate('/pedidos')}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#1D1D1F] border border-[#303034] text-[#F5F5F6] hover:bg-[#252528] transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a lista de pedidos
          </button>
        </div>
      </div>
    )
  }

  const proximaVersao =
    (pedido.artes?.reduce((max: number, a: { versao: number }) => Math.max(max, a.versao), 0) ?? 0) + 1
  const isVisualizandoHistorica = versaoExibida && arteAtiva && versaoExibida.id !== arteAtiva.id

  return (
    <div
      className="min-h-full pb-20 animate-[fadeIn_0.2s_ease-out] text-[#F5F5F6] selection:bg-[#E7B32C]/30"
      style={{ backgroundColor: '#0B0B0C' }}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── 1. CABEÇALHO DO PEDIDO ── */}
        <header className="space-y-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-[#909098] select-none">
            <Link to="/dashboard" className="hover:text-[#F5F5F6] transition-colors">
              Painel
            </Link>
            <span className="text-zinc-600">/</span>
            <Link to="/pedidos" className="hover:text-[#F5F5F6] transition-colors">
              Pedidos
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-[#F5F5F6] font-medium truncate max-w-xs sm:max-w-md">
              #{String(pedido.id).padStart(4, '0')} · {pedido.titulo}
            </span>
          </nav>

          {/* Linha Principal do Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#303034]/60">
            {/* Info Principal */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#1D1D1F] border border-[#303034] text-[#E7B32C]">
                  #{String(pedido.id).padStart(4, '0')}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F5F6] truncate">
                  {pedido.titulo}
                </h1>
                <div
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border',
                    statusCfg.badgeCls
                  )}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full', statusCfg.dotCls)} />
                  {statusCfg.label}
                </div>
              </div>

              {/* Subtítulo com Confecção, Tipo e Cliente */}
              <div className="flex items-center gap-2 text-xs text-[#909098] flex-wrap">
                <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <Factory className="w-3.5 h-3.5 text-[#E7B32C]" />
                  {pedido.confeccao?.nome || 'Confecção parceira'}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">
                  {TIPO_LABEL[pedido.tipo_impressao] || pedido.tipo_impressao}
                </span>

                {(() => {
                  const nome = pedido.cliente_nome || pedido.nome_cliente
                  const whats = pedido.cliente_whatsapp || pedido.whatsapp_cliente
                  const cleanWhats = whats ? whats.replace(/\D/g, '') : ''
                  if (!nome && !whats) return null
                  return (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 flex items-center gap-1.5 flex-wrap">
                        Cliente: <strong className="text-zinc-200 font-medium">{nome || 'Não informado'}</strong>
                        {cleanWhats && (
                          <a
                            href={`https://wa.me/55${cleanWhats}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/60 hover:text-emerald-300 transition-colors ml-1"
                            title="Conversar no WhatsApp"
                          >
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span>{whats}</span>
                          </a>
                        )}
                      </span>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Barra de Ações Rápidas */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Botão Copiar Link */}
              <button
                onClick={copiarLink}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 shadow-sm select-none',
                  copiedLink
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : 'bg-[#1D1D1F] border-[#303034] text-[#F5F5F6] hover:bg-[#252528] hover:border-zinc-500'
                )}
                title="Copiar link público de aprovação para enviar ao cliente"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5 text-[#E7B32C]" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>

              {/* Botão Abrir Link de Aprovação */}
              {pedido.token_aprovacao && (
                <a
                  href={`/aprovar/${pedido.token_aprovacao}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1D1D1F] border border-[#303034] text-zinc-300 hover:text-white hover:bg-[#252528] hover:border-zinc-500 transition-all select-none"
                  title="Abrir tela de aprovação pública do cliente"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Ver Aprovação</span>
                </a>
              )}

              {/* Botão Exportar / Resumo da OS */}
              <button
                onClick={() => setShowResumoModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1D1D1F] border border-[#303034] text-zinc-300 hover:text-white hover:bg-[#252528] hover:border-zinc-500 transition-all select-none"
                title="Visualizar e imprimir resumo técnico da Ordem de Serviço (OS)"
              >
                <Printer className="w-3.5 h-3.5 text-[#E7B32C]" />
                <span>Resumo OS</span>
              </button>

              {/* Botão Voltar */}
              <button
                onClick={() => navigate('/pedidos')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1D1D1F] border border-[#303034] text-zinc-300 hover:text-white hover:bg-[#252528] transition-all select-none group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Voltar</span>
              </button>

              {/* Botão Cancelar Pedido (Se ativo e não finalizado) */}
              {!isCancelado && !isFinalizado && isAdmin() && (
                <button
                  onClick={() =>
                    setConfirmModal({
                      tipo: 'cancelar',
                      titulo: 'Cancelar pedido?',
                      descricao: `O pedido "${pedido.titulo}" será cancelado imediatamente. Todas as operações de aprovação e envio de novas versões serão bloqueadas.`,
                      actionText: 'Sim, cancelar pedido',
                      destructive: true,
                    })
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-950/30 border border-red-900/60 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-all select-none ml-1"
                  title="Cancelar pedido e bloquear edições"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Cancelar Pedido</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── ALERTA DE PEDIDO CANCELADO (REGRA RIGOROSA) ── */}
        {isCancelado && (
          <div className="rounded-2xl p-4 sm:p-5 border border-red-900/60 bg-red-950/25 flex items-start sm:items-center gap-4 shadow-lg animate-[fadeIn_0.2s_ease-out]">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-900/40 border border-red-700/60 text-red-400 flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-red-300">
                  Pedido Cancelado — Modo Somente Leitura
                </h4>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-700/50">
                  Bloqueado
                </span>
              </div>
              <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
                Este pedido foi cancelado e está protegido contra alterações. O envio de novas versões, ativações,
                aprovações e modificações operacionais estão desativados. Os arquivos e o histórico permanecem disponíveis para consulta e auditoria.
              </p>
            </div>
          </div>
        )}

        {/* ── 2. INDICADORES (4 Cards em Grid) ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Status do Pedido */}
          <div className="rounded-2xl p-5 border border-[#303034] bg-[#151516] flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-colors shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#909098] uppercase">
                STATUS OPERACIONAL
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#1D1D1F] border border-[#303034] flex items-center justify-center text-zinc-400 group-hover:text-[#E7B32C] transition-colors">
                <statusCfg.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className={clsx('text-xl sm:text-2xl font-black tracking-tight', statusCfg.textCls)}>
                {statusCfg.label}
              </p>
              <p className="text-[11px] text-[#909098] mt-1 truncate" title={statusCfg.sublabel}>
                {statusCfg.sublabel}
              </p>
            </div>
          </div>

          {/* Card 2: Prazo de Entrega */}
          <div className="rounded-2xl p-5 border border-[#303034] bg-[#151516] flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-colors shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#909098] uppercase">
                PRAZO DE PRODUÇÃO
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#1D1D1F] border border-[#303034] flex items-center justify-center text-zinc-400 group-hover:text-[#E7B32C] transition-colors">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xl sm:text-2xl font-black tracking-tight text-[#F5F5F6]">
                {pedido.prazo ? format(parseISO(pedido.prazo), 'dd/MM/yyyy') : 'Sem prazo definido'}
              </p>
              <p className={clsx('text-[11px] mt-1 font-medium', slaStatus ? slaStatus.cls : 'text-[#909098]')}>
                {slaStatus ? slaStatus.texto : 'Data combinada com o cliente'}
              </p>
            </div>
          </div>

          {/* Card 3: Versão Atual / Final */}
          <div className="rounded-2xl p-5 border border-[#303034] bg-[#151516] flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-colors shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#909098] uppercase">
                VERSÃO DO PROJETO
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#1D1D1F] border border-[#303034] flex items-center justify-center text-zinc-400 group-hover:text-[#E7B32C] transition-colors">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xl sm:text-2xl font-black tracking-tight text-[#F5F5F6]">
                  {arteAtiva ? `Versão ${arteAtiva.versao}` : 'Nenhuma arte'}
                </p>
                {arteAtiva?.is_final && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E7B32C] text-black flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 fill-black" /> Final
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#909098] mt-1">
                {arteFinal
                  ? `Versão ${arteFinal.versao} consolidada para estamparia`
                  : arteAtiva
                  ? `${artesOrdenadas.length} iteração${artesOrdenadas.length !== 1 ? 'ões' : ''} no histórico`
                  : 'Aguardando primeiro envio'}
              </p>
            </div>
          </div>

          {/* Card 4: Quantidade de Arquivos */}
          <div className="rounded-2xl p-5 border border-[#303034] bg-[#151516] flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-colors shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#909098] uppercase">
                ARQUIVOS ANEXADOS
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#1D1D1F] border border-[#303034] flex items-center justify-center text-zinc-400 group-hover:text-[#E7B32C] transition-colors">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xl sm:text-2xl font-black tracking-tight text-[#F5F5F6]">
                {totalArquivosVersao === 1 ? '1 arquivo' : `${totalArquivosVersao} arquivos`}
              </p>
              <p className="text-[11px] text-[#909098] mt-1">
                {listaPreviews.length} visualizaç{listaPreviews.length === 1 ? 'ão' : 'ões'} · {listaFontes.length} matriz{listaFontes.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
        </section>

        {/* ── 3. ARTE ATUAL E ARQUIVOS DE PRODUÇÃO (Seção Principal em 2 Colunas) ── */}
        {versaoExibida ? (
          <section
            className={clsx(
              'rounded-2xl border p-5 sm:p-6 transition-all duration-200 relative shadow-xl',
              versaoExibida.is_final
                ? 'border-[#E7B32C]/70 shadow-[0_0_35px_rgba(231,179,44,0.08)] bg-[#151516]'
                : 'border-[#303034] bg-[#151516]'
            )}
          >
            {/* Aviso quando o usuário estiver inspecionando uma versão antiga */}
            {isVisualizandoHistorica && (
              <div className="mb-5 p-3.5 rounded-xl border border-blue-900/60 bg-blue-950/40 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-blue-300">
                  <Info className="w-4 h-4 flex-shrink-0 text-blue-400" />
                  <span>
                    Você está consultando a <strong>Versão {versaoExibida.versao}</strong> do histórico. A versão ativa no momento é a <strong>Versão {arteAtiva?.versao}</strong>.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setVersaoSelecionadaId(null)
                    setActivePreviewIdx(0)
                  }}
                  className="px-3 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 font-semibold transition-colors flex-shrink-0"
                >
                  Voltar para Versão Ativa
                </button>
              </div>
            )}

            {/* Header da Seção */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-[#303034]">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold text-[#F5F5F6] flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-[#E7B32C]" />
                    Arte atual e arquivos de produção
                  </h2>
                  <div
                    className={clsx(
                      'px-3 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 border',
                      versaoExibida.is_final
                        ? 'bg-[#E7B32C]/20 text-[#E7B32C] border-[#E7B32C]/60 shadow-[0_0_12px_rgba(231,179,44,0.2)]'
                        : versaoExibida.ativa
                        ? 'bg-[#E7B32C]/10 text-[#E7B32C] border-[#E7B32C]/30'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    )}
                  >
                    {versaoExibida.is_final && <Star className="w-3.5 h-3.5 fill-[#E7B32C]" />}
                    Versão {versaoExibida.versao} · {versaoExibida.is_final ? 'Final' : versaoExibida.ativa ? 'Atual' : 'Histórico'}
                  </div>
                </div>
                <p className="text-xs text-[#909098] mt-1">
                  {versaoExibida.enviada_em
                    ? `Enviada em ${format(parseISO(versaoExibida.enviada_em), "dd/MM/yyyy 'às' HH:mm")}`
                    : 'Arte registrada'}
                  {versaoExibida.notas ? ` — "${versaoExibida.notas}"` : ''}
                </p>
              </div>

              {/* Botões de Ação da Versão */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Se não for ativa e pedido não cancelado, permitir reativar */}
                {!isCancelado && !versaoExibida.ativa && isAdmin() && (
                  <button
                    onClick={() =>
                      setConfirmModal({
                        tipo: 'ativar',
                        titulo: `Ativar Versão ${versaoExibida.versao}?`,
                        descricao: `A Versão ${versaoExibida.versao} passará a ser a versão ativa exibida no link de aprovação e no Kanban.`,
                        arteId: versaoExibida.id,
                        actionText: 'Confirmar Ativação',
                      })
                    }
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-700 bg-[#1D1D1F] hover:bg-zinc-800 text-zinc-200 transition-all select-none"
                  >
                    Tornar Versão Ativa
                  </button>
                )}

                {/* Marcar / Desmarcar Final */}
                {!isCancelado && isAdmin() && (
                  versaoExibida.is_final ? (
                    <button
                      onClick={() =>
                        setConfirmModal({
                          tipo: 'desmarcarFinal',
                          titulo: 'Remover marcação de Versão Final?',
                          descricao: `A Versão ${versaoExibida.versao} deixará de ser a versão consolidada definitiva para produção.`,
                          arteId: versaoExibida.id,
                          actionText: 'Remover Marcação',
                        })
                      }
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-700 bg-[#1D1D1F] hover:bg-zinc-800 text-zinc-300 transition-all select-none"
                    >
                      Remover Marcação Final
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setConfirmModal({
                          tipo: 'marcarFinal',
                          titulo: `Definir Versão ${versaoExibida.versao} como Versão Final?`,
                          descricao: `Esta versão será consolidada como a matriz oficial de corte e gravação. O status do pedido será automaticamente atualizado para "Aprovado" no Kanban.`,
                          arteId: versaoExibida.id,
                          actionText: 'Confirmar Versão Final',
                        })
                      }
                      className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl border border-[#E7B32C]/50 text-[#E7B32C] bg-[#E7B32C]/10 hover:bg-[#E7B32C]/20 transition-all shadow-sm select-none"
                    >
                      <Star className="w-3.5 h-3.5 fill-[#E7B32C]" />
                      Definir como Versão Final
                    </button>
                  )
                )}

                {/* Revisar com IA (Apenas se não cancelado, admin e preview existir) */}
                {!isCancelado && isAdmin() && currentPreview?.url && (
                  <button
                    onClick={() => setShowRevisaoIA(true)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl border border-[#E7B32C] bg-[#E7B32C] text-black hover:bg-[#f3c13e] transition-all shadow-md select-none"
                    title="Análise ortográfica, visual e comparativa de versões com Inteligência Artificial"
                  >
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                    Revisar com IA
                  </button>
                )}
              </div>
            </div>

            {/* Grid 2 Colunas no Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── COLUNA ESQUERDA: VISUALIZAÇÃO DA ARTE ── */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-[#909098] uppercase">
                      VISUALIZAÇÃO DA ARTE
                    </span>
                    {listaPreviews.length > 1 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1D1D1F] border border-[#303034] text-[#E7B32C]">
                        {activePreviewIdx + 1} de {listaPreviews.length}
                      </span>
                    )}
                  </div>

                  {currentPreview?.url && (
                    <div className="flex items-center gap-2.5">
                      {/* Alternador de contraste do fundo */}
                      <button
                        onClick={() => setPreviewMatteDark(!previewMatteDark)}
                        className="text-[11px] text-zinc-400 hover:text-[#F5F5F6] transition-colors"
                        title={previewMatteDark ? 'Mudar para fundo claro' : 'Mudar para fundo escuro'}
                      >
                        {previewMatteDark ? 'Fundo claro' : 'Fundo escuro'}
                      </button>

                      <button
                        onClick={() => {
                          setZoomScale(1)
                          setLightboxOpen(true)
                        }}
                        className="text-[11px] text-[#E7B32C] hover:underline flex items-center gap-1 font-semibold transition-colors"
                        title="Ampliar em tela cheia com zoom"
                      >
                        <Maximize2 className="w-3 h-3" /> Ampliar
                      </button>

                      <a
                        href={currentPreview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
                        title="Abrir imagem original em nova aba"
                      >
                        <ExternalLink className="w-3 h-3" /> Original
                      </a>
                    </div>
                  )}
                </div>

                {/* Box de Prévia — Preserva 100% a proporção original da arte */}
                <div
                  onClick={() => currentPreview?.url && setLightboxOpen(true)}
                  className={clsx(
                    'rounded-2xl border border-[#303034] flex flex-col items-center justify-center min-h-[320px] sm:min-h-[380px] p-4 relative group overflow-hidden transition-all duration-200 select-none',
                    previewMatteDark ? 'bg-[#0E0E0F]' : 'bg-[#F2F2F4]',
                    currentPreview?.url ? 'cursor-zoom-in hover:border-[#E7B32C]/60 hover:shadow-lg' : 'cursor-default'
                  )}
                >
                  {currentPreview?.url ? (
                    <img
                      src={currentPreview.url}
                      alt={currentPreview.nome || 'Visualização da arte'}
                      className="max-h-80 sm:max-h-96 max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-zinc-600 py-16">
                      <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] border border-[#303034] flex items-center justify-center text-zinc-500">
                        <ImageIcon className="w-6 h-6 opacity-40" />
                      </div>
                      <span className="text-xs font-semibold text-zinc-400">
                        Nenhuma imagem de prévia cadastrada nesta versão
                      </span>
                      <span className="text-[11px] text-zinc-600">
                        Consulte os arquivos de produção na coluna ao lado
                      </span>
                    </div>
                  )}

                  {/* Overlay ao passar o mouse */}
                  {currentPreview?.url && (
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="px-3.5 py-1.5 rounded-xl bg-black/85 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xl border border-zinc-700">
                        <ZoomIn className="w-3.5 h-3.5 text-[#E7B32C]" /> Clique para ampliar
                      </span>
                    </div>
                  )}
                </div>

                {/* Seletor de Múltiplas Imagens (Mockups: Frente, Costas, Detalhes) */}
                {listaPreviews.length > 1 && (
                  <div className="flex items-center gap-2.5 mt-3 overflow-x-auto pb-1 scrollbar-thin">
                    {listaPreviews.map((p: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActivePreviewIdx(idx)}
                        className={clsx(
                          'relative rounded-xl overflow-hidden border flex-shrink-0 transition-all duration-150',
                          activePreviewIdx === idx
                            ? 'border-[#E7B32C] ring-2 ring-[#E7B32C]/40 scale-105 shadow-md'
                            : 'border-[#303034] opacity-50 hover:opacity-100'
                        )}
                        style={{ width: '60px', height: '60px', backgroundColor: '#0E0E0F' }}
                        title={p.nome}
                      >
                        <img src={p.url} alt={p.nome} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 px-1 py-0.2 bg-black/70 text-[9px] font-bold text-white rounded-tl">
                          #{idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Legenda inferior */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#909098]">
                  <span className="truncate max-w-[280px]" title={currentPreview?.nome}>
                    {currentPreview?.nome || 'Prévia oficial do projeto'}
                  </span>
                  <span className="flex items-center gap-1 text-zinc-500">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Proporção preservada
                  </span>
                </div>
              </div>

              {/* ── COLUNA DIREITA: ARQUIVOS DE PRODUÇÃO / FONTE ── */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-wider text-[#909098] uppercase">
                    ARQUIVOS DE PRODUÇÃO / MATRIZES
                  </span>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {listaFontes.length} {listaFontes.length === 1 ? 'matriz' : 'matrizes'}
                  </span>
                </div>

                {/* Container de Arquivos */}
                <div className="rounded-2xl border border-[#303034] bg-[#0E0E0F] p-4 flex-1 flex flex-col justify-between min-h-[320px]">
                  <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
                    {listaFontes.length > 0 ? (
                      listaFontes.map((fonte: any, idx: number) => {
                        const ext = (fonte.extensao || 'ARQ').toUpperCase()
                        const colors = getFileExtensionColor(ext)

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-[#303034] bg-[#151516] hover:border-[#E7B32C]/40 hover:bg-[#18181A] transition-all duration-150 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={clsx(
                                  'w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs border flex-shrink-0',
                                  colors.bg,
                                  colors.text,
                                  colors.border
                                )}
                              >
                                {ext}
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="text-xs font-semibold text-[#F5F5F6] truncate max-w-[170px] sm:max-w-xs group-hover:text-[#E7B32C] transition-colors"
                                  title={fonte.nome}
                                >
                                  {fonte.nome}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-[#909098] mt-0.5">
                                  <span>
                                    {fonte.tamanho
                                      ? `${(fonte.tamanho / 1024 / 1024).toFixed(2)} MB`
                                      : 'Pronto para download'}
                                  </span>
                                  <span className="text-zinc-600">•</span>
                                  <span className="text-zinc-400 font-medium">V{versaoExibida.versao}</span>
                                </div>
                              </div>
                            </div>

                            <a
                              href={fonte.url}
                              download={fonte.nome}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1D1D1F] hover:bg-[#252528] text-[#F5F5F6] border border-[#303034] hover:border-[#E7B32C]/40 transition-all ml-2 flex-shrink-0 shadow-sm"
                              title={`Baixar ${fonte.nome}`}
                            >
                              <Download className="w-3.5 h-3.5 text-[#E7B32C]" />
                              <span>Baixar</span>
                            </a>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#151516] border border-[#303034] flex items-center justify-center text-zinc-500">
                          <Package className="w-6 h-6 opacity-40" />
                        </div>
                        <p className="text-xs font-semibold text-zinc-400">
                          Nenhum arquivo de produção anexado nesta versão.
                        </p>
                        <p className="text-[11px] text-zinc-600 max-w-xs text-center">
                          Faça upload dos arquivos editáveis (CorelDRAW, Illustrator, Photoshop ou PDF) no formulário de versão.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Rodapé da Coluna de Arquivos */}
                  <div className="pt-3.5 mt-3 border-t border-[#303034]/70">
                    {isCancelado ? (
                      <p className="text-xs text-red-400/90 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Arquivos disponíveis para consulta. Edições bloqueadas pelo status de cancelamento.</span>
                      </p>
                    ) : (
                      <p className="text-xs text-[#909098] flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>Matrizes oficiais protegidas para corte, separação de cores e sublimação.</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-[#303034] bg-[#151516] p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#1D1D1F] border border-[#303034] flex items-center justify-center mx-auto text-zinc-500">
              <Package className="w-7 h-7 text-[#E7B32C]" />
            </div>
            <h3 className="text-base font-bold text-[#F5F5F6]">Nenhuma arte cadastrada ainda</h3>
            <p className="text-xs text-[#909098] max-w-md mx-auto">
              Este pedido ainda não possui artes ou matrizes anexadas. Envie a primeira versão usando a área de upload abaixo.
            </p>
          </section>
        )}

        {/* ── 4. ÁREA DE ENVIO DE NOVA VERSÃO (Bloqueada se cancelado) ── */}
        {!isCancelado && (
          <section className="rounded-2xl border border-[#303034] bg-[#151516] p-5 sm:p-6 transition-all duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#F5F5F6] flex items-center gap-2">
                  <CloudUpload className="w-5 h-5 text-[#E7B32C]" />
                  Enviar Versão {proximaVersao} {arteAtiva ? '(Nova Revisão)' : '(Versão Inicial)'}
                </h3>
                <p className="text-xs text-[#909098] mt-0.5">
                  Arraste imagens ou arquivos, ou cole mockups diretamente com{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-[#1D1D1F] text-[#E7B32C] border border-[#303034] font-mono text-[10px]">
                    Ctrl + V
                  </kbd>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUploadSection(!showUploadSection)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#303034] bg-[#1D1D1F] hover:bg-[#252528] text-zinc-300 self-start sm:self-center transition-colors"
              >
                {showUploadSection ? 'Ocultar formulário' : 'Expandir área de envio'}
              </button>
            </div>

            {/* Formulário Expansível */}
            {(showUploadSection || previewFiles.length > 0 || fonteFiles.length > 0) && (
              <div className="space-y-4 pt-2 animate-[fadeIn_0.15s_ease-out]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Zona de Mockups / Previews */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#F5F5F6] flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#E7B32C]" />
                        Imagens de Visualização (Mockups)
                      </span>
                      <span className="text-[11px] text-[#909098]">
                        {previewFiles.length} selecionada{previewFiles.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <input
                      ref={previewRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.gif,.bmp"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        if (files.length > 0) setPreviewFiles((prev) => [...prev, ...files])
                        e.target.value = ''
                      }}
                    />

                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDraggingPreview(true)
                      }}
                      onDragLeave={() => setDraggingPreview(false)}
                      onDrop={handleDropPreview}
                      onClick={() => previewRef.current?.click()}
                      className={clsx(
                        'rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all select-none',
                        draggingPreview
                          ? 'border-[#E7B32C] bg-[#E7B32C]/10'
                          : 'border-[#303034] bg-[#0E0E0F] hover:border-[#E7B32C]/50'
                      )}
                    >
                      <ImageIcon className="w-6 h-6 mx-auto mb-1.5 text-zinc-500" />
                      <p className="text-xs text-zinc-300 font-medium">Clique ou arraste imagens de mockups</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">JPG, PNG, WebP · Frente, costas e detalhes</p>
                    </div>

                    {/* Previews selecionados */}
                    {previewFiles.length > 0 && (
                      <div className="space-y-1.5 mt-2.5 max-h-40 overflow-y-auto pr-1">
                        {previewFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg border border-[#303034] bg-[#1D1D1F]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-8 h-8 rounded object-cover flex-shrink-0 border border-zinc-800"
                              />
                              <div className="min-w-0">
                                <p className="text-xs text-zinc-300 truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-zinc-500">{(file.size / 1024).toFixed(0)} KB</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Zona de Matrizes de Produção */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#F5F5F6] flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#E7B32C]" />
                        Arquivos de Produção / Matrizes
                      </span>
                      <span className="text-[11px] text-[#909098]">
                        {fonteFiles.length} selecionado{fonteFiles.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <input
                      ref={fonteRef}
                      type="file"
                      multiple
                      accept=".pdf,.cdr,.ai,.psd,.eps,.svg,.tiff,.tif,.bmp,.afdesign,.indd,.zip,.rar,.7z"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        if (files.length > 0) setFonteFiles((prev) => [...prev, ...files])
                        e.target.value = ''
                      }}
                    />

                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDraggingFonte(true)
                      }}
                      onDragLeave={() => setDraggingFonte(false)}
                      onDrop={handleDropFonte}
                      onClick={() => fonteRef.current?.click()}
                      className={clsx(
                        'rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all select-none',
                        draggingFonte
                          ? 'border-[#E7B32C] bg-[#E7B32C]/10'
                          : 'border-[#303034] bg-[#0E0E0F] hover:border-[#E7B32C]/50'
                      )}
                    >
                      <Package className="w-6 h-6 mx-auto mb-1.5 text-zinc-500" />
                      <p className="text-xs text-zinc-300 font-medium">Clique ou arraste matrizes editáveis</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">CDR, AI, PSD, PDF, ZIP até 50MB</p>
                    </div>

                    {/* Fontes selecionados */}
                    {fonteFiles.length > 0 && (
                      <div className="space-y-1.5 mt-2.5 max-h-40 overflow-y-auto pr-1">
                        {fonteFiles.map((file, idx) => {
                          const ext = file.name.split('.').pop()?.toUpperCase() || 'ARQ'
                          const colors = getFileExtensionColor(ext)
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-lg border border-[#303034] bg-[#1D1D1F]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={clsx(
                                    'w-8 h-8 rounded flex items-center justify-center flex-shrink-0 font-bold text-[10px] border',
                                    colors.bg,
                                    colors.text,
                                    colors.border
                                  )}
                                >
                                  {ext}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-zinc-300 truncate" title={file.name}>
                                    {file.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-500">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setFonteFiles((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Checkbox Versão Final Direta */}
                <div>
                  <label
                    className={clsx(
                      'flex items-center gap-3 cursor-pointer p-3.5 rounded-xl border transition-all select-none',
                      isFinal
                        ? 'border-[#E7B32C] bg-[#E7B32C]/10 shadow-[0_0_15px_rgba(231,179,44,0.1)]'
                        : 'border-[#303034] bg-[#1D1D1F] hover:border-zinc-600'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isFinal}
                      onChange={(e) => setIsFinal(e.target.checked)}
                      className="rounded accent-[#E7B32C] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#F5F5F6] flex items-center gap-1.5">
                        <Star className={clsx('w-3.5 h-3.5', isFinal ? 'fill-[#E7B32C] text-[#E7B32C]' : 'text-zinc-500')} />
                        Marcar diretamente como Versão Final (Consolidar e aprovar para produção)
                      </span>
                      <p className="text-[11px] text-[#909098] mt-0.5">
                        {isFinal
                          ? 'O pedido será movido para "Aprovado" no Kanban sem passar por aprovação externa.'
                          : 'Deixe desmarcado para enviar em "Aguardando Aprovação" para o cliente validar.'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Campo de Notas */}
                <input
                  className="w-full rounded-xl px-4 py-2.5 text-xs outline-none transition-colors border border-[#303034] bg-[#1D1D1F] text-[#F5F5F6] placeholder-zinc-500 focus:border-[#E7B32C]"
                  placeholder="Notas sobre esta versão (ex: Logotipos dos patrocinadores atualizados e numeração corrigida)"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />

                {/* Botão de Envio */}
                <button
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending || (previewFiles.length === 0 && fonteFiles.length === 0)}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-[#E7B32C] hover:bg-[#d4a020] text-black transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 select-none"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      Enviando arquivos da Versão {proximaVersao}...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      Enviar Versão {proximaVersao} ({previewFiles.length + fonteFiles.length} arquivos)
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── 5. DUAS COLUNAS: HISTÓRICO DE VERSÕES & LINHA DO TEMPO ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── COLUNA 1: HISTÓRICO DE VERSÕES ── */}
          <section className="rounded-2xl border border-[#303034] bg-[#151516] p-5 sm:p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303034]">
                <h3 className="text-base font-bold text-[#F5F5F6] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#E7B32C]" />
                  Histórico de versões
                </h3>
                <span className="text-xs font-semibold text-[#909098]">
                  {artesOrdenadas.length} {artesOrdenadas.length === 1 ? 'versão' : 'versões'}
                </span>
              </div>

              {artesOrdenadas.length > 0 ? (
                <div className="space-y-3">
                  {artesOrdenadas.map((arte: any) => {
                    const isExibindoEsta = versaoExibida?.id === arte.id
                    return (
                      <div
                        key={arte.id}
                        className={clsx(
                          'rounded-xl border p-4 transition-all bg-[#1D1D1F]',
                          isExibindoEsta
                            ? 'border-[#E7B32C]/70 ring-1 ring-[#E7B32C]/30 shadow-[0_0_15px_rgba(231,179,44,0.06)]'
                            : 'border-[#303034] hover:border-zinc-600'
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[#F5F5F6]">
                                Versão {arte.versao}
                              </span>
                              {arte.ativa && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E7B32C]/15 text-[#E7B32C] border border-[#E7B32C]/30">
                                  Atual
                                </span>
                              )}
                              {arte.is_final && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E7B32C] text-black flex items-center gap-1 shadow-sm">
                                  <Star className="w-3 h-3 fill-black" /> Final
                                </span>
                              )}
                              {isExibindoEsta && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-950/70 text-blue-300 border border-blue-800/60">
                                  Exibindo na tela
                                </span>
                              )}
                            </div>

                            {arte.enviada_em && (
                              <p className="text-[11px] text-[#909098] mt-1">
                                {format(parseISO(arte.enviada_em), "dd/MM/yyyy 'às' HH:mm")}
                              </p>
                            )}

                            {arte.notas && (
                              <p className="text-xs text-zinc-300 italic mt-1.5 line-clamp-2">
                                "{arte.notas}"
                              </p>
                            )}
                          </div>

                          {/* Ações da Versão */}
                          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                            <button
                              onClick={() => {
                                setVersaoSelecionadaId(arte.id)
                                setActivePreviewIdx(0)
                                window.scrollTo({ top: 120, behavior: 'smooth' })
                              }}
                              className={clsx(
                                'text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 select-none',
                                isExibindoEsta
                                  ? 'border-[#E7B32C]/50 bg-[#E7B32C]/10 text-[#E7B32C]'
                                  : 'border-[#303034] bg-[#151516] hover:bg-[#252528] text-zinc-300 hover:text-white'
                              )}
                            >
                              Ver arquivos <ExternalLink className="w-3 h-3" />
                            </button>

                            {!isCancelado && isAdmin() && (
                              <>
                                {!arte.ativa && (
                                  <button
                                    onClick={() =>
                                      setConfirmModal({
                                        tipo: 'ativar',
                                        titulo: `Ativar Versão ${arte.versao}?`,
                                        descricao: `Esta versão passará a ser a versão ativa exibida por padrão aos clientes.`,
                                        arteId: arte.id,
                                        actionText: 'Ativar',
                                      })
                                    }
                                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#303034] bg-[#151516] hover:bg-[#252528] text-zinc-300 transition-colors select-none"
                                  >
                                    Ativar
                                  </button>
                                )}

                                {artesOrdenadas.length > 1 && (
                                  <button
                                    onClick={() =>
                                      setConfirmModal({
                                        tipo: 'excluir',
                                        titulo: `Excluir Versão ${arte.versao}?`,
                                        descricao: `Esta ação não pode ser desfeita. Todos os arquivos e registros desta versão serão removidos permanentemente.`,
                                        arteId: arte.id,
                                        actionText: 'Excluir versão',
                                        destructive: true,
                                      })
                                    }
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-900/40 hover:bg-red-950/20 transition-all"
                                    title="Excluir versão"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 py-8 text-center">Nenhuma versão anterior registrada.</p>
              )}
            </div>
          </section>

          {/* ── COLUNA 2: LINHA DO TEMPO ── */}
          <section className="rounded-2xl border border-[#303034] bg-[#151516] p-5 sm:p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303034]">
                <h3 className="text-base font-bold text-[#F5F5F6] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E7B32C]" />
                  Linha do tempo
                </h3>
                <span className="text-xs text-[#909098]">Histórico de eventos reais</span>
              </div>

              {timelineEvents.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#303034]">
                  {timelineEvents.map((evt) => {
                    const dotColor =
                      evt.tipo === 'cancelamento'
                        ? 'bg-red-500 ring-4 ring-red-950'
                        : evt.tipo === 'aprovacao'
                        ? 'bg-emerald-500 ring-4 ring-emerald-950'
                        : evt.tipo === 'revisao'
                        ? 'bg-amber-500 ring-4 ring-amber-950'
                        : evt.tipo === 'versao'
                        ? 'bg-[#E7B32C] ring-4 ring-amber-950/60'
                        : 'bg-zinc-500 ring-4 ring-zinc-900'

                    return (
                      <div key={evt.id} className="relative group">
                        {/* Dot indicador */}
                        <div
                          className={clsx(
                            'absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125',
                            dotColor
                          )}
                        />

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-[#F5F5F6]">{evt.titulo}</p>
                            {evt.badge && (
                              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-[#1D1D1F] border border-[#303034] text-zinc-400">
                                {evt.badge}
                              </span>
                            )}
                          </div>

                          {evt.subtitulo && (
                            <p className="text-[11px] text-[#909098]">{evt.subtitulo}</p>
                          )}

                          {evt.detalhe && (
                            <p className="text-xs text-zinc-300 italic bg-[#1D1D1F] p-2.5 rounded-lg border border-[#303034]/70 leading-relaxed">
                              {evt.detalhe}
                            </p>
                          )}

                          <p className="text-[10px] text-zinc-500 pt-0.5">
                            {format(parseISO(evt.data), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 py-8 text-center">Nenhum evento registrado.</p>
              )}
            </div>
          </section>
        </div>

        {/* ── 6. OBSERVAÇÕES E REFERÊNCIAS DO PEDIDO ── */}
        {(pedido.observacoes || (pedido.referencias && pedido.referencias.length > 0)) && (
          <section className="rounded-2xl border border-[#303034] bg-[#151516] p-5 sm:p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-[#F5F5F6] flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-[#E7B32C]" />
              Briefing e Referências do Pedido
            </h3>

            {pedido.observacoes && (
              <div className="rounded-xl p-4 border border-[#303034] bg-[#1D1D1F] text-xs text-zinc-300 leading-relaxed">
                <span className="font-semibold text-zinc-400 block mb-1">Instruções fornecidas:</span>
                {pedido.observacoes}
              </div>
            )}

            {pedido.referencias && pedido.referencias.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {pedido.referencias.map(
                  (ref: { url: string; nome: string; tipo: string; tamanho: number }, idx: number) => {
                    const finalUrl = resolveMediaUrl(ref.url)
                    const ehImagem =
                      ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ref.tipo?.toLowerCase() ?? '') ||
                      /\.(png|jpe?g|gif|webp)($|\?)/i.test(ref.nome || ref.url || '')

                    return (
                      <a
                        key={idx}
                        href={finalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl border border-[#303034] bg-[#1D1D1F] hover:border-[#E7B32C]/60 overflow-hidden transition-all flex flex-col justify-between"
                      >
                        {ehImagem ? (
                          <div className="aspect-square bg-black/40 overflow-hidden flex items-center justify-center">
                            <img
                              src={finalUrl}
                              alt={ref.nome}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-[#E7B32C]/5 flex flex-col items-center justify-center gap-1.5">
                            <FileText className="w-8 h-8 text-zinc-500" />
                            <span className="text-[10px] font-bold text-[#E7B32C] uppercase">
                              {ref.tipo || 'DOC'}
                            </span>
                          </div>
                        )}
                        <div className="p-2 border-t border-[#303034]">
                          <p className="text-[11px] font-medium text-zinc-300 truncate" title={ref.nome}>
                            {ref.nome || `Ref ${idx + 1}`}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {ref.tamanho ? `${(ref.tamanho / 1024).toFixed(0)} KB` : 'Abrir ↗'}
                          </p>
                        </div>
                      </a>
                    )
                  }
                )}
              </div>
            )}
          </section>
        )}

      </div>

      {/* ── MODAL DE REVISÃO COM IA ── */}
      {showRevisaoIA && arteAtiva && (
        <RevisaoArteModal
          pedidoId={Number(id)}
          arteAtiva={arteAtiva}
          todasArtes={pedido.artes ?? []}
          onClose={() => setShowRevisaoIA(false)}
        />
      )}

      {/* ── MODAL DE CONFIRMAÇÃO DE AÇÕES ── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="rounded-2xl border border-[#303034] bg-[#151516] p-6 w-full max-w-md shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border',
                  confirmModal.destructive
                    ? 'bg-red-950/40 border-red-900/60 text-red-400'
                    : 'bg-[#E7B32C]/10 border-[#E7B32C]/30 text-[#E7B32C]'
                )}
              >
                {confirmModal.destructive ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Star className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{confirmModal.titulo}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Confirme a operação para continuar</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">{confirmModal.descricao}</p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#303034] bg-[#1D1D1F] hover:bg-[#252528] text-zinc-300 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.tipo === 'cancelar') {
                    cancelarMutation.mutate()
                  } else if (confirmModal.tipo === 'ativar' && confirmModal.arteId) {
                    ativarVersaoMutation.mutate(confirmModal.arteId)
                  } else if (confirmModal.tipo === 'marcarFinal' && confirmModal.arteId) {
                    marcarFinalMutation.mutate(confirmModal.arteId)
                  } else if (confirmModal.tipo === 'desmarcarFinal' && confirmModal.arteId) {
                    desmarcarFinalMutation.mutate(confirmModal.arteId)
                  } else if (confirmModal.tipo === 'excluir' && confirmModal.arteId) {
                    excluirVersaoMutation.mutate(confirmModal.arteId)
                  }
                }}
                disabled={
                  cancelarMutation.isPending ||
                  ativarVersaoMutation.isPending ||
                  marcarFinalMutation.isPending ||
                  desmarcarFinalMutation.isPending ||
                  excluirVersaoMutation.isPending
                }
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md select-none',
                  confirmModal.destructive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#E7B32C] hover:bg-[#d4a020] text-black'
                )}
              >
                {confirmModal.actionText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE RESUMO DA ORDEM DE SERVIÇO (EXPORTAR / IMPRIMIR) ── */}
      {showResumoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setShowResumoModal(false)}
        >
          <div
            className="rounded-2xl border border-[#303034] bg-[#151516] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 text-[#F5F5F6]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Resumo */}
            <div className="flex items-center justify-between pb-4 border-b border-[#303034]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E7B32C]/10 border border-[#E7B32C]/30 flex items-center justify-center text-[#E7B32C]">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Ordem de Serviço #{String(pedido.id).padStart(4, '0')}
                  </h3>
                  <p className="text-xs text-[#909098]">Resumo técnico para impressão e estamparia</p>
                </div>
              </div>
              <button
                onClick={() => setShowResumoModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1D1D1F] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações Principais da OS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-[#303034] bg-[#1D1D1F] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#909098]">Título do Pedido</span>
                <p className="font-bold text-sm text-[#F5F5F6]">{pedido.titulo}</p>
                <p className="text-zinc-400">Tipo: {TIPO_LABEL[pedido.tipo_impressao] || pedido.tipo_impressao}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-[#303034] bg-[#1D1D1F] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#909098]">Confecção Parceira</span>
                <p className="font-bold text-sm text-[#F5F5F6]">{pedido.confeccao?.nome || 'Não informada'}</p>
                <p className="text-zinc-400">
                  Status: <strong className="text-white">{statusCfg.label}</strong>
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[#303034] bg-[#1D1D1F] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#909098]">Dados do Cliente</span>
                <p className="font-semibold text-zinc-200">{pedido.cliente_nome || pedido.nome_cliente || 'Cliente final'}</p>
                <p className="text-zinc-400">{pedido.cliente_whatsapp || pedido.whatsapp_cliente || 'Sem telefone'}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-[#303034] bg-[#1D1D1F] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#909098]">Prazo e Versão</span>
                <p className="font-semibold text-zinc-200">
                  Prazo: {pedido.prazo ? format(parseISO(pedido.prazo), 'dd/MM/yyyy') : 'Sem prazo'}
                </p>
                <p className="text-zinc-400">
                  Versão Atual: Versão {arteAtiva ? arteAtiva.versao : '—'} {arteAtiva?.is_final ? '(Final)' : ''}
                </p>
              </div>
            </div>

            {/* Lista de Arquivos Técnicos */}
            <div className="space-y-2">
              <span className="text-[11px] uppercase font-bold text-[#909098]">Matrizes de Produção</span>
              <div className="rounded-xl border border-[#303034] bg-[#0E0E0F] p-3 space-y-2 max-h-40 overflow-y-auto">
                {listaFontes.length > 0 ? (
                  listaFontes.map((f: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#151516]">
                      <span className="font-mono text-[#E7B32C]">[{f.extensao?.toUpperCase()}]</span>
                      <span className="text-zinc-300 truncate max-w-xs">{f.nome}</span>
                      <span className="text-zinc-500">
                        {f.tamanho ? `${(f.tamanho / 1024 / 1024).toFixed(2)} MB` : 'Pronto'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-2">Nenhuma matriz anexada.</p>
                )}
              </div>
            </div>

            {/* Observações / Briefing */}
            {pedido.observacoes && (
              <div className="p-3 rounded-xl border border-[#303034] bg-[#1D1D1F] text-xs">
                <span className="font-bold text-zinc-400 block mb-1">Instruções de Produção:</span>
                <p className="text-zinc-300 leading-relaxed">{pedido.observacoes}</p>
              </div>
            )}

            {/* Ações de Impressão */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#303034]">
              <button
                onClick={() => setShowResumoModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#303034] bg-[#1D1D1F] hover:bg-[#252528] text-zinc-300 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  window.print()
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E7B32C] hover:bg-[#d4a020] text-black transition-all flex items-center gap-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" />
                Imprimir Ordem de Serviço
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX / ZOOM DA ARTE EM TELA CHEIA ── */}
      {lightboxOpen && currentPreview?.url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Barra de Ferramentas Superior */}
          <div
            className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 bg-[#151516]/90 px-3.5 py-1.5 rounded-xl border border-[#303034] text-xs shadow-xl">
              <span className="font-bold text-[#E7B32C]">V{versaoExibida?.versao}</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-300 truncate max-w-xs">{currentPreview.nome}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#151516]/90 px-2 py-1 rounded-xl border border-[#303034] shadow-xl">
                <button
                  onClick={() => setZoomScale((s) => Math.min(s + 0.25, 3))}
                  className="p-1 hover:text-[#E7B32C] text-zinc-400 transition-colors"
                  title="Aproximar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-zinc-300 select-none">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale((s) => Math.max(s - 0.25, 0.5))}
                  className="p-1 hover:text-[#E7B32C] text-zinc-400 transition-colors"
                  title="Afastar zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomScale(1)}
                  className="p-1 hover:text-[#E7B32C] text-zinc-400 transition-colors"
                  title="Redefinir zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <a
                href={currentPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-[#151516]/90 border border-[#303034] text-zinc-300 hover:text-white transition-colors shadow-xl"
                title="Abrir imagem original"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={() => setLightboxOpen(false)}
                className="p-2 rounded-xl bg-[#151516]/90 border border-[#303034] text-zinc-300 hover:text-red-400 transition-colors shadow-xl"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Imagem Ampliada com Zoom Interativo */}
          <div
            className="w-full h-full flex items-center justify-center overflow-auto p-4 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentPreview.url}
              alt={currentPreview.nome}
              style={{ transform: `scale(${zoomScale})` }}
              className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-150 rounded-lg shadow-2xl"
            />
          </div>

          {/* Seletor de Miniaturas no Rodapé do Lightbox */}
          {listaPreviews.length > 1 && (
            <div
              className="absolute bottom-4 flex items-center gap-2 bg-[#151516]/90 px-3 py-2 rounded-2xl border border-[#303034] overflow-x-auto max-w-[90vw] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {listaPreviews.map((p: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActivePreviewIdx(idx)}
                  className={clsx(
                    'w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0 transition-all',
                    activePreviewIdx === idx
                      ? 'border-[#E7B32C] ring-2 ring-[#E7B32C]/40 scale-105'
                      : 'border-zinc-800 opacity-60 hover:opacity-100'
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

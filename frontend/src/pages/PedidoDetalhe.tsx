import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidoService, arteService } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Upload, Link2, FileText, CheckCircle2,
  RefreshCw, Clock, CloudUpload, History, Paperclip,
  Image, Package, X, Ban, AlertTriangle, Sparkles,
  Star, Layers, ChevronDown, ChevronUp, Trash2, Check,
  ExternalLink, Download
} from 'lucide-react'
import RevisaoArteModal from '@/components/RevisaoArteModal'
import { resolveMediaUrl } from '@/lib/url'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  aguardando_briefing:  { label: 'Aguardando Briefing',  cls: 'bg-indigo-950 text-indigo-400 border-indigo-900' },
  em_producao:          { label: 'Em Produção',           cls: 'bg-blue-950   text-blue-400   border-blue-900'   },
  aguardando_aprovacao: { label: 'Aguardando Aprovação',  cls: 'bg-amber-950  text-amber-400  border-amber-900'  },
  aprovado:             { label: 'Aprovado',              cls: 'bg-emerald-950 text-emerald-400 border-emerald-900' },
  finalizado:           { label: 'Finalizado',            cls: 'bg-purple-950 text-purple-400 border-purple-900' },
  cancelado:            { label: 'Cancelado',             cls: 'bg-red-950 text-red-400 border-red-900' },
}
const TIPO_LABEL: Record<string, string> = {
  sublimacao: 'Sublimação', bordado: 'Bordado', serigrafia: 'Serigrafia',
}

export default function PedidoDetalhe() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const qc        = useQueryClient()

  const previewRef = useRef<HTMLInputElement>(null)
  const fonteRef   = useRef<HTMLInputElement>(null)

  const [notas, setNotas]                     = useState('')
  const [isFinal, setIsFinal]                 = useState(false)
  const [previewFiles, setPreviewFiles]       = useState<File[]>([])
  const [fonteFiles, setFonteFiles]           = useState<File[]>([])
  const [activePreviewIdx, setActivePreviewIdx] = useState(0)
  const [expandedVersaoId, setExpandedVersaoId] = useState<number | null>(null)
  const [draggingPreview, setDraggingPreview] = useState(false)
  const [draggingFonte, setDraggingFonte]     = useState(false)

  const { isAdmin } = useAuthStore()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showRevisaoIA, setShowRevisaoIA] = useState(false)

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => pedidoService.buscar(Number(id)),
  })

  // Listener para colar imagens da área de transferência (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
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
        toast.success('📸 Imagem da área de transferência colada no preview!')
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const cancelarMutation = useMutation({
    mutationFn: () => pedidoService.cancelar(Number(id)),
    onSuccess: () => {
      toast.success('Pedido cancelado.')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setConfirmCancel(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao cancelar pedido.')
      setConfirmCancel(false)
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
      toast.success(isFinal ? '⭐ Versão Final enviada com sucesso!' : 'Nova versão enviada!')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setNotas('')
      setIsFinal(false)
      setPreviewFiles([])
      setFonteFiles([])
      setActivePreviewIdx(0)
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
    },
    onError: () => toast.error('Erro ao definir versão final.')
  })

  const desmarcarFinalMutation = useMutation({
    mutationFn: (arteId: number) => arteService.desmarcarFinal(arteId),
    onSuccess: () => {
      toast.success('Marcação de versão final removida.')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
    },
    onError: () => toast.error('Erro ao remover marcação.')
  })

  const ativarVersaoMutation = useMutation({
    mutationFn: (arteId: number) => arteService.ativar(arteId),
    onSuccess: () => {
      toast.success('Versão ativada como a versão atual!')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
    },
    onError: () => toast.error('Erro ao ativar versão.')
  })

  const excluirVersaoMutation = useMutation({
    mutationFn: (arteId: number) => arteService.excluir(arteId),
    onSuccess: () => {
      toast.success('Versão removida.')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao excluir versão.')
    }
  })

  const copiarLink = async () => {
    if (!pedido) return
    try {
      const { link } = await pedidoService.linkAprovacao(pedido.id)
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado!')
    } catch { toast.error('Erro ao copiar link.') }
  }

  function handleDropPreview(e: React.DragEvent) {
    e.preventDefault()
    setDraggingPreview(false)
    const files = Array.from(e.dataTransfer.files || []).filter(f => /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(f.name))
    if (files.length > 0) {
      setPreviewFiles(prev => [...prev, ...files])
      toast.success(`${files.length} imagem(ns) de visualização adicionada(s)!`)
    } else {
      toast.error('A imagem deve ser JPG, PNG ou WebP.')
    }
  }

  function handleDropFonte(e: React.DragEvent) {
    e.preventDefault()
    setDraggingFonte(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) {
      setFonteFiles(prev => [...prev, ...files])
      toast.success(`${files.length} arquivo(s) de produção adicionado(s)!`)
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-zinc-500">
        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <span className="text-sm">Carregando pedido...</span>
      </div>
    </div>
  )
  if (!pedido) return (
    <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
      Pedido não encontrado.
    </div>
  )

  const arteAtiva       = pedido.artes?.find((a: { ativa: boolean }) => a.ativa)
  const ultimaAprovacao = pedido.aprovacoes?.[0]
  const statusCfg       = STATUS_CONFIG[pedido.status] ?? STATUS_CONFIG['aguardando_briefing']

  // Preview da arte ativa: usa preview_url se disponível, senão arquivo_url se for imagem
  const rawPreviewSrc = arteAtiva?.preview_url
    ?? (arteAtiva && ['png','jpg','jpeg','webp'].includes(arteAtiva.arquivo_tipo?.toLowerCase() ?? '')
      ? arteAtiva.arquivo_url : null)
  const previewSrc = rawPreviewSrc ? resolveMediaUrl(rawPreviewSrc) : null
  const temFonte = !!arteAtiva?.arquivo_url

  return (
    <div className="p-3 sm:p-5 md:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-5 animate-[fadeIn_0.2s_ease-out]">

      {/* Voltar */}
      <button
        onClick={() => navigate('/pedidos')}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Voltar para Pedidos
      </button>

      {/* ── Header ── */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{pedido.titulo}</h1>
            <div className="flex flex-wrap items-center gap-2.5 mt-2 text-sm text-zinc-500">
              <span className="text-zinc-400">{pedido.confeccao?.nome}</span>
              <span className="text-zinc-700">·</span>
              <span>{TIPO_LABEL[pedido.tipo_impressao]}</span>
              {pedido.prazo && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {format(parseISO(pedido.prazo), "dd/MM/yyyy")}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className={clsx('badge border text-xs', statusCfg.cls)}>
              {statusCfg.label}
            </span>
            <button onClick={copiarLink} className="btn-secondary text-xs py-1.5 gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Copiar link
            </button>
            {pedido.status !== 'cancelado' && pedido.status !== 'finalizado' && (
              <button
                onClick={() => setConfirmCancel(true)}
                className="btn-danger text-xs py-1.5 gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancelar
              </button>
            )}
          </div>
        </div>
        {pedido.observacoes && (
          <p
            className="mt-4 text-sm text-zinc-400 rounded-lg p-3 border"
            style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
          >
            {pedido.observacoes}
          </p>
        )}
      </div>

      {/* ── Banner de aprovação ── */}
      {ultimaAprovacao && (
        <div
          className="rounded-xl p-4 border-l-4 flex items-start gap-3"
          style={{
            background: ultimaAprovacao.status === 'aprovado' ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)',
            borderLeftColor: ultimaAprovacao.status === 'aprovado' ? '#10b981' : '#f59e0b',
            border: '1px solid',
            borderColor: ultimaAprovacao.status === 'aprovado' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
          }}
        >
          {ultimaAprovacao.status === 'aprovado'
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            : <RefreshCw    className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={clsx('text-sm font-semibold', ultimaAprovacao.status === 'aprovado' ? 'text-emerald-400' : 'text-amber-400')}>
              {ultimaAprovacao.status === 'aprovado' ? 'Arte aprovada' : 'Revisão solicitada'}
              {ultimaAprovacao.nome_aprovador && ` por ${ultimaAprovacao.nome_aprovador}`}
            </p>
            {ultimaAprovacao.comentario && (
              <p className="text-sm text-zinc-400 mt-0.5">{ultimaAprovacao.comentario}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Arte atual / Versão de Produção ── */}
      {arteAtiva && (() => {
        const arquivos = Array.isArray(arteAtiva.arquivos) ? arteAtiva.arquivos : []
        const previewsAtivos = arquivos.filter((a: any) => a.eh_preview)
        const fontesAtivos   = arquivos.filter((a: any) => !a.eh_preview)

        const listaPreviews = (previewsAtivos.length > 0
          ? previewsAtivos
          : (previewSrc ? [{ url: previewSrc, nome: arteAtiva.preview_nome || 'Visualização Principal' }] : [])
        ).map((p: any) => ({ ...p, url: resolveMediaUrl(p.url) }))

        const listaFontes = (fontesAtivos.length > 0
          ? fontesAtivos
          : (temFonte && arteAtiva.arquivo_url !== previewSrc
              ? [{ url: arteAtiva.arquivo_url, nome: arteAtiva.arquivo_nome || 'Arquivo Fonte', tipo: arteAtiva.arquivo_tipo, tamanho: arteAtiva.arquivo_tamanho }]
              : [])
        ).map((f: any) => ({ ...f, url: resolveMediaUrl(f.url) }))

        const currentPreview = listaPreviews[activePreviewIdx] ?? listaPreviews[0]

        return (
          <div className={clsx(
            "card p-5 transition-all",
            arteAtiva.is_final && "border-amber-500/50 shadow-[0_0_25px_rgba(212,160,32,0.12)]"
          )}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <CloudUpload className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  Arte Atual — Versão {arteAtiva.versao}
                </h2>
                {arteAtiva.is_final ? (
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }}
                  >
                    <Star className="w-3.5 h-3.5 fill-black" />
                    Versão Final (Produção)
                  </span>
                ) : (
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-400 border"
                    style={{ background: 'rgba(212,160,32,0.1)', borderColor: 'rgba(212,160,32,0.3)' }}
                  >
                    Em Aprovação
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isAdmin() && (
                  arteAtiva.is_final ? (
                    <button
                      onClick={() => desmarcarFinalMutation.mutate(arteAtiva.id)}
                      disabled={desmarcarFinalMutation.isPending}
                      className="text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors"
                    >
                      Remover Marcação Final
                    </button>
                  ) : (
                    <button
                      onClick={() => marcarFinalMutation.mutate(arteAtiva.id)}
                      disabled={marcarFinalMutation.isPending}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all shadow-sm"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      Definir como Versão Final
                    </button>
                  )
                )}

                {isAdmin() && (arteAtiva.preview_url || ['png','jpg','jpeg','webp'].includes(arteAtiva.arquivo_tipo?.toLowerCase() ?? '')) && (
                  <button
                    onClick={() => setShowRevisaoIA(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-90"
                    style={{
                      background: 'rgba(212,160,32,0.08)',
                      borderColor: 'rgba(212,160,32,0.25)',
                      color: '#d4a020',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Revisar com IA
                  </button>
                )}
              </div>
            </div>

            {arteAtiva.is_final && (
              <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-200/90">
                  <strong>Versão Final Consolidada:</strong> Esta versão é a matriz definitiva aprovada para produção e gravação de telas/sublimação.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Imagem de visualização */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#2a2a2a' }}>
                <div
                  className="flex items-center justify-between px-3 py-2.5 border-b"
                  style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
                >
                  <div className="flex items-center gap-2">
                    <Image className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-zinc-300">
                      Visualização ({listaPreviews.length} {listaPreviews.length === 1 ? 'imagem' : 'imagens'})
                    </span>
                  </div>
                  {currentPreview?.url && (
                    <a
                      href={currentPreview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      Abrir original <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-center min-h-[220px] p-2" style={{ background: '#111' }}>
                  {currentPreview?.url ? (
                    <img
                      src={currentPreview.url}
                      alt={currentPreview.nome || 'Preview da arte'}
                      className="max-h-64 max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-zinc-700">
                      <Image className="w-8 h-8" />
                      <span className="text-xs">Sem preview</span>
                    </div>
                  )}
                </div>

                {/* Miniaturas se houver mais de uma visualização */}
                {listaPreviews.length > 1 && (
                  <div className="flex items-center gap-2 p-2.5 border-t overflow-x-auto" style={{ background: '#141414', borderColor: '#2a2a2a' }}>
                    {listaPreviews.map((p: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActivePreviewIdx(idx)}
                        className={clsx(
                          "relative rounded-lg overflow-hidden border flex-shrink-0 transition-all",
                          activePreviewIdx === idx ? "border-amber-400 ring-2 ring-amber-400/20 scale-105" : "border-zinc-800 opacity-60 hover:opacity-100"
                        )}
                        style={{ width: '48px', height: '48px', background: '#000' }}
                      >
                        <img src={p.url} alt={p.nome} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {currentPreview?.nome && (
                  <div className="px-3 py-1.5 border-t" style={{ borderColor: '#2a2a2a', background: '#1a1a1a' }}>
                    <p className="text-[11px] text-zinc-400 truncate">{currentPreview.nome}</p>
                  </div>
                )}
              </div>

              {/* Arquivos de Produção & Fonte */}
              <div className="rounded-xl overflow-hidden border flex flex-col" style={{ borderColor: '#2a2a2a' }}>
                <div
                  className="flex items-center justify-between px-3 py-2.5 border-b"
                  style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-zinc-300">
                      Arquivos de Produção / Fonte ({listaFontes.length})
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[300px]" style={{ background: '#111' }}>
                  {listaFontes.length > 0 ? (
                    listaFontes.map((fonte: any, idx: number) => {
                      const ext = (fonte.extensao || fonte.tipo || 'arq').toUpperCase()
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl border transition-colors hover:border-amber-500/30"
                          style={{ background: '#181818', borderColor: '#262626' }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-[10px]"
                              style={{ background: 'rgba(212,160,32,0.12)', color: '#d4a020', border: '1px solid rgba(212,160,32,0.2)' }}
                            >
                              {ext}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-zinc-300 font-medium truncate" title={fonte.nome}>
                                {fonte.nome}
                              </p>
                              {fonte.tamanho && (
                                <p className="text-[10px] text-zinc-600">
                                  {(fonte.tamanho / 1024 / 1024).toFixed(2)} MB
                                </p>
                              )}
                            </div>
                          </div>
                          <a
                            href={fonte.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs py-1 px-2.5 gap-1.5 flex-shrink-0 ml-2"
                          >
                            <Download className="w-3 h-3" />
                            Baixar
                          </a>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2">
                      <Package className="w-8 h-8 opacity-40" />
                      <span className="text-xs">Nenhum arquivo de produção anexado</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Enviar nova versão ── */}
      {pedido.status !== 'cancelado' && (
        <div className="card p-5">
          {(() => {
            const proxVersao = (pedido.artes?.reduce((max: number, a: { versao: number }) => Math.max(max, a.versao), 0) ?? 0) + 1
            const totalArquivos = previewFiles.length + fonteFiles.length
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                    <CloudUpload className="w-5 h-5 text-amber-500" />
                    Enviar Versão {proxVersao} {arteAtiva ? '(Nova Revisão)' : '(Versão Inicial)'}
                  </h2>
                  <span className="text-xs text-zinc-500">
                    Você pode selecionar múltiplos arquivos e colar com <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono text-[10px]">Ctrl + V</kbd>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                  {/* ── Zona: Imagens de Preview (Múltiplas) ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Image className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-zinc-300">Imagens de Visualização (Mockups)</span>
                        <span className="text-[10px] text-red-500 font-medium">*</span>
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        {previewFiles.length} selecionada{previewFiles.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 mb-2">JPG, PNG, WebP — frente, costas, detalhes para o cliente ver</p>

                    <input
                      ref={previewRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.gif,.bmp"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        if (files.length > 0) {
                          setPreviewFiles((prev) => [...prev, ...files])
                        }
                        e.target.value = ''
                      }}
                    />

                    <div
                      onDragOver={(e) => { e.preventDefault(); setDraggingPreview(true) }}
                      onDragLeave={() => setDraggingPreview(false)}
                      onDrop={handleDropPreview}
                      onClick={() => previewRef.current?.click()}
                      className="rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-150 select-none mb-3"
                      style={{
                        borderColor: draggingPreview ? '#d4a020' : '#2a2a2a',
                        background: draggingPreview ? 'rgba(212,160,32,0.05)' : '#111',
                      }}
                    >
                      <Image
                        className="w-6 h-6 mx-auto mb-1.5 transition-colors"
                        style={{ color: draggingPreview ? '#d4a020' : '#555' }}
                      />
                      <p className="text-xs text-zinc-400 font-medium">Clique ou arraste imagens aqui</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">Suporta seleção múltipla e Ctrl + V</p>
                    </div>

                    {/* Lista de previews selecionados */}
                    {previewFiles.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {previewFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg border"
                            style={{ background: '#181818', borderColor: '#2a2a2a' }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-8 h-8 rounded object-cover flex-shrink-0 border border-zinc-800"
                              />
                              <div className="min-w-0">
                                <p className="text-xs text-zinc-300 truncate" title={file.name}>{file.name}</p>
                                <p className="text-[10px] text-zinc-600">{(file.size / 1024).toFixed(0)} KB</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPreviewFiles((prev) => prev.filter((_, i) => i !== idx))
                              }}
                              className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Zona: Arquivos de Produção & Fonte (Múltiplos) ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-zinc-300">Arquivos de Produção / Fonte</span>
                        <span className="text-[10px] text-zinc-700 font-normal">(opcional)</span>
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        {fonteFiles.length} selecionado{fonteFiles.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 mb-2">PDF, Corel CDR, AI, PSD, EPS, ZIP — matrizes prontas</p>

                    <input
                      ref={fonteRef}
                      type="file"
                      multiple
                      accept=".pdf,.cdr,.ai,.psd,.eps,.svg,.tiff,.tif,.bmp,.afdesign,.indd,.zip,.rar"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        if (files.length > 0) {
                          setFonteFiles((prev) => [...prev, ...files])
                        }
                        e.target.value = ''
                      }}
                    />

                    <div
                      onDragOver={(e) => { e.preventDefault(); setDraggingFonte(true) }}
                      onDragLeave={() => setDraggingFonte(false)}
                      onDrop={handleDropFonte}
                      onClick={() => fonteRef.current?.click()}
                      className="rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-150 select-none mb-3"
                      style={{
                        borderColor: draggingFonte ? '#d4a020' : '#2a2a2a',
                        background: draggingFonte ? 'rgba(212,160,32,0.05)' : '#111',
                      }}
                    >
                      <Package
                        className="w-6 h-6 mx-auto mb-1.5 transition-colors"
                        style={{ color: draggingFonte ? '#d4a020' : '#555' }}
                      />
                      <p className="text-xs text-zinc-400 font-medium">Clique ou arraste matrizes/fontes</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">PDF · CDR · AI · PSD · ZIP · até 50MB</p>
                    </div>

                    {/* Lista de fontes selecionados */}
                    {fonteFiles.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {fonteFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg border"
                            style={{ background: '#181818', borderColor: '#2a2a2a' }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 font-bold text-[10px]"
                                style={{ background: 'rgba(212,160,32,0.1)', color: '#d4a020', border: '1px solid rgba(212,160,32,0.2)' }}
                              >
                                {file.name.split('.').pop()?.toUpperCase() || 'ARQ'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-zinc-300 truncate" title={file.name}>{file.name}</p>
                                <p className="text-[10px] text-zinc-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setFonteFiles((prev) => prev.filter((_, i) => i !== idx))
                              }}
                              className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Opção para marcar diretamente como Versão Final */}
                <div className="mb-4">
                  <label
                    className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-all select-none"
                    style={{
                      background: isFinal ? 'rgba(212,160,32,0.08)' : '#141414',
                      borderColor: isFinal ? '#d4a020' : '#262626',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isFinal}
                      onChange={(e) => setIsFinal(e.target.checked)}
                      className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Star className={clsx("w-3.5 h-3.5", isFinal ? "fill-amber-400 text-amber-400" : "text-zinc-500")} />
                        Marcar esta versão como Versão Final (Aprovada para Produção)
                      </span>
                      <p className="text-[11px] text-zinc-500">
                        Define esta versão como a matriz final consolidada para impressão.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Notas sobre a versão */}
                <input
                  className="input text-sm mb-4"
                  placeholder="Notas sobre esta versão (ex: Ajustado tamanho do logotipo e cores da manga)"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />

                {/* Botão de envio */}
                <button
                  className="btn-primary w-full py-3"
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending || (previewFiles.length === 0 && fonteFiles.length === 0)}
                >
                  {uploadMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Enviando arquivos da Versão {proxVersao}...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 font-semibold">
                      <Upload className="w-4 h-4" />
                      Enviar Versão {proxVersao} {totalArquivos > 0 ? `(${totalArquivos} arquivo${totalArquivos > 1 ? 's' : ''})` : ''}
                    </span>
                  )}
                </button>
                {previewFiles.length === 0 && fonteFiles.length === 0 && (
                  <p className="text-[11px] text-zinc-600 text-center mt-2">
                    Selecione ou cole ao menos uma imagem ou arquivo para habilitar o envio
                  </p>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── Sequência / Histórico de Versões ── */}
      {pedido.artes?.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              Sequência de Versões ({pedido.artes.length})
            </h2>
            <span className="text-xs text-zinc-500">
              Linha de evolução até a versão final
            </span>
          </div>

          <div className="space-y-3">
            {pedido.artes
              .slice()
              .sort((a: any, b: any) => b.versao - a.versao)
              .map((arte: any) => {
                const isExpanded = expandedVersaoId === arte.id
                const arquivos = Array.isArray(arte.arquivos) ? arte.arquivos : []
                return (
                  <div
                    key={arte.id}
                    className={clsx(
                      "rounded-xl border transition-all overflow-hidden",
                      arte.is_final
                        ? "border-amber-500/50 bg-amber-500/[0.04]"
                        : arte.ativa
                        ? "border-zinc-700 bg-zinc-900/60"
                        : "border-zinc-800 bg-[#141414]"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between p-3.5 gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                            arte.is_final
                              ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                              : arte.ativa
                              ? "bg-zinc-700 text-amber-400"
                              : "bg-zinc-800 text-zinc-400"
                          )}
                        >
                          V{arte.versao}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-200">
                              Versão {arte.versao}
                            </span>
                            {arte.is_final && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm"
                                style={{ background: '#f59e0b', color: '#000' }}
                              >
                                <Star className="w-3 h-3 fill-black" /> Versão Final
                              </span>
                            )}
                            {arte.ativa && (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(212,160,32,0.15)', color: '#d4a020', border: '1px solid rgba(212,160,32,0.3)' }}
                              >
                                Atual
                              </span>
                            )}
                          </div>
                          {arte.enviada_em && (
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              Enviada em {format(parseISO(arte.enviada_em), "dd/MM/yyyy 'às' HH:mm")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Ações de Admin */}
                        {isAdmin() && (
                          <>
                            {!arte.ativa && (
                              <button
                                onClick={() => ativarVersaoMutation.mutate(arte.id)}
                                disabled={ativarVersaoMutation.isPending}
                                className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-zinc-800 hover:bg-zinc-800 transition-colors"
                              >
                                Ativar
                              </button>
                            )}
                            {!arte.is_final ? (
                              <button
                                onClick={() => marcarFinalMutation.mutate(arte.id)}
                                disabled={marcarFinalMutation.isPending}
                                className="text-xs font-semibold px-2.5 py-1 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1"
                              >
                                <Star className="w-3 h-3" /> Tornar Final
                              </button>
                            ) : (
                              <button
                                onClick={() => desmarcarFinalMutation.mutate(arte.id)}
                                disabled={desmarcarFinalMutation.isPending}
                                className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
                              >
                                Desmarcar Final
                              </button>
                            )}
                            {pedido.artes.length > 1 && (
                              <button
                                onClick={() => {
                                  if (confirm(`Deseja remover a Versão ${arte.versao}?`)) {
                                    excluirVersaoMutation.mutate(arte.id)
                                  }
                                }}
                                disabled={excluirVersaoMutation.isPending}
                                className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                                title="Excluir versão"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => setExpandedVersaoId(isExpanded ? null : arte.id)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800/80 transition-colors"
                        >
                          Arquivos ({arquivos.length || ((arte.preview_url ? 1 : 0) + (arte.arquivo_url ? 1 : 0))})
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Notas da versão */}
                    {arte.notas && (
                      <div className="px-3.5 pb-2.5 text-xs text-zinc-400 italic">
                        💬 "{arte.notas}"
                      </div>
                    )}

                    {/* Área expandida com todos os arquivos da versão */}
                    {isExpanded && (
                      <div className="p-3 border-t space-y-2" style={{ background: '#0e0e0e', borderColor: '#222' }}>
                        {arquivos.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {arquivos.map((arq: any, aIdx: number) => (
                              <div
                                key={aIdx}
                                className="flex items-center justify-between p-2 rounded-lg border border-zinc-800 bg-[#161616]"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {arq.eh_preview ? (
                                    <img src={arq.url} alt={arq.nome} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-amber-500/10 text-amber-400 font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                                      {(arq.extensao || 'ARQ').toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs text-zinc-300 truncate" title={arq.nome}>{arq.nome}</p>
                                    <p className="text-[10px] text-zinc-600">
                                      {arq.eh_preview ? 'Visualização' : 'Produção'} · {(arq.tamanho / 1024).toFixed(0)} KB
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={arq.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-amber-400 hover:underline px-2 py-1"
                                >
                                  Abrir ↗
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 text-xs">
                            {arte.preview_url && (
                              <a
                                href={arte.preview_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <Image className="w-3.5 h-3.5" /> Abrir Preview ↗
                              </a>
                            )}
                            {arte.arquivo_url && (
                              <a
                                href={arte.arquivo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-400 hover:underline flex items-center gap-1"
                              >
                                <Package className="w-3.5 h-3.5" /> Baixar Arquivo Fonte ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── Referências do designer ── */}
      {pedido.referencias?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-zinc-500" />
            Referências
            <span className="text-xs text-zinc-600 font-normal">({pedido.referencias.length} arquivo{pedido.referencias.length > 1 ? 's' : ''})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pedido.referencias.map((ref: { url: string; nome: string; tipo: string; tamanho: number }, i: number) => {
              const finalUrl = resolveMediaUrl(ref.url)
              const nomeOuUrl = (ref.nome || ref.url || '').toLowerCase()
              const ehImagem = ['png','jpg','jpeg','gif','webp'].includes(ref.tipo?.toLowerCase() ?? '') ||
                /\.(png|jpe?g|gif|webp)($|\?)/i.test(nomeOuUrl)
              return (
                <a
                  key={i}
                  href={finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl overflow-hidden border transition-all hover:border-[rgba(212,160,32,0.4)]"
                  style={{ background: '#161616', borderColor: '#2a2a2a' }}
                >
                  {ehImagem ? (
                    <div className="aspect-square overflow-hidden flex items-center justify-center relative" style={{ background: '#111' }}>
                      <img
                        src={finalUrl}
                        alt={ref.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          const img = e.currentTarget
                          if (!img.dataset.retried && finalUrl.includes('/storage/')) {
                            img.dataset.retried = 'true'
                            img.src = finalUrl.substring(finalUrl.indexOf('/storage/'))
                            return
                          }
                          img.style.display = 'none'
                          const parent = img.parentElement
                          if (parent && !parent.querySelector('.fallback-placeholder')) {
                            const fallback = document.createElement('div')
                            fallback.className = 'fallback-placeholder w-full h-full flex flex-col items-center justify-center p-2 text-zinc-500 text-xs text-center'
                            fallback.innerHTML = '<span class="text-lg mb-1">🖼️</span><span>Visualizar</span>'
                            parent.appendChild(fallback)
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-square flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(212,160,32,0.05)' }}>
                      <FileText className="w-8 h-8 text-zinc-600" />
                      <span className="text-xs text-zinc-600 uppercase font-semibold">{ref.tipo || 'DOC'}</span>
                    </div>
                  )}
                  <div className="p-2 border-t" style={{ borderColor: '#2a2a2a' }}>
                    <p className="text-[10px] text-zinc-400 truncate" title={ref.nome}>{ref.nome || `Arquivo ${i + 1}`}</p>
                    <p className="text-[10px] text-zinc-700">{(ref.tamanho ? ref.tamanho / 1024 : 0).toFixed(0)} KB</p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Histórico de versões ── */}
      {pedido.artes?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-500" />
            Histórico de Versões
          </h2>
          <div className="space-y-1.5">
            {pedido.artes.map((arte: {
              id: number; versao: number; arquivo_nome?: string; preview_nome?: string;
              enviada_em: string; ativa: boolean; arquivo_url?: string; preview_url?: string
            }) => (
              <div
                key={arte.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg border transition-colors"
                style={{
                  background: arte.ativa ? 'rgba(212,160,32,0.06)' : '#161616',
                  borderColor: arte.ativa ? 'rgba(212,160,32,0.2)' : '#2a2a2a',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-zinc-600" />
                  <span className="text-sm text-zinc-300">Versão {arte.versao}</span>
                  {arte.ativa && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(212,160,32,0.15)', color: '#d4a020', border: '1px solid rgba(212,160,32,0.25)' }}
                    >
                      Atual
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-600">
                  {arte.enviada_em && (
                    <span>{format(parseISO(arte.enviada_em), "dd/MM/yyyy HH:mm")}</span>
                  )}
                  {arte.preview_url && (
                    <a
                      href={arte.preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline transition-colors flex items-center gap-1"
                      style={{ color: '#d4a020' }}
                    >
                      <Image className="w-3 h-3" /> Preview ↗
                    </a>
                  )}
                  {arte.arquivo_url && (
                    <a
                      href={arte.arquivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline transition-colors flex items-center gap-1 text-zinc-500 hover:text-zinc-300"
                    >
                      <Package className="w-3 h-3" /> Fonte ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Banner de cancelado ── */}
      {pedido.status === 'cancelado' && (
        <div
          className="rounded-xl p-4 flex items-center gap-3 border"
          style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.2)' }}
        >
          <Ban className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Pedido cancelado</p>
            <p className="text-xs text-zinc-500 mt-0.5">Este pedido foi cancelado e não pode mais ser editado.</p>
          </div>
        </div>
      )}

      {/* ── Histórico de aprovações ── */}
      {pedido.aprovacoes?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            Histórico de Aprovações
          </h2>
          <div className="space-y-2">
            {pedido.aprovacoes.map((ap: {
              id: number; status: string; comentario?: string;
              nome_aprovador?: string; aprovado_em: string
            }) => (
              <div
                key={ap.id}
                className="rounded-lg p-3.5 border-l-4"
                style={{
                  background: ap.status === 'aprovado' ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                  borderLeftColor: ap.status === 'aprovado' ? '#10b981' : '#f59e0b',
                  border: '1px solid',
                  borderColor: ap.status === 'aprovado' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {ap.status === 'aprovado'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <RefreshCw    className="w-4 h-4 text-amber-400" />
                  }
                  <span className={clsx(
                    'text-sm font-medium',
                    ap.status === 'aprovado' ? 'text-emerald-400' : 'text-amber-400'
                  )}>
                    {ap.status === 'aprovado' ? 'Aprovado' : 'Revisão solicitada'}
                    {ap.nome_aprovador && ` — ${ap.nome_aprovador}`}
                  </span>
                  {ap.aprovado_em && (
                    <span className="ml-auto text-xs text-zinc-600">
                      {format(parseISO(ap.aprovado_em), "dd/MM/yyyy HH:mm")}
                    </span>
                  )}
                </div>
                {ap.comentario && (
                  <p className="text-sm text-zinc-400 ml-6">{ap.comentario}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── Modal de Revisão com IA ── */}
      {showRevisaoIA && arteAtiva && (
        <RevisaoArteModal
          pedidoId={Number(id)}
          arteAtiva={arteAtiva}
          todasArtes={pedido.artes ?? []}
          onClose={() => setShowRevisaoIA(false)}
        />
      )}

      {/* ── Modal de confirmação de cancelamento ── */}
      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmCancel(false)}
        >
          <div
            className="card p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Cancelar pedido?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              O pedido <span className="text-white font-medium">"{pedido.titulo}"</span> será marcado
              como cancelado e removido do Kanban.
            </p>
            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => setConfirmCancel(false)}
                disabled={cancelarMutation.isPending}
              >
                Voltar
              </button>
              <button
                className="btn-danger flex-1"
                onClick={() => cancelarMutation.mutate()}
                disabled={cancelarMutation.isPending}
              >
                {cancelarMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Cancelando...
                  </span>
                ) : (
                  <><Ban className="w-4 h-4" /> Confirmar cancelamento</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

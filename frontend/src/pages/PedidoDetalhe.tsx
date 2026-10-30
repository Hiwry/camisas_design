import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidoService, arteService } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Upload, Link2, FileText, CheckCircle2,
  RefreshCw, Clock, CloudUpload, History, Paperclip,
  Image, Package, X, Ban, AlertTriangle, Sparkles,
} from 'lucide-react'
import RevisaoArteModal from '@/components/RevisaoArteModal'
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

  const [notas, setNotas]               = useState('')
  const [previewFile, setPreviewFile]   = useState<File | null>(null)
  const [fonteFile, setFonteFile]       = useState<File | null>(null)
  const [draggingPreview, setDraggingPreview] = useState(false)
  const [draggingFonte, setDraggingFonte]     = useState(false)

  const { isAdmin } = useAuthStore()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showRevisaoIA, setShowRevisaoIA] = useState(false)

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => pedidoService.buscar(Number(id)),
  })

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
      if (!previewFile) throw new Error('Selecione a imagem de visualização.')
      const fd = new FormData()
      fd.append('preview', previewFile)
      if (fonteFile) fd.append('arquivo', fonteFile)
      if (notas) fd.append('notas', notas)
      return arteService.enviar(Number(id), fd)
    },
    onSuccess: () => {
      toast.success('Arte enviada! Pedido movido para Aguardando Aprovação.')
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      setNotas('')
      setPreviewFile(null)
      setFonteFile(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao enviar arte.')
    },
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
    const file = e.dataTransfer.files?.[0]
    if (file && /\.(jpe?g|png|webp)$/i.test(file.name)) {
      setPreviewFile(file)
    } else if (file) {
      toast.error('A imagem deve ser JPG, PNG ou WebP.')
    }
  }

  function handleDropFonte(e: React.DragEvent) {
    e.preventDefault()
    setDraggingFonte(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setFonteFile(file)
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
  const previewSrc = arteAtiva?.preview_url
    ?? (arteAtiva && ['png','jpg','jpeg','webp'].includes(arteAtiva.arquivo_tipo?.toLowerCase() ?? '')
      ? arteAtiva.arquivo_url : null)
  const temFonte = !!arteAtiva?.arquivo_url

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-5 animate-[fadeIn_0.2s_ease-out]">

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

      {/* ── Arte atual ── */}
      {arteAtiva && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <CloudUpload className="w-4 h-4" style={{ color: '#d4a020' }} />
              Arte Atual — Versão {arteAtiva.versao}
            </h2>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Imagem de visualização */}
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#2a2a2a' }}>
              <div
                className="flex items-center gap-2 px-3 py-2.5 border-b"
                style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                <Image className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">Imagem de Visualização</span>
              </div>
              <div className="flex items-center justify-center min-h-[180px]" style={{ background: '#111' }}>
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Preview da arte"
                    className="max-h-56 max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-zinc-700">
                    <Image className="w-8 h-8" />
                    <span className="text-xs">Sem preview</span>
                  </div>
                )}
              </div>
              {arteAtiva.preview_nome && (
                <div className="px-3 py-2 border-t" style={{ borderColor: '#2a2a2a', background: '#1a1a1a' }}>
                  <p className="text-[11px] text-zinc-500 truncate">{arteAtiva.preview_nome}</p>
                </div>
              )}
            </div>

            {/* Arquivo fonte */}
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#2a2a2a' }}>
              <div
                className="flex items-center gap-2 px-3 py-2.5 border-b"
                style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                <Package className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">Arquivo Fonte</span>
              </div>
              <div className="flex items-center justify-center min-h-[180px]" style={{ background: '#111' }}>
                {temFonte ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-zinc-400">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(212,160,32,0.1)', border: '1px solid rgba(212,160,32,0.2)' }}
                    >
                      <FileText className="w-7 h-7" style={{ color: '#d4a020' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-zinc-400 font-medium truncate max-w-[160px]" title={arteAtiva.arquivo_nome}>
                        {arteAtiva.arquivo_nome}
                      </p>
                      {arteAtiva.arquivo_tipo && (
                        <p className="text-[10px] text-zinc-700 uppercase mt-0.5">{arteAtiva.arquivo_tipo}</p>
                      )}
                    </div>
                    <a
                      href={arteAtiva.arquivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                    >
                      <Upload className="w-3 h-3 rotate-180" />
                      Baixar arquivo
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-zinc-700">
                    <Package className="w-8 h-8" />
                    <span className="text-xs">Sem arquivo fonte</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Enviar nova versão ── */}
      {pedido.status !== 'cancelado' && pedido.status !== 'finalizado' && <div className="card p-5">
        <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <CloudUpload className="w-4 h-4" style={{ color: '#d4a020' }} />
          {arteAtiva ? 'Enviar Nova Versão' : 'Enviar Arte'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* ── Zona: Imagem de Preview ── */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Image className="w-3.5 h-3.5" style={{ color: '#d4a020' }} />
              <span className="text-xs font-semibold text-zinc-300">Imagem de Visualização</span>
              <span className="text-[10px] text-red-500 font-medium">*</span>
            </div>
            <p className="text-[11px] text-zinc-600 mb-2">JPG, PNG, WebP — o cliente verá esta imagem</p>

            <input
              ref={previewRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setPreviewFile(file)
                e.target.value = ''
              }}
            />

            {previewFile ? (
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'rgba(212,160,32,0.35)', background: '#111' }}
              >
                <div className="relative">
                  <img
                    src={URL.createObjectURL(previewFile)}
                    alt="Preview selecionado"
                    className="w-full max-h-40 object-cover"
                  />
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                  >
                    <X className="w-3.5 h-3.5 text-zinc-300" />
                  </button>
                </div>
                <div className="px-3 py-2 border-t" style={{ borderColor: '#2a2a2a' }}>
                  <p className="text-[11px] text-zinc-400 truncate">{previewFile.name}</p>
                  <p className="text-[10px] text-zinc-700">{(previewFile.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDraggingPreview(true) }}
                onDragLeave={() => setDraggingPreview(false)}
                onDrop={handleDropPreview}
                onClick={() => previewRef.current?.click()}
                className="rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-150 select-none"
                style={{
                  borderColor: draggingPreview ? '#d4a020' : '#2a2a2a',
                  background: draggingPreview ? 'rgba(212,160,32,0.05)' : '#111',
                }}
              >
                <Image
                  className="w-7 h-7 mx-auto mb-2 transition-colors"
                  style={{ color: draggingPreview ? '#d4a020' : '#444' }}
                />
                <p className="text-xs text-zinc-500">Arraste ou clique para selecionar</p>
                <p className="text-[11px] text-zinc-700 mt-0.5">JPG · PNG · WebP · até 10MB</p>
              </div>
            )}
          </div>

          {/* ── Zona: Arquivo Fonte ── */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Package className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-300">Arquivo Fonte</span>
              <span className="text-[10px] text-zinc-700 font-normal">(opcional)</span>
            </div>
            <p className="text-[11px] text-zinc-600 mb-2">PDF, CDR, AI, PSD, EPS — arquivo de trabalho</p>

            <input
              ref={fonteRef}
              type="file"
              accept=".pdf,.cdr,.ai,.psd,.eps,.svg,.tiff,.tif,.bmp,.afdesign,.indd,.zip,.rar"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setFonteFile(file)
                e.target.value = ''
              }}
            />

            {fonteFile ? (
              <div
                className="rounded-xl border p-4 flex items-center gap-3"
                style={{ borderColor: '#2a2a2a', background: 'rgba(212,160,32,0.04)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(212,160,32,0.1)', border: '1px solid rgba(212,160,32,0.2)' }}
                >
                  <FileText className="w-5 h-5" style={{ color: '#d4a020' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 truncate font-medium">{fonteFile.name}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{(fonteFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={() => setFonteFile(null)}
                  className="flex-shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDraggingFonte(true) }}
                onDragLeave={() => setDraggingFonte(false)}
                onDrop={handleDropFonte}
                onClick={() => fonteRef.current?.click()}
                className="rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-150 select-none"
                style={{
                  borderColor: draggingFonte ? '#d4a020' : '#2a2a2a',
                  background: draggingFonte ? 'rgba(212,160,32,0.05)' : '#111',
                }}
              >
                <Package
                  className="w-7 h-7 mx-auto mb-2 transition-colors"
                  style={{ color: draggingFonte ? '#d4a020' : '#444' }}
                />
                <p className="text-xs text-zinc-500">Arraste ou clique para selecionar</p>
                <p className="text-[11px] text-zinc-700 mt-0.5">PDF · CDR · AI · PSD · EPS · até 50MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Notas */}
        <input
          className="input text-sm mb-4"
          placeholder="Notas sobre esta versão (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />

        {/* Botão de envio */}
        <button
          className="btn-primary w-full py-3"
          onClick={() => uploadMutation.mutate()}
          disabled={uploadMutation.isPending || !previewFile}
        >
          {uploadMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Enviando arte...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              {arteAtiva ? 'Enviar Nova Versão' : 'Enviar Arte'}
            </span>
          )}
        </button>
        {!previewFile && (
          <p className="text-[11px] text-zinc-700 text-center mt-2">
            Selecione a imagem de visualização para habilitar o envio
          </p>
        )}
      </div>}

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
              const nomeOuUrl = (ref.nome || ref.url || '').toLowerCase()
              const ehImagem = ['png','jpg','jpeg','gif','webp'].includes(ref.tipo?.toLowerCase() ?? '') ||
                /\.(png|jpe?g|gif|webp)($|\?)/i.test(nomeOuUrl)
              return (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl overflow-hidden border transition-all hover:border-[rgba(212,160,32,0.4)]"
                  style={{ background: '#161616', borderColor: '#2a2a2a' }}
                >
                  {ehImagem ? (
                    <div className="aspect-square overflow-hidden flex items-center justify-center" style={{ background: '#111' }}>
                      <img
                        src={ref.url}
                        alt={ref.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          const img = e.currentTarget
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
                    <p className="text-[10px] text-zinc-400 truncate" title={ref.nome}>{ref.nome}</p>
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

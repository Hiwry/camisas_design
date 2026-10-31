import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { aprovacaoService } from '@/services/api'
import toast from 'react-hot-toast'
import { resolveMediaUrl } from '@/lib/url'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, RefreshCw, FileText, ChevronDown, Shirt, ExternalLink, Download, Star, Image } from 'lucide-react'
import clsx from 'clsx'

type Etapa = 'visualizar' | 'revisao' | 'sucesso_aprovado' | 'sucesso_revisao'

const TIPO_LABEL: Record<string, string> = {
  sublimacao: 'Sublimação', bordado: 'Bordado', serigrafia: 'Serigrafia',
}

export default function AprovacaoPublica() {
  const { token } = useParams<{ token: string }>()
  const [etapa, setEtapa]                 = useState<Etapa>('visualizar')
  const [comentario, setComentario]       = useState('')
  const [nomeAprovador, setNomeAprovador] = useState('')
  const [histOpen, setHistOpen]           = useState(false)
  const [activePreviewIdx, setActivePreviewIdx] = useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['aprovacao', token],
    queryFn: () => aprovacaoService.buscarPorToken(token!),
    enabled: !!token,
  })

  const aprovarMutation = useMutation({
    mutationFn: () => aprovacaoService.aprovar(token!, nomeAprovador || undefined),
    onSuccess: () => setEtapa('sucesso_aprovado'),
    onError: () => toast.error('Erro ao aprovar. Tente novamente.'),
  })

  const revisaoMutation = useMutation({
    mutationFn: () => aprovacaoService.pedirRevisao(token!, comentario, nomeAprovador || undefined),
    onSuccess: () => setEtapa('sucesso_revisao'),
    onError: () => toast.error('Erro ao solicitar revisão. Tente novamente.'),
  })

  /* ── Loading ── */
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="flex items-center gap-3 text-zinc-500">
        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <span className="text-sm">Carregando arte...</span>
      </div>
    </div>
  )

  /* ── Erro / link inválido ── */
  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0a0a' }}>
      <div className="card p-10 max-w-sm text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span className="text-2xl">🔗</span>
        </div>
        <p className="text-white font-semibold mb-1">Link inválido</p>
        <p className="text-sm text-zinc-500">Solicite um novo link à sua confecção.</p>
      </div>
    </div>
  )

  /* ── Telas de sucesso ── */
  if (etapa === 'sucesso_aprovado') return <SuccessScreen tipo="aprovado" />
  if (etapa === 'sucesso_revisao')  return <SuccessScreen tipo="revisao" />

  const { pedido, arte_ativa, historico_artes } = data
  const jaFinalizado = ['aprovado', 'finalizado'].includes(pedido.status)

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>

      {/* ── Header ── */}
      <header
        className="border-b px-4 sm:px-6 py-3.5 sm:py-4 sticky top-0 z-10"
        style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderColor: '#1e1e1e' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)', boxShadow: '0 2px 12px rgba(212,160,32,0.3)' }}
            >
              <Shirt className="w-4 sm:w-5 h-4 sm:h-5" style={{ color: '#0a0a0a' }} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-zinc-500 leading-none mb-0.5">Aprovação de Arte</p>
              <p className="text-xs sm:text-sm font-semibold text-white leading-none">{pedido.confeccao.nome}</p>
            </div>
          </div>

          {jaFinalizado && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Arte Aprovada
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5">

        {/* ── Info do pedido ── */}
        <div className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-white">{pedido.titulo}</h1>
              <div className="flex items-center gap-2.5 mt-1.5 text-sm text-zinc-500">
                <span className="badge badge-gray">{TIPO_LABEL[pedido.tipo_impressao] ?? pedido.tipo_impressao}</span>
                {pedido.prazo && <span>Prazo: {format(parseISO(pedido.prazo), "dd/MM/yyyy")}</span>}
              </div>
            </div>
          </div>
          {pedido.observacoes && (
            <p
              className="mt-3 text-sm text-zinc-400 rounded-lg p-3 border"
              style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
            >
              {pedido.observacoes}
            </p>
          )}
        </div>

        {/* ── Visualização da arte ── */}
        {arte_ativa ? (() => {
          const tipoArte   = arte_ativa.arquivo_tipo?.toLowerCase() ?? ''
          const arquivos   = Array.isArray(arte_ativa.arquivos) ? arte_ativa.arquivos : []
          const previews   = arquivos.filter((a: any) => a.eh_preview)
          const fontes     = arquivos.filter((a: any) => !a.eh_preview).map((f: any) => ({ ...f, url: resolveMediaUrl(f.url) }))

          const listaPreviews = (previews.length > 0
            ? previews
            : (arte_ativa.preview_url ? [{ url: arte_ativa.preview_url, nome: arte_ativa.preview_nome }] : (['png','jpg','jpeg','webp'].includes(tipoArte) ? [{ url: arte_ativa.arquivo_url, nome: arte_ativa.arquivo_nome }] : []))
          ).map((p: any) => ({ ...p, url: resolveMediaUrl(p.url) }))

          const curPreview = listaPreviews[activePreviewIdx] ?? listaPreviews[0]
          const previewSrc = curPreview?.url ? resolveMediaUrl(curPreview.url) : null
          const versaoAtual = historico_artes?.find((a: { ativa: boolean }) => a.ativa)?.versao ?? arte_ativa.versao ?? 1

          return (
            <div className={clsx("card overflow-hidden", arte_ativa.is_final && "border-amber-500/50 shadow-lg shadow-amber-500/10")}>
              <div
                className="flex flex-wrap items-center justify-between px-5 py-3 border-b gap-3"
                style={{ background: '#161616', borderColor: '#2a2a2a' }}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-200">Versão {versaoAtual}</span>
                  {arte_ativa.is_final && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shadow"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }}
                    >
                      <Star className="w-3 h-3 fill-black" />
                      Versão Final Aprovada
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {previewSrc && (
                    <a
                      href={previewSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                      style={{ color: '#d4a020' }}
                    >
                      Abrir em nova aba <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {arte_ativa.notas && (
                <div className="px-5 py-2 text-xs text-zinc-400 border-b border-zinc-800 bg-zinc-900/40 italic">
                  💬 Mensagem do Designer: "{arte_ativa.notas}"
                </div>
              )}

              <div className="flex items-center justify-center min-h-[280px] sm:min-h-[480px] p-2" style={{ background: '#080808' }}>
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Arte para aprovação"
                    className="max-h-[65vh] sm:max-h-[560px] max-w-full object-contain rounded-lg"
                  />
                ) : arte_ativa.arquivo_tipo === 'pdf' ? (
                  <iframe
                    src={arte_ativa.arquivo_url}
                    className="w-full h-[580px]"
                    title="Arte para aprovação"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-zinc-600 py-16">
                    <FileText className="w-12 h-12" />
                    <p className="text-sm">Sem imagem de visualização</p>
                    {arte_ativa.arquivo_url && (
                      <a
                        href={arte_ativa.arquivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium"
                        style={{ color: '#d4a020' }}
                      >
                        Baixar arquivo fonte ↗
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Se houver múltiplas imagens de visualização (ex: frente e costas) */}
              {listaPreviews.length > 1 && (
                <div className="flex items-center gap-2 px-5 py-3 border-t overflow-x-auto" style={{ background: '#121212', borderColor: '#222' }}>
                  <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" /> Ângulos:
                  </span>
                  {listaPreviews.map((p: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActivePreviewIdx(idx)}
                      className={clsx(
                        "rounded-lg overflow-hidden border transition-all flex-shrink-0",
                        activePreviewIdx === idx ? "border-amber-400 ring-2 ring-amber-400/30 scale-105" : "border-zinc-800 opacity-60 hover:opacity-100"
                      )}
                      style={{ width: '48px', height: '48px', background: '#000' }}
                    >
                      <img src={p.url} alt={p.nome} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Banner de download dos arquivos fonte/produção */}
              {(fontes.length > 0 || (arte_ativa.arquivo_url && arte_ativa.preview_url)) && (
                <div
                  className="px-5 py-3 border-t space-y-2"
                  style={{ background: '#161616', borderColor: '#2a2a2a' }}
                >
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Arquivos de Produção Disponíveis
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {fontes.length > 0 ? (
                      fontes.map((f: any, fIdx: number) => (
                        <a
                          key={fIdx}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                          style={{ color: '#d4a020', borderColor: 'rgba(212,160,32,0.25)', background: 'rgba(212,160,32,0.05)' }}
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar {f.nome}
                        </a>
                      ))
                    ) : (
                      <a
                        href={resolveMediaUrl(arte_ativa.arquivo_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                        style={{ color: '#d4a020', borderColor: 'rgba(212,160,32,0.25)', background: 'rgba(212,160,32,0.05)' }}
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar arquivo fonte ({arte_ativa.arquivo_nome || 'Arquivo'})
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })() : (
          <div className="card p-16 text-center text-zinc-600 text-sm">
            Nenhuma arte disponível para visualização ainda.
          </div>
        )}

        {/* ── Versões anteriores ── */}
        {historico_artes?.length > 1 && (
          <div className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              onClick={() => setHistOpen(!histOpen)}
            >
              <span>Versões anteriores ({historico_artes.length - 1})</span>
              <ChevronDown className={clsx('w-4 h-4 transition-transform duration-150', histOpen && 'rotate-180')} />
            </button>
            {histOpen && (
              <div className="border-t divide-y" style={{ borderColor: '#1e1e1e' }}>
                {historico_artes
                  .filter((a: { ativa: boolean }) => !a.ativa)
                  .map((arte: { id: number; versao: number; enviada_em: string; arquivo_url?: string; preview_url?: string }) => (
                    <div
                      key={arte.id}
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ borderColor: '#1e1e1e' }}
                    >
                      <span className="text-sm text-zinc-500">Versão {arte.versao}</span>
                      <div className="flex items-center gap-4">
                        {arte.enviada_em && (
                          <span className="text-xs text-zinc-700">
                            {format(parseISO(arte.enviada_em), "dd/MM/yyyy HH:mm")}
                          </span>
                        )}
                        {(arte.preview_url ?? arte.arquivo_url) && (
                          <a
                            href={arte.preview_url ?? arte.arquivo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium hover:underline"
                            style={{ color: '#d4a020' }}
                          >
                            Ver ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── Painel de ações ── */}
        {!jaFinalizado && arte_ativa && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-5">O que você deseja fazer?</h2>

            {/* Nome do aprovador */}
            <div className="mb-5">
              <label className="label">Seu nome <span className="text-zinc-700 font-normal normal-case tracking-normal">(opcional)</span></label>
              <input
                type="text"
                className="input max-w-sm"
                placeholder="Ex: João Silva"
                value={nomeAprovador}
                onChange={(e) => setNomeAprovador(e.target.value)}
              />
            </div>

            {etapa === 'visualizar' && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  className="btn-primary flex-1 py-3 text-sm font-semibold"
                  onClick={() => aprovarMutation.mutate()}
                  disabled={aprovarMutation.isPending}
                >
                  {aprovarMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Aprovando...
                    </span>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Aprovar Arte</>
                  )}
                </button>
                <button
                  className="btn-secondary flex-1 py-3 text-sm"
                  onClick={() => setEtapa('revisao')}
                >
                  <RefreshCw className="w-4 h-4" /> Pedir Revisão
                </button>
              </div>
            )}

            {etapa === 'revisao' && (
              <div className="space-y-4">
                <div>
                  <label className="label">
                    O que precisa ser alterado?
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea
                    className="textarea"
                    placeholder="Ex: Gostaria de mudar a fonte do nome, deixar maior e centralizado..."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary" onClick={() => setEtapa('visualizar')}>
                    Voltar
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={() => revisaoMutation.mutate()}
                    disabled={revisaoMutation.isPending || comentario.trim().length < 5}
                  >
                    {revisaoMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        Enviando...
                      </span>
                    ) : (
                      <><RefreshCw className="w-4 h-4" /> Enviar Revisão</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-zinc-800 pb-4">
          Camiseta Design · Sistema de Aprovação de Artes
        </p>
      </div>
    </div>
  )
}

/* ── Tela de sucesso ── */
function SuccessScreen({ tipo }: { tipo: 'aprovado' | 'revisao' }) {
  const aprovado = tipo === 'aprovado'
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: aprovado
          ? 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.08) 0%, #0a0a0a 70%)'
          : 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,158,11,0.08) 0%, #0a0a0a 70%)',
      }}
    >
      <div className="card p-12 max-w-md text-center animate-[slideUp_0.3s_ease-out]">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: aprovado ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${aprovado ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}
        >
          {aprovado
            ? <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            : <RefreshCw    className="w-10 h-10 text-amber-400" />
          }
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          {aprovado ? 'Arte aprovada!' : 'Revisão solicitada!'}
        </h2>
        <p className="text-zinc-400 leading-relaxed">
          {aprovado
            ? 'Sua aprovação foi registrada. A confecção foi notificada e dará seguimento ao pedido.'
            : 'Seu comentário foi enviado ao designer. Você receberá uma nova versão em breve.'
          }
        </p>
        <div
          className="mt-8 h-px"
          style={{ background: 'linear-gradient(to right, transparent, #2a2a2a, transparent)' }}
        />
        <p className="mt-6 text-xs text-zinc-700">Camiseta Design · Sistema de Aprovação</p>
      </div>
    </div>
  )
}

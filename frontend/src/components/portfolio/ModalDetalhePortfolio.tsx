import { useState } from 'react'
import { PortfolioItem, portfolioService } from '@/services/api'
import {
  X,
  Heart,
  Share2,
  Calendar,
  Layers,
  Sparkles,
  Palette,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  Tag,
  Building,
  Maximize2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  item: PortfolioItem
  onClose: () => void
  onCurtir?: (item: PortfolioItem) => void
  onCriarPedidoComEstilo?: (item: PortfolioItem) => void
}

export default function ModalDetalhePortfolio({
  item,
  onClose,
  onCurtir,
  onCriarPedidoComEstilo,
}: Props) {
  const galeria = item.galeria && item.galeria.length > 0 ? item.galeria : [item.imagem_principal]
  const [imagemAtiva, setImagemAtiva] = useState(0)
  const [curtidasLocal, setCurtidasLocal] = useState(item.curtidas)
  const [jaCurtiu, setJaCurtiu] = useState(false)
  const [copiouHex, setCopiouHex] = useState<string | null>(null)
  const [copiouLink, setCopiouLink] = useState(false)

  async function handleCurtir() {
    if (jaCurtiu) return
    try {
      setJaCurtiu(true)
      setCurtidasLocal((prev) => prev + 1)
      const res = await portfolioService.curtir(item.id)
      setCurtidasLocal(res.curtidas)
      if (onCurtir) {
        onCurtir({ ...item, curtidas: res.curtidas })
      }
      toast.success('Você curtiu esta criação!', { icon: '❤️' })
    } catch {
      // Ignora erro silenciosamente
    }
  }

  function handleCopiarLink() {
    const url = `${window.location.origin}/portfolio?item=${item.id}`
    navigator.clipboard.writeText(url)
    setCopiouLink(true)
    toast.success('Link do trabalho copiado!')
    setTimeout(() => setCopiouLink(false), 2500)
  }

  function handleCopiarHex(hex: string) {
    navigator.clipboard.writeText(hex)
    setCopiouHex(hex)
    toast.success(`Cor ${hex} copiada!`)
    setTimeout(() => setCopiouHex(null), 2000)
  }

  function handlePedirNoWhatsApp() {
    const msg = encodeURIComponent(
      `Olá! Vi o trabalho "${item.titulo}" (${item.categoria.toUpperCase()}) no portfólio da Camisas Design e gostaria de solicitar uma criação nesse mesmo estilo!`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #121212 0%, #0d0d0d 100%)',
          borderColor: '#262626',
        }}
      >
        {/* Barra superior de ações */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-zinc-800 bg-zinc-900/60 z-10 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full bg-[#d4a020]/15 text-[#d4a020] border border-[#d4a020]/30">
              {item.categoria}
            </span>
            {item.servico && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {item.servico === 'sublimacao'
                  ? 'Sublimação Total'
                  : item.servico === 'serigrafia'
                  ? 'Serigrafia / Silk'
                  : item.servico === 'bordado'
                  ? 'Bordado'
                  : item.servico === 'logos'
                  ? 'Logos & Mascotes'
                  : item.servico}
              </span>
            )}
            {item.destaque && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Sparkles className="w-2.5 h-2.5" /> Destaque
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCurtir}
              disabled={jaCurtiu}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all border',
                jaCurtiu
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-700'
              )}
              title="Curtir este design"
            >
              <Heart
                className={clsx('w-3.5 h-3.5', jaCurtiu ? 'fill-rose-500 text-rose-500' : '')}
              />
              <span>{curtidasLocal}</span>
            </button>

            <button
              type="button"
              onClick={handleCopiarLink}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors"
              title="Copiar link"
            >
              {copiouLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo em 2 colunas com scroll */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          {/* Coluna da Imagem e Galeria (7 cols) */}
          <div className="md:col-span-7 p-3.5 sm:p-5 flex flex-col justify-between bg-black/40">
            {/* Visualizador Principal */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800/80 group">
              <img
                src={galeria[imagemAtiva] || item.imagem_principal}
                alt={item.titulo}
                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

              <a
                href={galeria[imagemAtiva] || item.imagem_principal}
                target="_blank"
                rel="noreferrer"
                className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 backdrop-blur-md text-zinc-300 hover:text-white hover:bg-black/80 transition-all border border-white/10"
                title="Abrir em resolução original"
              >
                <Maximize2 className="w-4 h-4" />
              </a>

              <div className="absolute bottom-3 left-3 text-xs text-zinc-300 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10">
                Visualização {imagemAtiva + 1} de {galeria.length}
              </div>
            </div>

            {/* Miniaturas da Galeria */}
            {galeria.length > 1 && (
              <div className="flex items-center gap-2.5 mt-4 overflow-x-auto pb-1 scrollbar-none">
                {galeria.map((foto, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImagemAtiva(idx)}
                    className={clsx(
                      'relative w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all',
                      imagemAtiva === idx
                        ? 'border-[#d4a020] scale-105 shadow-md shadow-[#d4a020]/20'
                        : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-700'
                    )}
                  >
                    <img src={foto} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Aviso de fidelidade gráfica */}
            <div className="mt-4 p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex items-center gap-2.5 text-xs text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>
                Arquivos entregues em <strong>curvas (CorelDraw & Illustrator)</strong>, CMYK e 300 DPI prontos para impressão.
              </span>
            </div>
          </div>

          {/* Coluna de Informações e Briefing (5 cols) */}
          <div className="md:col-span-5 p-4 sm:p-5 md:p-6 flex flex-col justify-between space-y-5 sm:space-y-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
                  {item.titulo}
                </h2>
                {item.subtitulo && (
                  <p className="text-xs md:text-sm text-zinc-400 mt-1 leading-snug">
                    {item.subtitulo}
                  </p>
                )}
              </div>

              {/* Ficha Técnica Rápida */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Cliente / Projeto</span>
                  <span className="text-zinc-200 font-medium truncate block">
                    {item.cliente || 'Confecção Parceira'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Ano de Criação</span>
                  <span className="text-zinc-200 font-medium block">
                    {item.ano || '2026'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Tecido Recomendado</span>
                  <span className="text-zinc-200 font-medium truncate block">
                    {item.tecido || 'Dry-Fit UV50+'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Estamparia / Técnica</span>
                  <span className="text-zinc-200 font-medium truncate block">
                    {item.tecnica || 'Sublimação Total'}
                  </span>
                </div>
              </div>

              {/* Descrição & Conceito */}
              {item.descricao && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#d4a020]" />
                    Conceito Criativo & Execução
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 p-3 rounded-xl border border-zinc-800/60">
                    {item.descricao}
                  </p>
                </div>
              )}

              {/* Paleta de Cores Utilizada */}
              {item.cores && item.cores.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#d4a020]" />
                    Paleta de Cores (Clique para Copiar HEX)
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.cores.map((cor, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleCopiarHex(cor)}
                        className="group flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-all"
                        title={`Clique para copiar ${cor}`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shadow-inner flex-shrink-0"
                          style={{ backgroundColor: cor }}
                        />
                        <span className="text-[11px] font-mono text-zinc-400 group-hover:text-white uppercase">
                          {copiouHex === cor ? 'Copiado!' : cor}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags do Projeto */}
              {item.tags && item.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Botões de Ação na base */}
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              {onCriarPedidoComEstilo && (
                <button
                  type="button"
                  onClick={() => onCriarPedidoComEstilo(item)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-[#d4a020] text-black hover:bg-[#e0ad26] shadow-md shadow-[#d4a020]/20 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Criar Pedido com Base Nesse Estilo
                </button>
              )}

              <button
                type="button"
                onClick={handlePedirNoWhatsApp}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Conversar no WhatsApp sobre esse Design
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

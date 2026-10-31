import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { portfolioService, PortfolioItem } from '@/services/api'
import ModalDetalhePortfolio from '@/components/portfolio/ModalDetalhePortfolio'
import ModalGerenciarPortfolio from '@/components/portfolio/ModalGerenciarPortfolio'
import toast from 'react-hot-toast'
import {
  Sparkles,
  Search,
  Plus,
  Heart,
  Palette,
  Eye,
  Edit2,
  Trash2,
  Star,
  CheckCircle2,
  Share2,
  ExternalLink,
  Shirt,
  MessageCircle,
  X,
  User,
  Layers,
  ArrowUpRight,
  Package,
} from 'lucide-react'
import clsx from 'clsx'

const SEGMENTOS_FILTRO = [
  { id: 'todos', label: 'Todos' },
  { id: 'esportivos', label: 'Esportivos' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'eventos', label: 'Eventos' },
]

const SERVICOS_FILTRO = [
  { id: 'todos', label: 'Todos os Serviços' },
  { id: 'sublimacao', label: 'Sublimação Total' },
  { id: 'serigrafia', label: 'Serigrafia (Silk)' },
  { id: 'bordado', label: 'Bordado' },
  { id: 'logos', label: 'Logos & Mascotes' },
]

function getServicoLabel(servico?: string) {
  switch (servico) {
    case 'sublimacao':
      return 'Sublimação Total'
    case 'serigrafia':
      return 'Serigrafia'
    case 'bordado':
      return 'Bordado'
    case 'logos':
      return 'Logo & Mascote'
    default:
      return servico || 'Sublimação'
  }
}

interface PortfolioPageProps {
  isPublic?: boolean
}

export default function PortfolioPage({ isPublic = false }: PortfolioPageProps) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, isAdmin } = useAuthStore()
  const isAdm = isAdmin()

  // Filtros
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todos')
  const [servicoAtivo, setServicoAtivo] = useState<string>('todos')
  const [busca, setBusca] = useState<string>('')
  const [showSobreModal, setShowSobreModal] = useState<boolean>(false)

  // Modais
  const [itemVisualizando, setItemVisualizando] = useState<PortfolioItem | null>(null)
  const [itemParaEditar, setItemParaEditar] = useState<PortfolioItem | null>(null)
  const [showModalGerenciar, setShowModalGerenciar] = useState<boolean>(false)

  // Consulta do Portfólio
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio-itens', categoriaAtiva, servicoAtivo, busca],
    queryFn: () =>
      portfolioService.listar({
        categoria: categoriaAtiva !== 'todos' ? categoriaAtiva : undefined,
        servico: servicoAtivo !== 'todos' ? servicoAtivo : undefined,
        busca: busca.trim() || undefined,
        incluir_inativos: isAdm,
      }),
  })

  const itens = data?.itens ?? []
  const metricas = data?.metricas

  // Se houver query param `?item=123` abre direto o modal
  useEffect(() => {
    const itemIdParam = searchParams.get('item')
    if (itemIdParam && itens.length > 0 && !itemVisualizando) {
      const achado = itens.find((i) => i.id === Number(itemIdParam))
      if (achado) setItemVisualizando(achado)
    }
  }, [searchParams, itens])

  // Mutação: Alternar Destaque
  const toggleDestaqueMutation = useMutation({
    mutationFn: (id: number) => portfolioService.adminToggleDestaque(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      toast.success('Destaque atualizado!')
    },
  })

  // Mutação: Excluir Trabalho
  const excluirMutation = useMutation({
    mutationFn: (id: number) => portfolioService.adminExcluir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      toast.success('Trabalho removido com sucesso.')
    },
  })

  function handleConfirmarExclusao(item: PortfolioItem) {
    if (window.confirm(`Tem certeza que deseja remover o trabalho "${item.titulo}"?`)) {
      excluirMutation.mutate(item.id)
    }
  }

  function handleContatoWhatsApp() {
    const msg = encodeURIComponent(
      'Olá! Vi o portfólio no Camiseta Design e gostaria de um orçamento para criação de fardamento/camisas personalizadas.'
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  // Identifica o item em destaque principal (Brasiliense F.C. ou primeiro destaque)
  const itemDestaquePrincipal = useMemo(() => {
    return itens.find((i) => i.destaque) || itens[0] || null
  }, [itens])

  // Itens para o grid abaixo do showcase
  const itensGrid = useMemo(() => {
    if (!itemDestaquePrincipal) return itens
    return itens.filter((i) => i.id !== itemDestaquePrincipal.id)
  }, [itens, itemDestaquePrincipal])

  return (
    <div
      className={clsx(
        'text-zinc-100 flex flex-col selection:bg-[#d4a020] selection:text-black',
        isPublic ? 'min-h-screen' : 'min-h-full'
      )}
      style={{ background: '#0a0a0a' }}
    >
      {/* ── Topbar Pública (Apenas exibida na rota pública sem sidebar) ── */}
      {isPublic && (
        <header
          className="border-b px-4 sm:px-6 md:px-10 py-3 sm:py-4 z-20 sticky top-0 backdrop-blur-md"
          style={{ background: '#111111ee', borderColor: '#1e1e1e' }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            {/* Logo Camiseta Design */}
            <Link to="/portfolio" className="flex items-center gap-2 flex-shrink-0">
              <img
                src="/logo.svg"
                alt="Camiseta Design"
                className="h-7 sm:h-8 w-auto"
                onError={(e) => {
                  const i = e.currentTarget
                  i.onerror = null
                  i.src = '/logo.png'
                }}
              />
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Camiseta<span className="text-[#d4a020]">Design</span>
              </span>
            </Link>

            {/* Links da direita */}
            <nav className="flex items-center gap-2.5 sm:gap-6 text-xs font-medium text-zinc-400 overflow-x-auto scrollbar-none py-1">
              <button
                type="button"
                onClick={() => {
                  setCategoriaAtiva('todos')
                  setServicoAtivo('todos')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="text-white font-semibold transition-colors hover:text-white whitespace-nowrap"
              >
                Portfólio
              </button>

              <button
                type="button"
                onClick={() => setShowSobreModal(true)}
                className="hover:text-white transition-colors whitespace-nowrap hidden xs:inline-block"
              >
                Sobre
              </button>

              <button
                type="button"
                onClick={handleContatoWhatsApp}
                className="flex items-center gap-1 text-zinc-300 hover:text-[#d4a020] transition-colors font-semibold whitespace-nowrap"
              >
                <span>WhatsApp</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#d4a020]" />
              </button>

              {user ? (
                <Link
                  to="/pedidos"
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-black shadow-md transition-all whitespace-nowrap flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)' }}
                >
                  <span>Painel</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-black transition-all whitespace-nowrap flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)' }}
                >
                  <span>Entrar</span>
                </Link>
              )}
            </nav>
          </div>
        </header>
      )}

      {/* ── Conteúdo Principal do Portfólio ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
        {/* ── Headline & Filtros por Segmento ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 pb-2 border-b border-[#1e1e1e]">
          {/* Título & Subtítulo */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(212,160,32,0.12)',
                  color: '#d4a020',
                  border: '1px solid rgba(212,160,32,0.25)',
                }}
              >
                Portfólio Oficial · Camiseta Design
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Artes que vestem identidade<span className="text-[#d4a020]">.</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 font-medium tracking-wide">
              Camisas • Uniformes • Estampas
            </p>
          </div>

          {/* Filtros por Segmento com Underline Dourado */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium self-stretch md:self-auto overflow-x-auto pb-1 scrollbar-none">
            {SEGMENTOS_FILTRO.map((cat, idx) => {
              const ativo = categoriaAtiva === cat.id
              return (
                <div key={cat.id} className="flex items-center gap-3 sm:gap-6">
                  {idx > 0 && <span className="text-zinc-700 select-none">|</span>}
                  <button
                    type="button"
                    onClick={() => setCategoriaAtiva(cat.id)}
                    className={clsx(
                      'relative pb-1.5 transition-colors whitespace-nowrap',
                      ativo ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <span>{cat.label}</span>
                    {ativo && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ background: 'linear-gradient(90deg, #d4a020, #e8b430)' }}
                      />
                    )}
                  </button>
                </div>
              )
            })}

            {isAdm && (
              <button
                type="button"
                onClick={() => {
                  setItemParaEditar(null)
                  setShowModalGerenciar(true)
                }}
                className="ml-auto sm:ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-black shadow-md transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Trabalho</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Filtro por Categoria de Serviço / Técnica (Sublimação, Serigrafia, Bordado, Logos) ── */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border"
          style={{ background: '#111111', borderColor: '#1e1e1e' }}
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mr-1 flex items-center gap-1.5 flex-shrink-0">
              <Layers className="w-3.5 h-3.5 text-[#d4a020]" />
              Serviço:
            </span>
            {SERVICOS_FILTRO.map((srv) => {
              const ativo = servicoAtivo === srv.id
              const count = srv.id === 'todos' ? metricas?.total : metricas?.servicos?.[srv.id]
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => setServicoAtivo(srv.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex-shrink-0',
                    ativo
                      ? 'text-black font-bold shadow-md'
                      : 'bg-[#181818] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                  )}
                  style={
                    ativo
                      ? {
                          background: 'linear-gradient(135deg,#d4a020,#e8b430)',
                          borderColor: '#d4a020',
                          boxShadow: '0 2px 10px rgba(212,160,32,0.25)',
                        }
                      : {}
                  }
                >
                  <span>{srv.label}</span>
                  {count !== undefined && (
                    <span
                      className={clsx(
                        'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                        ativo ? 'bg-black/25 text-black' : 'bg-zinc-800 text-zinc-500'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Campo de Busca Rápida & Reset */}
          <div className="relative flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar fardamento, time, tecido..."
                className="input pl-8 pr-7 py-1 text-xs w-full bg-[#161616] border-zinc-800 rounded-xl text-zinc-300"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {(categoriaAtiva !== 'todos' || servicoAtivo !== 'todos' || busca) && (
              <button
                type="button"
                onClick={() => {
                  setCategoriaAtiva('todos')
                  setServicoAtivo('todos')
                  setBusca('')
                }}
                className="text-[11px] text-[#d4a020] hover:underline whitespace-nowrap font-medium flex-shrink-0"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Showcase Principal (Layout do Mockup) ── */}
        {itemDestaquePrincipal && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
            {/* Card Grande da Esquerda (Frente e Costas) ~ 62% da largura */}
            <div className="md:col-span-7 flex flex-col group">
              <div
                onClick={() => setItemVisualizando(itemDestaquePrincipal)}
                className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#111111] border cursor-pointer shadow-2xl transition-all duration-300 group-hover:border-zinc-700"
                style={{ borderColor: '#1e1e1e' }}
              >
                <img
                  src={itemDestaquePrincipal.imagem_principal}
                  alt={itemDestaquePrincipal.titulo}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none opacity-40 group-hover:opacity-20 transition-opacity" />
              </div>

              {/* Legenda do Card Principal */}
              <div className="flex items-center justify-between mt-3 px-1">
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      onClick={() => setItemVisualizando(itemDestaquePrincipal)}
                      className="text-sm font-bold text-white hover:text-[#d4a020] transition-colors cursor-pointer"
                    >
                      01 — {itemDestaquePrincipal.titulo}
                    </h3>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(212,160,32,0.12)',
                        color: '#d4a020',
                        border: '1px solid rgba(212,160,32,0.25)',
                      }}
                    >
                      {getServicoLabel(itemDestaquePrincipal.servico)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {itemDestaquePrincipal.subtitulo || 'Uniforme esportivo / Frente e costas'}
                  </p>
                </div>

                {isAdm && (
                  <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => {
                        setItemParaEditar(itemDestaquePrincipal)
                        setShowModalGerenciar(true)
                      }}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Coluna da Direita (2 Cards Empilhados) ~ 38% da largura */}
            <div className="md:col-span-5 flex flex-col justify-between gap-5 md:gap-6">
              {/* Card Superior Direito: Detalhes que fazem a diferença */}
              <div className="flex flex-col group">
                <div
                  onClick={() => setItemVisualizando(itemDestaquePrincipal)}
                  className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[#111111] border cursor-pointer shadow-xl transition-all duration-300 group-hover:border-zinc-700"
                  style={{ borderColor: '#1e1e1e' }}
                >
                  <img
                    src={
                      itemDestaquePrincipal.galeria?.[1] ||
                      '/portfolio/brasiliense_detalhes.jpg'
                    }
                    alt="Detalhes"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none opacity-40 group-hover:opacity-20 transition-opacity" />
                </div>

                {/* Legenda */}
                <div className="flex items-center justify-between mt-3 px-1">
                  <span
                    onClick={() => setItemVisualizando(itemDestaquePrincipal)}
                    className="text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Detalhes que fazem a diferença
                  </span>
                  <span className="text-xs text-zinc-600 font-mono">02</span>
                </div>
              </div>

              {/* Card Inferior Direito: Estampa em destaque */}
              <div className="flex flex-col group">
                <div
                  onClick={() => setItemVisualizando(itemDestaquePrincipal)}
                  className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[#111111] border cursor-pointer shadow-xl transition-all duration-300 group-hover:border-zinc-700"
                  style={{ borderColor: '#1e1e1e' }}
                >
                  <img
                    src={
                      itemDestaquePrincipal.galeria?.[2] ||
                      '/portfolio/brasiliense_estampa.jpg'
                    }
                    alt="Estampa em destaque"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none opacity-40 group-hover:opacity-20 transition-opacity" />
                </div>

                {/* Legenda */}
                <div className="flex items-center justify-between mt-3 px-1">
                  <span
                    onClick={() => setItemVisualizando(itemDestaquePrincipal)}
                    className="text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Estampa em destaque
                  </span>
                  <span className="text-xs text-zinc-600 font-mono">03</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Segunda Linha / Grid de Mais Projetos ── */}
        <div className="pt-4 space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="aspect-[4/3] rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : itens.length === 0 ? (
            <div
              className="p-12 text-center rounded-2xl border space-y-3"
              style={{ background: '#111111', borderColor: '#1e1e1e' }}
            >
              <Shirt className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">Nenhum projeto encontrado nesta categoria</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Não encontramos trabalhos para a combinação de filtros selecionada.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCategoriaAtiva('todos')
                  setServicoAtivo('todos')
                  setBusca('')
                }}
                className="text-xs font-bold px-4 py-2 rounded-xl text-black transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)' }}
              >
                Limpar Todos os Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {itensGrid.map((item, index) => {
                const numeroFormatado = String(index + 4).padStart(2, '0')
                return (
                  <div key={item.id} className="flex flex-col group">
                    <div
                      onClick={() => setItemVisualizando(item)}
                      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#111111] border cursor-pointer shadow-lg transition-all duration-300 group-hover:border-zinc-700 group-hover:-translate-y-1"
                      style={{ borderColor: '#1e1e1e' }}
                    >
                      <img
                        src={item.imagem_principal}
                        alt={item.titulo}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none opacity-40 group-hover:opacity-20 transition-opacity" />

                      {/* Tag de Destaque se houver */}
                      {item.destaque && (
                        <div className="absolute top-3 left-3">
                          <span
                            className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm"
                            style={{
                              background: 'linear-gradient(135deg,#d4a020,#e8b430)',
                              color: '#0a0a0a',
                            }}
                          >
                            Destaque
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Legenda do Card */}
                    <div className="flex items-center justify-between mt-3 px-1">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            onClick={() => setItemVisualizando(item)}
                            className="text-xs sm:text-sm font-bold text-white hover:text-[#d4a020] transition-colors cursor-pointer"
                          >
                            {numeroFormatado} — {item.titulo}
                          </h3>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(212,160,32,0.1)',
                              color: '#d4a020',
                              border: '1px solid rgba(212,160,32,0.2)',
                            }}
                          >
                            {getServicoLabel(item.servico)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                          {item.subtitulo || `${item.categoria} / ${item.tecido || 'Dry-Fit'}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-600 font-mono">{numeroFormatado}</span>

                        {isAdm && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setItemParaEditar(item)
                                setShowModalGerenciar(true)
                              }}
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                              title="Editar"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmarExclusao(item)}
                              className="p-1 rounded hover:bg-red-950/40 text-zinc-400 hover:text-red-400"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Banner de Contato / Orçamento na Base ── */}
        <div
          className="mt-8 sm:mt-12 rounded-3xl p-5 sm:p-8 md:p-10 border flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6"
          style={{
            background: 'linear-gradient(135deg, #121212 0%, #171510 100%)',
            borderColor: '#262626',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4a020]">
                Criação Personalizada
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
              Gostou dos modelos? Vamos criar o seu fardamento exclusivo.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Desenvolvemos a arte do zero, vetorizamos mascotes, preparamos mockups 3D e entregamos os arquivos em curvas prontos para corte e sublimação da sua confecção.
            </p>
          </div>

          <button
            type="button"
            onClick={handleContatoWhatsApp}
            className="w-full sm:w-auto justify-center py-3 px-6 rounded-xl text-xs font-bold flex items-center gap-2 text-black shadow-lg transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg,#d4a020,#e8b430)',
              boxShadow: '0 4px 20px rgba(212,160,32,0.3)',
            }}
          >
            <span>Falar no WhatsApp</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t px-6 sm:px-10 py-6 text-center text-xs text-zinc-600" style={{ borderColor: '#1a1a1a' }}>
        <p>© {new Date().getFullYear()} Camiseta Design — Todos os direitos reservados. Artes que vestem identidade.</p>
      </footer>

      {/* ── Modal de Detalhes do Projeto ── */}
      {itemVisualizando && (
        <ModalDetalhePortfolio
          item={itemVisualizando}
          onClose={() => {
            setItemVisualizando(null)
            searchParams.delete('item')
            setSearchParams(searchParams)
          }}
          onCurtir={() => {
            qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
          }}
          onCriarPedidoComEstilo={(item) => {
            setItemVisualizando(null)
            if (user) {
              navigate('/pedidos', { state: { modeloReferencia: item.titulo } })
              toast.success(`Modelo "${item.titulo}" selecionado como referência!`)
            } else {
              handleContatoWhatsApp()
            }
          }}
        />
      )}

      {/* ── Modal Sobre ── */}
      {showSobreModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSobreModal(false)
          }}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border p-6 sm:p-8 space-y-6 shadow-2xl"
            style={{ background: '#111111', borderColor: '#222222' }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: '#1e1e1e' }}>
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.svg"
                  alt="Camiseta Design"
                  className="h-7 w-auto"
                  onError={(e) => {
                    const i = e.currentTarget
                    i.onerror = null
                    i.src = '/logo.png'
                  }}
                />
                <div>
                  <h3 className="text-base font-black text-white">Camiseta Design</h3>
                  <p className="text-xs text-zinc-400">Estúdio de Criação de Fardamentos & Artes Digitais</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSobreModal(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
              <p>
                Especializados em fardamentos esportivos, abadás, camisas promocionais e uniformes corporativos. Unimos arte visual de alto impacto com padrões industriais rigorosos de corte e impressão.
              </p>

              <div className="space-y-2 pt-2 border-t" style={{ borderColor: '#1e1e1e' }}>
                <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                  Padrão Camiseta Design:
                </span>
                <ul className="space-y-1.5 text-zinc-400">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d4a020]" />
                    Arquivos fechados em curvas (CorelDRAW e Illustrator)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d4a020]" />
                    Perfil de cor CMYK calibrado para sublimação total e serigrafia
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d4a020]" />
                    Mascotes vetoriais, escudos heráldicos e numerações exclusivas
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d4a020]" />
                    Mockups 3D hiper-realistas para aprovação rápida do cliente
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSobreModal(false)
                  handleContatoWhatsApp()
                }}
                className="w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-black shadow-md transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)' }}
              >
                <span>Solicitar Orçamento no WhatsApp</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Gestão / Cadastro pelo Admin ── */}
      {showModalGerenciar && (
        <ModalGerenciarPortfolio
          itemParaEditar={itemParaEditar}
          onClose={() => {
            setShowModalGerenciar(false)
            setItemParaEditar(null)
          }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
          }}
        />
      )}
    </div>
  )
}

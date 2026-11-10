import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PortfolioItem,
  PortfolioCategoriaItem,
  portfolioService,
} from '@/services/api'
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Star,
  Eye,
  EyeOff,
  Search,
  Layers,
  Tag,
  Sparkles,
  Check,
  AlertCircle,
  FolderPlus,
  CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  onClose: () => void
  onEditarItem: (item: PortfolioItem) => void
  onNovoItem: () => void
}

export default function ModalPainelGerenciadorPortfolio({
  onClose,
  onEditarItem,
  onNovoItem,
}: Props) {
  const qc = useQueryClient()
  const [abaAtiva, setAbaAtiva] = useState<'trabalhos' | 'categorias'>('trabalhos')
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [filtroServico, setFiltroServico] = useState<string>('todos')

  // Estado para criação de nova categoria
  const [novoNomeCat, setNovoNomeCat] = useState('')
  const [novoTipoCat, setNovoTipoCat] = useState<'segmento' | 'servico'>('segmento')
  const [salvandoCat, setSalvandoCat] = useState(false)

  // Estado para edição inline de categoria
  const [catEditandoId, setCatEditandoId] = useState<number | null>(null)
  const [nomeEditandoCat, setNomeEditandoCat] = useState('')

  // 1. Consulta dos Trabalhos (incluindo inativos)
  const { data: portfolioData, isLoading: loadingItens } = useQuery({
    queryKey: ['portfolio-itens-admin'],
    queryFn: () => portfolioService.listar({ incluir_inativos: true }),
  })

  // 2. Consulta das Categorias
  const { data: categoriasData, isLoading: loadingCats } = useQuery({
    queryKey: ['portfolio-categorias'],
    queryFn: () => portfolioService.listarCategorias(true),
  })

  const itens = portfolioData?.itens ?? []
  const categorias = categoriasData?.categorias ?? []
  const servicos = categoriasData?.servicos ?? []

  // Mutações de Trabalhos
  const toggleDestaqueMutation = useMutation({
    mutationFn: (id: number) => portfolioService.adminToggleDestaque(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens-admin'] })
      toast.success('Destaque atualizado!')
    },
    onError: () => toast.error('Falha ao atualizar destaque.'),
  })

  const toggleAtivoMutation = useMutation({
    mutationFn: (id: number) => portfolioService.adminToggleAtivo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens-admin'] })
      toast.success('Visibilidade atualizada!')
    },
    onError: () => toast.error('Falha ao atualizar visibilidade.'),
  })

  const excluirItemMutation = useMutation({
    mutationFn: (id: number) => portfolioService.adminExcluir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens-admin'] })
      qc.invalidateQueries({ queryKey: ['portfolio-categorias'] })
      toast.success('Trabalho removido com sucesso!')
    },
    onError: () => toast.error('Erro ao excluir trabalho.'),
  })

  // Mutações de Categorias
  const criarCategoriaMutation = useMutation({
    mutationFn: (dados: { nome: string; tipo: 'segmento' | 'servico' }) =>
      portfolioService.adminCriarCategoria(dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-categorias'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      setNovoNomeCat('')
      toast.success('Nova categoria criada com sucesso!')
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Falha ao criar categoria.'),
  })

  const atualizarCategoriaMutation = useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) =>
      portfolioService.adminAtualizarCategoria(id, { nome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-categorias'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      setCatEditandoId(null)
      toast.success('Categoria atualizada!')
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Falha ao atualizar categoria.'),
  })

  const excluirCategoriaMutation = useMutation({
    mutationFn: ({ id, forcar }: { id: number; forcar?: boolean }) =>
      portfolioService.adminExcluirCategoria(id, forcar),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-categorias'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      toast.success('Categoria removida com sucesso.')
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        if (
          window.confirm(
            `${err.response.data.message}\n\nDeseja forçar a exclusão mesmo assim?`
          )
        ) {
          excluirCategoriaMutation.mutate({
            id: err.config?.url?.split('/')?.pop(),
            forcar: true,
          })
        }
      } else {
        toast.error(err?.response?.data?.message || 'Falha ao remover categoria.')
      }
    },
  })

  function handleCriarCategoria(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNomeCat.trim()) {
      toast.error('Informe o nome da categoria')
      return
    }
    setSalvandoCat(true)
    criarCategoriaMutation.mutate(
      { nome: novoNomeCat.trim(), tipo: novoTipoCat },
      { onSettled: () => setSalvandoCat(false) }
    )
  }

  function handleSalvarEdicaoCat(id: number) {
    if (!nomeEditandoCat.trim()) return
    atualizarCategoriaMutation.mutate({ id, nome: nomeEditandoCat.trim() })
  }

  function handleConfirmarExclusaoItem(item: PortfolioItem) {
    if (window.confirm(`Tem certeza que deseja excluir "${item.titulo}" do portfólio?`)) {
      excluirItemMutation.mutate(item.id)
    }
  }

  // Filtragem dos trabalhos para a tabela
  const itensFiltrados = itens.filter((i) => {
    const matchBusca =
      !busca.trim() ||
      i.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (i.subtitulo && i.subtitulo.toLowerCase().includes(busca.toLowerCase())) ||
      (i.cliente && i.cliente.toLowerCase().includes(busca.toLowerCase()))

    const matchCat = filtroCategoria === 'todos' || i.categoria === filtroCategoria
    const matchSrv = filtroServico === 'todos' || i.servico === filtroServico

    return matchBusca && matchCat && matchSrv
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #131313 0%, #0c0c0c 100%)',
          borderColor: '#262626',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner"
              style={{
                background: 'rgba(212,160,32,0.12)',
                borderColor: 'rgba(212,160,32,0.3)',
                color: '#d4a020',
              }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Gerenciador de Portfólio & Catálogo
              </h2>
              <p className="text-xs text-zinc-400">
                Edite trabalhos individualmente, altere fotos, crie novas categorias e controle o que aparece no catálogo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-3 pb-0 border-b border-zinc-800 bg-[#121212]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAbaAtiva('trabalhos')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-px',
                abaAtiva === 'trabalhos'
                  ? 'border-[#d4a020] text-white bg-zinc-900/40 rounded-t-lg'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#d4a020]" />
              <span>Trabalhos Cadastrados ({itens.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('categorias')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-px',
                abaAtiva === 'categorias'
                  ? 'border-[#d4a020] text-white bg-zinc-900/40 rounded-t-lg'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Tag className="w-3.5 h-3.5 text-[#d4a020]" />
              <span>Categorias & Serviços ({categorias.length + servicos.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onNovoItem()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-black shadow-md transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Novo Trabalho</span>
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* ════ ABA 1: TRABALHOS CADASTRADOS ════ */}
          {abaAtiva === 'trabalhos' && (
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Filtrar por título, cliente..."
                    className="input pl-8 pr-3 py-1.5 text-xs w-full bg-[#181818] border-zinc-800 text-zinc-200"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="input text-xs py-1.5 bg-[#181818] border-zinc-800 text-zinc-300"
                  >
                    <option value="todos">Todos os Segmentos</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.nome}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroServico}
                    onChange={(e) => setFiltroServico(e.target.value)}
                    className="input text-xs py-1.5 bg-[#181818] border-zinc-800 text-zinc-300"
                  >
                    <option value="todos">Todos os Serviços</option>
                    {servicos.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.nome}
                      </option>
                    ))}
                  </select>

                  {(busca || filtroCategoria !== 'todos' || filtroServico !== 'todos') && (
                    <button
                      type="button"
                      onClick={() => {
                        setBusca('')
                        setFiltroCategoria('todos')
                        setFiltroServico('todos')
                      }}
                      className="text-xs text-[#d4a020] hover:underline whitespace-nowrap px-1"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Tabela de Trabalhos */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-900/80 border-b border-zinc-800">
                      <tr>
                        <th className="py-3 px-3 w-16">Foto</th>
                        <th className="py-3 px-3">Título / Peça</th>
                        <th className="py-3 px-3">Segmento</th>
                        <th className="py-3 px-3">Serviço</th>
                        <th className="py-3 px-3 text-center">Destaque</th>
                        <th className="py-3 px-3 text-center">Visível</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {loadingItens ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-zinc-500">
                            Carregando trabalhos do catálogo...
                          </td>
                        </tr>
                      ) : itensFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-zinc-500">
                            Nenhum trabalho encontrado com os filtros atuais.
                          </td>
                        </tr>
                      ) : (
                        itensFiltrados.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-zinc-900/40 transition-colors group"
                          >
                            {/* Thumbnail */}
                            <td className="py-2.5 px-3">
                              <div className="w-12 h-9 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/60 flex-shrink-0">
                                <img
                                  src={item.imagem_principal}
                                  alt={item.titulo}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </td>

                            {/* Título & Detalhes */}
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-white block line-clamp-1">
                                {item.titulo}
                              </span>
                              <span className="text-[11px] text-zinc-500 block line-clamp-1">
                                {item.subtitulo || item.cliente || 'Sem subtítulo'}
                              </span>
                            </td>

                            {/* Categoria */}
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {categorias.find((c) => c.slug === item.categoria)?.nome ||
                                  item.categoria}
                              </span>
                            </td>

                            {/* Serviço */}
                            <td className="py-2.5 px-3">
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{
                                  background: 'rgba(212,160,32,0.12)',
                                  color: '#d4a020',
                                  border: '1px solid rgba(212,160,32,0.25)',
                                }}
                              >
                                {servicos.find((s) => s.slug === item.servico)?.nome ||
                                  item.servico ||
                                  'Sublimação'}
                              </span>
                            </td>

                            {/* Destaque (Showcase) */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleDestaqueMutation.mutate(item.id)}
                                className={clsx(
                                  'p-1.5 rounded-lg transition-all',
                                  item.destaque
                                    ? 'text-[#d4a020] bg-[#d4a020]/10 hover:bg-[#d4a020]/20'
                                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
                                )}
                                title={item.destaque ? 'Remover destaque' : 'Marcar destaque'}
                              >
                                <Star
                                  className={clsx(
                                    'w-4 h-4',
                                    item.destaque ? 'fill-current' : ''
                                  )}
                                />
                              </button>
                            </td>

                            {/* Ativo / Oculto */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleAtivoMutation.mutate(item.id)}
                                className={clsx(
                                  'p-1.5 rounded-lg transition-all',
                                  item.ativo
                                    ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                                    : 'text-zinc-500 bg-zinc-800 hover:bg-zinc-700'
                                )}
                                title={item.ativo ? 'Ativo no portfólio' : 'Oculto do público'}
                              >
                                {item.ativo ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Ações */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onEditarItem(item)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-[#d4a020] hover:text-black text-zinc-200 transition-colors"
                                  title="Editar trabalho individualmente"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleConfirmarExclusaoItem(item)}
                                  className="p-1.5 rounded-lg hover:bg-red-950/40 text-zinc-500 hover:text-red-400 transition-colors"
                                  title="Excluir trabalho"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════ ABA 2: CATEGORIAS E SERVIÇOS ════ */}
          {abaAtiva === 'categorias' && (
            <div className="space-y-6">
              {/* Box de Adicionar Nova Categoria */}
              <form
                onSubmit={handleCriarCategoria}
                className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-[#d4a020]" />
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Criar Nova Categoria / Tipo de Serviço
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Nome da Categoria *
                    </label>
                    <input
                      type="text"
                      required
                      value={novoNomeCat}
                      onChange={(e) => setNovoNomeCat(e.target.value)}
                      placeholder="Ex: Escolar / Terceirão, Academias, Motoclubes, DTF Têxtil..."
                      className="input w-full text-xs py-2 bg-[#161616] border-zinc-800 text-zinc-200"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Tipo *
                    </label>
                    <select
                      value={novoTipoCat}
                      onChange={(e) =>
                        setNovoTipoCat(e.target.value as 'segmento' | 'servico')
                      }
                      className="input w-full text-xs py-2 bg-[#161616] border-zinc-800 text-zinc-200"
                    >
                      <option value="segmento">
                        Segmento de Mercado (Ex: Esportivos, Eventos, Escolar)
                      </option>
                      <option value="servico">
                        Serviço / Técnica (Ex: Sublimação, Bordado, Silk, DTF)
                      </option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={salvandoCat}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{salvandoCat ? 'Criando...' : 'Adicionar'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Grid com 2 colunas: Segmentos e Serviços */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Coluna 1: Segmentos */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
                  <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-[#d4a020]" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Segmentos de Mercado ({categorias.length})
                      </h4>
                    </div>
                    <span className="text-[10px] text-zinc-500">Filtro do topo</span>
                  </div>

                  <div className="p-3 divide-y divide-zinc-800/60">
                    {categorias.map((cat) => {
                      const isEditando = catEditandoId === cat.id
                      return (
                        <div
                          key={cat.id}
                          className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-zinc-900/40 rounded-lg transition-colors"
                        >
                          {isEditando ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={nomeEditandoCat}
                                onChange={(e) => setNomeEditandoCat(e.target.value)}
                                className="input text-xs py-1 px-2 flex-1 bg-[#181818]"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSalvarEdicaoCat(cat.id)}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCatEditandoId(null)}
                                className="p-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="font-bold text-white text-xs block">
                                  {cat.nome}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  slug: {cat.slug} • {cat.total_itens ?? 0} trabalho(s)
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCatEditandoId(cat.id)
                                    setNomeEditandoCat(cat.nome)
                                  }}
                                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                  title="Editar nome"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    excluirCategoriaMutation.mutate({ id: cat.id })
                                  }
                                  className="p-1 rounded hover:bg-red-950/40 text-zinc-500 hover:text-red-400"
                                  title="Excluir categoria"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Coluna 2: Serviços e Técnicas */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
                  <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#d4a020]" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Serviços & Técnicas ({servicos.length})
                      </h4>
                    </div>
                    <span className="text-[10px] text-zinc-500">Filtro de técnica</span>
                  </div>

                  <div className="p-3 divide-y divide-zinc-800/60">
                    {servicos.map((srv) => {
                      const isEditando = catEditandoId === srv.id
                      return (
                        <div
                          key={srv.id}
                          className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-zinc-900/40 rounded-lg transition-colors"
                        >
                          {isEditando ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={nomeEditandoCat}
                                onChange={(e) => setNomeEditandoCat(e.target.value)}
                                className="input text-xs py-1 px-2 flex-1 bg-[#181818]"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSalvarEdicaoCat(srv.id)}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCatEditandoId(null)}
                                className="p-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="font-bold text-white text-xs block">
                                  {srv.nome}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  slug: {srv.slug} • {srv.total_itens ?? 0} trabalho(s)
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCatEditandoId(srv.id)
                                    setNomeEditandoCat(srv.nome)
                                  }}
                                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                  title="Editar nome"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    excluirCategoriaMutation.mutate({ id: srv.id })
                                  }
                                  className="p-1 rounded hover:bg-red-950/40 text-zinc-500 hover:text-red-400"
                                  title="Excluir serviço"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


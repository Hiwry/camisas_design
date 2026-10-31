import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { shopService, ShopItem } from '@/services/api'
import ModalGerenciarItemShop from '@/components/shop/ModalGerenciarItemShop'
import toast from 'react-hot-toast'
import {
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
  Palette,
  Bot,
  PenTool,
  Clock,
  Zap,
  ArrowUpRight,
  ExternalLink,
  Tag,
  Star,
} from 'lucide-react'
import clsx from 'clsx'

const CATEGORIAS_CONFIG: Record<string, { label: string; cor: string }> = {
  combos:   { label: 'Combos & Pacotes',    cor: '#ec4899' },
  artes:    { label: 'Artes Extras',        cor: '#d4a020' },
  ia:       { label: 'Créditos IA',         cor: '#8b5cf6' },
  servicos: { label: 'Serviços de Design',  cor: '#3b82f6' },
  urgencia: { label: 'Prazos & Urgência',   cor: '#f59e0b' },
}

export default function GerenciarShopPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [filtroAtivo, setFiltroAtivo] = useState<string>('')
  const [modalAberto, setModalAberto] = useState(false)
  const [itemParaEditar, setItemParaEditar] = useState<ShopItem | null>(null)

  // Consulta todos os itens pelo endpoint do admin
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['admin-shop-itens', filtroCategoria, search, filtroAtivo],
    queryFn: () =>
      shopService.adminListarItens({
        categoria: filtroCategoria === 'todos' ? undefined : filtroCategoria,
        search: search || undefined,
        ativo: filtroAtivo || undefined,
      }),
  })

  // Mutação para alternar ativo/inativo
  const toggleAtivoMutation = useMutation({
    mutationFn: (id: number) => shopService.adminToggleAtivo(id),
    onSuccess: (data) => {
      toast.success(data.message)
      qc.invalidateQueries({ queryKey: ['admin-shop-itens'] })
      qc.invalidateQueries({ queryKey: ['shop-itens'] })
    },
    onError: () => toast.error('Falha ao alterar status do produto.'),
  })

  // Mutação para excluir
  const excluirMutation = useMutation({
    mutationFn: (id: number) => shopService.adminExcluirItem(id),
    onSuccess: () => {
      toast.success('Produto excluído com sucesso!')
      qc.invalidateQueries({ queryKey: ['admin-shop-itens'] })
      qc.invalidateQueries({ queryKey: ['shop-itens'] })
    },
    onError: () => toast.error('Falha ao excluir produto.'),
  })

  function handleEditar(item: ShopItem) {
    setItemParaEditar(item)
    setModalAberto(true)
  }

  function handleNovo() {
    setItemParaEditar(null)
    setModalAberto(true)
  }

  function handleExcluir(item: ShopItem) {
    const itemId = item.db_id || (item.id as unknown as number)
    if (confirm(`Tem certeza que deseja excluir "${item.nome}" do Shop?`)) {
      excluirMutation.mutate(itemId)
    }
  }

  // Estatísticas
  const totalProdutos = itens.length
  const totalAtivos = itens.filter((i) => i.ativo).length
  const totalDestaques = itens.filter((i) => i.destaque).length
  const totalCombos = itens.filter((i) => i.categoria === 'combos' || i.categoria === 'artes').length

  return (
    <div className="min-h-full p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* ── Header Principal ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 sm:pb-6 border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(212,160,32,0.2), rgba(212,160,32,0.05))',
                border: '1px solid rgba(212,160,32,0.3)',
              }}
            >
              <ShoppingBag className="w-5 h-5 text-[#d4a020]" />
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight">
              Gerenciar Produtos & Combos do Shop
            </h1>
          </div>
          <p className="text-xs md:text-sm text-zinc-400 max-w-2xl">
            Painel administrativo para cadastrar novos itens, combos especiais de artes, gerenciar preços, fotos de capa e ativar/desativar produtos para as confecções.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <Link
            to="/shop"
            className="btn-secondary flex-1 sm:flex-none justify-center px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5"
            title="Abrir o Shop na visão do cliente"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Shop</span>
            <ArrowUpRight className="w-3 h-3 text-zinc-500" />
          </Link>

          <button
            type="button"
            onClick={handleNovo}
            className="btn-primary flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-[#d4a020]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* ── Cards de Estatísticas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
            Total de Itens
          </span>
          <span className="text-2xl font-black text-white">{totalProdutos}</span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">cadastrados no sistema</span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/10">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
            Ativos no Catálogo
          </span>
          <span className="text-2xl font-black text-emerald-300">{totalAtivos}</span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">visíveis para os clientes</span>
        </div>

        <div className="p-4 rounded-xl border border-[#d4a020]/30 bg-[#d4a020]/5">
          <span className="text-[11px] font-semibold text-[#d4a020] uppercase tracking-wider block mb-1">
            Itens em Destaque
          </span>
          <span className="text-2xl font-black text-[#d4a020]">{totalDestaques}</span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">com borda dourada</span>
        </div>

        <div className="p-4 rounded-xl border border-pink-900/30 bg-pink-950/10">
          <span className="text-[11px] font-semibold text-pink-400 uppercase tracking-wider block mb-1">
            Combos & Artes
          </span>
          <span className="text-2xl font-black text-pink-300">{totalCombos}</span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">pacotes de produção</span>
        </div>
      </div>

      {/* ── Filtros e Barra de Pesquisa ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Categorias Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setFiltroCategoria('todos')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border',
              filtroCategoria === 'todos'
                ? 'bg-white text-black border-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            Todos
          </button>
          {Object.entries(CATEGORIAS_CONFIG).map(([catKey, cat]) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setFiltroCategoria(catKey)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border',
                filtroCategoria === catKey
                  ? 'bg-zinc-800 border-zinc-600 text-white shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Busca e Status */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 py-1.5 text-xs w-full"
            />
          </div>

          <select
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value)}
            className="input py-1.5 text-xs w-28"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>
      </div>

      {/* ── Tabela / Lista de Produtos ── */}
      {isLoading ? (
        <div className="p-12 text-center text-zinc-500 text-xs">Carregando catálogo de produtos...</div>
      ) : itens.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 p-12 text-center bg-zinc-900/30 space-y-3">
          <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">Nenhum produto encontrado</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Não há produtos cadastrados com esses filtros. Clique abaixo para cadastrar o primeiro item ou combo.
          </p>
          <button
            type="button"
            onClick={handleNovo}
            className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Cadastrar Produto / Combo
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Capa & Produto</th>
                  <th className="px-5 py-3.5 font-semibold">Categoria</th>
                  <th className="px-5 py-3.5 font-semibold">Preço</th>
                  <th className="px-5 py-3.5 font-semibold">Qtd / Benefício</th>
                  <th className="px-5 py-3.5 font-semibold">Prazo SLA</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {itens.map((item) => {
                  const catCfg = CATEGORIAS_CONFIG[item.categoria] || {
                    label: item.categoria,
                    cor: '#71717a',
                  }
                  const itemId = item.db_id || (item.id as unknown as number)

                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/25 transition-colors">
                      {/* Capa e Nome */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 rounded-lg overflow-hidden bg-black border border-zinc-700/80 flex-shrink-0 relative">
                            {item.imagem ? (
                              <img
                                src={item.imagem}
                                alt={item.nome}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <ShoppingBag className="w-4 h-4" />
                              </div>
                            )}
                            {item.destaque && (
                              <div
                                className="absolute top-0 right-0 p-0.5 rounded-bl bg-[#d4a020] text-black"
                                title="Produto em destaque"
                              >
                                <Star className="w-2.5 h-2.5 fill-current" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white truncate max-w-xs block">
                                {item.nome}
                              </span>
                              {item.badge && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-[#d4a020] border border-zinc-700">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                              {item.codigo || item.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block"
                          style={{
                            color: catCfg.cor,
                            borderColor: `${catCfg.cor}40`,
                            background: `${catCfg.cor}10`,
                          }}
                        >
                          {catCfg.label}
                        </span>
                      </td>

                      {/* Preço */}
                      <td className="px-5 py-3.5">
                        <span className="font-black text-white text-sm">
                          R$ {Number(item.valor).toFixed(2).replace('.', ',')}
                        </span>
                        {item.valor_original && Number(item.valor_original) > Number(item.valor) && (
                          <span className="text-[10px] text-zinc-500 line-through block">
                            de R$ {Number(item.valor_original).toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </td>

                      {/* Qtd Liberada */}
                      <td className="px-5 py-3.5">
                        <span className="text-zinc-200 font-semibold">
                          +{item.quantidade}{' '}
                          <span className="text-zinc-500 text-[10px] font-normal">
                            {item.categoria === 'ia'
                              ? 'análise(s)'
                              : item.categoria === 'artes' || item.categoria === 'combos'
                              ? 'arte(s)'
                              : 'serviço'}
                          </span>
                        </span>
                      </td>

                      {/* Prazo SLA */}
                      <td className="px-5 py-3.5 text-zinc-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{item.entrega_sla}</span>
                        </div>
                      </td>

                      {/* Status Ativo/Inativo */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleAtivoMutation.mutate(itemId)}
                          disabled={toggleAtivoMutation.isPending}
                          className={clsx(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer',
                            item.ativo
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                          )}
                          title="Clique para alternar ativação no catálogo"
                        >
                          {item.ativo ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ativo
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-zinc-500" /> Inativo
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEditar(item)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                          title="Editar produto / combo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluir(item)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Excluir produto do shop"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal de Criação / Edição ── */}
      {modalAberto && (
        <ModalGerenciarItemShop
          itemParaEditar={itemParaEditar}
          onClose={() => {
            setModalAberto(false)
            setItemParaEditar(null)
          }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin-shop-itens'] })
            qc.invalidateQueries({ queryKey: ['shop-itens'] })
          }}
        />
      )}
    </div>
  )
}

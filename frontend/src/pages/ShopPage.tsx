import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { shopService, ShopItem, ShopPedido } from '@/services/api'
import ModalComprarItemShop from '@/components/shop/ModalComprarItemShop'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  Sparkles,
  Palette,
  Zap,
  Box,
  Clock,
  PenTool,
  Bot,
  Cpu,
  Check,
  ShieldCheck,
  ArrowRight,
  Plus,
  Coins,
  History,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Filter,
  Layers,
  ChevronRight,
  TrendingUp,
  Package,
} from 'lucide-react'
import clsx from 'clsx'

function getItemIcon(iconName?: string) {
  switch (iconName) {
    case 'palette':
      return Palette
    case 'sparkles':
      return Sparkles
    case 'zap':
      return Zap
    case 'bot':
      return Bot
    case 'cpu':
      return Cpu
    case 'pen-tool':
      return PenTool
    case 'box':
      return Box
    case 'clock':
      return Clock
    default:
      return ShoppingBag
  }
}

const CATEGORIAS = [
  { id: 'todos', label: 'Todos os Itens' },
  { id: 'combos', label: 'Combos & Pacotes', icone: Layers },
  { id: 'artes', label: 'Artes Extras', icone: Palette },
  { id: 'ia', label: 'Créditos IA', icone: Bot },
  { id: 'servicos', label: 'Serviços de Design', icone: PenTool },
  { id: 'urgencia', label: 'Prazos & Urgência', icone: Clock },
]

export default function ShopPage() {
  const qc = useQueryClient()
  const { user, isAdmin } = useAuthStore()
  const isAdm = isAdmin()

  const [abaAtiva, setAbaAtiva] = useState<'catalogo' | 'historico' | 'admin'>('catalogo')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos')
  const [itemSelecionado, setItemSelecionado] = useState<ShopItem | null>(null)
  const [filtroStatusAdmin, setFiltroStatusAdmin] = useState<string>('')

  // Consulta catálogo e saldos
  const { data: shopData, isLoading: loadingItens } = useQuery({
    queryKey: ['shop-itens'],
    queryFn: shopService.listarItens,
  })

  // Consulta histórico de pedidos da confecção
  const { data: meusPedidos, isLoading: loadingMeusPedidos } = useQuery({
    queryKey: ['shop-pedidos'],
    queryFn: shopService.meusPedidos,
    enabled: abaAtiva === 'historico',
  })

  // Consulta todos os pedidos para o admin
  const { data: adminPedidosData, isLoading: loadingAdminPedidos } = useQuery({
    queryKey: ['admin-shop-pedidos', filtroStatusAdmin],
    queryFn: () => shopService.adminPedidos({ status: filtroStatusAdmin || undefined }),
    enabled: isAdm && abaAtiva === 'admin',
  })

  // Mutação do Admin para atualizar status
  const atualizarStatusMutation = useMutation({
    mutationFn: ({ pedidoId, status }: { pedidoId: number; status: string }) =>
      shopService.adminAtualizarStatus(pedidoId, { status }),
    onSuccess: () => {
      toast.success('Status do pedido atualizado!')
      qc.invalidateQueries({ queryKey: ['admin-shop-pedidos'] })
      qc.invalidateQueries({ queryKey: ['shop-itens'] })
    },
    onError: () => toast.error('Falha ao atualizar status.'),
  })

  const itens = shopData?.itens ?? []
  const saldo = shopData?.saldo

  const itensFiltrados =
    categoriaFiltro === 'todos'
      ? itens
      : itens.filter((i) => i.categoria === categoriaFiltro)

  return (
    <div className="min-h-full p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* ── Topo: Header & Navegação de Abas ── */}
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
              Shop de Itens e Serviços Avulsos
            </h1>
          </div>
          <p className="text-xs md:text-sm text-zinc-400 max-w-2xl">
            Adquira artes extras, créditos de IA, vetorização e mockups sob demanda com liberação imediata via Pix, sem necessidade de alterar seu plano mensal.
          </p>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 self-stretch md:self-auto overflow-x-auto max-w-full scrollbar-none">
          <button
            type="button"
            onClick={() => setAbaAtiva('catalogo')}
            className={clsx(
              'flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0',
              abaAtiva === 'catalogo'
                ? 'bg-[#d4a020] text-black shadow-md shadow-[#d4a020]/20'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Catálogo
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('historico')}
            className={clsx(
              'flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0',
              abaAtiva === 'historico'
                ? 'bg-[#d4a020] text-black shadow-md shadow-[#d4a020]/20'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <History className="w-3.5 h-3.5" />
            Minhas Compras
          </button>
          {isAdm && (
            <>
              <button
                type="button"
                onClick={() => setAbaAtiva('admin')}
                className={clsx(
                  'flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0',
                  abaAtiva === 'admin'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Pedidos Admin
              </button>
              <Link
                to="/admin/shop/produtos"
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#d4a020]/15 hover:bg-[#d4a020]/25 text-[#d4a020] border border-[#d4a020]/30 transition-all hover:scale-[1.02] whitespace-nowrap flex-shrink-0"
                title="Cadastrar, editar e organizar produtos, combos e preços"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Gerenciar Produtos</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Painel de Saldos e Status da Confecção ── */}
      {saldo && !isAdm && (
        <div
          className="rounded-2xl p-5 border relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #111111 0%, #171510 100%)',
            borderColor: '#262626',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#d4a020]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Status da sua conta
              </span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {saldo.confeccao_nome || 'Sua Confecção'}
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Ativa
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <TrendingUp className="w-4 h-4 text-[#d4a020]" />
              <span>Artes extras adquiridas ficam disponíveis sem expirar.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Cota do Plano Mensal */}
            <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">
                Plano Mensal (Uso)
              </span>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xl font-extrabold text-white">
                  {saldo.artes_usadas_mes} / {saldo.limite_mensal}
                </span>
                <span className="text-[11px] text-zinc-500">artes este mês</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (saldo.artes_usadas_mes / (saldo.limite_mensal || 1)) * 100)}%`,
                    background:
                      saldo.artes_usadas_mes >= saldo.limite_mensal
                        ? '#ef4444'
                        : saldo.artes_usadas_mes >= saldo.limite_mensal * 0.7
                        ? '#f59e0b'
                        : '#10b981',
                  }}
                />
              </div>
            </div>

            {/* Card 2: Artes Extras Disponíveis */}
            <div
              className="p-3.5 rounded-xl border bg-zinc-900/60"
              style={{
                borderColor: saldo.artes_extras > 0 ? 'rgba(212,160,32,0.4)' : '#27272a',
                background:
                  saldo.artes_extras > 0 ? 'rgba(212,160,32,0.05)' : 'rgba(24,24,27,0.6)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-zinc-400">Artes Extras (Shop)</span>
                <Palette className="w-3.5 h-3.5 text-[#d4a020]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-[#d4a020]">
                  +{saldo.artes_extras}
                </span>
                <span className="text-[11px] text-zinc-400">avulsas acumuladas</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Usadas quando a cota mensal acaba</p>
            </div>

            {/* Card 3: Total Geral de Criação de Pedidos */}
            <div className="p-3.5 rounded-xl border border-emerald-900/30 bg-emerald-950/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-emerald-400">Total Disponível</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-300">
                  {saldo.artes_disponiveis}
                </span>
                <span className="text-[11px] text-zinc-400">pedidos prontos para abrir</span>
              </div>
              <p className="text-[10px] text-emerald-400/70 mt-1">Soma de plano restante + extras</p>
            </div>

            {/* Card 4: Créditos IA */}
            <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-zinc-400">Créditos de IA</span>
                <Coins className="w-3.5 h-3.5 text-[#d4a020]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-white">{saldo.creditos_ia}</span>
                <span className="text-[11px] text-zinc-400">análises com Gemini IA</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Para revisar arte antes de enviar</p>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA 1: CATÁLOGO DO SHOP ── */}
      {abaAtiva === 'catalogo' && (
        <div className="space-y-6">
          {/* Filtros por Categoria */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIAS.map((cat) => {
              const Icon = cat.icone
              const ativo = categoriaFiltro === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaFiltro(cat.id)}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border',
                    ativo
                      ? 'bg-[#d4a020]/15 border-[#d4a020] text-[#d4a020] shadow-sm'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  )}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Grid de Itens */}
          {loadingItens ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {itensFiltrados.map((item) => {
                const ItemIcon = getItemIcon(item.icone)
                return (
                  <div
                    key={item.id}
                    className={clsx(
                      'relative rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1',
                      item.destaque
                        ? 'border-[#d4a020]/60 bg-gradient-to-b from-[#181611] to-[#101010] shadow-lg shadow-[#d4a020]/10'
                        : 'border-zinc-800/90 bg-[#111111] hover:border-zinc-700'
                    )}
                  >
                    {/* Badge Superior */}
                    {item.badge && (
                      <span
                        className={clsx(
                          'absolute -top-3 right-5 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border shadow-sm',
                          item.destaque
                            ? 'bg-[#d4a020] text-black border-[#d4a020]'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Imagem de Capa do Item */}
                    {item.imagem && (
                      <div className="relative w-full h-44 mb-4 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800/80 group">
                        <img
                          src={item.imagem}
                          alt={item.nome}
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent opacity-70 pointer-events-none" />
                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-zinc-300 font-medium">
                          <Clock className="w-3 h-3 text-[#d4a020]" />
                          <span>{item.entrega_sla}</span>
                        </div>
                      </div>
                    )}

                    <div>
                      {/* Topo do Card */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: item.destaque
                              ? 'rgba(212,160,32,0.2)'
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${
                              item.destaque ? 'rgba(212,160,32,0.4)' : '#27272a'
                            }`,
                          }}
                        >
                          <ItemIcon
                            className="w-5 h-5"
                            style={{ color: item.destaque ? '#d4a020' : '#a1a1aa' }}
                          />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white leading-tight">
                            {item.nome}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span className="text-[11px] text-zinc-400 font-medium">
                              {item.entrega_sla}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Descrição */}
                      <p className="text-xs text-zinc-400 leading-relaxed mb-5 min-h-[36px]">
                        {item.descricao}
                      </p>

                      {/* Itens Inclusos */}
                      <div className="space-y-2 mb-6 pt-4 border-t border-zinc-800/70">
                        {item.itens_inclusos.map((inc, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="leading-snug">{inc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preço e Botão de Ação */}
                    <div className="pt-4 border-t border-zinc-800/80">
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          {item.valor_original && item.valor_original > item.valor ? (
                            <span className="text-xs text-zinc-500 line-through block">
                              de R$ {item.valor_original.toFixed(2).replace('.', ',')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-500 block">Investimento único</span>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-semibold text-zinc-400">R$</span>
                            <span className="text-2xl font-black text-white">
                              {item.valor.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-zinc-500 font-medium bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                          Pix Automático
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setItemSelecionado(item)}
                        className={clsx(
                          'w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all',
                          item.destaque
                            ? 'bg-[#d4a020] text-black hover:bg-[#e0ad26] shadow-md shadow-[#d4a020]/20'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                        )}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Adquirir com Pix
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA 2: MINHAS COMPRAS DO SHOP ── */}
      {abaAtiva === 'historico' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#d4a020]" />
              Suas aquisições e comprovantes
            </h2>
            <span className="text-xs text-zinc-500">
              {meusPedidos?.length ?? 0} compra(s) registrada(s)
            </span>
          </div>

          {loadingMeusPedidos ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Carregando histórico...</div>
          ) : !meusPedidos || meusPedidos.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 p-12 text-center bg-zinc-900/30 space-y-3">
              <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">Nenhum item avulso adquirido ainda</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Quando você comprar artes extras, créditos ou serviços avulsos, os recibos e status aparecerão aqui.
              </p>
              <button
                type="button"
                onClick={() => setAbaAtiva('catalogo')}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                Explorar Catálogo do Shop
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-900/50">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[580px]">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Item Adquirido</th>
                      <th className="px-5 py-3.5 font-semibold">Categoria</th>
                      <th className="px-5 py-3.5 font-semibold">Valor</th>
                      <th className="px-5 py-3.5 font-semibold">Data</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {meusPedidos.map((ped) => {
                      const statusPago = ped.status === 'pago' || ped.status === 'concluido'
                      return (
                        <tr key={ped.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-5 py-4 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{ped.item_nome}</span>
                              {ped.quantidade > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                  {ped.quantidade}x
                                </span>
                              )}
                            </div>
                            {ped.detalhes && (
                              <span className="text-[10px] text-zinc-400 block mt-0.5 max-w-md truncate">
                                {ped.detalhes}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-zinc-400 uppercase text-[10px] font-semibold">
                            {ped.categoria}
                          </td>
                          <td className="px-5 py-4 font-bold text-white">
                            R$ {Number(ped.valor_total).toFixed(2).replace('.', ',')}
                          </td>
                          <td className="px-5 py-4 text-zinc-400">
                            {new Date(ped.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-5 py-4">
                            {statusPago ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Liberado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" /> Aguardando Pix
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {!statusPago && (
                              <button
                                type="button"
                                onClick={() => {
                                  const found = itens.find((i) => i.id === ped.item_id)
                                  if (found) setItemSelecionado(found)
                                }}
                                className="text-[11px] font-bold text-[#d4a020] hover:underline"
                              >
                                Pagar Pix
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA 3: GESTÃO DO ADMIN ── */}
      {isAdm && abaAtiva === 'admin' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Painel do Administrador · Pedidos do Shop
              </h2>
              <p className="text-xs text-zinc-400">
                Visualize todos os pagamentos e pedidos de itens avulsos feitos pelas confecções.
              </p>
            </div>

            {/* Filtro de Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Filtrar:</span>
              <select
                value={filtroStatusAdmin}
                onChange={(e) => setFiltroStatusAdmin(e.target.value)}
                className="input text-xs py-1.5 px-3"
              >
                <option value="">Todos os status</option>
                <option value="pendente">Pendentes</option>
                <option value="pago">Pagos (A liberar)</option>
                <option value="concluido">Concluídos</option>
              </select>
            </div>
          </div>

          {loadingAdminPedidos ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Carregando pedidos gerais...</div>
          ) : !adminPedidosData?.data || adminPedidosData.data.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 p-12 text-center bg-zinc-900/30">
              <p className="text-xs text-zinc-400">Nenhum pedido encontrado para este filtro.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-900/50">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">ID</th>
                      <th className="px-5 py-3.5 font-semibold">Confecção / Usuário</th>
                      <th className="px-5 py-3.5 font-semibold">Item & Qtd</th>
                      <th className="px-5 py-3.5 font-semibold">Valor</th>
                      <th className="px-5 py-3.5 font-semibold">Data</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Ação Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {adminPedidosData.data.map((ped: ShopPedido) => (
                      <tr key={ped.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-4 font-mono text-zinc-400">#{ped.id}</td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-white block">
                            {ped.confeccao?.nome || ped.user?.name || 'Cliente'}
                          </span>
                          <span className="text-[10px] text-zinc-500">{ped.user?.email}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-zinc-200 block">{ped.item_nome}</span>
                          {ped.detalhes && (
                            <span className="text-[10px] text-zinc-400 block max-w-xs truncate">
                              {ped.detalhes}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-bold text-white">
                          R$ {Number(ped.valor_total).toFixed(2).replace('.', ',')}
                        </td>
                        <td className="px-5 py-4 text-zinc-400">
                          {new Date(ped.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                              ped.status === 'concluido'
                               ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                               : ped.status === 'pago'
                               ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                               : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            )}
                          >
                            {ped.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right space-x-1.5">
                          {ped.status === 'pendente' && (
                            <button
                              type="button"
                              onClick={() =>
                                atualizarStatusMutation.mutate({
                                  pedidoId: ped.id,
                                  status: 'pago',
                                })
                              }
                              className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Aprovar Pix
                            </button>
                          )}
                          {ped.status === 'pago' && (
                            <button
                              type="button"
                              onClick={() =>
                                atualizarStatusMutation.mutate({
                                  pedidoId: ped.id,
                                  status: 'concluido',
                                })
                              }
                              className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                            >
                              Concluir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de Compra e Pagamento Pix ── */}
      {itemSelecionado && (
        <ModalComprarItemShop
          item={itemSelecionado}
          onClose={() => setItemSelecionado(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['shop-itens'] })
            qc.invalidateQueries({ queryKey: ['shop-pedidos'] })
          }}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { 
  Search, 
  Package, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  MessageCircle, 
  ArrowLeft, 
  Sparkles, 
  AlertCircle,
  Eye,
  Layers,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar
} from 'lucide-react'
import { rastreioService } from '@/services/api'
import toast from 'react-hot-toast'

interface PedidoRastreio {
  id: number
  titulo: string
  tipo_impressao: string
  status: string
  status_label: string
  prazo: string | null
  prazo_formatado: string | null
  esta_atrasado: boolean
  token_aprovacao: string
  link_aprovacao: string
  observacoes: string | null
  progresso: number
  created_at: string
  confeccao_nome: string | null
  preview_url: string | null
  tem_arte: boolean
}

interface ClienteInfo {
  nome: string
  tipo: 'confeccao' | 'cliente'
  plano?: string
  telefone: string
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; step: number; color: string }> = {
  aguardando_briefing:  { label: 'Aguardando Briefing', badge: 'bg-zinc-800 text-zinc-300 border-zinc-700', step: 1, color: '#a1a1aa' },
  em_producao:          { label: 'Em Produção',         badge: 'bg-amber-950/70 text-amber-300 border-amber-800/80', step: 2, color: '#f59e0b' },
  aguardando_aprovacao: { label: 'Aguardando Aprovação',badge: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/80', step: 3, color: '#818cf8' },
  aprovado:             { label: 'Arte Aprovada',       badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80', step: 4, color: '#34d399' },
  finalizado:           { label: 'Finalizado',          badge: 'bg-teal-950/70 text-teal-300 border-teal-800/80', step: 5, color: '#2dd4bf' },
  cancelado:            { label: 'Cancelado',           badge: 'bg-red-950/70 text-red-300 border-red-800/80', step: 0, color: '#f87171' },
}

const STEPS = [
  { label: 'Briefing', desc: 'Dados e referências recebidos' },
  { label: 'Criação', desc: 'Designers desenvolvendo a arte' },
  { label: 'Aprovação', desc: 'Pronta para sua validação' },
  { label: 'Aprovada', desc: 'Arte aprovada para estampar' },
  { label: 'Concluído', desc: 'Arquivos finais entregues' },
]

export default function RastreioPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [telefone, setTelefone] = useState(searchParams.get('tel') || '')
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [pedidos, setPedidos] = useState<PedidoRastreio[]>([])
  const [cliente, setCliente] = useState<ClienteInfo | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Aplica máscara automática de telefone (BR)
  function formatarTelefone(valor: string) {
    const d = valor.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d ? `(${d}` : ''
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
  }

  function handleTelefoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTelefone(formatarTelefone(e.target.value))
  }

  async function handleBuscar(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const limpo = telefone.replace(/\D/g, '')
    if (limpo.length < 8) {
      toast.error('Digite seu número de telefone com DDD (Ex: 81 98888-7777)')
      return
    }

    setLoading(true)
    setBuscado(true)
    setSearchParams({ tel: telefone })

    try {
      const res = await rastreioService.buscar(limpo)
      if (res.encontrado) {
        setPedidos(res.pedidos || [])
        setCliente(res.cliente || null)
      } else {
        setPedidos([])
        setCliente(null)
        toast(res.mensagem || 'Nenhum pedido encontrado.', { icon: '🔍' })
      }
    } catch (err: any) {
      setPedidos([])
      setCliente(null)
      const msg = err.response?.data?.mensagem || 'Erro ao consultar pedidos. Tente novamente.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const telUrl = searchParams.get('tel')
    if (telUrl && telUrl.replace(/\D/g, '').length >= 8) {
      handleBuscar()
    }
  }, [])

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroStatus === 'todos') return true
    if (filtroStatus === 'producao') return p.status === 'em_producao' || p.status === 'aguardando_briefing'
    if (filtroStatus === 'aprovacao') return p.status === 'aguardando_aprovacao'
    if (filtroStatus === 'concluidos') return p.status === 'aprovado' || p.status === 'finalizado'
    return true
  })

  const whatsappAdmin = '5581987624556' // WhatsApp comercial do sistema

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0c', color: '#e4e4e7' }}>
      {/* Topbar Pública */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 backdrop-blur-md bg-[#0a0a0c]/85">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4a020] to-[#996b00] flex items-center justify-center font-black text-black text-sm shadow-md shadow-[#d4a020]/20">
              CD
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm tracking-tight group-hover:text-[#d4a020] transition-colors">
                Camiseta Design
              </span>
              <span className="text-[10px] text-zinc-500 -mt-1 tracking-wider uppercase font-mono">
                Portal de Rastreio
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/portfolio"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
            >
              Catálogo de Artes
            </Link>
            <Link
              to="/login"
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white transition-all bg-zinc-900/60"
            >
              Entrar no Painel
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 sm:py-12 w-full space-y-8">
        
        {/* Hero de Busca */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-[#d4a020]/30 bg-[#d4a020]/10 text-[#d4a020]">
            <Sparkles className="w-3.5 h-3.5" /> Acompanhamento Online de Pedidos
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Consulte seus Pedidos e Artes
          </h1>
          <p className="text-sm sm:text-base text-zinc-400">
            Digite seu WhatsApp ou telefone cadastrado para visualizar o andamento dos seus pedidos, conferir prévias e aprovar modelos em 1 clique.
          </p>

          {/* Form de Consulta */}
          <form onSubmit={handleBuscar} className="pt-4 max-w-md mx-auto">
            <div className="relative flex items-center">
              <input
                type="tel"
                value={telefone}
                onChange={handleTelefoneChange}
                placeholder="(81) 98888-7777"
                className="w-full bg-[#141417] border-2 border-zinc-800 focus:border-[#d4a020] rounded-xl px-4 py-3.5 text-base sm:text-lg text-white placeholder-zinc-600 focus:outline-none transition-all shadow-inner font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm bg-[#d4a020] hover:bg-[#b88610] text-black transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-[#d4a020]/20"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Rastrear</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              🔒 Não precisa de login ou senha. Usamos o número de WhatsApp cadastrado.
            </p>
          </form>
        </div>

        {/* Resultados */}
        {buscado && (
          <div className="space-y-6 pt-4 animate-fadeIn">
            {pedidos.length > 0 ? (
              <>
                {/* Card de Boas-vindas ao Cliente / Confecção */}
                <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-gradient-to-r from-[#141417] to-[#1a1a20] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#d4a020]/15 border border-[#d4a020]/30 flex items-center justify-center text-[#d4a020]">
                      {cliente?.tipo === 'confeccao' ? (
                        <Building2 className="w-6 h-6" />
                      ) : (
                        <Package className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white">
                          {cliente?.nome || 'Seus Pedidos'}
                        </h2>
                        {cliente?.tipo === 'confeccao' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4a020]/20 text-[#d4a020] border border-[#d4a020]/40 uppercase">
                            Confecção Parceira
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {pedidos.length} {pedidos.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'} no sistema
                      </p>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/${whatsappAdmin}?text=${encodeURIComponent(`Olá! Estou acompanhando meus pedidos como ${cliente?.nome || 'cliente'}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/60 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Falar no WhatsApp</span>
                  </a>
                </div>

                {/* Filtros rápidos */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'todos', label: `Todos (${pedidos.length})` },
                    { id: 'producao', label: `Em Produção (${pedidos.filter(p => p.status === 'em_producao' || p.status === 'aguardando_briefing').length})` },
                    { id: 'aprovacao', label: `Aguardando Aprovação (${pedidos.filter(p => p.status === 'aguardando_aprovacao').length})` },
                    { id: 'concluidos', label: `Concluídos (${pedidos.filter(p => p.status === 'aprovado' || p.status === 'finalizado').length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFiltroStatus(f.id)}
                      className={`px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap border ${
                        filtroStatus === f.id
                          ? 'bg-[#d4a020] text-black border-[#d4a020] font-bold shadow'
                          : 'bg-[#141417] text-zinc-400 border-zinc-800 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Lista de Cards de Pedidos */}
                <div className="space-y-5">
                  {pedidosFiltrados.map((p) => {
                    const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.aguardando_briefing
                    const isAguardandoAprovacao = p.status === 'aguardando_aprovacao'

                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-zinc-800 bg-[#121215] overflow-hidden hover:border-zinc-700 transition-all shadow-lg"
                      >
                        {/* Topo do Card */}
                        <div className="p-4 sm:p-6 border-b border-zinc-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-xs font-bold text-zinc-500">
                                #{p.id}
                              </span>
                              <h3 className="text-base sm:text-lg font-bold text-white">
                                {p.titulo}
                              </h3>
                              <span className={`badge border text-[11px] font-semibold ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                              <span>Impressão: <strong className="text-zinc-300 capitalize">{p.tipo_impressao}</strong></span>
                              <span>•</span>
                              <span>Criado em: <strong className="text-zinc-300">{p.created_at}</strong></span>
                              {p.confeccao_nome && (
                                <>
                                  <span>•</span>
                                  <span>Confecção: <strong className="text-zinc-300">{p.confeccao_nome}</strong></span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Prazo */}
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-400">Prazo Estimado:</span>
                            <span className={`font-semibold ${p.esta_atrasado ? 'text-red-400 font-bold' : 'text-zinc-200'}`}>
                              {p.prazo_formatado || 'Em definição'}
                              {p.esta_atrasado && ' (Atrasado)'}
                            </span>
                          </div>
                        </div>

                        {/* Corpo: Progresso e Ações */}
                        <div className="p-4 sm:p-6 space-y-6">
                          
                          {/* Stepper visual de etapas */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                Etapa do Pedido
                              </span>
                              <span className="text-xs font-bold font-mono" style={{ color: cfg.color }}>
                                {p.progresso}% Concluído
                              </span>
                            </div>

                            {/* Barra de progresso */}
                            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden mb-5">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${p.progresso}%`, background: cfg.color }}
                              />
                            </div>

                            {/* Passos horizontais */}
                            <div className="grid grid-cols-5 gap-1 sm:gap-2">
                              {STEPS.map((s, idx) => {
                                const stepNum = idx + 1
                                const isCurrent = cfg.step === stepNum
                                const isCompleted = cfg.step > stepNum || p.status === 'aprovado' || p.status === 'finalizado'

                                return (
                                  <div key={s.label} className="flex flex-col items-center text-center">
                                    <div
                                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-all ${
                                        isCompleted
                                          ? 'bg-emerald-500 text-black'
                                          : isCurrent
                                          ? 'bg-[#d4a020] text-black ring-4 ring-[#d4a020]/20'
                                          : 'bg-zinc-800 text-zinc-500'
                                      }`}
                                    >
                                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                                    </div>
                                    <span className={`text-[10px] sm:text-xs font-semibold ${
                                      isCurrent ? 'text-white' : isCompleted ? 'text-zinc-300' : 'text-zinc-600'
                                    }`}>
                                      {s.label}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Se estiver aguardando aprovação, dá destaque total */}
                          {isAguardandoAprovacao && (
                            <div className="p-4 sm:p-5 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="space-y-1 text-center sm:text-left">
                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                                  <Sparkles className="w-3.5 h-3.5" /> Arte Pronta para Sua Aprovação!
                                </div>
                                <p className="text-xs sm:text-sm text-zinc-300">
                                  Nosso designer finalizou o mockup. Clique abaixo para abrir a arte em alta resolução e aprovar ou solicitar ajustes online.
                                </p>
                              </div>

                              <Link
                                to={p.link_aprovacao}
                                className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-[#d4a020] to-[#e6b432] text-black hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#d4a020]/20 shrink-0"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Ver e Aprovar Arte Online</span>
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </div>
                          )}

                          {/* Se já foi aprovado */}
                          {(p.status === 'aprovado' || p.status === 'finalizado') && (
                            <div className="p-3.5 rounded-xl border border-emerald-800/40 bg-emerald-950/20 flex items-center justify-between gap-3 text-xs text-emerald-300">
                              <div className="flex items-center gap-2.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>Arte aprovada com sucesso! Arquivos em preparação para estampagem e entrega.</span>
                              </div>
                              <Link
                                to={p.link_aprovacao}
                                className="underline hover:text-white shrink-0"
                              >
                                Ver Aprovação
                              </Link>
                            </div>
                          )}

                          {/* Detalhes / Observações */}
                          {p.observacoes && (
                            <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 text-xs text-zinc-400">
                              <span className="font-semibold text-zinc-300 block mb-1">Observações do Pedido:</span>
                              <p className="whitespace-pre-line leading-relaxed">{p.observacoes}</p>
                            </div>
                          )}

                          {/* Miniatura da arte (se houver) */}
                          {p.preview_url && (
                            <div className="flex items-center gap-3 pt-1">
                              <div className="w-16 h-16 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                                <img
                                  src={p.preview_url}
                                  alt={p.titulo}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs font-semibold text-zinc-300 block">
                                  Prévia da Arte
                                </span>
                                <Link
                                  to={p.link_aprovacao}
                                  className="text-xs text-[#d4a020] hover:underline flex items-center gap-1"
                                >
                                  <span>Visualizar em tela cheia</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          )}

                          {/* Rodapé do card: Ação secundária WhatsApp */}
                          <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                            <span className="text-zinc-500">
                              Dúvidas sobre este pedido?
                            </span>
                            <a
                              href={`https://wa.me/${whatsappAdmin}?text=${encodeURIComponent(`Olá! Gostaria de informações sobre o pedido #${p.id} (${p.titulo}).`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Falar com designer sobre #{p.id}</span>
                            </a>
                          </div>

                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              /* Nenhum pedido encontrado para o número */
              <div className="text-center p-8 sm:p-12 rounded-2xl border border-zinc-800 bg-[#121215] space-y-4 max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center mx-auto text-zinc-500">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Nenhum pedido encontrado</h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    Não encontramos pedidos vinculados ao número <strong>{telefone}</strong>. Verifique se incluiu o DDD correto ou entre em contato com nossa equipe.
                  </p>
                </div>
                <div className="pt-2">
                  <a
                    href={`https://wa.me/${whatsappAdmin}?text=${encodeURIComponent(`Olá! Tentei rastrear meu pedido pelo número ${telefone} mas não encontrei. Poderiam me ajudar?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-900/30"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Falar no WhatsApp com Atendente</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer Simples */}
      <footer className="border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Camiseta Design. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-zinc-300 transition-colors">Início</Link>
            <Link to="/portfolio" className="hover:text-zinc-300 transition-colors">Portfólio</Link>
            <Link to="/login" className="hover:text-zinc-300 transition-colors">Área do Cliente</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

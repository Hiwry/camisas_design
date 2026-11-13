import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { grupoService } from '@/services/grupoService'
import { useAuthStore } from '@/store/authStore'
import { resolveMediaUrl } from '@/lib/url'
import GradeProducao from '@/components/grupos/GradeProducao'
import LinhaDoTempoGrupo from '@/components/grupos/LinhaDoTempoGrupo'
import SolicitacoesForaPrazoModal from '@/components/grupos/SolicitacoesForaPrazoModal'
import GrupoCriarEditarModal from './GrupoCriarEditarModal'
import {
  Users2,
  Calendar,
  Clock,
  Shirt,
  DollarSign,
  Copy,
  Share2,
  Lock,
  Unlock,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  MessageCircle,
  FileSpreadsheet,
  Settings,
  History,
  Layers,
  Search,
  Ruler,
  AlertCircle,
  ArrowLeft,
  Upload,
  Key,
  FileDown,
  User,
  Phone,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Grupo, GrupoParticipante } from '@/types/grupo'

export default function GrupoAdminDetalhe() {
  const { id } = useParams<{ id: string }>()
  const grupoId = Number(id)
  const queryClient = useQueryClient()
  const { user, isAdmin } = useAuthStore()

  const [abaAtiva, setAbaAtiva] = useState<'participantes' | 'producao' | 'solicitacoes' | 'config' | 'logs'>('participantes')
  const [busca, setBusca] = useState('')
  const [filtroPagamento, setFiltroPagamento] = useState('todos')
  const [filtroModelo, setFiltroModelo] = useState('')
  const [filtroTamanho, setFiltroTamanho] = useState('')

  // Modais
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showSolicitacoesModal, setShowSolicitacoesModal] = useState(false)
  const [participantePagamento, setParticipantePagamento] = useState<GrupoParticipante | null>(null)
  const [pagamentoValor, setPagamentoValor] = useState('')
  const [pagamentoForma, setPagamentoForma] = useState('PIX')
  const [pagamentoData, setPagamentoData] = useState(new Date().toISOString().slice(0, 10))
  const [pagamentoObs, setPagamentoObs] = useState('')
  const [loadingPagamento, setLoadingPagamento] = useState(false)

  // Participante edição modal
  const [participanteParaEditar, setParticipanteParaEditar] = useState<GrupoParticipante | null>(null)

  // Query dos dados do grupo
  const { data: grupo, isLoading, refetch } = useQuery({
    queryKey: ['grupo-detalhe', grupoId],
    queryFn: () => grupoService.buscar(grupoId),
    enabled: !!grupoId,
  })

  // Query dos dados de produção
  const { data: dadosProducao, refetch: refetchProducao } = useQuery({
    queryKey: ['grupo-producao', grupoId],
    queryFn: () => grupoService.totaisProducao(grupoId),
    enabled: !!grupoId && (abaAtiva === 'producao' || abaAtiva === 'participantes'),
  })

  if (isLoading || !grupo) {
    return (
      <div className="p-8 text-center text-zinc-500 text-sm">
        Carregando detalhes do grupo...
      </div>
    )
  }

  // Filtragem de participantes
  const participantesFiltrados = (grupo.participantes || []).filter((p) => {
    if (busca) {
      const b = busca.toLowerCase()
      const matchNome = p.nome_completo.toLowerCase().includes(b)
      const matchCamisa = (p.nome_camisa || '').toLowerCase().includes(b)
      const matchNum = (p.numero_camisa || '').includes(b)
      if (!matchNome && !matchCamisa && !matchNum) return false
    }
    if (filtroPagamento !== 'todos' && p.status_pagamento !== filtroPagamento) {
      return false
    }
    if (filtroModelo && p.modelo?.nome !== filtroModelo) {
      return false
    }
    if (filtroTamanho && p.tamanho !== filtroTamanho) {
      return false
    }
    return true
  })

  // Ações de Confirmação / Reabertura
  async function handleConfirmarGrupo() {
    if (!confirm('Deseja confirmar e travar o grupo? Nenhum participante poderá mais editar ou preencher dados diretamente.')) return
    try {
      await grupoService.confirmar(grupoId)
      toast.success('Grupo confirmado e travado com sucesso!')
      refetch()
    } catch {
      toast.error('Erro ao confirmar grupo.')
    }
  }

  async function handleReabrirGrupo() {
    if (!confirm('Deseja reabrir o grupo para edições?')) return
    try {
      await grupoService.reabrir(grupoId)
      toast.success('Grupo reaberto!')
      refetch()
    } catch {
      toast.error('Erro ao reabrir grupo.')
    }
  }

  // Registrar Pagamento
  async function handleSalvarPagamento(e: React.FormEvent) {
    e.preventDefault()
    if (!participantePagamento) return
    const valorNum = Number(pagamentoValor)
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setLoadingPagamento(true)
    try {
      await grupoService.registrarPagamento(grupoId, participantePagamento.id, {
        valor: valorNum,
        forma_pagamento: pagamentoForma,
        data_pagamento: pagamentoData,
        observacao: pagamentoObs,
      })
      toast.success('Pagamento registrado com sucesso!')
      setParticipantePagamento(null)
      setPagamentoValor('')
      setPagamentoObs('')
      refetch()
    } catch {
      toast.error('Erro ao registrar pagamento.')
    } finally {
      setLoadingPagamento(false)
    }
  }

  // Excluir Pagamento
  async function handleExcluirPagamento(participanteId: number, pagamentoId: number) {
    if (!confirm('Deseja remover este pagamento?')) return
    try {
      await grupoService.excluirPagamento(grupoId, participanteId, pagamentoId)
      toast.success('Pagamento removido.')
      refetch()
    } catch {
      toast.error('Erro ao remover pagamento.')
    }
  }

  // Excluir Participante
  async function handleExcluirParticipante(p: GrupoParticipante) {
    if (!confirm(`Deseja excluir o participante "${p.nome_completo}"?`)) return
    try {
      await grupoService.excluirParticipante(grupoId, p.id)
      toast.success('Participante excluído.')
      refetch()
      refetchProducao()
    } catch {
      toast.error('Erro ao excluir participante.')
    }
  }

  // Cobrar via WhatsApp
  function handleCobrarWhatsApp(p: GrupoParticipante) {
    if (!p.whatsapp) {
      toast.error('Participante não cadastrou WhatsApp.')
      return
    }
    const cleanPhone = p.whatsapp.replace(/\D/g, '')
    const valorPendente = (p.valor_total - (p.pagamentos || []).reduce((acc, pg) => acc + pg.valor, 0)).toFixed(2).replace('.', ',')
    const texto = `Olá ${p.nome_completo}, tudo bem? Estou passando para lembrar sobre o pagamento da sua camiseta do grupo *"${grupo?.nome}"*. O valor pendente é de *R$ ${valorPendente}*. Me avise assim que puder!`
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(texto)}`, '_blank')
  }

  // Enviar Tabela de Medidas (Admin)
  async function handleUploadTabelaMedidas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('tabela_medidas', file)
    try {
      await grupoService.salvarTabelaMedidas(grupoId, formData)
      toast.success('Tabela de medidas atualizada!')
      refetch()
    } catch {
      toast.error('Erro ao enviar tabela de medidas.')
    }
  }

  const pendentesSolicitacoes = (grupo.solicitacoes || []).filter((s) => s.status === 'pendente')
  const percentualPago = grupo.total_previsto && grupo.total_previsto > 0
    ? Math.round(((grupo.total_pago || 0) / grupo.total_previsto) * 100)
    : 0
  const podeGerenciar = isAdmin() || (user?.id === grupo.user_id)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Topo / Voltar */}
      <div className="flex items-center justify-between">
        <Link
          to="/grupos"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para lista de grupos
        </Link>

        <div className="flex items-center gap-2">
          {grupo.senha_acesso && (
            <div
              onClick={() => {
                navigator.clipboard.writeText(grupo.senha_acesso!)
                toast.success(`Senha ${grupo.senha_acesso} copiada!`)
              }}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold hover:bg-amber-500/25 transition"
              title="Clique para copiar a senha de acesso"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Senha: {grupo.senha_acesso}
            </div>
          )}

          <button
            onClick={() => {
              const url = `${window.location.origin}/grupo/${grupo.token}?senha=${grupo.senha_acesso || ''}`
              navigator.clipboard.writeText(url)
              toast.success('Link com senha copiado!')
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar Link com Senha
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/grupo/${grupo.token}?senha=${grupo.senha_acesso || ''}`
              const texto = `Fala turma! Acesse o link para preencher seu pedido do grupo *"${grupo.nome}"*:\n\n${url}\n\n🔑 *Senha de acesso:* ${grupo.senha_acesso || ''}`
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank')
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp
          </button>
          <button
            onClick={() => grupoService.baixarPdf(grupoId, grupo.nome)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-xs font-semibold transition"
            title="Baixar Ordem de Produção em PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            Baixar PDF
          </button>
        </div>
      </div>

      {/* Card Principal de Resumo */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{grupo.nome}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {grupo.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mt-1.5">
              {(grupo.cliente_nome || grupo.user?.name) && (
                <span className="flex items-center gap-1 text-amber-300 font-medium">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  Cliente: <strong className="text-white">{grupo.cliente_nome || grupo.user?.name}</strong>
                  {grupo.cliente_whatsapp && (
                    <a
                      href={`https://wa.me/55${grupo.cliente_whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 ml-1 inline-flex items-center gap-0.5 underline text-[11px]"
                      title="Chamar no WhatsApp"
                    >
                      <Phone className="w-3 h-3" />
                      {grupo.cliente_whatsapp}
                    </a>
                  )}
                </span>
              )}
              {grupo.confeccao?.nome && (
                <span className="text-zinc-400">
                  Confecção: <strong className="text-zinc-200">{grupo.confeccao.nome}</strong>
                </span>
              )}
              <span>
                Prazo: <strong className="text-zinc-200">{new Date(grupo.prazo_limite).toLocaleDateString('pt-BR')}</strong>
              </span>
              <span>
                Total de peças: <strong className="text-amber-400">{grupo.total_pecas || 0}</strong>
              </span>
            </div>
          </div>

          {/* Botões de Ação */}
          {podeGerenciar && (
            <div className="flex items-center gap-2">
              {grupo.status === 'aberto' ? (
                <button
                  onClick={handleConfirmarGrupo}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition shadow-lg shadow-amber-500/10"
                >
                  <Lock className="w-4 h-4" />
                  Confirmar e Travar Grupo
                </button>
              ) : (
                <button
                  onClick={handleReabrirGrupo}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-zinc-800 text-zinc-200 hover:text-white transition"
                >
                  <Unlock className="w-4 h-4" />
                  Reabrir Inscrições
                </button>
              )}
              <button
                onClick={() => setShowConfigModal(true)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition"
                title="Configurações do Grupo"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-800">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">Total Previsto</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              R$ {Number(grupo.total_previsto || 0).toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">Total Recebido</span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
              R$ {Number(grupo.total_pago || 0).toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">Total Pendente</span>
            <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
              R$ {Number(grupo.total_pendente || 0).toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">% Pago</span>
            <div className="text-lg font-bold text-yellow-400 font-mono mt-0.5">
              {percentualPago}%
            </div>
          </div>
        </div>
      </div>

      {/* Linha do Tempo Visual */}
      <LinhaDoTempoGrupo
        status={grupo.status}
        datasStatus={grupo.datas_status}
        fotoCamisaPronta={grupo.foto_camisa_pronta}
      />

      {/* Navegação por Abas */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setAbaAtiva('participantes')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
            abaAtiva === 'participantes'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Users2 className="w-4 h-4" />
          Participantes ({grupo.participantes?.length || 0})
        </button>

        <button
          onClick={() => setAbaAtiva('producao')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
            abaAtiva === 'producao'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Shirt className="w-4 h-4" />
          Totais & Separação
        </button>

        {podeGerenciar && (
          <button
            onClick={() => setAbaAtiva('solicitacoes')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              abaAtiva === 'solicitacoes'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Solicitações Fora do Prazo
            {pendentesSolicitacoes.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-bold">
                {pendentesSolicitacoes.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setAbaAtiva('logs')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
            abaAtiva === 'logs'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          Histórico & Auditoria
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* ABA 1: Participantes & Pagamentos */}
      {abaAtiva === 'participantes' && (
        <div className="space-y-4">
          
          {/* Filtros da Tabela */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por nome ou número..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="input pl-9 text-xs"
              />
            </div>

            <select
              value={filtroPagamento}
              onChange={(e) => setFiltroPagamento(e.target.value)}
              className="input text-xs"
            >
              <option value="todos">Todos os pagamentos</option>
              <option value="pendente">Pendente</option>
              <option value="parcial">Parcial</option>
              <option value="pago">Pago</option>
            </select>

            <select
              value={filtroModelo}
              onChange={(e) => setFiltroModelo(e.target.value)}
              className="input text-xs"
            >
              <option value="">Todos os modelos</option>
              {(grupo.modelos || []).map((m) => (
                <option key={m.id} value={m.nome}>{m.nome}</option>
              ))}
            </select>

            <select
              value={filtroTamanho}
              onChange={(e) => setFiltroTamanho(e.target.value)}
              className="input text-xs"
            >
              <option value="">Todos os tamanhos</option>
              {(grupo.tamanhos_disponiveis || []).map((t) => (
                <option key={t.tamanho} value={t.tamanho}>{t.tamanho}</option>
              ))}
            </select>
          </div>

          {/* Tabela de Participantes */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Participante</th>
                    <th className="px-4 py-3">Modelo / Cor / Tam</th>
                    <th className="px-4 py-3">Nome / Número</th>
                    <th className="px-4 py-3 text-right">Valor Total</th>
                    <th className="px-4 py-3 text-right">Pago</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {participantesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-zinc-500">
                        Nenhum participante encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    participantesFiltrados.map((p) => {
                      const totalPago = (p.pagamentos || []).reduce((acc, pg) => acc + pg.valor, 0)
                      const saldoDevedor = Math.max(0, p.valor_total - totalPago)

                      return (
                        <tr key={p.id} className="hover:bg-zinc-950/40">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{p.nome_completo}</div>
                            {p.whatsapp && (
                              <div className="text-[11px] text-zinc-400 font-mono">{p.whatsapp}</div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-zinc-200 font-medium">{p.modelo?.nome || 'Padrão'}</div>
                            <div className="text-[11px] text-zinc-400">
                              Cor: {p.cor} • Tam: <strong className="text-amber-400">{p.tamanho}</strong> (Qtd: {p.quantidade})
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {p.nome_camisa ? (
                              <div className="font-semibold text-zinc-200 uppercase">"{p.nome_camisa}"</div>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                            {p.numero_camisa && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono font-bold text-[10px]">
                                #{p.numero_camisa}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-200">
                            R$ {Number(p.valor_total).toFixed(2).replace('.', ',')}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                            R$ {totalPago.toFixed(2).replace('.', ',')}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                p.status_pagamento === 'pago'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : p.status_pagamento === 'parcial'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {p.status_pagamento}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Registrar Pagamento */}
                              <button
                                onClick={() => {
                                  setParticipantePagamento(p)
                                  setPagamentoValor(saldoDevedor > 0 ? String(saldoDevedor) : '')
                                }}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
                                title="Registrar Pagamento"
                              >
                                Pagar
                              </button>

                              {/* Cobrar via WhatsApp se pendente */}
                              {p.status_pagamento !== 'pago' && p.whatsapp && (
                                <button
                                  onClick={() => handleCobrarWhatsApp(p)}
                                  className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition"
                                  title="Cobrar via WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              )}

                              {/* Excluir */}
                              <button
                                onClick={() => handleExcluirParticipante(p)}
                                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Excluir Participante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: Totais de Produção & Separação */}
      {abaAtiva === 'producao' && dadosProducao && (
        <GradeProducao
          dados={dadosProducao}
          onExportarCsv={() => {
            grupoService.baixarCsv(grupoId, grupo.nome)
          }}
          onExportarPdf={() => {
            grupoService.baixarPdf(grupoId, grupo.nome)
          }}
        />
      )}

      {/* ABA 3: Solicitações Fora do Prazo */}
      {abaAtiva === 'solicitacoes' && (
        <div className="space-y-4">
          <SolicitacoesForaPrazoModal
            solicitacoes={grupo.solicitacoes || []}
            statusGrupo={grupo.status}
            onAvaliar={async (solId, acao, resp) => {
              await grupoService.avaliarSolicitacao(grupoId, solId, { acao, resposta: resp })
              refetch()
              refetchProducao()
            }}
            onClose={() => setAbaAtiva('participantes')}
          />
        </div>
      )}

      {/* ABA 4: Logs e Auditoria */}
      {abaAtiva === 'logs' && (
        <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            Registro de Alterações e Auditoria
          </h4>

          <div className="space-y-3">
            {(grupo.logs || []).map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs flex items-start justify-between gap-4">
                <div>
                  <span className="font-semibold text-zinc-200">{log.descricao}</span>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    Realizado por: <strong className="text-zinc-400">{log.user?.name || 'Sistema'}</strong> • IP: {log.ip || '-'}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Registrar Pagamento */}
      {participantePagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Registrar Pagamento</h3>
              <button
                onClick={() => setParticipantePagamento(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
              <div>Participante: <strong className="text-white">{participantePagamento.nome_completo}</strong></div>
              <div>Valor Total: <strong className="text-zinc-200">R$ {Number(participantePagamento.valor_total).toFixed(2).replace('.', ',')}</strong></div>
              <div>Total Já Pago: <strong className="text-emerald-400">R$ {(participantePagamento.pagamentos || []).reduce((acc, p) => acc + p.valor, 0).toFixed(2).replace('.', ',')}</strong></div>
            </div>

            {/* Histórico de pagamentos já realizados */}
            {(participantePagamento.pagamentos || []).length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-zinc-400 font-semibold block">Pagamentos Realizados:</span>
                <div className="max-h-28 overflow-y-auto space-y-1.5">
                  {(participantePagamento.pagamentos || []).map((pg) => (
                    <div key={pg.id} className="p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px] flex items-center justify-between">
                      <div>
                        <strong className="text-emerald-400">R$ {Number(pg.valor).toFixed(2)}</strong> - {pg.forma_pagamento} ({pg.data_pagamento})
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExcluirPagamento(participantePagamento.id, pg.id)}
                        className="text-zinc-500 hover:text-red-400"
                        title="Remover pagamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulário para novo pagamento */}
            <form onSubmit={handleSalvarPagamento} className="space-y-3">
              <div>
                <label className="label">Valor do Pagamento (R$) *</label>
                <input
                  type="number"
                  step="0.5"
                  value={pagamentoValor}
                  onChange={(e) => setPagamentoValor(e.target.value)}
                  className="input font-mono"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Forma de Pagamento</label>
                  <select
                    value={pagamentoForma}
                    onChange={(e) => setPagamentoForma(e.target.value)}
                    className="input"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>

                <div>
                  <label className="label">Data do Pagamento</label>
                  <input
                    type="date"
                    value={pagamentoData}
                    onChange={(e) => setPagamentoData(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Observação (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Pago metade agora"
                  value={pagamentoObs}
                  onChange={(e) => setPagamentoObs(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setParticipantePagamento(null)}
                  className="px-4 py-2 text-xs rounded-lg bg-zinc-800 text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingPagamento}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-500 text-black hover:bg-emerald-400"
                >
                  {loadingPagamento ? 'Salvando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configuração do Admin */}
      {showConfigModal && (
        <GrupoCriarEditarModal
          grupoParaEditar={grupo}
          onClose={() => setShowConfigModal(false)}
          onSuccess={() => {
            setShowConfigModal(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}


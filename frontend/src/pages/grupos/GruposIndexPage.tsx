import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { grupoService } from '@/services/grupoService'
import { useAuthStore } from '@/store/authStore'
import { resolveMediaUrl } from '@/lib/url'
import GrupoCriarEditarModal from './GrupoCriarEditarModal'
import {
  Users2,
  Plus,
  Copy,
  Calendar,
  Share2,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Factory,
  Lock,
  Shirt,
  DollarSign,
  AlertCircle,
  Key,
  User,
  MessageCircle,
  FileDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Grupo } from '@/types/grupo'

const STATUS_BADGES: Record<string, { label: string; cor: string; bg: string }> = {
  aberto: { label: 'Aberto', cor: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  prazo_encerrado: { label: 'Prazo Encerrado', cor: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  confirmado: { label: 'Confirmado', cor: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  em_producao: { label: 'Em Produção', cor: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  pronto: { label: 'Pronto', cor: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' },
  entregue: { label: 'Entregue', cor: 'text-zinc-400', bg: 'bg-zinc-800 border-zinc-700' },
}

export default function GruposIndexPage() {
  const { user, isAdmin, isConfeccao } = useAuthStore()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [showCriarModal, setShowCriarModal] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['grupos-lista', busca, statusFiltro],
    queryFn: () =>
      grupoService.listar({
        busca: busca || undefined,
        status: statusFiltro || undefined,
      }),
  })

  const grupos = data?.data || []

  function handleCopyLink(grupo: Grupo) {
    const url = `${window.location.origin}/grupo/${grupo.token}?senha=${grupo.senha_acesso || ''}`
    navigator.clipboard.writeText(url)
    toast.success('Link com senha copiado!')
  }

  function handleShareWhatsApp(grupo: Grupo) {
    const url = `${window.location.origin}/grupo/${grupo.token}?senha=${grupo.senha_acesso || ''}`
    const texto = `Fala pessoal! Nosso grupo de camisas *"${grupo.nome}"* já está aberto. Escolha seu modelo e tamanho pelo link:\n\n${url}\n\n🔑 *Senha de acesso:* ${grupo.senha_acesso || ''}`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank')
  }

  async function handleDuplicar(grupo: Grupo) {
    if (!confirm(`Deseja duplicar o grupo "${grupo.nome}"?`)) return
    try {
      await grupoService.duplicar(grupo.id, {
        nome: `${grupo.nome} (Cópia)`,
      })
      toast.success('Grupo duplicado com sucesso!')
      refetch()
    } catch {
      toast.error('Erro ao duplicar grupo.')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Topo / Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users2 className="w-6 h-6 text-amber-400" />
            Grupos de Camisas
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Crie grupos para seus clientes, compartilhe o link no WhatsApp e acompanhe os pedidos e produção
          </p>
        </div>

        <button
          onClick={() => setShowCriarModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition shadow-lg shadow-amber-500/10"
        >
          <Plus className="w-4 h-4" />
          Criar Novo Grupo
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar grupo por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input pl-9 text-xs"
          />
        </div>

        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="input w-full sm:w-48 text-xs"
        >
          <option value="">Todos os status</option>
          <option value="aberto">Aberto</option>
          <option value="prazo_encerrado">Prazo Encerrado</option>
          <option value="confirmado">Confirmado</option>
          <option value="em_producao">Em Produção</option>
          <option value="pronto">Pronto</option>
          <option value="entregue">Entregue</option>
        </select>
      </div>

      {/* Grid de Grupos */}
      {isLoading ? (
        <div className="py-16 text-center text-zinc-500 text-sm">Carregando grupos...</div>
      ) : grupos.length === 0 ? (
        <div className="p-12 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-3">
          <Shirt className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum grupo encontrado</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Crie seu primeiro grupo de camisas para compartilhar o link no WhatsApp com seus clientes!
          </p>
          <button
            onClick={() => setShowCriarModal(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-amber-400 hover:bg-zinc-700 transition"
          >
            <Plus className="w-4 h-4" /> Criar Primeiro Grupo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {grupos.map((grupo) => {
            const badge = STATUS_BADGES[grupo.status] || STATUS_BADGES.aberto
            const totalPreenchido = grupo.participantes_count || 0
            const progresso = Math.min(100, Math.round((totalPreenchido / (grupo.total_esperado || 1)) * 100))

            return (
              <div
                key={grupo.id}
                className="rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition overflow-hidden flex flex-col justify-between shadow-lg"
              >
                <div>
                  {/* Capa ou Placeholder */}
                  <div className="relative h-36 bg-zinc-950 overflow-hidden border-b border-zinc-800/80">
                    {grupo.imagem_capa ? (
                      <img
                        src={resolveMediaUrl(grupo.imagem_capa)}
                        alt={grupo.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-700">
                        <Shirt className="w-10 h-10" />
                      </div>
                    )}

                    {/* Badge de Status */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cor} ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Badge de Notificação de Solicitações Pendentes (Admin) */}
                    {isAdmin() && (grupo.solicitacoes_pendentes_count || 0) > 0 && (
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black flex items-center gap-1 shadow">
                        <AlertCircle className="w-3 h-3" />
                        {grupo.solicitacoes_pendentes_count} atrasado(s)
                      </div>
                    )}
                  </div>

                  {/* Dados do Grupo */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-white line-clamp-1">{grupo.nome}</h3>

                      {/* Cliente / Responsável do Grupo */}
                      {(grupo.cliente_nome || grupo.user?.name) && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-medium mt-1">
                          <User className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span className="truncate">
                            Cliente: <strong className="text-white">{grupo.cliente_nome || grupo.user?.name}</strong>
                          </span>
                          {grupo.cliente_whatsapp && (
                            <a
                              href={`https://wa.me/55${grupo.cliente_whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-400 hover:text-emerald-300 ml-1 inline-flex items-center gap-0.5"
                              title={`WhatsApp de ${grupo.cliente_nome || 'cliente'}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span className="text-[10px] underline">{grupo.cliente_whatsapp}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Confecção Responsável */}
                      {grupo.confeccao?.nome && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                          <Factory className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                          <span className="truncate">Confecção: {grupo.confeccao.nome}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Prazo: {new Date(grupo.prazo_limite).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {grupo.senha_acesso && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(grupo.senha_acesso!)
                              toast.success(`Senha ${grupo.senha_acesso} copiada!`)
                            }}
                            className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-bold hover:bg-amber-500/20 transition"
                            title="Clique para copiar a senha"
                          >
                            <Key className="w-3 h-3 text-amber-400" />
                            {grupo.senha_acesso}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-medium">
                          {totalPreenchido} de {grupo.total_esperado} preencheram
                        </span>
                        <span className="font-mono text-amber-400 font-bold">{progresso}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                    </div>

                    {/* Resumo Financeiro (Admin / Cliente) */}
                    {!isConfeccao() && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-center">
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800/60">
                          <div className="text-[10px] text-zinc-500 uppercase">Previsto</div>
                          <div className="text-xs font-bold text-zinc-200 font-mono">
                            R$ {Number(grupo.total_previsto || 0).toFixed(0)}
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800/60">
                          <div className="text-[10px] text-zinc-500 uppercase">Recebido</div>
                          <div className="text-xs font-bold text-emerald-400 font-mono">
                            R$ {Number(grupo.total_pago || 0).toFixed(0)}
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800/60">
                          <div className="text-[10px] text-zinc-500 uppercase">Pendente</div>
                          <div className="text-xs font-bold text-amber-400 font-mono">
                            R$ {Number(grupo.total_pendente || 0).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé do Card com Ações */}
                <div className="px-4 py-3 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyLink(grupo)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                      title="Copiar link com senha"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleShareWhatsApp(grupo)}
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition"
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicar(grupo)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition"
                      title="Duplicar grupo anterior"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => grupoService.baixarPdf(grupo.id, grupo.nome)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition"
                      title="Baixar Ordem de Produção (PDF)"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                  </div>

                  <Link
                    to={isConfeccao() && grupo.user_id !== user?.id ? `/grupos/${grupo.id}/confeccao` : `/grupos/${grupo.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
                  >
                    <span>{isConfeccao() && grupo.user_id !== user?.id ? 'Ver Produção' : 'Gerenciar'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar Grupo */}
      {showCriarModal && (
        <GrupoCriarEditarModal
          onClose={() => setShowCriarModal(false)}
          onSuccess={() => {
            setShowCriarModal(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}


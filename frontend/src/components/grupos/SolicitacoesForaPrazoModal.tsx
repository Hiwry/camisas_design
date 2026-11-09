import { useState } from 'react'
import { X, Clock, Check, Ban, AlertTriangle, UserPlus } from 'lucide-react'
import type { GrupoSolicitacao } from '@/types/grupo'
import toast from 'react-hot-toast'

interface Props {
  solicitacoes: GrupoSolicitacao[]
  statusGrupo: string
  onAvaliar: (solicitacaoId: number, acao: 'aprovar' | 'recusar', resposta?: string) => Promise<void>
  onClose: () => void
}

export default function SolicitacoesForaPrazoModal({ solicitacoes, statusGrupo, onAvaliar, onClose }: Props) {
  const [resposta, setResposta] = useState<Record<number, string>>({})
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const pendentes = solicitacoes.filter((s) => s.status === 'pendente')
  const avaliadas = solicitacoes.filter((s) => s.status !== 'pendente')

  async function handleAcao(id: number, acao: 'aprovar' | 'recusar') {
    setLoadingId(id)
    try {
      await onAvaliar(id, acao, resposta[id])
      toast.success(acao === 'aprovar' ? 'Solicitação aprovada e adicionada!' : 'Solicitação recusada.')
    } catch {
      toast.error('Erro ao processar solicitação.')
    } finally {
      setLoadingId(null)
    }
  }

  const emProducao = statusGrupo === 'em_producao'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Solicitações Fora do Prazo ("Esqueci de preencher")</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta se o grupo estiver Em Produção */}
        {emProducao && (
          <div className="px-5 py-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <span>
              <strong>Atenção:</strong> O grupo já está <strong>Em Produção</strong>! A aprovação de novas peças depende da capacidade da confecção aceitar o acréscimo. A confecção será notificada.
            </span>
          </div>
        )}

        {/* Lista de Solicitações */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
            Aguardando Aprovação ({pendentes.length})
          </h4>

          {pendentes.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Nenhuma solicitação pendente no momento.</p>
          ) : (
            pendentes.map((sol) => {
              const dados = sol.dados_participante
              return (
                <div key={sol.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-sm font-bold text-white flex items-center gap-2">
                        {dados.nome_completo}
                        {dados.whatsapp && (
                          <span className="text-xs text-zinc-400 font-mono font-normal">({dados.whatsapp})</span>
                        )}
                      </h5>
                      <div className="text-xs text-zinc-400 mt-1 flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-semibold">
                          {dados.quantidade}x {dados.tamanho}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          Cor: {dados.cor}
                        </span>
                        {dados.nome_camisa && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            Nome: "{dados.nome_camisa}"
                          </span>
                        )}
                        {dados.numero_camisa && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 font-mono font-bold text-amber-400">
                            #{dados.numero_camisa}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(sol.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  {sol.motivo && (
                    <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-300">
                      <strong className="text-zinc-400">Motivo informado:</strong> "{sol.motivo}"
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-zinc-800">
                    <input
                      type="text"
                      placeholder="Mensagem opcional de retorno..."
                      value={resposta[sol.id] || ''}
                      onChange={(e) => setResposta({ ...resposta, [sol.id]: e.target.value })}
                      className="input text-xs flex-1"
                    />

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleAcao(sol.id, 'aprovar')}
                        disabled={loadingId === sol.id}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleAcao(sol.id, 'recusar')}
                        disabled={loadingId === sol.id}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" />
                        Recusar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Histórico de Avaliadas */}
          {avaliadas.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <h4 className="text-xs uppercase font-bold text-zinc-500 tracking-wider">
                Histórico de Solicitações Já Avaliadas ({avaliadas.length})
              </h4>
              <div className="space-y-2">
                {avaliadas.map((sol) => (
                  <div key={sol.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-300">{sol.dados_participante.nome_completo}</span>
                      <span className="text-zinc-500 ml-2">({sol.dados_participante.quantidade}x {sol.dados_participante.tamanho})</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      sol.status === 'aprovado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {sol.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 bg-zinc-900 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}


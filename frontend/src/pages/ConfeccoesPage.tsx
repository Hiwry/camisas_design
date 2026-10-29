import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { confeccaoService, creditoService } from '@/services/api'
import toast from 'react-hot-toast'
import { Factory, Plus, Search, Coins } from 'lucide-react'
import { DarkModal } from './PedidosPage'

const PLANO_CFG: Record<string, { label: string; badge: string; limite: number; sla: string }> = {
  basico:       { label: 'START', badge: 'bg-indigo-950 text-indigo-400 border-indigo-900', limite: 10, sla: '48h' },
  profissional: { label: 'PRO',   badge: 'bg-amber-950 text-amber-400 border-amber-900',   limite: 20, sla: '24h' },
  premium:      { label: 'VIP',   badge: 'bg-purple-950 text-purple-400 border-purple-900', limite: 35, sla: '12h' },
}
// Compat
const PLANO_BADGE = Object.fromEntries(Object.entries(PLANO_CFG).map(([k, v]) => [k, v.badge]))
const PLANO_LIMITES = Object.fromEntries(Object.entries(PLANO_CFG).map(([k, v]) => [k, v.limite]))

export default function ConfeccoesPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [confeccaoAjustar, setConfeccaoAjustar] = useState<any | null>(null)
  const [ajusteQtd, setAjusteQtd] = useState<number>(5)
  const [ajusteOp, setAjusteOp] = useState<'adicionar' | 'remover' | 'definir'>('adicionar')
  const [ajusteMotivo, setAjusteMotivo] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['confeccoes', search],
    queryFn: () => confeccaoService.listar({ search }),
  })

  const criarMutation = useMutation({
    mutationFn: confeccaoService.criar,
    onSuccess: () => {
      toast.success('Confecção criada!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setShowForm(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar confecção.')
    },
  })

  const ajustarMutation = useMutation({
    mutationFn: () =>
      creditoService.adminAjustar(confeccaoAjustar.id, {
        quantidade: ajusteQtd,
        operacao: ajusteOp,
        motivo: ajusteMotivo.trim() || undefined,
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Créditos atualizados!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setConfeccaoAjustar(null)
      setAjusteMotivo('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar créditos.')
    },
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    criarMutation.mutate(Object.fromEntries(new FormData(e.currentTarget)))
  }

  const confeccoes = Array.isArray(data) ? data : (data?.data ?? [])

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(212,160,32,0.12)', border: '1px solid rgba(212,160,32,0.2)' }}
          >
            <Factory className="w-4 h-4" style={{ color: '#d4a020' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Confecções</h1>
            <p className="text-xs text-zinc-500">{confeccoes.length} cadastradas</p>
          </div>
        </div>
        <button className="btn-primary text-xs px-4 py-2" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5" /> Nova Confecção
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">

        {/* Busca */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            className="input pl-9"
            placeholder="Buscar confecções..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabela */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <svg className="animate-spin w-5 h-5 text-zinc-600" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
          ) : confeccoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-zinc-600">
              <Factory className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Nenhuma confecção cadastrada.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#161616', borderBottom: '1px solid #2a2a2a' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Nome</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Plano</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Uso Mensal</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Créditos IA</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {confeccoes.map((c: {
                  id: number; nome: string; email: string; plano: string;
                  artes_usadas_mes: number; limite_mensal: number; creditos_ia?: number; ativo: boolean
                }, i: number) => {
                  const pct = c.limite_mensal > 0 ? (c.artes_usadas_mes / c.limite_mensal) : 0
                  const barColor = pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#10b981'
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #1e1e1e',
                        background: i % 2 === 0 ? '#111' : '#141414',
                      }}
                    >
                      <td className="px-5 py-3.5 font-medium text-zinc-100">{c.nome}</td>
                      <td className="px-5 py-3.5 text-zinc-500">{c.email ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`badge border text-[10px] ${PLANO_BADGE[c.plano] ?? PLANO_BADGE.basico}`}>
                          {PLANO_CFG[c.plano]?.label ?? c.plano} · {PLANO_LIMITES[c.plano] ?? c.limite_mensal}/mês · {PLANO_CFG[c.plano]?.sla ?? '48h'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2a2a' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, pct * 100)}%`, background: barColor }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: barColor }}>
                            {c.artes_usadas_mes}/{c.limite_mensal}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="badge border text-[11px] font-bold px-2 py-0.5 flex items-center gap-1"
                            style={{
                              background: (c.creditos_ia ?? 0) > 0 ? 'rgba(212,160,32,0.1)' : 'rgba(239,68,68,0.1)',
                              borderColor: (c.creditos_ia ?? 0) > 0 ? 'rgba(212,160,32,0.3)' : 'rgba(239,68,68,0.3)',
                              color: (c.creditos_ia ?? 0) > 0 ? '#d4a020' : '#ef4444',
                            }}
                          >
                            <Coins className="w-3 h-3" />
                            {c.creditos_ia ?? 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setConfeccaoAjustar(c)
                              setAjusteQtd(5)
                              setAjusteOp('adicionar')
                            }}
                            className="text-[10px] font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
                            title="Gerenciar créditos desta confecção"
                          >
                            Ajustar
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge border text-[10px] ${c.ativo ? 'bg-emerald-950 text-emerald-400 border-emerald-900' : 'bg-red-950 text-red-400 border-red-900'}`}>
                          {c.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <DarkModal title="Nova Confecção" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome da confecção</label>
              <input name="nome" className="input" required placeholder="Ex: Confecção Modelo" />
            </div>
            <div>
              <label className="label">Email (será o login)</label>
              <input name="email" type="email" className="input" required placeholder="confeccao@email.com" />
            </div>
            <div>
              <label className="label">Senha inicial</label>
              <input name="password" type="password" className="input" required minLength={8} placeholder="Mínimo 8 caracteres" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input name="whatsapp" className="input" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="label">Plano</label>
              <select name="plano" className="input" required>
                <option value="basico">START — 10 artes/mês · entrega 48h</option>
                <option value="profissional">PRO — 20 artes/mês · entrega 24h</option>
                <option value="premium">VIP — 35 artes/mês · entrega 12h</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? 'Criando...' : 'Criar Confecção'}
              </button>
            </div>
          </form>
        </DarkModal>
      )}

      {/* Modal de Ajuste de Créditos */}
      {confeccaoAjustar && (
        <DarkModal
          title={`Gerenciar Créditos IA — ${confeccaoAjustar.nome}`}
          onClose={() => setConfeccaoAjustar(null)}
        >
          <div className="space-y-4">
            <div
              className="p-3.5 rounded-xl border flex items-center justify-between"
              style={{ background: '#141414', borderColor: '#262626' }}
            >
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#d4a020]" />
                <span className="text-xs text-zinc-400">Saldo atual da confecção:</span>
              </div>
              <span className="text-sm font-bold text-white">
                {confeccaoAjustar.creditos_ia ?? 0} análises
              </span>
            </div>

            <div>
              <label className="label">Operação</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'adicionar', label: 'Adicionar (+)' },
                  { id: 'remover', label: 'Remover (-)' },
                  { id: 'definir', label: 'Definir (=)' },
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setAjusteOp(op.id as any)}
                    className="py-2 text-xs font-semibold rounded-lg border transition-all"
                    style={{
                      background: ajusteOp === op.id ? 'rgba(212,160,32,0.15)' : '#161616',
                      borderColor: ajusteOp === op.id ? '#d4a020' : '#262626',
                      color: ajusteOp === op.id ? '#d4a020' : '#888',
                    }}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Quantidade de análises</label>
              <input
                type="number"
                min="1"
                max="500"
                value={ajusteQtd}
                onChange={(e) => setAjusteQtd(Math.max(1, Number(e.target.value)))}
                className="input"
                required
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Equivalente a: R$ {(ajusteQtd * 5).toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div>
              <label className="label">Motivo do ajuste (opcional)</label>
              <input
                placeholder="Ex: Pagamento Pix confirmado manualmente / Bônus"
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
                className="input"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setConfeccaoAjustar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={ajustarMutation.isPending}
                onClick={() => ajustarMutation.mutate()}
              >
                {ajustarMutation.isPending ? 'Salvando...' : 'Salvar Créditos'}
              </button>
            </div>
          </div>
        </DarkModal>
      )}
    </div>
  )
}

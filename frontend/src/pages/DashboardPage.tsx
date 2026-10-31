import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/api'
import { ReactNode } from 'react'
import {
  LayoutDashboard, AlertTriangle, TrendingUp, Clock,
  CheckCircle2, Ban, Zap, Activity, ChevronRight,
} from 'lucide-react'

/* ── Configuração por status ── */
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; badgeCls: string }> = {
  aguardando_briefing:  { label: 'Aguardando Briefing',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)',   badgeCls: 'bg-indigo-950 text-indigo-400 border-indigo-900' },
  em_producao:          { label: 'Em Produção',           color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',   badgeCls: 'bg-blue-950 text-blue-400 border-blue-900' },
  aguardando_aprovacao: { label: 'Aguardando Aprovação',  color: '#d4a020', bg: 'rgba(212,160,32,0.12)',   badgeCls: 'bg-amber-950 text-amber-400 border-amber-900' },
  aprovado:             { label: 'Aprovado',              color: '#10b981', bg: 'rgba(16,185,129,0.12)',   badgeCls: 'bg-emerald-950 text-emerald-400 border-emerald-900' },
  finalizado:           { label: 'Finalizado',            color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',   badgeCls: 'bg-purple-950 text-purple-400 border-purple-900' },
  cancelado:            { label: 'Cancelado',             color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    badgeCls: 'bg-red-950 text-red-400 border-red-900' },
}

const STATUS_ORDER = [
  'aguardando_briefing', 'em_producao', 'aguardando_aprovacao',
  'aprovado', 'finalizado', 'cancelado',
]

const PLANO_LABEL: Record<string, string> = {
  basico: 'Básico', profissional: 'Profissional', premium: 'Premium',
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardService.buscar,
    retry: 1,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-zinc-500">
        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#d4a020" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <span className="text-sm">Carregando dashboard...</span>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-600">
      <AlertTriangle className="w-8 h-8 opacity-40" />
      <p className="text-sm">Não foi possível carregar o dashboard.</p>
      <p className="text-xs text-zinc-700">Verifique se o backend está rodando em localhost:8000</p>
    </div>
  )

  const por_status:    Record<string, number> = data.por_status    ?? {}
  const por_confeccao: { confeccao: string; total: number }[]      = data.por_confeccao  ?? []
  const uso_por_plano: { id: number; nome: string; plano: string; artes_usadas: number; limite_mensal: number; percentual_uso: number }[] = data.uso_por_plano ?? []
  const pedidos_recentes: number = data.pedidos_recentes ?? 0
  const atrasados:        number = data.atrasados        ?? 0
  const cancelados:       number = data.cancelados       ?? por_status['cancelado'] ?? 0
  const total_geral:      number = data.total_geral      ?? 0
  const total_ativos:     number = data.total_ativos     ?? total_geral

  const maxConfeccao = por_confeccao.length > 0
    ? Math.max(...por_confeccao.map((c) => c.total))
    : 1

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 animate-[fadeIn_0.2s_ease-out] max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
          <LayoutDashboard className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Dashboard</h1>
          <p className="text-xs text-zinc-500">Visão geral do sistema</p>
        </div>
      </div>

      {/* ── Alerta de atrasados ── */}
      {atrasados > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.25)' }}
        >
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-bold">{atrasados}</span>
            {' '}pedido{atrasados > 1 ? 's' : ''} com prazo vencido aguardando ação.
          </p>
        </div>
      )}

      {/* ── Métricas principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Total de Pedidos"
          value={total_geral}
          sub={`${total_ativos ?? total_geral} ativos`}
          icon={<TrendingUp className="w-4 h-4" />}
          accent="#d4a020"
        />
        <MetricCard
          label="Últimos 7 dias"
          value={pedidos_recentes}
          sub="novos pedidos"
          icon={<Clock className="w-4 h-4" />}
          accent="#3b82f6"
        />
        <MetricCard
          label="Em Produção"
          value={por_status['em_producao'] ?? 0}
          sub="em andamento"
          icon={<Activity className="w-4 h-4" />}
          accent="#6366f1"
        />
        <MetricCard
          label="Aguard. Aprovação"
          value={por_status['aguardando_aprovacao'] ?? 0}
          sub="aguardando cliente"
          icon={<Zap className="w-4 h-4" />}
          accent="#f59e0b"
        />
        <MetricCard
          label="Cancelados"
          value={cancelados ?? 0}
          sub="pedidos cancelados"
          icon={<Ban className="w-4 h-4" />}
          accent="#ef4444"
        />
      </div>

      {/* ── Linha 2: Status + Confecção ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Por Status — ocupa 3 colunas */}
        <div className="lg:col-span-3 card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-white">Pedidos por Status</h2>
            <span className="text-xs text-zinc-600">{total_geral} total</span>
          </div>

          {/* Barra empilhada */}
          <div className="flex h-2.5 rounded-full overflow-hidden mb-5 gap-0.5">
            {STATUS_ORDER.map((s) => {
              const n = por_status[s] ?? 0
              const pct = total_geral > 0 ? (n / total_geral) * 100 : 0
              if (pct === 0) return null
              return (
                <div
                  key={s}
                  style={{ width: `${pct}%`, background: STATUS_CFG[s]?.color ?? '#555' }}
                  title={`${STATUS_CFG[s]?.label}: ${n}`}
                />
              )
            })}
          </div>

          {/* Lista de itens */}
          <div className="space-y-2">
            {STATUS_ORDER.map((status) => {
              const n   = por_status[status] ?? 0
              const pct = total_geral > 0 ? Math.round((n / total_geral) * 100) : 0
              const cfg = STATUS_CFG[status]
              return (
                <div key={status} className="group">
                  <div className="flex items-center gap-3">
                    {/* Dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: cfg?.color ?? '#555' }}
                    />
                    {/* Label */}
                    <span className="text-xs text-zinc-400 flex-1 truncate">{cfg?.label ?? status}</span>
                    {/* Count + pct */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(Math.max(pct * 1.2, n > 0 ? 4 : 0), 120)}px`,
                          background: cfg?.color ?? '#555',
                          opacity: n === 0 ? 0.2 : 1,
                          transition: 'width 0.5s ease',
                        }}
                      />
                      <span className="text-sm font-bold text-zinc-200 w-5 text-right">{n}</span>
                      <span className="text-[10px] text-zinc-700 w-7 text-right">{pct}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Por Confecção — ocupa 2 colunas */}
        <div className="lg:col-span-2 card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-white">Por Confecção</h2>
            <ChevronRight className="w-4 h-4 text-zinc-700" />
          </div>
          {por_confeccao.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-700">
              <Activity className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">Nenhum pedido ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {por_confeccao.map((item: { confeccao: string; total: number }, i: number) => {
                const pct = Math.round((item.total / maxConfeccao) * 100)
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-300 truncate flex-1 pr-2" title={item.confeccao}>
                        {item.confeccao}
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(212,160,32,0.12)', color: '#d4a020', border: '1px solid rgba(212,160,32,0.2)' }}
                      >
                        {item.total}
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: '#242424' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: 'linear-gradient(to right, #d4a020, #e8b430)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Aprovados + Finalizados (mini métricas) ── */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          label="Aprovados"
          value={por_status['aprovado'] ?? 0}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          color="#10b981"
        />
        <MiniStat
          label="Finalizados"
          value={por_status['finalizado'] ?? 0}
          icon={<CheckCircle2 className="w-4 h-4 text-purple-400" />}
          color="#8b5cf6"
        />
      </div>

      {/* ── Uso do Plano Mensal ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-white">Uso do Plano Mensal</h2>
          <span className="text-xs text-zinc-600">{uso_por_plano.length} confecção{uso_por_plano.length !== 1 ? 'ões' : ''}</span>
        </div>
        <div className="space-y-5">
          {uso_por_plano.map((c: {
            id: number; nome: string; plano: string;
            artes_usadas: number; limite_mensal: number; percentual_uso: number
          }) => {
            const barColor = c.percentual_uso >= 90 ? '#ef4444' : c.percentual_uso >= 70 ? '#f59e0b' : '#10b981'
            const statusLabel = c.percentual_uso >= 90 ? 'Crítico' : c.percentual_uso >= 70 ? 'Alto' : 'Normal'
            const statusCls   = c.percentual_uso >= 90
              ? 'bg-red-950 text-red-400 border-red-900'
              : c.percentual_uso >= 70
              ? 'bg-amber-950 text-amber-400 border-amber-900'
              : 'bg-emerald-950 text-emerald-400 border-emerald-900'

            return (
              <div key={c.id} className="group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-zinc-200 truncate">{c.nome}</span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0"
                      style={{ background: '#1e1e1e', color: '#888', borderColor: '#2a2a2a' }}
                    >
                      {PLANO_LABEL[c.plano] ?? c.plano}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${statusCls}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <span style={{ color: barColor }} className="text-sm font-bold">{c.artes_usadas}</span>
                    <span className="text-zinc-700 text-xs">/ {c.limite_mensal}</span>
                    <span className="text-zinc-700 text-xs ml-1">artes</span>
                    <span
                      className="ml-2 text-xs font-bold"
                      style={{ color: barColor }}
                    >
                      {c.percentual_uso}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#242424' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${c.percentual_uso}%`,
                      background: c.percentual_uso >= 90
                        ? 'linear-gradient(to right, #ef4444, #dc2626)'
                        : c.percentual_uso >= 70
                        ? 'linear-gradient(to right, #f59e0b, #d97706)'
                        : 'linear-gradient(to right, #10b981, #059669)',
                    }}
                  />
                </div>
                {c.percentual_uso >= 90 && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Limite quase atingido — {c.limite_mensal - c.artes_usadas} arte{c.limite_mensal - c.artes_usadas !== 1 ? 's' : ''} restante{c.limite_mensal - c.artes_usadas !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

/* ── MetricCard ── */
function MetricCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: number; sub?: string; icon: ReactNode; accent: string
}) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center self-start"
        style={{ color: accent }}
      >
        {icon}
      </div>
      {/* Value */}
      <div>
        <p className="text-3xl font-black text-white leading-none tracking-tight">{value}</p>
        {sub && <p className="text-[11px] mt-1 text-zinc-500">{sub}</p>}
      </div>
      {/* Label */}
      <p className="text-[11px] text-zinc-600 font-medium uppercase tracking-wider leading-tight">{label}</p>
    </div>
  )
}

/* ── MiniStat ── */
function MiniStat({
  label, value, icon, color: _color,
}: {
  label: string; value: number; icon: ReactNode; color: string
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-xs text-zinc-600 font-medium">{label}</p>
      </div>
    </div>
  )
}

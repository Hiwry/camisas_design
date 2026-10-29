import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { authService, creditoService } from '@/services/api'
import ModalComprarCreditos from '@/components/ModalComprarCreditos'
import {
  LayoutDashboard, Columns, ClipboardList, Factory, LogOut, Sparkles, Smartphone, CheckCircle2, Coins, Plus, ShoppingBag, Package, Palette,
} from 'lucide-react'
import clsx from 'clsx'

const PLANO_CFG: Record<string, { label: string; cor: string; sla: string }> = {
  basico:       { label: 'START',  cor: '#6366f1', sla: '48h' },
  profissional: { label: 'PRO',    cor: '#d4a020', sla: '24h' },
  premium:      { label: 'VIP',    cor: '#8b5cf6', sla: '12h' },
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const conf = user?.confeccao
  const [showComprarModal, setShowComprarModal] = useState(false)

  const { data: saldoData } = useQuery({
    queryKey: ['creditos-saldo'],
    queryFn: creditoService.saldo,
    enabled: !!user,
  })

  async function handleLogout() {
    try { await authService.logout() } catch {}
    logout()
    navigate('/login')
  }

  const navItems = [
    ...(isAdmin() ? [
      { to: '/dashboard',           icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/kanban',              icon: Columns,          label: 'Kanban' },
      { to: '/confeccoes',          icon: Factory,          label: 'Confecções' },
      { to: '/admin/shop/produtos', icon: Package,          label: 'Gerenciar Shop' },
    ] : []),
    { to: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
    { to: '/portfolio', icon: Palette, label: 'Portfólio / Catálogo' },
    { to: '/shop', icon: ShoppingBag, label: 'Shop Avulso' },
    { to: '/revisar-arte', icon: Sparkles, label: 'Revisar Arte IA' },
    { to: '/whatsapp',    icon: Smartphone, label: 'WhatsApp' },
  ]

  return (
    <div className="flex h-screen" style={{ background: '#0a0a0a' }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col border-r"
        style={{ background: '#111111', borderColor: '#1e1e1e' }}
      >
        {/* Logo */}
        <div className="flex items-center px-5 py-4 border-b" style={{ borderColor: '#1e1e1e' }}>
          <img
            src="/logo.svg"
            alt="DesignFlow"
            className="h-8 w-auto"
            onError={(e) => {
              // Fallback para PNG se SVG não carregar
              const img = e.currentTarget
              img.onerror = null
              img.src = '/logo.png'
            }}
          />
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'text-[#0a0a0a] font-semibold'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                )
              }
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(135deg,#d4a020,#e8b430)',
                boxShadow: '0 2px 12px rgba(212,160,32,0.25)',
              } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* ── Card de plano (só confecção) ── */}
        {!isAdmin() && conf && (() => {
          const plano   = PLANO_CFG[conf.plano] ?? PLANO_CFG.basico
          const pct     = conf.limite_mensal > 0 ? (conf.artes_usadas_mes / conf.limite_mensal) : 0
          const barCor  = pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#10b981'
          return (
            <div className="mx-3 mb-3 rounded-xl border overflow-hidden" style={{ borderColor: '#2a2a2a', background: '#0f0f0f' }}>
              {/* Header do plano */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest"
                    style={{ background: `${plano.cor}18`, color: plano.cor, border: `1px solid ${plano.cor}35` }}
                  >
                    {plano.label}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-medium">·  {plano.sla} entrega</span>
                </div>
              </div>

              {/* Uso mensal */}
              <div className="px-3 pb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-zinc-500">Artes este mês</span>
                  <span className="text-[11px] font-bold" style={{ color: barCor }}>
                    {conf.artes_usadas_mes}/{conf.limite_mensal}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2a2a' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct * 100)}%`, background: barCor }}
                  />
                </div>
                {Boolean(conf.artes_extras && conf.artes_extras > 0) && (
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-800/80">
                    <span className="text-[10px] text-[#d4a020] font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Artes Extras
                    </span>
                    <span className="text-[10px] font-extrabold text-[#d4a020] bg-[#d4a020]/10 px-1.5 py-0.2 rounded border border-[#d4a020]/30">
                      +{conf.artes_extras}
                    </span>
                  </div>
                )}
              </div>

              {/* Créditos IA */}
              <div
                className="flex items-center justify-between px-3 py-2 border-t"
                style={{ borderColor: '#1e1e1e', background: 'rgba(212,160,32,0.03)' }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Coins className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#d4a020' }} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] text-zinc-500 font-semibold leading-tight">CRÉDITOS IA</span>
                    <span className="text-[11px] font-bold text-white truncate leading-tight">
                      {saldoData?.creditos ?? conf.creditos_ia ?? 0} análises
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComprarModal(true)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded transition-all hover:opacity-90 flex-shrink-0"
                  style={{
                    background: 'rgba(212,160,32,0.15)',
                    color: '#d4a020',
                    border: '1px solid rgba(212,160,32,0.3)',
                  }}
                  title="Comprar créditos por R$ 5 cada"
                >
                  + R$ 5
                </button>
              </div>
            </div>
          )
        })()}

        {/* Usuário */}
        <div className="px-3 py-4 border-t" style={{ borderColor: '#1e1e1e' }}>
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: '#1a1a1a' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#d4a020,#e8b430)', color: '#0a0a0a' }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-zinc-500 capitalize leading-tight mt-0.5">
                {user?.role === 'admin' ? 'Administrador' : 'Confecção'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto" style={{ background: '#0a0a0a' }}>
        <Outlet />
      </main>

      {/* Modal de Compra de Créditos */}
      {showComprarModal && (
        <ModalComprarCreditos onClose={() => setShowComprarModal(false)} />
      )}
    </div>
  )
}

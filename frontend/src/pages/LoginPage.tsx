import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authService.login(email, password)
      setAuth(data.token, data.user)
      navigate(data.user.role === 'admin' ? '/dashboard' : '/pedidos')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Credenciais inválidas.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">

      {/* Painel esquerdo — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 bg-zinc-950">
        {/* Logo — filtro branco para fundo escuro */}
        <img
          src="/logo.svg"
          alt="DesignFlow"
          className="h-10 w-auto"
          style={{ filter: 'brightness(0) invert(1)' }}
          onError={(e) => { const i = e.currentTarget; i.onerror = null; i.src = '/logo.png'; i.style.filter = 'brightness(0) invert(1)' }}
        />

        {/* Centro */}
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-widest font-medium mb-4">
            Plataforma SaaS
          </p>
          <h2 className="text-4xl font-bold text-white leading-tight mb-6">
            Gestão de artes<br />para camisetas
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
            Centralize pedidos, envie artes e colete aprovações dos seus clientes — tudo em um painel.
          </p>

          <div className="mt-10 space-y-4">
            {[
              'Kanban visual por confecção',
              'Aprovação online sem cadastro',
              'Histórico de versões de arte',
              'Notificações por email e WhatsApp',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                <span className="text-sm text-zinc-400">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-zinc-700 text-xs">
          © {new Date().getFullYear()} Camiseta Design
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden mb-10">
            <img
              src="/logo.svg"
              alt="DesignFlow"
              className="h-9 w-auto"
              onError={(e) => { const i = e.currentTarget; i.onerror = null; i.src = '/logo.png' }}
            />
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Entrar na conta</h1>
          <p className="text-zinc-500 text-sm mb-8">Acesso restrito a administradores e confecções</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="w-full border border-zinc-200 bg-zinc-50 text-zinc-900 placeholder-zinc-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full border border-zinc-200 bg-zinc-50 text-zinc-900 placeholder-zinc-400 rounded-lg px-4 py-3 pr-12 text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

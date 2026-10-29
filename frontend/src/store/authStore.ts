import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'confeccao'
  whatsapp?: string
  creditos_ia?: number
  confeccao?: {
    id: number
    nome: string
    plano: string
    limite_mensal: number
    artes_usadas_mes: number
    artes_extras?: number
    creditos_ia?: number
    sla_horas?: number
    sla_expresso?: number
  } | null
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
  isAdmin: () => boolean
  isConfeccao: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => set({ token, user }),

      setUser: (user) => set({ user }),

      logout: () => set({ token: null, user: null }),

      isAdmin: () => get().user?.role === 'admin',

      isConfeccao: () => get().user?.role === 'confeccao',
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)

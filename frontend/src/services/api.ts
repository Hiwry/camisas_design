import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Interceptor: injeta token Bearer automaticamente
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor: logout automático em 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Helpers de serviço ────────────────────────────────────────────────────

export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me').then((r) => r.data),
}

export const pedidoService = {
  listar: (params?: Record<string, unknown>) =>
    api.get('/pedidos', { params }).then((r) => r.data),
  buscar: (id: number) =>
    api.get(`/pedidos/${id}`).then((r) => r.data),
  criar: (data: FormData | Record<string, unknown>) =>
    api.post('/pedidos', data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }).then((r) => r.data),
  atualizar: (id: number, data: Record<string, unknown>) =>
    api.put(`/pedidos/${id}`, data).then((r) => r.data),
  mudarStatus: (id: number, status: string) =>
    api.post(`/pedidos/${id}/status`, { status }).then((r) => r.data),
  cancelar: (id: number) =>
    api.post(`/pedidos/${id}/cancelar`).then((r) => r.data),
  linkAprovacao: (id: number) =>
    api.get(`/pedidos/${id}/link-aprovacao`).then((r) => r.data),
}

export const arteService = {
  listar: (pedidoId: number) =>
    api.get(`/pedidos/${pedidoId}/artes`).then((r) => r.data),
  enviar: (pedidoId: number, formData: FormData) =>
    api.post(`/pedidos/${pedidoId}/artes`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  revisar: (pedidoId: number, arteId: number, arteCompararId?: number) =>
    api.post(`/pedidos/${pedidoId}/revisar-arte`, {
      arte_id: arteId,
      arte_comparar_id: arteCompararId ?? null,
    }, { timeout: 90000 }).then((r) => r.data),
}

export const kanbanService = {
  buscar: () => api.get('/kanban').then((r) => r.data),
  mover: (pedidoId: number, novoStatus: string, ordem?: number) =>
    api.post('/kanban/mover', { pedido_id: pedidoId, novo_status: novoStatus, ordem })
      .then((r) => r.data),
}

export const dashboardService = {
  buscar: () => api.get('/dashboard').then((r) => r.data),
}

export const confeccaoService = {
  listar: (params?: Record<string, unknown>) =>
    api.get('/confeccoes', { params }).then((r) => r.data),
  buscar: (id: number) =>
    api.get(`/confeccoes/${id}`).then((r) => r.data),
  criar: (data: Record<string, unknown>) =>
    api.post('/confeccoes', data).then((r) => r.data),
  atualizar: (id: number, data: Record<string, unknown>) =>
    api.put(`/confeccoes/${id}`, data).then((r) => r.data),
}

export const whatsappService = {
  status:       () => api.get('/whatsapp/status').then(r => r.data),
  qrcode:       () => api.get('/whatsapp/qrcode').then(r => r.data),
  desconectar:  () => api.post('/whatsapp/desconectar').then(r => r.data),
  enviarTeste:  (numero: string, mensagem: string) =>
    api.post('/whatsapp/enviar-teste', { numero, mensagem }).then(r => r.data),
}

export const revisaoService = {
  comparar: (formData: FormData) =>
    api.post('/revisao/comparar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90000,
    }).then((r) => r.data),
  historico: () =>
    api.get('/revisao/historico').then((r) => r.data),
}

export const aprovacaoService = {
  buscarPorToken: (token: string) =>
    api.get(`/aprovacao/${token}`).then((r) => r.data),
  aprovar: (token: string, nomeAprovador?: string) =>
    api.post(`/aprovacao/${token}/aprovar`, { nome_aprovador: nomeAprovador })
      .then((r) => r.data),
  pedirRevisao: (token: string, comentario: string, nomeAprovador?: string) =>
    api.post(`/aprovacao/${token}/revisao`, {
      comentario,
      nome_aprovador: nomeAprovador,
    }).then((r) => r.data),
}

export const rastreioService = {
  buscar: (telefone: string) =>
    api.post('/publico/rastreio', { telefone }).then((r) => r.data),
}

export const creditoService = {
  saldo: () => api.get('/creditos/saldo').then((r) => r.data),
  comprar: (quantidade: number) =>
    api.post('/creditos/comprar', { quantidade }).then((r) => r.data),
  confirmarPagamento: (transacaoId: number) =>
    api.post(`/creditos/confirmar-pagamento/${transacaoId}`).then((r) => r.data),
  historico: () => api.get('/creditos/historico').then((r) => r.data),
  adminAjustar: (
    confeccaoId: number,
    data: { quantidade: number; operacao: 'adicionar' | 'remover' | 'definir'; motivo?: string }
  ) => api.post(`/admin/confeccoes/${confeccaoId}/creditos`, data).then((r) => r.data),
}

export interface ShopItem {
  id: string
  db_id?: number
  codigo?: string
  nome: string
  categoria: 'artes' | 'ia' | 'servicos' | 'urgencia' | 'combos' | string
  quantidade: number
  valor: number
  valor_original?: number
  descricao: string
  entrega_sla: string
  badge?: string
  destaque?: boolean
  icone?: string
  imagem?: string
  itens_inclusos: string[]
  ativo?: boolean
  ordem?: number
}

export interface ShopPedido {
  id: number
  confeccao_id: number | null
  user_id: number
  item_id: string
  item_nome: string
  categoria: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  status: 'pendente' | 'pago' | 'concluido' | 'cancelado'
  txid?: string
  pix_codigo?: string
  pix_qrcode?: string
  detalhes?: string
  pago_em?: string
  concluido_em?: string
  created_at: string
  confeccao?: { id: number; nome: string }
  user?: { id: number; name: string; email: string }
}

export interface ShopDados {
  itens: ShopItem[]
  saldo: {
    is_admin: boolean
    artes_extras: number
    creditos_ia: number
    artes_usadas_mes: number
    limite_mensal: number
    artes_disponiveis: number
    confeccao_nome?: string
  }
}

export const shopService = {
  listarItens: (): Promise<ShopDados> => api.get('/shop/itens').then((r) => r.data),
  comprar: (data: { item_id: string; detalhes?: string; pedido_id?: number }) =>
    api.post('/shop/comprar', data).then((r) => r.data),
  confirmarPagamento: (pedidoId: number) =>
    api.post(`/shop/pedidos/${pedidoId}/confirmar-pagamento`).then((r) => r.data),
  meusPedidos: (): Promise<ShopPedido[]> => api.get('/shop/pedidos').then((r) => r.data),
  adminPedidos: (params?: { status?: string; categoria?: string; confeccao_id?: number }) =>
    api.get('/admin/shop/pedidos', { params }).then((r) => r.data),
  adminAtualizarStatus: (pedidoId: number, data: { status: string; detalhes?: string }) =>
    api.patch(`/admin/shop/pedidos/${pedidoId}`, data).then((r) => r.data),

  // Gestão de Itens e Combos do Catálogo (Admin)
  adminListarItens: (params?: { categoria?: string; search?: string; ativo?: string }): Promise<ShopItem[]> =>
    api.get('/admin/shop/itens', { params }).then((r) => r.data),
  adminCriarItem: (data: FormData | Record<string, unknown>) =>
    api.post('/admin/shop/itens', data).then((r) => r.data),
  adminAtualizarItem: (id: number, data: FormData | Record<string, unknown>) =>
    api.post(`/admin/shop/itens/${id}`, data).then((r) => r.data),
  adminToggleAtivo: (id: number) =>
    api.patch(`/admin/shop/itens/${id}/toggle-ativo`).then((r) => r.data),
  adminExcluirItem: (id: number) =>
    api.delete(`/admin/shop/itens/${id}`).then((r) => r.data),
}

// ─── Portfólio / Catálogo de Trabalhos Realizados ──────────────────────────

export interface PortfolioItem {
  id: number
  titulo: string
  categoria: string
  servico?: string
  subtitulo?: string
  descricao?: string
  imagem_principal: string
  galeria?: string[]
  cliente?: string
  ano?: string
  tecido?: string
  tecnica?: string
  cores?: string[]
  tags?: string[]
  destaque: boolean
  curtidas: number
  ordem: number
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export interface PortfolioResposta {
  itens: PortfolioItem[]
  metricas: {
    total: number
    destaques: number
    total_curtidas: number
    categorias: Record<string, number>
    servicos?: Record<string, number>
  }
}

export const portfolioService = {
  listar: (params?: {
    categoria?: string
    servico?: string
    busca?: string
    destaque_only?: boolean
    incluir_inativos?: boolean
  }): Promise<PortfolioResposta> =>
    api.get('/portfolio', { params }).then((r) => r.data),
  buscar: (id: number): Promise<PortfolioItem> =>
    api.get(`/portfolio/${id}`).then((r) => r.data),
  curtir: (id: number): Promise<{ success: boolean; curtidas: number }> =>
    api.post(`/portfolio/${id}/curtir`).then((r) => r.data),
  adminCriar: (data: FormData | Record<string, unknown>): Promise<PortfolioItem> =>
    api.post('/admin/portfolio', data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }).then((r) => r.data),
  adminAtualizar: (id: number, data: FormData | Record<string, unknown>): Promise<PortfolioItem> =>
    api.post(`/admin/portfolio/${id}`, data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }).then((r) => r.data),
  adminToggleDestaque: (id: number) =>
    api.patch(`/admin/portfolio/${id}/toggle-destaque`).then((r) => r.data),
  adminToggleAtivo: (id: number) =>
    api.patch(`/admin/portfolio/${id}/toggle-ativo`).then((r) => r.data),
  adminExcluir: (id: number) =>
    api.delete(`/admin/portfolio/${id}`).then((r) => r.data),
}



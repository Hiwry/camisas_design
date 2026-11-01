import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { confeccaoService, creditoService } from '@/services/api'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Coins,
  Eye,
  Edit3,
  SlidersHorizontal,
  Package,
  Power,
  Trash2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  AlertTriangle,
  Sparkles,
  Smartphone,
  Mail,
  Phone,
  Calendar,
  Layers,
} from 'lucide-react'

// Paleta de Referência:
// Background: #0B0B0C
// Cards: #151516
// Superfícies: #1D1D1F
// Bordas: #303034
// Primária: #E7B32C
// Texto Principal: #F5F5F6
// Texto Secundário: #909098
// Status Ativo: #45DB92

export interface ConfeccaoItem {
  id: number
  user_id?: number | null
  nome: string
  email?: string | null
  telefone?: string | null
  whatsapp?: string | null
  plano: 'avulso' | 'basico' | 'profissional' | 'premium' | string
  limite_mensal: number
  artes_usadas_mes: number
  artes_extras?: number
  creditos_ia?: number
  reset_em?: string
  ativo: boolean
  pedidos_count?: number
  user?: {
    id: number
    name: string
    email: string
  } | null
}

const PLANO_CFG: Record<string, { label: string; limite: number; sla: string }> = {
  avulso:       { label: 'AVULSO', limite: 0,  sla: '48h' },
  basico:       { label: 'START',  limite: 10, sla: '48h' },
  profissional: { label: 'PRO',    limite: 20, sla: '24h' },
  premium:      { label: 'VIP',    limite: 35, sla: '12h' },
}

function getInitials(name: string): string {
  if (!name) return 'CD'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ConfeccoesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Estados de Filtros e Busca
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [planoFilter, setPlanoFilter] = useState<string>('todos')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const ITENS_POR_PAGINA = 10

  // Modais
  const [showCriarModal, setShowCriarModal] = useState(false)
  const [criarLogin, setCriarLogin] = useState(false)

  const [confeccaoDetalhes, setConfeccaoDetalhes] = useState<ConfeccaoItem | null>(null)
  const [confeccaoEditar, setConfeccaoEditar] = useState<ConfeccaoItem | null>(null)
  const [confeccaoAlterarPlano, setConfeccaoAlterarPlano] = useState<ConfeccaoItem | null>(null)
  const [confeccaoAjustarCreditos, setConfeccaoAjustarCreditos] = useState<ConfeccaoItem | null>(null)
  const [confeccaoExcluir, setConfeccaoExcluir] = useState<ConfeccaoItem | null>(null)

  // Formulário de Créditos IA
  const [ajusteQtd, setAjusteQtd] = useState<number>(5)
  const [ajusteOp, setAjusteOp] = useState<'adicionar' | 'remover' | 'definir'>('adicionar')
  const [ajusteMotivo, setAjusteMotivo] = useState('')

  // Formulário de Alterar Plano
  const [novoPlano, setNovoPlano] = useState<string>('profissional')
  const [novoLimiteCustom, setNovoLimiteCustom] = useState<number>(20)

  // Menu Dropdown de Ações com Posicionamento Fixo (Flutua livremente fora do overflow da tabela)
  const [menuAnchor, setMenuAnchor] = useState<{
    top: number
    right: number
    openUpwards: boolean
    confeccao: ConfeccaoItem
  } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Fecha dropdown ao clicar fora, rolar ou redimensionar a tela
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAnchor(null)
      }
    }
    function handleScrollOrResize() {
      setMenuAnchor(null)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAnchor(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Consulta de Confecções
  const { data, isLoading } = useQuery({
    queryKey: ['confeccoes'],
    queryFn: () => confeccaoService.listar(),
  })

  const confeccoes: ConfeccaoItem[] = useMemo(() => {
    if (!data) return []
    return Array.isArray(data) ? data : (data?.data ?? [])
  }, [data])

  // Filtragem
  const confeccoesFiltradas = useMemo(() => {
    return confeccoes.filter((c) => {
      const matchBusca =
        !search.trim() ||
        c.nome.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.user?.email && c.user.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.whatsapp && c.whatsapp.includes(search))

      const matchStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativo' && c.ativo) ||
        (statusFilter === 'inativo' && !c.ativo)

      const matchPlano = planoFilter === 'todos' || c.plano === planoFilter

      return matchBusca && matchStatus && matchPlano
    })
  }, [confeccoes, search, statusFilter, planoFilter])

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(confeccoesFiltradas.length / ITENS_POR_PAGINA))
  const confeccoesPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return confeccoesFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [confeccoesFiltradas, paginaAtual])

  // Indicadores Superiores (Métricas reais)
  const totalCadastradas = confeccoes.length
  const totalAtivas = confeccoes.filter((c) => c.ativo).length

  // Pedidos e Limites
  const pedidosUsadosTotal = confeccoes.reduce((acc, c) => acc + (c.artes_usadas_mes || 0), 0)
  const limitePeriodoTotal = confeccoes.reduce((acc, c) => acc + (c.limite_mensal || 0), 0)
  const creditosIaTotal = confeccoes.reduce((acc, c) => acc + (c.creditos_ia || 0), 0)

  // ── MUTAÇÕES ──────────────────────────────────────────────────────────────

  // Criar confecção
  const criarMutation = useMutation({
    mutationFn: confeccaoService.criar,
    onSuccess: () => {
      toast.success('Confecção cadastrada com sucesso!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setShowCriarModal(false)
      setCriarLogin(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao cadastrar confecção.'
      toast.error(msg)
    },
  })

  // Editar cadastro
  const editarMutation = useMutation({
    mutationFn: (payload: { id: number; data: Record<string, any> }) =>
      confeccaoService.atualizar(payload.id, payload.data),
    onSuccess: () => {
      toast.success('Dados da confecção atualizados!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setConfeccaoEditar(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao atualizar dados.'
      toast.error(msg)
    },
  })

  // Alterar Plano
  const alterarPlanoMutation = useMutation({
    mutationFn: (payload: { id: number; plano: string; limite_mensal: number }) =>
      confeccaoService.atualizar(payload.id, {
        plano: payload.plano,
        limite_mensal: payload.limite_mensal,
      }),
    onSuccess: () => {
      toast.success('Plano e limite mensal atualizados com sucesso!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setConfeccaoAlterarPlano(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao alterar plano.'
      toast.error(msg)
    },
  })

  // Alternar Status Ativo / Inativo
  const alternarStatusMutation = useMutation({
    mutationFn: (payload: { id: number; ativo: boolean }) =>
      confeccaoService.atualizar(payload.id, { ativo: payload.ativo }),
    onSuccess: (_, vars) => {
      toast.success(vars.ativo ? 'Confecção ativada!' : 'Confecção desativada!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setMenuAbertoId(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao alterar status.'
      toast.error(msg)
    },
  })

  // Ajustar Créditos IA
  const ajustarCreditosMutation = useMutation({
    mutationFn: () => {
      if (!confeccaoAjustarCreditos) return Promise.reject('Nenhuma confecção selecionada')
      return creditoService.adminAjustar(confeccaoAjustarCreditos.id, {
        quantidade: ajusteQtd,
        operacao: ajusteOp,
        motivo: ajusteMotivo.trim() || undefined,
      })
    },
    onSuccess: (res) => {
      toast.success(res?.message || 'Créditos atualizados!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setConfeccaoAjustarCreditos(null)
      setAjusteMotivo('')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao atualizar créditos.'
      toast.error(msg)
    },
  })

  // Excluir confecção
  const excluirMutation = useMutation({
    mutationFn: (id: number) => confeccaoService.excluir(id),
    onSuccess: () => {
      toast.success('Confecção removida!')
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setConfeccaoExcluir(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao remover confecção.'
      toast.error(msg)
    },
  })

  // Handler do Form de Cadastro
  function handleCriarSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload = Object.fromEntries(formData)
    criarMutation.mutate(payload)
  }

  // Handler do Form de Edição
  function handleEditarSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!confeccaoEditar) return
    const formData = new FormData(e.currentTarget)
    const payload = Object.fromEntries(formData)
    editarMutation.mutate({ id: confeccaoEditar.id, data: payload })
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-screen overflow-y-auto px-4 sm:px-6 md:px-8 py-6"
      style={{ backgroundColor: '#0B0B0C' }}
    >
      {/* ── BREADCRUMB ── */}
      <nav className="flex items-center gap-2 text-xs text-[#909098] mb-3 select-none">
        <span className="hover:text-[#F5F5F6] cursor-pointer transition-colors" onClick={() => navigate('/dashboard')}>
          Painel
        </span>
        <span className="text-zinc-600">/</span>
        <span>Gestão</span>
        <span className="text-zinc-600">/</span>
        <span className="text-[#F5F5F6] font-medium">Confecções</span>
      </nav>

      {/* ── CABEÇALHO ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F6]">
            Confecções
          </h1>
          <p className="text-sm text-[#909098] mt-1">
            Gerencie seus parceiros, planos e créditos de inteligência artificial.
          </p>
        </div>

        <button
          onClick={() => setShowCriarModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 shadow-sm active:scale-[0.98] select-none"
          style={{
            backgroundColor: '#E7B32C',
            color: '#0B0B0C',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3c13e')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E7B32C')}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nova confecção</span>
        </button>
      </div>

      {/* ── 4 INDICADORES SUPERIORES (GRID) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total de Confecções */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
            TOTAL DE CONFECÇÕES
          </span>
          <div className="my-2 text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {isLoading ? (
              <div className="h-9 w-16 bg-[#1D1D1F] rounded animate-pulse" />
            ) : (
              String(totalCadastradas).padStart(2, '0')
            )}
          </div>
          <span className="text-xs text-[#909098]">Parceiros cadastrados</span>
        </div>

        {/* Card 2: Confecções Ativas */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
            CONFECÇÕES ATIVAS
          </span>
          <div className="my-2 text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {isLoading ? (
              <div className="h-9 w-16 bg-[#1D1D1F] rounded animate-pulse" />
            ) : (
              String(totalAtivas).padStart(2, '0')
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#45DB92' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#45DB92' }}></span>
            <span>Em operação</span>
          </div>
        </div>

        {/* Card 3: Pedidos Utilizados */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
            PEDIDOS UTILIZADOS
          </span>
          <div className="my-2 flex items-center justify-between gap-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#F5F5F6] tracking-tight">
              {isLoading ? (
                <div className="h-9 w-24 bg-[#1D1D1F] rounded animate-pulse" />
              ) : (
                <>
                  {pedidosUsadosTotal}{' '}
                  <span className="text-lg text-[#909098] font-normal">/ {limitePeriodoTotal || '—'}</span>
                </>
              )}
            </div>

            {!isLoading && limitePeriodoTotal > 0 && (
              <div className="w-20 sm:w-24 h-2 rounded-full overflow-hidden bg-[#262629]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((pedidosUsadosTotal / limitePeriodoTotal) * 100))}%`,
                    backgroundColor: '#E7B32C',
                  }}
                />
              </div>
            )}
          </div>
          <span className="text-xs text-[#909098]">Limite do período atual</span>
        </div>

        {/* Card 4: Créditos IA Disponíveis */}
        <div
          className="p-5 rounded-xl border flex flex-col justify-between transition-all"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#909098]">
            CRÉDITOS IA DISPONÍVEIS
          </span>
          <div className="my-2 text-3xl sm:text-4xl font-bold text-[#F5F5F6] tracking-tight">
            {isLoading ? (
              <div className="h-9 w-16 bg-[#1D1D1F] rounded animate-pulse" />
            ) : (
              creditosIaTotal
            )}
          </div>
          <span className="text-xs text-[#909098]">Saldo total disponível</span>
        </div>
      </div>

      {/* ── CONTAINER DA LISTA DE CONFECÇÕES ── */}
      <div
        className="rounded-xl border flex flex-col overflow-hidden shadow-sm"
        style={{ backgroundColor: '#151516', borderColor: '#303034' }}
      >
        {/* Topo do Container: Título + Busca + Filtros */}
        <div className="p-4 sm:p-5 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4" style={{ borderColor: '#303034' }}>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#F5F5F6]">
              Lista de confecções
            </h2>
            <p className="text-xs text-[#909098] mt-0.5">
              Visualize e administre suas confecções cadastradas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#909098]" />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPaginaAtual(1)
                }}
                className="w-full text-xs rounded-lg pl-9 pr-3 py-2 outline-none transition-colors"
                style={{
                  backgroundColor: '#1D1D1F',
                  border: '1px solid #303034',
                  color: '#F5F5F6',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
              />
            </div>

            {/* Filtro de Status */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any)
                setPaginaAtual(1)
              }}
              className="text-xs rounded-lg px-3 py-2 outline-none cursor-pointer transition-colors"
              style={{
                backgroundColor: '#1D1D1F',
                border: '1px solid #303034',
                color: '#F5F5F6',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
            >
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>

            {/* Filtro de Plano */}
            <select
              value={planoFilter}
              onChange={(e) => {
                setPlanoFilter(e.target.value)
                setPaginaAtual(1)
              }}
              className="text-xs rounded-lg px-3 py-2 outline-none cursor-pointer transition-colors"
              style={{
                backgroundColor: '#1D1D1F',
                border: '1px solid #303034',
                color: '#F5F5F6',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
            >
              <option value="todos">Todos os planos</option>
              <option value="profissional">PRO</option>
              <option value="basico">START</option>
              <option value="premium">VIP</option>
              <option value="avulso">AVULSO</option>
            </select>
          </div>
        </div>

        {/* ── TABELA RESPONSIVA ── */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr style={{ backgroundColor: '#151516', borderBottom: '1px solid #303034' }}>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  CONFECÇÃO
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  PLANO
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  USO MENSAL
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  CRÉDITOS IA
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  STATUS
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#909098] uppercase tracking-wider">
                  AÇÕES
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                // Skeleton loading state
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #202024' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#1D1D1F] animate-pulse" />
                        <div className="space-y-1.5">
                          <div className="w-28 h-3.5 bg-[#1D1D1F] rounded animate-pulse" />
                          <div className="w-36 h-2.5 bg-[#1D1D1F] rounded animate-pulse" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-20 h-5 bg-[#1D1D1F] rounded-full animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-24 h-4 bg-[#1D1D1F] rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-16 h-4 bg-[#1D1D1F] rounded animate-pulse" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-14 h-5 bg-[#1D1D1F] rounded-full animate-pulse" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="w-20 h-7 bg-[#1D1D1F] rounded-lg ml-auto animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : confeccoesPaginadas.length === 0 ? (
                // Empty state ou sem resultados na busca
                <tr>
                  <td colSpan={6} className="text-center py-16 px-4">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                        style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034' }}
                      >
                        <Search className="w-5 h-5 text-[#909098]" />
                      </div>
                      <p className="text-sm font-semibold text-[#F5F5F6]">
                        Nenhuma confecção encontrada
                      </p>
                      <p className="text-xs text-[#909098] mt-1">
                        {search || statusFilter !== 'todos' || planoFilter !== 'todos'
                          ? 'Tente ajustar os filtros ou o termo de busca.'
                          : 'Clique em "Nova confecção" para cadastrar seu primeiro parceiro.'}
                      </p>
                      {(search || statusFilter !== 'todos' || planoFilter !== 'todos') && (
                        <button
                          onClick={() => {
                            setSearch('')
                            setStatusFilter('todos')
                            setPlanoFilter('todos')
                          }}
                          className="mt-3 text-xs text-[#E7B32C] hover:underline"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                confeccoesPaginadas.map((c) => {
                  const cfgPlano = PLANO_CFG[c.plano] ?? PLANO_CFG.avulso
                  const limiteEfetivo = c.limite_mensal || cfgPlano.limite || 0
                  const pctUso = limiteEfetivo > 0 ? c.artes_usadas_mes / limiteEfetivo : 0
                  const emailExibicao = c.email || c.user?.email || 'Sem e-mail cadastrado'
                  const initials = getInitials(c.nome)

                  // Rótulo alinhado sem inconsistência
                  const rotuloPlano =
                    c.plano === 'avulso'
                      ? 'AVULSO · Sob Demanda'
                      : `${cfgPlano.label} · ${limiteEfetivo}/mês`

                  return (
                    <tr
                      key={c.id}
                      className="transition-colors group hover:bg-[#1A1A1D]"
                      style={{ borderBottom: '1px solid #202024' }}
                    >
                      {/* Coluna 1: CONFECÇÃO */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 select-none shadow-inner"
                            style={{
                              backgroundColor: '#241C10',
                              color: '#E7B32C',
                              border: '1px solid rgba(231,179,44,0.25)',
                            }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-[#F5F5F6] block truncate">
                              {c.nome}
                            </span>
                            <span className="text-xs text-[#909098] block truncate mt-0.5">
                              {emailExibicao}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: PLANO */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold select-none"
                          style={{
                            backgroundColor: '#2A2210',
                            border: '1px solid rgba(231,179,44,0.3)',
                            color: '#E7B32C',
                          }}
                        >
                          {rotuloPlano}
                        </span>
                      </td>

                      {/* Coluna 3: USO MENSAL */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {c.plano === 'avulso' ? (
                          <span className="text-xs text-[#F5F5F6] font-medium">
                            <strong>{c.artes_usadas_mes}</strong>{' '}
                            {c.artes_usadas_mes === 1 ? 'pedido' : 'pedidos'}
                          </span>
                        ) : (
                          <div>
                            <div className="text-xs font-semibold text-[#F5F5F6]">
                              {c.artes_usadas_mes} / {limiteEfetivo}
                            </div>
                            <div className="w-20 sm:w-24 h-1.5 rounded-full overflow-hidden bg-[#262629] mt-1.5">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(100, Math.round(pctUso * 100))}%`,
                                  backgroundColor:
                                    pctUso >= 1 ? '#EF4444' : pctUso >= 0.8 ? '#F59E0B' : '#E7B32C',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Coluna 4: CRÉDITOS IA */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs font-medium text-[#F5F5F6]">
                          {c.creditos_ia ?? 0} créditos
                        </span>
                      </td>

                      {/* Coluna 5: STATUS */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {c.ativo ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                            style={{
                              backgroundColor: '#0E291C',
                              border: '1px solid #155E38',
                              color: '#45DB92',
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#45DB92' }}></span>
                            <span>Ativo</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                            style={{
                              backgroundColor: '#2A1316',
                              border: '1px solid #7F1D1D',
                              color: '#F87171',
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F87171' }}></span>
                            <span>Inativo</span>
                          </span>
                        )}
                      </td>

                      {/* Coluna 6: AÇÕES */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (menuAnchor?.confeccao.id === c.id) {
                              setMenuAnchor(null)
                              return
                            }
                            const rect = e.currentTarget.getBoundingClientRect()
                            const spaceBelow = window.innerHeight - rect.bottom
                            const openUpwards = spaceBelow < 300 && rect.top > 300
                            setMenuAnchor({
                              top: openUpwards ? rect.top - 8 : rect.bottom + 8,
                              right: Math.max(16, window.innerWidth - rect.right),
                              openUpwards,
                              confeccao: c,
                            })
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none"
                          style={{
                            backgroundColor: menuAnchor?.confeccao.id === c.id ? '#241C10' : '#1D1D1F',
                            border: `1px solid ${menuAnchor?.confeccao.id === c.id ? '#E7B32C' : '#303034'}`,
                            color: menuAnchor?.confeccao.id === c.id ? '#E7B32C' : '#F5F5F6',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#E7B32C'
                            e.currentTarget.style.color = '#E7B32C'
                          }}
                          onMouseLeave={(e) => {
                            if (menuAnchor?.confeccao.id !== c.id) {
                              e.currentTarget.style.borderColor = '#303034'
                              e.currentTarget.style.color = '#F5F5F6'
                            }
                          }}
                        >
                          <span>Gerenciar</span>
                          <span className="text-[#909098]">...</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── FOOTER DA TABELA: PAGINAÇÃO ── */}
        <div
          className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#909098]"
          style={{ borderColor: '#303034' }}
        >
          <span>
            Exibindo {confeccoesPaginadas.length} de {confeccoesFiltradas.length}{' '}
            {confeccoesFiltradas.length === 1 ? 'confecção' : 'confecções'}
          </span>

          <div className="flex items-center gap-2">
            <span>
              Página {paginaAtual} de {totalPaginas}
            </span>
            <div className="flex items-center gap-1 ml-2">
              <button
                disabled={paginaAtual <= 1}
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                className="p-1 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={paginaAtual >= totalPaginas}
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                className="p-1 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER INFERIOR: CONTROLE CENTRALIZADO ── */}
      <div
        className="p-4 rounded-xl border mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{
          backgroundColor: '#151516',
          borderColor: 'rgba(231,179,44,0.3)',
        }}
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-[#E7B32C]">
            <span>+ CONTROLE CENTRALIZADO</span>
          </div>
          <p className="text-xs text-[#909098] mt-1">
            Gerencie planos, créditos, pedidos e dados dos parceiros em um só lugar.
          </p>
        </div>
      </div>

      {/* ── DROPDOWN FLUTUANTE DE AÇÕES (FIXO, SEMPRE FORA DO OVERFLOW) ── */}
      {menuAnchor && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuAnchor.openUpwards ? undefined : `${menuAnchor.top}px`,
            bottom: menuAnchor.openUpwards ? `${window.innerHeight - menuAnchor.top}px` : undefined,
            right: `${menuAnchor.right}px`,
            backgroundColor: '#151516',
            borderColor: '#303034',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
          className="w-56 rounded-xl py-1.5 z-[100] animate-[slideUp_0.15s_ease-out] text-left border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b mb-1" style={{ borderColor: '#202024' }}>
            <p className="text-[10px] uppercase font-semibold text-[#909098] tracking-wider">
              Ações para parceiro
            </p>
            <p className="text-xs font-bold text-[#F5F5F6] truncate">
              {menuAnchor.confeccao.nome}
            </p>
          </div>

          {/* 1. Visualizar detalhes */}
          <button
            onClick={() => {
              setConfeccaoDetalhes(menuAnchor.confeccao)
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#909098]" />
            <span>Visualizar detalhes</span>
          </button>

          {/* 2. Editar cadastro */}
          <button
            onClick={() => {
              setConfeccaoEditar(menuAnchor.confeccao)
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#909098]" />
            <span>Editar cadastro</span>
          </button>

          {/* 3. Alterar plano */}
          <button
            onClick={() => {
              setConfeccaoAlterarPlano(menuAnchor.confeccao)
              setNovoPlano(menuAnchor.confeccao.plano)
              setNovoLimiteCustom(
                menuAnchor.confeccao.limite_mensal ||
                  PLANO_CFG[menuAnchor.confeccao.plano]?.limite ||
                  10
              )
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#E7B32C]" />
            <span>Alterar plano</span>
          </button>

          {/* 4. Gerenciar créditos IA */}
          <button
            onClick={() => {
              setConfeccaoAjustarCreditos(menuAnchor.confeccao)
              setAjusteQtd(5)
              setAjusteOp('adicionar')
              setAjusteMotivo('')
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Coins className="w-3.5 h-3.5 text-[#E7B32C]" />
            <span>Gerenciar créditos IA</span>
          </button>

          {/* 5. Consultar pedidos */}
          <button
            onClick={() => {
              const confId = menuAnchor.confeccao.id
              setMenuAnchor(null)
              navigate(`/pedidos?confeccao_id=${confId}`)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <Package className="w-3.5 h-3.5 text-[#909098]" />
            <span>Consultar pedidos</span>
          </button>

          <div className="border-t my-1" style={{ borderColor: '#202024' }} />

          {/* 6. Ativar / Desativar */}
          <button
            onClick={() => {
              alternarStatusMutation.mutate({
                id: menuAnchor.confeccao.id,
                ativo: !menuAnchor.confeccao.ativo,
              })
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[#1D1D1F]"
            style={{ color: menuAnchor.confeccao.ativo ? '#F87171' : '#45DB92' }}
          >
            <Power className="w-3.5 h-3.5" />
            <span>
              {menuAnchor.confeccao.ativo
                ? 'Desativar confecção'
                : 'Ativar confecção'}
            </span>
          </button>

          {/* 7. Excluir com confirmação */}
          <button
            onClick={() => {
              setConfeccaoExcluir(menuAnchor.confeccao)
              setMenuAnchor(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir parceiro</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAIS DO SISTEMA
         ══════════════════════════════════════════════════════════════════════════ */}

      {/* ── MODAL: NOVA CONFECÇÃO ── */}
      {showCriarModal && (
        <ModalContainer title="Cadastrar Nova Confecção" onClose={() => setShowCriarModal(false)}>
          <form onSubmit={handleCriarSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                Nome da Confecção ou Empresa *
              </label>
              <input
                name="nome"
                required
                placeholder="Ex: Fardamentos Real / Estamparia Modelo"
                className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                  WhatsApp (Rastreio e Bot)
                </label>
                <input
                  name="whatsapp"
                  placeholder="(81) 98888-7777"
                  className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                  style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                  Telefone Fixo / Adicional
                </label>
                <input
                  name="telefone"
                  placeholder="(81) 3333-2222"
                  className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                  style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                Plano de Assinatura *
              </label>
              <select
                name="plano"
                defaultValue="profissional"
                required
                className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors cursor-pointer"
                style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
              >
                <option value="profissional">PRO — 20 artes/mês · Entrega 24h</option>
                <option value="basico">START — 10 artes/mês · Entrega 48h</option>
                <option value="premium">VIP — 35 artes/mês · Entrega 12h</option>
                <option value="avulso">AVULSO — Demanda pontual (Sem mensalidade)</option>
              </select>
            </div>

            {/* Checkbox: Criar usuário de login */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5"
              style={{ backgroundColor: '#1D1D1F', borderColor: '#303034' }}
            >
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="criar_usuario"
                  value="1"
                  checked={criarLogin}
                  onChange={(e) => setCriarLogin(e.target.checked)}
                  className="mt-0.5 rounded border-[#303034] text-[#E7B32C] focus:ring-[#E7B32C]"
                />
                <div>
                  <span className="text-xs font-semibold text-[#F5F5F6] block">
                    Criar conta de acesso com e-mail e senha
                  </span>
                  <span className="text-[11px] text-[#909098] block leading-relaxed mt-0.5">
                    Permite que o parceiro faça login no portal para abrir pedidos e acompanhar produção.
                  </span>
                </div>
              </label>

              {criarLogin ? (
                <div className="pt-2 border-t space-y-3" style={{ borderColor: '#303034' }}>
                  <div>
                    <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                      E-mail de Login *
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="parceiro@email.com"
                      className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                      style={{ backgroundColor: '#151516', border: '1px solid #303034', color: '#F5F5F6' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                      Senha Inicial * (mín. 8 caracteres)
                    </label>
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      placeholder="••••••••"
                      className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                      style={{ backgroundColor: '#151516', border: '1px solid #303034', color: '#F5F5F6' }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-[#909098] block mb-1">
                    E-mail de Notificação (opcional)
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="contato@empresa.com"
                    className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                    style={{ backgroundColor: '#151516', border: '1px solid #303034', color: '#F5F5F6' }}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCriarModal(false)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={criarMutation.isPending}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#E7B32C', color: '#0B0B0C' }}
              >
                {criarMutation.isPending ? 'Cadastrando...' : 'Cadastrar Confecção'}
              </button>
            </div>
          </form>
        </ModalContainer>
      )}

      {/* ── MODAL: DETALHES DA CONFECÇÃO ── */}
      {confeccaoDetalhes && (
        <ModalContainer title={`Detalhes — ${confeccaoDetalhes.nome}`} onClose={() => setConfeccaoDetalhes(null)}>
          <div className="space-y-4">
            {/* Header com Avatar */}
            <div
              className="p-4 rounded-xl border flex items-center gap-3.5"
              style={{ backgroundColor: '#1D1D1F', borderColor: '#303034' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner"
                style={{ backgroundColor: '#241C10', color: '#E7B32C', border: '1px solid rgba(231,179,44,0.3)' }}
              >
                {getInitials(confeccaoDetalhes.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-[#F5F5F6] truncate">{confeccaoDetalhes.nome}</h4>
                <p className="text-xs text-[#909098] truncate">{confeccaoDetalhes.email || 'Sem e-mail cadastrado'}</p>
              </div>
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor: confeccaoDetalhes.ativo ? '#0E291C' : '#2A1316',
                  color: confeccaoDetalhes.ativo ? '#45DB92' : '#F87171',
                  border: `1px solid ${confeccaoDetalhes.ativo ? '#155E38' : '#7F1D1D'}`,
                }}
              >
                {confeccaoDetalhes.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Grid de Informações */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border" style={{ backgroundColor: '#151516', borderColor: '#303034' }}>
                <span className="text-[#909098] block text-[10px] uppercase font-semibold">Plano Atual</span>
                <span className="text-[#E7B32C] font-bold mt-1 block">
                  {PLANO_CFG[confeccaoDetalhes.plano]?.label ?? confeccaoDetalhes.plano}
                </span>
                <span className="text-[11px] text-[#909098] block mt-0.5">
                  SLA: {PLANO_CFG[confeccaoDetalhes.plano]?.sla ?? '48h'}
                </span>
              </div>

              <div className="p-3 rounded-lg border" style={{ backgroundColor: '#151516', borderColor: '#303034' }}>
                <span className="text-[#909098] block text-[10px] uppercase font-semibold">Uso no Mês</span>
                <span className="text-[#F5F5F6] font-bold mt-1 block">
                  {confeccaoDetalhes.artes_usadas_mes} / {confeccaoDetalhes.limite_mensal || '∞'}
                </span>
                <span className="text-[11px] text-[#909098] block mt-0.5">
                  Artes extras: {confeccaoDetalhes.artes_extras ?? 0}
                </span>
              </div>

              <div className="p-3 rounded-lg border" style={{ backgroundColor: '#151516', borderColor: '#303034' }}>
                <span className="text-[#909098] block text-[10px] uppercase font-semibold">Créditos de IA</span>
                <span className="text-[#F5F5F6] font-bold mt-1 block flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-[#E7B32C]" />
                  {confeccaoDetalhes.creditos_ia ?? 0} análises
                </span>
              </div>

              <div className="p-3 rounded-lg border" style={{ backgroundColor: '#151516', borderColor: '#303034' }}>
                <span className="text-[#909098] block text-[10px] uppercase font-semibold">Total de Pedidos</span>
                <span className="text-[#F5F5F6] font-bold mt-1 block flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#909098]" />
                  {confeccaoDetalhes.pedidos_count ?? 0} pedidos
                </span>
              </div>
            </div>

            {/* Contatos */}
            <div className="p-3 rounded-xl border space-y-2 text-xs" style={{ backgroundColor: '#151516', borderColor: '#303034' }}>
              <span className="text-[#909098] block text-[10px] uppercase font-semibold">Canais de Contato</span>

              <div className="flex items-center justify-between">
                <span className="text-[#909098] flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-[#45DB92]" /> WhatsApp:
                </span>
                {confeccaoDetalhes.whatsapp ? (
                  <a
                    href={`https://wa.me/55${confeccaoDetalhes.whatsapp.replace(/\D/g, '').replace(/^55/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#45DB92] hover:underline flex items-center gap-1"
                  >
                    <span>{confeccaoDetalhes.whatsapp}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-zinc-600">Não informado</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#909098] flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#909098]" /> E-mail:
                </span>
                <span className="text-[#F5F5F6]">{confeccaoDetalhes.email || 'Não informado'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#909098] flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#909098]" /> Acesso Web:
                </span>
                <span className="text-[#F5F5F6]">
                  {confeccaoDetalhes.user_id ? 'Possui login cadastrado' : 'Acompanha por WhatsApp'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfeccaoDetalhes(null)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfeccaoEditar(confeccaoDetalhes)
                  setConfeccaoDetalhes(null)
                }}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all"
                style={{ backgroundColor: '#E7B32C', color: '#0B0B0C' }}
              >
                Editar Cadastro
              </button>
            </div>
          </div>
        </ModalContainer>
      )}

      {/* ── MODAL: EDITAR CADASTRO ── */}
      {confeccaoEditar && (
        <ModalContainer title={`Editar — ${confeccaoEditar.nome}`} onClose={() => setConfeccaoEditar(null)}>
          <form onSubmit={handleEditarSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                Nome da Confecção *
              </label>
              <input
                name="nome"
                required
                defaultValue={confeccaoEditar.nome}
                className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                E-mail
              </label>
              <input
                name="email"
                type="email"
                defaultValue={confeccaoEditar.email || confeccaoEditar.user?.email || ''}
                placeholder="contato@empresa.com"
                className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                  WhatsApp
                </label>
                <input
                  name="whatsapp"
                  defaultValue={confeccaoEditar.whatsapp || ''}
                  placeholder="(81) 98888-7777"
                  className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                  style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                  Telefone Fixo
                </label>
                <input
                  name="telefone"
                  defaultValue={confeccaoEditar.telefone || ''}
                  placeholder="(81) 3333-2222"
                  className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                  style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E7B32C')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#303034')}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfeccaoEditar(null)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editarMutation.isPending}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#E7B32C', color: '#0B0B0C' }}
              >
                {editarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </ModalContainer>
      )}

      {/* ── MODAL: ALTERAR PLANO ── */}
      {confeccaoAlterarPlano && (
        <ModalContainer
          title={`Alterar Plano — ${confeccaoAlterarPlano.nome}`}
          onClose={() => setConfeccaoAlterarPlano(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-[#909098]">
              Selecione o novo plano para atualizar o limite de pedidos mensais e o prazo de entrega (SLA).
            </p>

            <div className="space-y-2">
              {[
                { id: 'profissional', label: 'PRO', limite: 20, sla: '24h', desc: 'Ideal para confecções ativas' },
                { id: 'basico', label: 'START', limite: 10, sla: '48h', desc: 'Para pequenas estamparias' },
                { id: 'premium', label: 'VIP', limite: 35, sla: '12h', desc: 'Produção contínua prioritária' },
                { id: 'avulso', label: 'AVULSO', limite: 0, sla: '48h', desc: 'Sob demanda sem cota fixa' },
              ].map((p) => {
                const isSelected = novoPlano === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setNovoPlano(p.id)
                      setNovoLimiteCustom(p.limite)
                    }}
                    className="p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
                    style={{
                      backgroundColor: isSelected ? 'rgba(231,179,44,0.1)' : '#1D1D1F',
                      borderColor: isSelected ? '#E7B32C' : '#303034',
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F5F5F6]">{p.label}</span>
                        <span className="text-[11px] text-[#E7B32C] font-semibold">
                          {p.id === 'avulso' ? 'Sob Demanda' : `${p.limite} pedidos/mês`}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#909098] block mt-0.5">{p.desc} · SLA {p.sla}</span>
                    </div>

                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: isSelected ? '#E7B32C' : '#303034',
                        backgroundColor: isSelected ? '#E7B32C' : 'transparent',
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-[#0B0B0C] stroke-[3]" />}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Limite Customizado */}
            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                Limite Mensal de Pedidos
              </label>
              <input
                type="number"
                min="0"
                max="999"
                value={novoLimiteCustom}
                onChange={(e) => setNovoLimiteCustom(Math.max(0, Number(e.target.value)))}
                className="w-full text-xs rounded-lg px-3 py-2 outline-none transition-colors"
                style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
              />
              <span className="text-[11px] text-[#909098] mt-1 block">
                Valor utilizado na barra de progresso do período atual.
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfeccaoAlterarPlano(null)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={alterarPlanoMutation.isPending}
                onClick={() =>
                  alterarPlanoMutation.mutate({
                    id: confeccaoAlterarPlano.id,
                    plano: novoPlano,
                    limite_mensal: novoLimiteCustom,
                  })
                }
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#E7B32C', color: '#0B0B0C' }}
              >
                {alterarPlanoMutation.isPending ? 'Salvando...' : 'Confirmar Plano'}
              </button>
            </div>
          </div>
        </ModalContainer>
      )}

      {/* ── MODAL: GERENCIAR CRÉDITOS IA ── */}
      {confeccaoAjustarCreditos && (
        <ModalContainer
          title={`Créditos IA — ${confeccaoAjustarCreditos.nome}`}
          onClose={() => setConfeccaoAjustarCreditos(null)}
        >
          <div className="space-y-4">
            <div
              className="p-3.5 rounded-xl border flex items-center justify-between"
              style={{ backgroundColor: '#1D1D1F', borderColor: '#303034' }}
            >
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#E7B32C]" />
                <span className="text-xs text-[#909098]">Saldo disponível atual:</span>
              </div>
              <span className="text-sm font-bold text-[#F5F5F6]">
                {confeccaoAjustarCreditos.creditos_ia ?? 0} análises
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">Operação</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'adicionar', label: 'Adicionar (+)' },
                  { id: 'remover', label: 'Remover (-)' },
                  { id: 'definir', label: 'Definir (=)' },
                ].map((op) => {
                  const isSelected = ajusteOp === op.id
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setAjusteOp(op.id as any)}
                      className="py-2 text-xs font-semibold rounded-lg border transition-all"
                      style={{
                        backgroundColor: isSelected ? 'rgba(231,179,44,0.15)' : '#1D1D1F',
                        borderColor: isSelected ? '#E7B32C' : '#303034',
                        color: isSelected ? '#E7B32C' : '#909098',
                      }}
                    >
                      {op.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                Quantidade de análises
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={ajusteQtd}
                onChange={(e) => setAjusteQtd(Math.max(1, Number(e.target.value)))}
                className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
              />
              <span className="text-[11px] text-[#909098] mt-1 block">
                Equivalente comercial: R$ {(ajusteQtd * 5).toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#F5F5F6] block mb-1">
                Motivo do ajuste (opcional)
              </label>
              <input
                placeholder="Ex: Pagamento PIX manual / Bonificação"
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
                className="w-full text-xs rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{ backgroundColor: '#1D1D1F', border: '1px solid #303034', color: '#F5F5F6' }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfeccaoAjustarCreditos(null)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={ajustarCreditosMutation.isPending}
                onClick={() => ajustarCreditosMutation.mutate()}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#E7B32C', color: '#0B0B0C' }}
              >
                {ajustarCreditosMutation.isPending ? 'Salvando...' : 'Salvar Créditos'}
              </button>
            </div>
          </div>
        </ModalContainer>
      )}

      {/* ── MODAL: CONFIRMAR EXCLUSÃO ── */}
      {confeccaoExcluir && (
        <ModalContainer title="Confirmar Exclusão" onClose={() => setConfeccaoExcluir(null)}>
          <div className="space-y-4">
            <div
              className="p-3.5 rounded-xl border flex items-start gap-3"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#F5F5F6]">
                  Atenção: Ação irreversível
                </p>
                <p className="text-xs text-[#909098] mt-1">
                  Tem certeza de que deseja excluir a confecção{' '}
                  <strong className="text-[#F5F5F6]">{confeccaoExcluir.nome}</strong>? Se houver conta de login
                  associada, ela também será removida.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfeccaoExcluir(null)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#1D1D1F]"
                style={{ borderColor: '#303034', color: '#F5F5F6' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluirMutation.isPending}
                onClick={() => excluirMutation.mutate(confeccaoExcluir.id)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-[#EF4444] hover:bg-[#DC2626] text-white transition-all disabled:opacity-50"
              >
                {excluirMutation.isPending ? 'Excluindo...' : 'Excluir Definitivamente'}
              </button>
            </div>
          </div>
        </ModalContainer>
      )}
    </div>
  )
}

// ── COMPONENTE DE MODAL DARK PREMIUM ───────────────────────────────────────────
function ModalContainer({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-[fadeIn_0.15s_ease-out]"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl animate-[slideUp_0.2s_ease-out] border"
        style={{
          backgroundColor: '#151516',
          borderColor: '#303034',
          boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#303034' }}
        >
          <h3 className="text-sm font-bold text-[#F5F5F6]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#909098] hover:text-[#F5F5F6] hover:bg-[#1D1D1F] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

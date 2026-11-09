import api from './api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { Grupo, GrupoParticipante, TotaisProducaoResponse } from '@/types/grupo'
import { gerarEBaixarPdfOrdem } from '@/lib/pdfOrdemProducao'

export const grupoService = {
  // Autenticado: listagem e CRUD
  listar: (params?: Record<string, unknown>) =>
    api.get<{ data: Grupo[]; current_page: number; last_page: number; total: number }>('/grupos', { params }).then((r) => r.data),

  buscar: (id: number) =>
    api.get<Grupo>(`/grupos/${id}`).then((r) => r.data),

  criar: (formData: FormData) =>
    api.post<{ message: string; grupo: Grupo }>('/grupos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  atualizar: (id: number, formData: FormData | Record<string, unknown>) =>
    api.post<{ message: string; grupo: Grupo }>(`/grupos/${id}?_method=PUT`, formData, {
      headers: formData instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }).then((r) => r.data),

  duplicar: (id: number, dados: { nome?: string; prazo_limite?: string }) =>
    api.post<{ message: string; grupo: Grupo }>(`/grupos/${id}/duplicar`, dados).then((r) => r.data),

  confirmar: (id: number) =>
    api.post<{ message: string; grupo: Grupo }>(`/grupos/${id}/confirmar`).then((r) => r.data),

  reabrir: (id: number) =>
    api.post<{ message: string; grupo: Grupo }>(`/grupos/${id}/reabrir`).then((r) => r.data),

  excluir: (id: number) =>
    api.delete<{ message: string }>(`/grupos/${id}`).then((r) => r.data),

  // Gestão de participantes e pagamentos
  adicionarParticipante: (grupoId: number, data: Record<string, unknown>) =>
    api.post<{ message: string; participante: GrupoParticipante }>(`/grupos/${grupoId}/participantes`, data).then((r) => r.data),

  atualizarParticipante: (grupoId: number, participanteId: number, data: Record<string, unknown>) =>
    api.put<{ message: string; participante: GrupoParticipante }>(`/grupos/${grupoId}/participantes/${participanteId}`, data).then((r) => r.data),

  excluirParticipante: (grupoId: number, participanteId: number) =>
    api.delete<{ message: string }>(`/grupos/${grupoId}/participantes/${participanteId}`).then((r) => r.data),

  registrarPagamento: (grupoId: number, participanteId: number, data: { valor: number; forma_pagamento: string; data_pagamento: string; observacao?: string }) =>
    api.post(`/grupos/${grupoId}/participantes/${participanteId}/pagamentos`, data).then((r) => r.data),

  excluirPagamento: (grupoId: number, participanteId: number, pagamentoId: number) =>
    api.delete(`/grupos/${grupoId}/participantes/${participanteId}/pagamentos/${pagamentoId}`).then((r) => r.data),

  avaliarSolicitacao: (grupoId: number, solicitacaoId: number, data: { acao: 'aprovar' | 'recusar'; resposta?: string }) =>
    api.post(`/grupos/${grupoId}/solicitacoes/${solicitacaoId}/avaliar`, data).then((r) => r.data),

  // Confecção e Produção
  salvarTabelaMedidas: (grupoId: number, formData: FormData) =>
    api.post(`/grupos/${grupoId}/tabela-medidas`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  atualizarStatusProducao: (grupoId: number, formData: FormData) =>
    api.post(`/grupos/${grupoId}/status-producao`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  totaisProducao: (grupoId: number) =>
    api.get<TotaisProducaoResponse>(`/grupos/${grupoId}/totais-producao`).then((r) => r.data),

  urlExportarCsv: (grupoId: number) => {
    const token = useAuthStore.getState().token
    return `${api.defaults.baseURL}/grupos/${grupoId}/exportar-csv${token ? `?token=${token}` : ''}`
  },

  urlExportarPdf: (grupoId: number) => {
    const token = useAuthStore.getState().token
    return `${api.defaults.baseURL}/grupos/${grupoId}/exportar-pdf${token ? `?token=${token}` : ''}`
  },

  urlImprimirOrdem: (grupoId: number) => {
    const token = useAuthStore.getState().token
    return `${api.defaults.baseURL}/grupos/${grupoId}/imprimir-ordem${token ? `?token=${token}` : ''}`
  },

  baixarPdf: async (grupoId: number, nomeGrupo = 'grupo') => {
    const toastId = toast.loading('Gerando PDF da Ordem de Produção...')
    try {
      // 1. Busca os dados consolidados da produção
      const dados = await grupoService.totaisProducao(grupoId)

      // 2. Gera e baixa o arquivo PDF diretamente no navegador (salva nos Downloads do computador)
      gerarEBaixarPdfOrdem(dados, nomeGrupo)
      toast.success('Download do PDF concluído!', { id: toastId })
    } catch (err: unknown) {
      console.warn('Erro ao gerar PDF localmente, tentando fallback:', err)
      toast.dismiss(toastId)
      // Se falhar, abre a versão HTML pronta para imprimir / Salvar em PDF
      const printUrl = grupoService.urlImprimirOrdem(grupoId)
      window.open(printUrl, '_blank')
      toast('Abrindo ordem para impressão / salvar em PDF...', { icon: '🖨️' })
    }
  },

  baixarCsv: async (grupoId: number, nomeGrupo = 'grupo') => {
    const res = await api.get(`/grupos/${grupoId}/exportar-csv`, {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    const safeName = nomeGrupo.replace(/[^a-zA-Z0-9_-]/g, '_')
    link.setAttribute('download', `ordem_producao_${safeName}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  // Rotas Públicas
  buscarPublico: (token: string, senha?: string) =>
    api.get(`/publico/grupos/${token}`, { params: { senha } }).then((r) => r.data),

  validarSenha: (token: string, senha: string) =>
    api.post<{ valida: boolean; message: string }>(`/publico/grupos/${token}/validar-senha`, { senha }).then((r) => r.data),

  verificarNumero: (token: string, numero: string, ignorarId?: number) =>
    api.get<{ em_uso: boolean; numero: string }>(`/publico/grupos/${token}/verificar-numero`, {
      params: { numero, ignorar_participante_id: ignorarId },
    }).then((r) => r.data),

  participarPublico: (token: string, data: Record<string, unknown>) =>
    api.post(`/publico/grupos/${token}/participar`, data).then((r) => r.data),

  consultarEdicaoPublico: (token: string, tokenEdicao: string) =>
    api.get(`/publico/grupos/${token}/participante/${tokenEdicao}`).then((r) => r.data),

  salvarEdicaoPublico: (token: string, tokenEdicao: string, data: Record<string, unknown>) =>
    api.put(`/publico/grupos/${token}/participante/${tokenEdicao}`, data).then((r) => r.data),

  solicitarForaPrazoPublico: (token: string, data: Record<string, unknown>) =>
    api.post(`/publico/grupos/${token}/solicitar-fora-prazo`, data).then((r) => r.data),
}


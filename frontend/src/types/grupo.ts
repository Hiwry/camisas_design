export interface GrupoModelo {
  id: number
  grupo_id: number
  nome: string
  foto?: string | null
  valor_base: number
  cores?: string[]
  ordem?: number
}

export interface GrupoPagamento {
  id: number
  grupo_participante_id: number
  valor: number
  forma_pagamento: string
  data_pagamento: string
  observacao?: string | null
  registrado_por?: number | null
  created_at?: string
}

export interface GrupoParticipante {
  id: number
  grupo_id: number
  grupo_modelo_id: number
  token_edicao: string
  nome_completo: string
  whatsapp?: string | null
  cor?: string | null
  tamanho?: string | null
  quantidade: number
  nome_camisa?: string | null
  numero_camisa?: string | null
  apelido?: string | null
  frase_costas?: string | null
  observacao?: string | null
  valor_unitario: number
  valor_total: number
  status_pagamento: 'pendente' | 'parcial' | 'pago'
  modelo?: GrupoModelo
  pagamentos?: GrupoPagamento[]
  created_at?: string
}

export interface GrupoTamanho {
  tamanho: string
  acrescimo: number
}

export interface GrupoSolicitacao {
  id: number
  grupo_id: number
  dados_participante: {
    nome_completo: string
    whatsapp?: string
    grupo_modelo_id: number
    cor: string
    tamanho: string
    quantidade: number
    nome_camisa?: string
    numero_camisa?: string
    apelido?: string
    frase_costas?: string
    observacao?: string
  }
  motivo?: string | null
  status: 'pendente' | 'aprovado' | 'recusado'
  resposta_admin?: string | null
  avaliado_por?: number | null
  avaliado_em?: string | null
  created_at: string
}

export interface GrupoLog {
  id: number
  grupo_id: number
  user_id?: number | null
  tipo: string
  descricao: string
  dados_anteriores?: Record<string, unknown> | null
  dados_novos?: Record<string, unknown> | null
  ip?: string | null
  created_at: string
  user?: {
    id: number
    name: string
  }
}

export interface Grupo {
  id: number
  user_id?: number | null
  confeccao_id?: number | null
  cliente_nome?: string | null
  cliente_whatsapp?: string | null
  nome: string
  descricao?: string | null
  imagem_capa?: string | null
  token: string
  senha_acesso?: string | null
  total_esperado: number
  pedido_minimo: number
  prazo_limite: string
  status: 'aberto' | 'prazo_encerrado' | 'confirmado' | 'em_producao' | 'pronto' | 'entregue'
  tabela_medidas_url?: string | null
  foto_camisa_pronta?: string | null
  observacoes_confeccao?: string | null
  campo_nome_camisa: boolean
  campo_numero_camisa: boolean
  campo_apelido: boolean
  campo_frase_costas: boolean
  campo_observacao: boolean
  tamanhos_disponiveis?: GrupoTamanho[]
  datas_status?: Record<string, string>
  modelos?: GrupoModelo[]
  participantes?: GrupoParticipante[]
  participantes_producao?: Array<{
    id: number
    nome_completo: string
    modelo?: string
    cor?: string
    tamanho?: string
    quantidade: number
    nome_camisa?: string | null
    numero_camisa?: string | null
    apelido?: string | null
    frase_costas?: string | null
    observacao?: string | null
  }>
  solicitacoes?: GrupoSolicitacao[]
  solicitacoes_pendentes_count?: number
  logs?: GrupoLog[]
  total_pecas?: number
  total_previsto?: number
  total_pago?: number
  total_pendente?: number
  participantes_count?: number
  user?: {
    id: number
    name: string
    email: string
    whatsapp?: string
  }
  confeccao?: {
    id: number
    nome: string
    telefone?: string
    whatsapp?: string
    email?: string
  }
}

export interface TotaisProducaoResponse {
  grupo: {
    id: number
    nome: string
    cliente_nome?: string
    cliente_whatsapp?: string
    confeccao_nome?: string
    status: string
    prazo_limite: string
    total_esperado: number
    pedido_minimo: number
    imagem_capa?: string
    tabela_medidas_url?: string
  }
  total_pecas: number
  por_tamanho: Record<string, number>
  por_modelo: Record<string, number>
  grade: Record<string, Record<string, Record<string, number>>>
  numeros_repetidos: string[]
  lista_nomes_numeros: Array<{
    id: number
    nome_completo: string
    modelo: string
    cor: string
    tamanho: string
    quantidade: number
    nome_camisa?: string
    numero_camisa?: string
    apelido?: string
    frase_costas?: string
    observacao?: string
    numero_duplicado?: boolean
  }>
}


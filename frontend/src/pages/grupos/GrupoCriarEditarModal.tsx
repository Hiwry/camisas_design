import { useState, useEffect } from 'react'
import { X, Upload, Plus, Trash2, Shirt, Calendar, Users, DollarSign, Image as ImageIcon, Key, RefreshCw, User, Phone } from 'lucide-react'
import { grupoService } from '@/services/grupoService'
import { confeccaoService } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { Grupo } from '@/types/grupo'

interface Props {
  grupoParaEditar?: Grupo | null
  onClose: () => void
  onSuccess: () => void
}

export default function GrupoCriarEditarModal({ grupoParaEditar, onClose, onSuccess }: Props) {
  const { isAdmin } = useAuthStore()

  const [nome, setNome] = useState(grupoParaEditar?.nome || '')
  const [descricao, setDescricao] = useState(grupoParaEditar?.descricao || '')
  const [clienteNome, setClienteNome] = useState(grupoParaEditar?.cliente_nome || '')
  const [clienteWhatsapp, setClienteWhatsapp] = useState(grupoParaEditar?.cliente_whatsapp || '')
  const [totalEsperado, setTotalEsperado] = useState(grupoParaEditar?.total_esperado || 30)
  const [pedidoMinimo, setPedidoMinimo] = useState(grupoParaEditar?.pedido_minimo || 0)
  const [prazoLimite, setPrazoLimite] = useState(
    grupoParaEditar?.prazo_limite ? grupoParaEditar.prazo_limite.slice(0, 16) : ''
  )
  const [senhaAcesso, setSenhaAcesso] = useState(
    grupoParaEditar?.senha_acesso || String(Math.floor(100000 + Math.random() * 900000))
  )
  const [confeccaoId, setConfeccaoId] = useState<number | string>(grupoParaEditar?.confeccao_id || '')
  const [capaFile, setCapaFile] = useState<File | null>(null)
  const [capaPreview, setCapaPreview] = useState<string | null>(null)

  // Flags extras
  const [campoNomeCamisa, setCampoNomeCamisa] = useState(grupoParaEditar?.campo_nome_camisa ?? true)
  const [campoNumeroCamisa, setCampoNumeroCamisa] = useState(grupoParaEditar?.campo_numero_camisa ?? true)
  const [campoApelido, setCampoApelido] = useState(grupoParaEditar?.campo_apelido ?? false)
  const [campoFraseCostas, setCampoFraseCostas] = useState(grupoParaEditar?.campo_frase_costas ?? false)
  const [campoObservacao, setCampoObservacao] = useState(grupoParaEditar?.campo_observacao ?? true)

  // Modelos
  const [modelos, setModelos] = useState<Array<{ nome: string; valor_base: number; coresStr: string }>>(
    grupoParaEditar?.modelos && grupoParaEditar.modelos.length > 0
      ? grupoParaEditar.modelos.map((m) => ({
          nome: m.nome,
          valor_base: m.valor_base,
          coresStr: (m.cores || []).join(', '),
        }))
      : [
          { nome: 'Camiseta Manga Curta', valor_base: 45, coresStr: 'Preto, Branco, Azul Marinho, Cinza' },
          { nome: 'Baby Look Feminina', valor_base: 45, coresStr: 'Preto, Branco, Rosa, Cinza' },
        ]
  )

  // Confecções cadastradas (para select do admin)
  const [confeccoes, setConfeccoes] = useState<Array<{ id: number; nome: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAdmin()) {
      confeccaoService.listar().then((res: unknown) => {
        const data = (res as { data?: Array<{ id: number; nome: string }> })?.data || res
        if (Array.isArray(data)) {
          setConfeccoes(data)
        }
      }).catch(() => {})
    }
  }, [isAdmin])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setCapaFile(file)
      setCapaPreview(URL.createObjectURL(file))
    }
  }

  function addModelo() {
    setModelos([...modelos, { nome: '', valor_base: 45, coresStr: 'Preto, Branco' }])
  }

  function removeModelo(index: number) {
    setModelos(modelos.filter((_, i) => i !== index))
  }

  function updateModelo(index: number, field: string, val: unknown) {
    const list = [...modelos]
    list[index] = { ...list[index], [field]: val }
    setModelos(list)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('Informe o nome do grupo.')
      return
    }
    if (!prazoLimite) {
      toast.error('Informe o prazo limite.')
      return
    }
    if (modelos.length === 0) {
      toast.error('Adicione pelo menos um modelo disponível.')
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append('nome', nome)
    formData.append('descricao', descricao)
    formData.append('cliente_nome', clienteNome)
    formData.append('cliente_whatsapp', clienteWhatsapp)
    formData.append('total_esperado', String(totalEsperado))
    formData.append('pedido_minimo', String(pedidoMinimo))
    formData.append('prazo_limite', prazoLimite)
    formData.append('senha_acesso', senhaAcesso)

    if (confeccaoId) {
      formData.append('confeccao_id', String(confeccaoId))
    }

    if (capaFile) {
      formData.append('imagem_capa', capaFile)
    }

    formData.append('campo_nome_camisa', campoNomeCamisa ? '1' : '0')
    formData.append('campo_numero_camisa', campoNumeroCamisa ? '1' : '0')
    formData.append('campo_apelido', campoApelido ? '1' : '0')
    formData.append('campo_frase_costas', campoFraseCostas ? '1' : '0')
    formData.append('campo_observacao', campoObservacao ? '1' : '0')

    modelos.forEach((mod, idx) => {
      formData.append(`modelos[${idx}][nome]`, mod.nome)
      formData.append(`modelos[${idx}][valor_base]`, String(mod.valor_base))
      const coresArray = mod.coresStr.split(',').map((c) => c.trim()).filter(Boolean)
      coresArray.forEach((c, cIdx) => {
        formData.append(`modelos[${idx}][cores][${cIdx}]`, c)
      })
    })

    try {
      if (grupoParaEditar) {
        await grupoService.atualizar(grupoParaEditar.id, formData)
        toast.success('Grupo atualizado com sucesso!')
      } else {
        await grupoService.criar(formData)
        toast.success('Grupo criado com sucesso!')
      }
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao salvar grupo.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl my-8">
        
        {/* Topo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <Shirt className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              {grupoParaEditar ? 'Editar Configurações do Grupo' : 'Criar Novo Grupo de Camisas'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Nome e Descrição */}
          <div className="space-y-4">
            <div>
              <label className="label">Nome do Grupo *</label>
              <input
                type="text"
                placeholder="Ex: Camisa Formatura 3ºB - Terceirão 2026"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">Descrição ou Orientações</label>
              <textarea
                placeholder="Instruções para a turma (ex: prazo final para preenchimento, data prevista de entrega, etc.)"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="textarea"
                rows={2}
              />
            </div>

            {/* Identificação do Cliente / Responsável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div>
                <label className="label flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  Cliente / Responsável do Grupo
                </label>
                <input
                  type="text"
                  placeholder="Ex: João Silva / Colégio ABC / Turma B"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="input"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Para saber qual cliente está com este grupo</span>
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  WhatsApp do Cliente (com DDD)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 82999998888"
                  value={clienteWhatsapp}
                  onChange={(e) => setClienteWhatsapp(e.target.value)}
                  className="input"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Para contato direto ou envio da ordem</span>
              </div>
            </div>
          </div>

          {/* Imagem de Capa */}
          <div>
            <label className="label">Imagem de Capa / Layout da Camisa</label>
            <div className="flex items-center gap-4">
              <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl cursor-pointer bg-zinc-900/50 transition">
                <Upload className="w-6 h-6 text-zinc-400 mb-1" />
                <span className="text-xs text-zinc-300 font-medium">Clique para escolher imagem</span>
                <span className="text-[10px] text-zinc-500 mt-0.5">JPG, PNG ou WebP (compressão automática)</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>

              {capaPreview && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 flex-shrink-0">
                  <img src={capaPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setCapaFile(null); setCapaPreview(null) }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-red-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Meta de Participantes e Prazo Limite */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                Meta de Participantes (Y) *
              </label>
              <input
                type="number"
                min="1"
                value={totalEsperado}
                onChange={(e) => setTotalEsperado(Number(e.target.value))}
                className="input"
                placeholder="30"
                required
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Para a barra "X de Y preencheram".</span>
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Prazo Limite para Preenchimento *
              </label>
              <input
                type="datetime-local"
                value={prazoLimite}
                onChange={(e) => setPrazoLimite(e.target.value)}
                className="input"
                required
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Após essa data, o formulário é travado.</span>
            </div>
          </div>

          {/* Senha de Acesso Aleatória do Grupo */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label flex items-center gap-1.5 mb-0">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Senha de Acesso do Grupo (PIN de Segurança)
              </label>
              <button
                type="button"
                onClick={() => setSenhaAcesso(String(Math.floor(100000 + Math.random() * 900000)))}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                title="Gerar outro código aleatório"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Gerar Nova Senha
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={senhaAcesso}
                onChange={(e) => setSenhaAcesso(e.target.value)}
                placeholder="Ex: 584920"
                className="input font-mono font-bold tracking-widest text-base"
                required
              />
            </div>
            <span className="text-[11px] text-zinc-500 block">
              Os amigos devem digitar essa senha (ou clicar no link completo) para liberar o formulário.
            </span>
          </div>

          {/* Configurações exclusivas do Admin: Confecção e Pedido Mínimo */}
          {isAdmin() && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
              <h4 className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                Controle do Administrador
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Confecção Responsável</label>
                  <select
                    value={confeccaoId}
                    onChange={(e) => setConfeccaoId(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione uma confecção...</option>
                    {confeccoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-zinc-500 mt-1 block">Só ela terá acesso à produção deste grupo.</span>
                </div>

                <div>
                  <label className="label">Pedido Mínimo da Confecção</label>
                  <input
                    type="number"
                    min="0"
                    value={pedidoMinimo}
                    onChange={(e) => setPedidoMinimo(Number(e.target.value))}
                    className="input"
                    placeholder="Ex: 20 peças"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">Alerta se ficar abaixo dessa quantidade.</span>
                </div>
              </div>
            </div>
          )}

          {/* Modelos Disponíveis e Valores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label flex items-center gap-1.5 mb-0">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                Modelos Disponíveis e Preços
              </label>
              <button
                type="button"
                onClick={addModelo}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Modelo
              </button>
            </div>

            <div className="space-y-2.5">
              {modelos.map((mod, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      placeholder="Nome do modelo (ex: Manga Curta)"
                      value={mod.nome}
                      onChange={(e) => updateModelo(idx, 'nome', e.target.value)}
                      className="input text-xs"
                      required
                    />
                  </div>
                  <div className="w-full sm:w-28">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Valor R$"
                      value={mod.valor_base}
                      onChange={(e) => updateModelo(idx, 'valor_base', Number(e.target.value))}
                      className="input text-xs font-mono"
                      required
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      placeholder="Cores separadas por vírgula"
                      value={mod.coresStr}
                      onChange={(e) => updateModelo(idx, 'coresStr', e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                  {modelos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeModelo(idx)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition"
                      title="Remover modelo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Campos Extras Ativáveis */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
            <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
              Campos Personalizáveis do Formulário
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={campoNomeCamisa}
                  onChange={(e) => setCampoNomeCamisa(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-800"
                />
                Nome na Camisa
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={campoNumeroCamisa}
                  onChange={(e) => setCampoNumeroCamisa(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-800"
                />
                Número da Camisa
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={campoApelido}
                  onChange={(e) => setCampoApelido(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-800"
                />
                Apelido
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={campoFraseCostas}
                  onChange={(e) => setCampoFraseCostas(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-800"
                />
                Frase nas Costas
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={campoObservacao}
                  onChange={(e) => setCampoObservacao(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-800"
                />
                Observações
              </label>
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition disabled:opacity-50"
            >
              {loading ? 'Salvando...' : grupoParaEditar ? 'Salvar Alterações' : 'Criar Grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


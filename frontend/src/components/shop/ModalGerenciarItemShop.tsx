import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shopService, ShopItem } from '@/services/api'
import toast from 'react-hot-toast'
import {
  X,
  Plus,
  Trash2,
  Upload,
  Check,
  Sparkles,
  ShoppingBag,
  Palette,
  Zap,
  Box,
  Clock,
  PenTool,
  Bot,
  Cpu,
  Layers,
  Image as ImageIcon,
} from 'lucide-react'

interface Props {
  itemParaEditar?: ShopItem | null
  onClose: () => void
  onSuccess?: () => void
}

const IMAGENS_SUGERIDAS = [
  { label: 'Camisa Ouro (1 Arte)', path: '/shop/arte_avulsa_1.jpg' },
  { label: 'Trio Camisas (3 Artes)', path: '/shop/arte_avulsa_3.jpg' },
  { label: 'Pack 5 Camisas', path: '/shop/arte_avulsa_5.jpg' },
  { label: 'Scanner IA Ciano', path: '/shop/creditos_ia_5.svg' },
  { label: 'Processador IA Pro', path: '/shop/creditos_ia_15.svg' },
  { label: 'Vetorização Caneta', path: '/shop/vetorizacao_logo.svg' },
  { label: 'Mockup 3D Estúdio', path: '/shop/mockup_3d.svg' },
  { label: 'Cronômetro Fast-Track', path: '/shop/taxa_expressa.svg' },
]

export default function ModalGerenciarItemShop({ itemParaEditar, onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const isEditing = !!itemParaEditar

  const [nome, setNome] = useState(itemParaEditar?.nome || '')
  const [codigo, setCodigo] = useState(itemParaEditar?.codigo || '')
  const [categoria, setCategoria] = useState(itemParaEditar?.categoria || 'combos')
  const [quantidade, setQuantidade] = useState(itemParaEditar?.quantidade || 1)
  const [valor, setValor] = useState(itemParaEditar ? String(itemParaEditar.valor) : '49.90')
  const [valorOriginal, setValorOriginal] = useState(
    itemParaEditar?.valor_original ? String(itemParaEditar.valor_original) : ''
  )
  const [entregaSla, setEntregaSla] = useState(itemParaEditar?.entrega_sla || 'Liberação imediata')
  const [badge, setBadge] = useState(itemParaEditar?.badge || '')
  const [destaque, setDestaque] = useState(itemParaEditar?.destaque || false)
  const [ativo, setAtivo] = useState(itemParaEditar?.ativo ?? true)
  const [ordem, setOrdem] = useState(itemParaEditar?.ordem || 0)
  const [icone, setIcone] = useState(itemParaEditar?.icone || 'sparkles')
  const [descricao, setDescricao] = useState(itemParaEditar?.descricao || '')
  const [imagem, setImagem] = useState(itemParaEditar?.imagem || '/shop/arte_avulsa_3.jpg')
  const [novoArquivoImagem, setNovoArquivoImagem] = useState<File | null>(null)
  const [previewUpload, setPreviewUpload] = useState<string | null>(null)

  const [inclusos, setInclusos] = useState<string[]>(
    itemParaEditar?.itens_inclusos?.length
      ? itemParaEditar.itens_inclusos
      : ['+1 benefício exclusivo', 'Atendimento direto com o designer', 'Economia no combo']
  )
  const [novoIncluso, setNovoIncluso] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleAdicionarIncluso() {
    if (!novoIncluso.trim()) return
    setInclusos([...inclusos, novoIncluso.trim()])
    setNovoIncluso('')
  }

  function handleRemoverIncluso(idx: number) {
    setInclusos(inclusos.filter((_, i) => i !== idx))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setNovoArquivoImagem(file)
      setPreviewUpload(URL.createObjectURL(file))
    }
  }

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('nome', nome.trim())
      if (codigo.trim()) formData.append('codigo', codigo.trim())
      formData.append('categoria', categoria)
      formData.append('quantidade', String(quantidade))
      formData.append('valor', valor)
      if (valorOriginal.trim()) formData.append('valor_original', valorOriginal)
      formData.append('entrega_sla', entregaSla.trim())
      if (badge.trim()) formData.append('badge', badge.trim())
      formData.append('destaque', destaque ? '1' : '0')
      formData.append('ativo', ativo ? '1' : '0')
      formData.append('ordem', String(ordem))
      formData.append('icone', icone)
      formData.append('descricao', descricao.trim())

      if (novoArquivoImagem) {
        formData.append('imagem_file', novoArquivoImagem)
      } else {
        formData.append('imagem', imagem)
      }

      formData.append('itens_inclusos', JSON.stringify(inclusos))

      const itemId = itemParaEditar?.db_id || (itemParaEditar?.id as unknown as number)

      if (isEditing && itemId) {
        return shopService.adminAtualizarItem(itemId, formData)
      } else {
        return shopService.adminCriarItem(formData)
      }
    },
    onSuccess: (data) => {
      toast.success(data.message || (isEditing ? 'Item atualizado!' : 'Item criado com sucesso!'))
      qc.invalidateQueries({ queryKey: ['admin-shop-itens'] })
      qc.invalidateQueries({ queryKey: ['shop-itens'] })
      if (onSuccess) onSuccess()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao salvar item.')
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          background: '#0f0f0f',
          borderColor: '#262626',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.95), 0 0 35px rgba(212,160,32,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b flex-shrink-0"
          style={{ background: '#141414', borderColor: '#222' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(212,160,32,0.15)',
                border: '1px solid rgba(212,160,32,0.3)',
              }}
            >
              <ShoppingBag className="w-4 h-4 text-[#d4a020]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight truncate">
                {isEditing ? 'Editar Produto / Combo do Shop' : 'Novo Produto ou Combo no Shop'}
              </h2>
              <p className="text-[11px] text-zinc-500 leading-tight mt-0.5 truncate">
                Defina valores, benefícios inclusos e imagem para exibição no catálogo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvarMutation.mutate()
          }}
          className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs"
        >
          {/* Linha 1: Nome e Código */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-zinc-300 font-semibold">Título do Item / Combo *</label>
              <input
                required
                type="text"
                placeholder="Ex: Combo 4 Artes + Vetorização Grátis"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input w-full py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-400">Código / Slug (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: combo_especial_4"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="input w-full py-2 text-xs font-mono"
              />
            </div>
          </div>

          {/* Linha 2: Categoria, Quantidade Liberada e Ícone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold">Categoria *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="input w-full py-2 text-xs"
              >
                <option value="combos">Combos & Pacotes</option>
                <option value="artes">Artes Extras</option>
                <option value="ia">Créditos de IA</option>
                <option value="servicos">Serviços de Design</option>
                <option value="urgencia">Prazos & Urgência</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold">Qtd Liberada *</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="input w-full py-2 text-xs"
                title="Quantidade de artes extras ou créditos IA adicionados após o Pix"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold">Ícone</label>
              <select
                value={icone}
                onChange={(e) => setIcone(e.target.value)}
                className="input w-full py-2 text-xs"
              >
                <option value="sparkles">✨ Sparkles (Brilho)</option>
                <option value="palette">🎨 Palette (Paleta)</option>
                <option value="zap">⚡ Zap (Raio)</option>
                <option value="bot">🤖 Bot (Robô IA)</option>
                <option value="cpu">🧠 CPU (Processador)</option>
                <option value="pen-tool">✒️ Pen Tool (Caneta Vetorial)</option>
                <option value="box">📦 Box (Mockup 3D)</option>
                <option value="clock">⏱️ Clock (Cronômetro)</option>
              </select>
            </div>
          </div>

          {/* Linha 3: Valores & SLA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold">Preço de Venda (R$) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="input w-full py-2 text-xs font-bold text-white"
                placeholder="49.90"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-400">Preço De / Original (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorOriginal}
                onChange={(e) => setValorOriginal(e.target.value)}
                className="input w-full py-2 text-xs text-zinc-400"
                placeholder="69.90 (riscado)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold">Prazo de Entrega / SLA *</label>
              <input
                required
                type="text"
                value={entregaSla}
                onChange={(e) => setEntregaSla(e.target.value)}
                className="input w-full py-2 text-xs"
                placeholder="Ex: Liberação imediata, 12h úteis"
              />
            </div>
          </div>

          {/* Linha 4: Badge, Destaque, Ativo e Ordem */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-zinc-400">Badge Promocional</label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="input w-full py-2 text-xs"
                placeholder="Ex: Mais Escolhido, Super Desconto"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-400">Ordem de Exibição</label>
              <input
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(Number(e.target.value))}
                className="input w-full py-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-4 py-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300 select-none">
                <input
                  type="checkbox"
                  checked={destaque}
                  onChange={(e) => setDestaque(e.target.checked)}
                  className="rounded border-zinc-700 text-[#d4a020] focus:ring-[#d4a020]"
                />
                <span>Destaque</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300 select-none">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Ativo</span>
              </label>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <label className="text-zinc-300 font-semibold">Descrição Comercial do Produto</label>
            <textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input w-full py-2 text-xs resize-none"
              placeholder="Explique o objetivo deste produto ou combo para encantar as confecções..."
            />
          </div>

          {/* Seletor de Imagem e Upload */}
          <div className="space-y-2 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
            <label className="text-zinc-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#d4a020]" /> Imagem de Capa do Item
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-[#d4a020] hover:underline flex items-center gap-1 font-semibold"
              >
                <Upload className="w-3 h-3" /> Fazer upload de nova foto
              </button>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Preview Atual */}
            <div className="flex items-center gap-4">
              <div className="w-28 h-16 rounded-lg overflow-hidden border border-zinc-700 bg-black flex-shrink-0 relative">
                <img
                  src={previewUpload || imagem}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-zinc-400 block mb-1">
                  Ou escolha uma arte pronta do catálogo:
                </span>
                <select
                  value={previewUpload ? '' : imagem}
                  onChange={(e) => {
                    setPreviewUpload(null)
                    setNovoArquivoImagem(null)
                    setImagem(e.target.value)
                  }}
                  className="input w-full py-1.5 text-[11px]"
                >
                  {IMAGENS_SUGERIDAS.map((sug) => (
                    <option key={sug.path} value={sug.path}>
                      {sug.label} ({sug.path})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Benefícios Inclusos */}
          <div className="space-y-2">
            <label className="text-zinc-300 font-semibold flex items-center justify-between">
              <span>Benefícios inclusos no card:</span>
              <span className="text-[10px] text-zinc-500">Exibidos com ícone verde</span>
            </label>

            <div className="space-y-1.5">
              {inclusos.map((inc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 input py-1.5 text-xs bg-zinc-900 border-zinc-800 text-zinc-300 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{inc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoverIncluso(i)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800"
                    title="Remover benefício"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Digitar novo benefício (ex: 'Arquivo em curvas incluso')..."
                value={novoIncluso}
                onChange={(e) => setNovoIncluso(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAdicionarIncluso()
                  }
                }}
                className="input flex-1 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleAdicionarIncluso}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvarMutation.isPending}
              className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5"
            >
              {salvarMutation.isPending ? (
                'Salvando...'
              ) : isEditing ? (
                'Atualizar Item'
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Criar Produto / Combo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

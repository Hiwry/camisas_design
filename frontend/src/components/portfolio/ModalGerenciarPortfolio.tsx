import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PortfolioItem, portfolioService } from '@/services/api'
import {
  X,
  Upload,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Save,
  Trash2,
  Plus,
  FolderPlus,
  Check,
  Star,
  ArrowLeft,
  ArrowRight,
  Link as LinkIcon,
  Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export interface FotoGaleria {
  id: string
  url?: string
  file?: File
  preview: string
  isCapa: boolean
}

interface Props {
  itemParaEditar?: PortfolioItem | null
  onClose: () => void
  onSuccess: () => void
}

export default function ModalGerenciarPortfolio({
  itemParaEditar,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient()
  const isEditing = Boolean(itemParaEditar)
  const multiFileInputRef = useRef<HTMLInputElement>(null)
  const [salvando, setSalvando] = useState(false)

  // Consulta das Categorias cadastradas dinamicamente
  const { data: categoriasData } = useQuery({
    queryKey: ['portfolio-categorias'],
    queryFn: () => portfolioService.listarCategorias(true),
  })

  const categorias = categoriasData?.categorias ?? [
    { id: 1, nome: 'Esportivos', slug: 'esportivos', tipo: 'segmento' as const, ordem: 1, ativo: true },
    { id: 2, nome: 'Empresas', slug: 'empresas', tipo: 'segmento' as const, ordem: 2, ativo: true },
    { id: 3, nome: 'Eventos', slug: 'eventos', tipo: 'segmento' as const, ordem: 3, ativo: true },
  ]

  const servicos = categoriasData?.servicos ?? [
    { id: 4, nome: 'Sublimação Total', slug: 'sublimacao', tipo: 'servico' as const, ordem: 1, ativo: true },
    { id: 5, nome: 'Serigrafia (Silk)', slug: 'serigrafia', tipo: 'servico' as const, ordem: 2, ativo: true },
    { id: 6, nome: 'Bordado', slug: 'bordado', tipo: 'servico' as const, ordem: 3, ativo: true },
    { id: 7, nome: 'Logos & Mascotes', slug: 'logos', tipo: 'servico' as const, ordem: 4, ativo: true },
  ]

  // Form State
  const [titulo, setTitulo] = useState(itemParaEditar?.titulo ?? '')
  const [categoria, setCategoria] = useState(itemParaEditar?.categoria ?? 'esportivos')
  const [servico, setServico] = useState(itemParaEditar?.servico ?? 'sublimacao')
  const [subtitulo, setSubtitulo] = useState(itemParaEditar?.subtitulo ?? '')
  const [descricao, setDescricao] = useState(itemParaEditar?.descricao ?? '')

  // Estado da Galeria de Fotos e Imagem Principal
  const [fotos, setFotos] = useState<FotoGaleria[]>(() => {
    const list: FotoGaleria[] = []
    const capa = itemParaEditar?.imagem_principal || ''
    const galeriaDb = Array.isArray(itemParaEditar?.galeria)
      ? itemParaEditar.galeria.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : []

    // Adiciona primeiro a capa se existir
    const todasUrls: string[] = []
    if (capa) todasUrls.push(capa)
    galeriaDb.forEach((u) => {
      if (!todasUrls.includes(u)) todasUrls.push(u)
    })

    todasUrls.forEach((url, idx) => {
      list.push({
        id: `existente-${idx}-${Date.now()}`,
        url,
        preview: url,
        isCapa: url === capa || (idx === 0 && !capa),
      })
    })

    if (list.length > 0 && !list.some((f) => f.isCapa)) {
      list[0].isCapa = true
    }

    return list
  })

  // Entrada manual de URL
  const [urlManual, setUrlManual] = useState('')
  const [mostrarInputUrl, setMostrarInputUrl] = useState(false)

  // Mini criação rápida de categoria inline
  const [criandoCatRapida, setCriandoCatRapida] = useState(false)
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatTipo, setNovaCatTipo] = useState<'segmento' | 'servico'>('segmento')

  const [cliente, setCliente] = useState(itemParaEditar?.cliente ?? '')
  const [ano, setAno] = useState(itemParaEditar?.ano ?? '2026')
  const [tecido, setTecido] = useState(itemParaEditar?.tecido ?? 'Dry-Fit UV50+')
  const [tecnica, setTecnica] = useState(itemParaEditar?.tecnica ?? 'Sublimação Total')
  const [coresStr, setCoresStr] = useState(
    itemParaEditar?.cores ? itemParaEditar.cores.join(', ') : '#0f0f0f, #d4a020, #ffffff'
  )
  const [tagsStr, setTagsStr] = useState(
    itemParaEditar?.tags ? itemParaEditar.tags.join(', ') : 'Futebol, Sublimação'
  )
  const [destaque, setDestaque] = useState(itemParaEditar?.destaque ?? false)
  const [ordem, setOrdem] = useState(itemParaEditar?.ordem ?? 0)
  const [ativo, setAtivo] = useState(itemParaEditar?.ativo ?? true)

  const criarCatRapidaMutation = useMutation({
    mutationFn: (dados: { nome: string; tipo: 'segmento' | 'servico' }) =>
      portfolioService.adminCriarCategoria(dados),
    onSuccess: (nova) => {
      qc.invalidateQueries({ queryKey: ['portfolio-categorias'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      if (nova.tipo === 'segmento') {
        setCategoria(nova.slug)
      } else {
        setServico(nova.slug)
      }
      setNovaCatNome('')
      setCriandoCatRapida(false)
      toast.success(`Categoria "${nova.nome}" criada com sucesso!`)
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Erro ao criar categoria.'),
  })

  function handleSalvarCatRapida() {
    if (!novaCatNome.trim()) return
    criarCatRapidaMutation.mutate({ nome: novaCatNome.trim(), tipo: novaCatTipo })
  }

  // Upload de Múltiplos Arquivos
  function handleMultiFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const novas: FotoGaleria[] = []
    Array.from(files).forEach((file, index) => {
      const preview = URL.createObjectURL(file)
      novas.push({
        id: `file-${Date.now()}-${index}-${Math.random()}`,
        file,
        preview,
        isCapa: fotos.length === 0 && index === 0,
      })
    })

    setFotos((prev) => {
      const updated = [...prev, ...novas]
      if (updated.length > 0 && !updated.some((f) => f.isCapa)) {
        updated[0].isCapa = true
      }
      return updated
    })

    if (e.target) e.target.value = ''
    toast.success(`${novas.length} imagem(ns) adicionada(s)!`)
  }

  // Adicionar URL Manual
  function handleAdicionarUrl() {
    if (!urlManual.trim()) return
    const url = urlManual.trim()
    const nova: FotoGaleria = {
      id: `url-${Date.now()}-${Math.random()}`,
      url,
      preview: url,
      isCapa: fotos.length === 0,
    }
    setFotos((prev) => {
      const updated = [...prev, nova]
      if (updated.length > 0 && !updated.some((f) => f.isCapa)) {
        updated[0].isCapa = true
      }
      return updated
    })
    setUrlManual('')
    setMostrarInputUrl(false)
    toast.success('Imagem adicionada via URL!')
  }

  // Definir como Capa Principal
  function handleDefinirComoCapa(id: string) {
    setFotos((prev) =>
      prev.map((f) => ({
        ...f,
        isCapa: f.id === id,
      }))
    )
    toast.success('Imagem definida como Capa Principal!')
  }

  // Remover Foto
  function handleRemoverFoto(id: string) {
    setFotos((prev) => {
      const itemToRemove = prev.find((f) => f.id === id)
      const filtered = prev.filter((f) => f.id !== id)
      if (itemToRemove?.isCapa && filtered.length > 0) {
        filtered[0].isCapa = true
      }
      return filtered
    })
    toast.success('Imagem removida!')
  }

  // Mover Posição da Foto
  function handleMoverFoto(index: number, direcao: 'esquerda' | 'direita') {
    setFotos((prev) => {
      const novoArr = [...prev]
      const targetIdx = direcao === 'esquerda' ? index - 1 : index + 1
      if (targetIdx < 0 || targetIdx >= novoArr.length) return prev
      const temp = novoArr[index]
      novoArr[index] = novoArr[targetIdx]
      novoArr[targetIdx] = temp
      return novoArr
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) {
      toast.error('Informe o título do trabalho')
      return
    }

    if (fotos.length === 0) {
      toast.error('Adicione pelo menos uma foto ou mockup para o trabalho')
      return
    }

    const fotoCapa = fotos.find((f) => f.isCapa) || fotos[0]

    setSalvando(true)
    try {
      const formData = new FormData()
      formData.append('titulo', titulo)
      formData.append('categoria', categoria)
      formData.append('servico', servico)
      if (subtitulo) formData.append('subtitulo', subtitulo)
      if (descricao) formData.append('descricao', descricao)
      if (cliente) formData.append('cliente', cliente)
      if (ano) formData.append('ano', ano)
      if (tecido) formData.append('tecido', tecido)
      if (tecnica) formData.append('tecnica', tecnica)
      formData.append('destaque', destaque ? '1' : '0')
      formData.append('ativo', ativo ? '1' : '0')
      formData.append('ordem', String(ordem))

      // Cores & Tags como JSON
      const coresArr = coresStr
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
      const tagsArr = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      formData.append('cores', JSON.stringify(coresArr))
      formData.append('tags', JSON.stringify(tagsArr))

      // Imagem Principal (Capa)
      if (fotoCapa.file) {
        formData.append('imagem_arquivo', fotoCapa.file)
      } else if (fotoCapa.url) {
        formData.append('imagem_principal', fotoCapa.url)
      }

      // Galeria de URLs mantidas (preserva a ordem e a capa)
      const urlsMantidas: string[] = []
      if (fotoCapa.url) {
        urlsMantidas.push(fotoCapa.url)
      }
      fotos.forEach((f) => {
        if (f.id !== fotoCapa.id && f.url) {
          urlsMantidas.push(f.url)
        }
      })
      formData.append('galeria', JSON.stringify(urlsMantidas))

      // Novas imagens adicionais enviadas como arquivo
      fotos.forEach((f) => {
        if (f.file && f.id !== fotoCapa.id) {
          formData.append('galeria_arquivos[]', f.file)
        }
      })

      if (isEditing && itemParaEditar) {
        await portfolioService.adminAtualizar(itemParaEditar.id, formData)
        toast.success('Trabalho atualizado com sucesso!')
      } else {
        await portfolioService.adminCriar(formData)
        toast.success('Novo trabalho publicado no catálogo!')
      }

      qc.invalidateQueries({ queryKey: ['portfolio-itens'] })
      qc.invalidateQueries({ queryKey: ['portfolio-itens-admin'] })
      qc.invalidateQueries({ queryKey: ['portfolio-categorias'] })

      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha ao salvar trabalho.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #131313 0%, #0e0e0e 100%)',
          borderColor: '#262626',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#d4a020]" />
              {isEditing ? `Editar Trabalho #${itemParaEditar?.id}` : 'Cadastrar Novo Trabalho no Portfólio'}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">
              {isEditing
                ? 'Atualize fotos, títulos, textos e categorias deste trabalho individualmente.'
                : 'Publique fotos de camisas prontas, mockups 3D e amostras para seus clientes verem.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mini Criador Rápido de Categoria Inline */}
        {criandoCatRapida && (
          <div className="px-6 py-3 bg-zinc-900/90 border-b border-zinc-800 flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={novaCatNome}
              onChange={(e) => setNovaCatNome(e.target.value)}
              placeholder="Nome da nova categoria..."
              className="input text-xs py-1.5 flex-1 bg-[#181818]"
              autoFocus
            />
            <select
              value={novaCatTipo}
              onChange={(e) => setNovaCatTipo(e.target.value as any)}
              className="input text-xs py-1.5 bg-[#181818]"
            >
              <option value="segmento">Segmento (Ex: Escolar, Igreja)</option>
              <option value="servico">Serviço/Técnica (Ex: DTF, Bordado)</option>
            </select>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSalvarCatRapida}
                disabled={!novaCatNome.trim()}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Criar
              </button>
              <button
                type="button"
                onClick={() => setCriandoCatRapida(false)}
                className="btn-secondary text-xs py-1.5 px-2.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Formulário com scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Título */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Título do Trabalho *
              </label>
              <input
                type="text"
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Fênix All-Black Gold Edition"
                className="input w-full text-xs"
              />
            </div>

            {/* Segmento */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Segmento *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNovaCatTipo('segmento')
                    setCriandoCatRapida(true)
                  }}
                  className="text-[11px] text-[#d4a020] hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  Nova
                </button>
              </div>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="input w-full text-xs"
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria do Serviço / Técnica */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Serviço / Técnica *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNovaCatTipo('servico')
                    setCriandoCatRapida(true)
                  }}
                  className="text-[11px] text-[#d4a020] hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  Novo
                </button>
              </div>
              <select
                value={servico}
                onChange={(e) => setServico(e.target.value)}
                className="input w-full text-xs"
              >
                {servicos.map((srv) => (
                  <option key={srv.id} value={srv.slug}>
                    {srv.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Subtítulo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Subtítulo / Resumo Rápido
              </label>
              <input
                type="text"
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                placeholder="Ex: Sublimação total com detalhes em degradê"
                className="input w-full text-xs"
              />
            </div>
          </div>

          {/* Gestor de Fotos e Galeria (Múltiplas Imagens) */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#d4a020]" />
                  Fotos e Galeria da Camisa
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#d4a020]/15 text-[#d4a020] border border-[#d4a020]/30 ml-1">
                    {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Adicione frente, costas e detalhes. A imagem marcada como <strong>Capa</strong> será exibida nos cards do portfólio.
                </p>
              </div>

              {/* Botões de Ação para Adicionar Fotos */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => multiFileInputRef.current?.click()}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload de Fotos
                </button>
                <input
                  ref={multiFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultiFiles}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setMostrarInputUrl((prev) => !prev)}
                  className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1"
                  title="Adicionar imagem via URL externa"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                  Link URL
                </button>
              </div>
            </div>

            {/* Input para Link URL quando ativo */}
            {mostrarInputUrl && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-zinc-800">
                <input
                  type="url"
                  value={urlManual}
                  onChange={(e) => setUrlManual(e.target.value)}
                  placeholder="Cole o link da imagem (ex: https://.../costas.jpg)"
                  className="input flex-1 text-xs py-1.5 bg-zinc-900 border-zinc-700"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAdicionarUrl()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAdicionarUrl}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  Adicionar
                </button>
              </div>
            )}

            {/* Grid de Imagens Adicionadas */}
            {fotos.length === 0 ? (
              <div
                onClick={() => multiFileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-zinc-700 hover:border-[#d4a020]/60 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-zinc-950/40 text-center px-4"
              >
                <div className="p-3 rounded-full bg-zinc-900 text-zinc-400">
                  <Upload className="w-5 h-5 text-[#d4a020]" />
                </div>
                <div className="text-xs text-zinc-300 font-medium">
                  Clique aqui ou selecione arquivos para adicionar imagens
                </div>
                <div className="text-[10px] text-zinc-500">
                  Você pode selecionar várias fotos de uma só vez (frente, costas, texturas, etc.)
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {fotos.map((foto, index) => (
                  <div
                    key={foto.id}
                    className={clsx(
                      'relative group rounded-xl border overflow-hidden bg-black/60 transition-all flex flex-col',
                      foto.isCapa
                        ? 'border-[#d4a020] ring-1 ring-[#d4a020]/40 shadow-lg shadow-[#d4a020]/10'
                        : 'border-zinc-800 hover:border-zinc-700'
                    )}
                  >
                    {/* Imagem */}
                    <div className="relative aspect-[4/3] w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                      <img
                        src={foto.preview}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Selo de Capa */}
                      {foto.isCapa && (
                        <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#d4a020] text-black text-[9px] font-black uppercase tracking-wider shadow">
                          <Star className="w-2.5 h-2.5 fill-black" />
                          Capa
                        </div>
                      )}

                      {/* Botão de Excluir Foto */}
                      <button
                        type="button"
                        onClick={() => handleRemoverFoto(foto.id)}
                        className="absolute top-1.5 right-1.5 z-10 p-1.5 rounded-md bg-black/70 hover:bg-rose-600 text-zinc-300 hover:text-white transition-colors"
                        title="Remover esta foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Ordem / Índice */}
                      <span className="absolute bottom-1.5 right-1.5 z-10 text-[9px] font-mono px-1 rounded bg-black/80 text-zinc-300">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Ações na barra inferior do Card */}
                    <div className="p-1.5 bg-zinc-900 flex items-center justify-between gap-1 text-[10px]">
                      {foto.isCapa ? (
                        <span className="text-[10px] text-[#d4a020] font-bold px-1">
                          Imagem Principal
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDefinirComoCapa(foto.id)}
                          className="text-[10px] text-zinc-400 hover:text-white font-medium hover:underline flex items-center gap-1 px-1"
                        >
                          <Star className="w-2.5 h-2.5 text-zinc-500" />
                          Tornar Capa
                        </button>
                      )}

                      {/* Botões de Reordenar */}
                      <div className="flex items-center gap-0.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleMoverFoto(index, 'esquerda')}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-zinc-800 disabled:opacity-20 text-zinc-400 hover:text-white"
                          title="Mover para esquerda"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoverFoto(index, 'direita')}
                          disabled={index === fotos.length - 1}
                          className="p-1 rounded hover:bg-zinc-800 disabled:opacity-20 text-zinc-400 hover:text-white"
                          title="Mover para direita"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Descrição & Conceito */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Descrição do Conceito / Briefing
            </label>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a inspiração do modelo, detalhes dos recortes, gola, texturas utilizadas..."
              className="input w-full text-xs resize-none"
            />
          </div>

          {/* Ficha Técnica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Cliente / Turma / Confecção
              </label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ex: Atlética Fênix Imperatriz"
                className="input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Ano de Criação
              </label>
              <input
                type="text"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="Ex: 2026"
                className="input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tecido Recomendado
              </label>
              <input
                type="text"
                value={tecido}
                onChange={(e) => setTecido(e.target.value)}
                placeholder="Ex: Dry-Fit Colmeia 100% Poliéster"
                className="input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Técnica de Impressão / Estamparia
              </label>
              <input
                type="text"
                value={tecnica}
                onChange={(e) => setTecnica(e.target.value)}
                placeholder="Ex: Sublimação Digital Total"
                className="input w-full text-xs"
              />
            </div>
          </div>

          {/* Cores e Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Cores Principais (HEX separados por vírgula)
              </label>
              <input
                type="text"
                value={coresStr}
                onChange={(e) => setCoresStr(e.target.value)}
                placeholder="#0f0f0f, #d4a020, #ffffff"
                className="input w-full text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tags (separadas por vírgula)
              </label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="Futebol, Interclasses, Black & Gold"
                className="input w-full text-xs"
              />
            </div>
          </div>

          {/* Flags: Destaque e Ativo */}
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
              <input
                type="checkbox"
                checked={destaque}
                onChange={(e) => setDestaque(e.target.checked)}
                className="w-4 h-4 rounded text-[#d4a020] focus:ring-[#d4a020] bg-zinc-800 border-zinc-700"
              />
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#d4a020]" />
                Destacar no Topo do Portfólio
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="w-4 h-4 rounded text-[#d4a020] focus:ring-[#d4a020] bg-zinc-800 border-zinc-700"
              />
              <span>Visível no Catálogo</span>
            </label>
          </div>

          {/* Rodapé do Modal */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="btn-secondary text-xs py-2 px-4"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="btn-primary text-xs py-2 px-5 flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {salvando ? 'Salvando...' : isEditing ? 'Atualizar Trabalho' : 'Publicar no Catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

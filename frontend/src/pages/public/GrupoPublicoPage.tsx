import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { grupoService } from '@/services/grupoService'
import { resolveMediaUrl } from '@/lib/url'
import TabelaMedidasModal from '@/components/grupos/TabelaMedidasModal'
import {
  Shirt,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Ruler,
  Share2,
  Send,
  Sparkles,
  Lock,
  ArrowRight,
  ExternalLink,
  Key,
  Unlock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { GrupoModelo } from '@/types/grupo'

export default function GrupoPublicoPage() {
  const { token } = useParams<{ token: string }>()

  // Estado do formulário
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [modeloId, setModeloId] = useState<number | null>(null)
  const [cor, setCor] = useState('')
  const [tamanho, setTamanho] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [nomeCamisa, setNomeCamisa] = useState('')
  const [numeroCamisa, setNumeroCamisa] = useState('')
  const [apelido, setApelido] = useState('')
  const [fraseCostas, setFraseCostas] = useState('')
  const [observacao, setObservacao] = useState('')
  const [honeypot, setHoneypot] = useState('')

  // Senha de Acesso
  const [senhaUrl] = useState(() => new URLSearchParams(window.location.search).get('senha') || '')
  const [senhaDigitada, setSenhaDigitada] = useState(senhaUrl)
  const [senhaLiberada, setSenhaLiberada] = useState(false)
  const [validandoSenha, setValidandoSenha] = useState(false)

  // Modais e status
  const [showTabelaMedidas, setShowTabelaMedidas] = useState(false)
  const [showForaPrazoModal, setShowForaPrazoModal] = useState(false)
  const [motivoForaPrazo, setMotivoForaPrazo] = useState('')
  const [numeroEmUso, setNumeroEmUso] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sucessoData, setSucessoData] = useState<{
    participante: Record<string, unknown>
    token_edicao: string
    link_edicao: string
  } | null>(null)

  // Busca dados públicos do grupo
  const { data: grupo, isLoading, error, refetch } = useQuery({
    queryKey: ['grupo-publico', token, senhaUrl],
    queryFn: () => grupoService.buscarPublico(token!, senhaUrl || undefined),
    enabled: !!token,
  })

  // Se o grupo não tem senha ou a senha da URL for válida, libera automaticamente
  useEffect(() => {
    if (grupo) {
      if (!grupo.tem_senha || grupo.senha_valida) {
        setSenhaLiberada(true)
      }
    }
  }, [grupo])

  // Desbloquear por senha digitada
  async function handleValidarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!senhaDigitada.trim()) {
      toast.error('Digite a senha de acesso.')
      return
    }

    setValidandoSenha(true)
    try {
      const res = await grupoService.validarSenha(token!, senhaDigitada.trim())
      if (res.valida) {
        setSenhaLiberada(true)
        toast.success('Acesso liberado com sucesso!')
      } else {
        toast.error('Senha incorreta! Verifique com o organizador.')
      }
    } catch {
      toast.error('Erro ao verificar senha.')
    } finally {
      setValidandoSenha(false)
    }
  }

  // Seleciona o primeiro modelo por padrão
  useEffect(() => {
    if (grupo?.modelos && grupo.modelos.length > 0 && !modeloId) {
      setModeloId(grupo.modelos[0].id)
      if (grupo.modelos[0].cores && grupo.modelos[0].cores.length > 0) {
        setCor(grupo.modelos[0].cores[0])
      }
    }
  }, [grupo, modeloId])

  // Atualiza cor ao trocar de modelo
  const modeloSelecionado = grupo?.modelos?.find((m: GrupoModelo) => m.id === modeloId)
  useEffect(() => {
    if (modeloSelecionado?.cores && modeloSelecionado.cores.length > 0) {
      if (!modeloSelecionado.cores.includes(cor)) {
        setCor(modeloSelecionado.cores[0])
      }
    }
  }, [modeloSelecionado])

  // Verifica número em tempo real
  useEffect(() => {
    if (!token || !numeroCamisa.trim()) {
      setNumeroEmUso(false)
      return
    }

    const timer = setTimeout(() => {
      grupoService.verificarNumero(token, numeroCamisa.trim()).then((res) => {
        setNumeroEmUso(res.em_uso)
      }).catch(() => {})
    }, 400)

    return () => clearTimeout(timer)
  }, [token, numeroCamisa])

  // Contagem regressiva do prazo
  const [tempoRestante, setTempoRestante] = useState({ dias: 0, horas: 0, minutos: 0, expirado: false })
  useEffect(() => {
    if (!grupo?.prazo_limite) return

    function calcular() {
      const diff = new Date(grupo.prazo_limite).getTime() - new Date().getTime()
      if (diff <= 0) {
        setTempoRestante({ dias: 0, horas: 0, minutos: 0, expirado: true })
        return
      }
      const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
      const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTempoRestante({ dias, horas, minutos, expirado: false })
    }

    calcular()
    const int = setInterval(calcular, 60000)
    return () => clearInterval(int)
  }, [grupo?.prazo_limite])

  // Cálculo de valor (sem acréscimo por tamanho)
  const valorUnitario = Number(modeloSelecionado?.valor_base || 0)
  const valorTotal = valorUnitario * quantidade

  // Compartilhar WhatsApp
  function handleShareWhatsApp() {
    const url = window.location.href
    const texto = `Fala pessoal! Nosso grupo de camisas *"${grupo?.nome}"* já está aberto para preenchimento. Acesse o link para escolher seu modelo e tamanho:\n\n${url}`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank')
  }

  // Submissão do formulário
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modeloId || !cor || !tamanho) {
      toast.error('Selecione o modelo, a cor e o tamanho.')
      return
    }

    setSubmitting(true)
    try {
      const res = await grupoService.participarPublico(token!, {
        nome_completo: nomeCompleto,
        whatsapp,
        grupo_modelo_id: modeloId,
        cor,
        tamanho,
        quantidade,
        nome_camisa: nomeCamisa,
        numero_camisa: numeroCamisa,
        apelido,
        frase_costas: fraseCostas,
        observacao,
        senha_acesso: senhaDigitada || senhaUrl,
        website_url_honeypot: honeypot,
      })

      setSucessoData(res)
      toast.success('Seus dados foram gravados com sucesso!')
      refetch()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao enviar dados.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Submissão Fora do Prazo ("Esqueci de preencher")
  async function handleForaPrazoSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modeloId || !cor || !tamanho) {
      toast.error('Preencha os dados da camisa.')
      return
    }

    setSubmitting(true)
    try {
      await grupoService.solicitarForaPrazoPublico(token!, {
        nome_completo: nomeCompleto,
        whatsapp,
        grupo_modelo_id: modeloId,
        cor,
        tamanho,
        quantidade,
        nome_camisa: nomeCamisa,
        numero_camisa: numeroCamisa,
        apelido,
        frase_costas: fraseCostas,
        observacao,
        motivo: motivoForaPrazo,
        senha_acesso: senhaDigitada || senhaUrl,
      })

      toast.success('Solicitação enviada com sucesso! O organizador irá avaliar a inclusão.')
      setShowForaPrazoModal(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao enviar solicitação.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Shirt className="w-10 h-10 text-amber-400 animate-bounce mx-auto" />
          <p className="text-sm text-zinc-400">Carregando grupo de camisas...</p>
        </div>
      </div>
    )
  }

  if (error || !grupo) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center p-4 text-center">
        <div className="max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Grupo não encontrado</h2>
          <p className="text-xs text-zinc-400">
            O link acessado é inválido ou este grupo não existe mais.
          </p>
          <Link to="/" className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-white">
            Ir para página inicial
          </Link>
        </div>
      </div>
    )
  }

  const progressoPercent = Math.min(
    100,
    Math.round((grupo.total_participantes / (grupo.total_esperado || 1)) * 100)
  )

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-zinc-100 flex flex-col justify-between">
      
      {/* Topo / Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shirt className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm tracking-wide text-white">Camiseta Design</span>
          </div>
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            Compartilhar no WhatsApp
          </button>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">

        {/* Card de Capa e Apresentação do Grupo */}
        <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 overflow-hidden shadow-xl">
          {grupo.imagem_capa && (
            <div className="relative w-full h-48 sm:h-64 bg-zinc-950">
              <img
                src={resolveMediaUrl(grupo.imagem_capa)}
                alt={grupo.nome}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
            </div>
          )}

          <div className="p-5 sm:p-6 space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {grupo.nome}
            </h1>

            {grupo.descricao && (
              <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
                {grupo.descricao}
              </p>
            )}

            {/* Cronômetro e Prazo */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-zinc-400">Prazo:</span>
                <strong className="text-white">
                  {new Date(grupo.prazo_limite).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>

              {!tempoRestante.expirado ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>
                    Faltam <strong>{tempoRestante.dias}d {tempoRestante.horas}h {tempoRestante.minutos}m</strong>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-400">
                  <Lock className="w-4 h-4" />
                  <span>Prazo finalizado</span>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Progresso do Grupo (X de Y) */}
          <div className="px-5 py-4 bg-zinc-950/60 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                {grupo.total_participantes} de {grupo.total_esperado} já preencheram
              </span>
              <span className="font-mono text-amber-400 font-bold">{progressoPercent}%</span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                style={{ width: `${progressoPercent}%` }}
              />
            </div>

            {grupo.meta_atingida && (
              <div className="pt-1 text-center text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5 animate-pulse">
                <Sparkles className="w-4 h-4" />
                Meta atingida! Parabéns turma!
              </div>
            )}
          </div>
        </div>

        {/* Mensagem de Sucesso pós-envio */}
        {sucessoData && (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Dados enviados com sucesso!</h3>
              <p className="text-xs text-zinc-300 mt-1">
                Sua camiseta já está garantida no grupo. Guarde o link abaixo caso precise alterar seus dados antes do prazo:
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-left flex items-center justify-between gap-3">
              <div className="truncate text-xs font-mono text-amber-400">
                {window.location.origin}/grupo/{token}/participante/{sucessoData.token_edicao}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/grupo/${token}/participante/${sucessoData.token_edicao}`)
                  toast.success('Link de edição copiado!')
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-700 transition flex-shrink-0"
              >
                Copiar Link
              </button>
            </div>
          </div>
        )}

        {/* Formulário Principal ou Bloqueio */}
        {!sucessoData && (
          !senhaLiberada && grupo.tem_senha ? (
            /* Card de Desbloqueio por Senha */
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 space-y-5 text-center shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <Key className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Grupo Protegido por Senha</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Este grupo é restrito à sua turma. Digite a senha informada pelo organizador para acessar o formulário de pedido.
                </p>
              </div>

              <form onSubmit={handleValidarSenha} className="max-w-xs mx-auto space-y-3">
                <input
                  type="text"
                  placeholder="Digite a senha (PIN)"
                  value={senhaDigitada}
                  onChange={(e) => setSenhaDigitada(e.target.value)}
                  className="input text-center font-mono font-bold tracking-widest text-lg py-3 uppercase"
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  disabled={validandoSenha}
                  className="w-full py-3 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
                >
                  <Unlock className="w-4 h-4" />
                  {validandoSenha ? 'Verificando...' : 'Desbloquear Formulário'}
                </button>
              </form>
            </div>
          ) : grupo.esta_aberto ? (
            <form onSubmit={handleSubmit} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6 space-y-5">
              <div className="border-b border-zinc-800 pb-3">
                <h2 className="text-lg font-bold text-white">Preencha seus dados para a confecção</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Informe o tamanho correto e detalhes personalizados para sua estampa
                </p>
              </div>

              {/* Honeypot anti-spam oculto */}
              <input
                type="text"
                name="website_url_honeypot"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Nome Completo e WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nome Completo *</label>
                  <input
                    type="text"
                    placeholder="Seu nome e sobrenome"
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">WhatsApp (para avisos)</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Escolha do Modelo */}
              <div>
                <label className="label">Modelo da Camisa *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(grupo.modelos || []).map((mod: GrupoModelo) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setModeloId(mod.id)}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        modeloId === mod.id
                          ? 'bg-amber-500/15 border-amber-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{mod.nome}</div>
                        {mod.cores && mod.cores.length > 0 && (
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            Cores: {mod.cores.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-bold text-amber-400 font-mono">
                        R$ {Number(mod.valor_base).toFixed(2).replace('.', ',')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor e Tamanho */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cor */}
                <div>
                  <label className="label">Cor Escolhida *</label>
                  {modeloSelecionado?.cores && modeloSelecionado.cores.length > 0 ? (
                    <select
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="input"
                      required
                    >
                      {modeloSelecionado.cores.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex: Preto"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="input"
                      required
                    />
                  )}
                </div>

                {/* Tamanho com Tabela de Medidas */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label mb-0">Tamanho *</label>
                    {grupo.tem_tabela_medidas && (
                      <button
                        type="button"
                        onClick={() => setShowTabelaMedidas(true)}
                        className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <Ruler className="w-3.5 h-3.5" /> Ver tabela de medidas
                      </button>
                    )}
                  </div>

                  <select
                    value={tamanho}
                    onChange={(e) => setTamanho(e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">Selecione o tamanho...</option>
                    {(grupo.tamanhos_disponiveis || []).map((t: { tamanho: string }) => (
                      <option key={t.tamanho} value={t.tamanho}>
                        {t.tamanho}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantidade */}
              <div>
                <label className="label">Quantidade de Peças *</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
                    className="input text-center font-bold font-mono w-20"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => q + 1)}
                    className="w-10 h-10 rounded-lg bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Campos Extras: Nome e Número na Camisa */}
              {(grupo.campo_nome_camisa || grupo.campo_numero_camisa) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                  {grupo.campo_nome_camisa && (
                    <div>
                      <label className="label">Nome Estampado na Camisa</label>
                      <input
                        type="text"
                        placeholder="Ex: LUCAS ou SILVA"
                        value={nomeCamisa}
                        onChange={(e) => setNomeCamisa(e.target.value)}
                        className="input uppercase"
                      />
                    </div>
                  )}

                  {grupo.campo_numero_camisa && (
                    <div>
                      <label className="label">Número da Camisa</label>
                      <input
                        type="text"
                        placeholder="Ex: 10 ou 7"
                        value={numeroCamisa}
                        onChange={(e) => setNumeroCamisa(e.target.value)}
                        className={`input font-mono font-bold ${
                          numeroEmUso ? 'border-amber-500 bg-amber-500/10' : ''
                        }`}
                      />
                      {numeroEmUso && (
                        <span className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Aviso: O número #{numeroCamisa} já foi escolhido por outro amigo!
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Apelido e Frase nas Costas */}
              {(grupo.campo_apelido || grupo.campo_frase_costas) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {grupo.campo_apelido && (
                    <div>
                      <label className="label">Apelido na Turma</label>
                      <input
                        type="text"
                        placeholder="Seu apelido"
                        value={apelido}
                        onChange={(e) => setApelido(e.target.value)}
                        className="input"
                      />
                    </div>
                  )}

                  {grupo.campo_frase_costas && (
                    <div>
                      <label className="label">Frase nas Costas</label>
                      <input
                        type="text"
                        placeholder="Frase ou citação"
                        value={fraseCostas}
                        onChange={(e) => setFraseCostas(e.target.value)}
                        className="input"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Observações */}
              {grupo.campo_observacao && (
                <div>
                  <label className="label">Observações Adicionais</label>
                  <textarea
                    placeholder="Alguma observação especial para a costura ou estampa?"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="textarea"
                    rows={2}
                  />
                </div>
              )}

              {/* Resumo do Valor Total */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">Total a pagar ({quantidade} {quantidade === 1 ? 'peça' : 'peças'}):</div>
                  <div className="text-xl font-extrabold text-amber-400 font-mono">
                    R$ {valorTotal.toFixed(2).replace('.', ',')}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-black font-extrabold text-sm hover:bg-amber-400 transition flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Gravando...' : 'Confirmar e Enviar'}
                </button>
              </div>
            </form>
          ) : (
            /* Grupo Bloqueado com Botão 'Esqueci de preencher' */
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-800 text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Inscrições Encerradas</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  O prazo limite deste grupo já foi atingido ou o pedido já foi confirmado para produção. Novas alterações normais estão bloqueadas.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowForaPrazoModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-bold transition inline-flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Esqueci de preencher (Solicitar Inclusão)
                </button>
              </div>
            </div>
          )
        )}

      </main>

      {/* Modal da Tabela de Medidas */}
      {showTabelaMedidas && grupo.tabela_medidas_url && (
        <TabelaMedidasModal
          imageUrl={grupo.tabela_medidas_url}
          onClose={() => setShowTabelaMedidas(false)}
        />
      )}

      {/* Modal 'Esqueci de preencher' */}
      {showForaPrazoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Solicitação de Pedido Fora do Prazo</h3>
            <p className="text-xs text-zinc-400">
              Sua solicitação será enviada ao administrador do grupo para avaliação. Se aprovada, sua peça será adicionada à produção.
            </p>

            <form onSubmit={handleForaPrazoSubmit} className="space-y-4 text-left">
              <div>
                <label className="label">Nome Completo *</label>
                <input
                  type="text"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">WhatsApp</label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Tamanho *</label>
                  <select
                    value={tamanho}
                    onChange={(e) => setTamanho(e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">Selecione...</option>
                    {(grupo.tamanhos_disponiveis || []).map((t: { tamanho: string }) => (
                      <option key={t.tamanho} value={t.tamanho}>{t.tamanho}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Motivo do Atraso</label>
                <textarea
                  placeholder="Por que não conseguiu preencher antes do prazo?"
                  value={motivoForaPrazo}
                  onChange={(e) => setMotivoForaPrazo(e.target.value)}
                  className="textarea"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowForaPrazoModal(false)}
                  className="px-4 py-2 text-xs rounded-lg bg-zinc-800 text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-500 text-black hover:bg-amber-400"
                >
                  {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rodapé simples */}
      <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Camiseta Design • Módulo de Grupos
      </footer>
    </div>
  )
}


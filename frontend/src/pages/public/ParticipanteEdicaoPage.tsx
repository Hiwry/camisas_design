import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { grupoService } from '@/services/grupoService'
import { Shirt, Save, Lock, ArrowLeft, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { GrupoModelo } from '@/types/grupo'

export default function ParticipanteEdicaoPage() {
  const { token, tokenEdicao } = useParams<{ token: string; tokenEdicao: string }>()

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
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['participante-edicao', token, tokenEdicao],
    queryFn: () => grupoService.consultarEdicaoPublico(token!, tokenEdicao!),
    enabled: !!token && !!tokenEdicao,
  })

  useEffect(() => {
    if (data?.participante) {
      const p = data.participante
      setNomeCompleto(p.nome_completo || '')
      setWhatsapp(p.whatsapp || '')
      setModeloId(p.grupo_modelo_id || null)
      setCor(p.cor || '')
      setTamanho(p.tamanho || '')
      setQuantidade(p.quantidade || 1)
      setNomeCamisa(p.nome_camisa || '')
      setNumeroCamisa(p.numero_camisa || '')
      setApelido(p.apelido || '')
      setFraseCostas(p.frase_costas || '')
      setObservacao(p.observacao || '')
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Shirt className="w-10 h-10 text-amber-400 animate-bounce mx-auto" />
          <p className="text-sm text-zinc-400">Carregando seus dados...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center p-4 text-center">
        <div className="max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Link de edição inválido</h2>
          <p className="text-xs text-zinc-400">
            O link pessoal de edição expirou ou não corresponde a um participante deste grupo.
          </p>
          <Link to={`/grupo/${token}`} className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-white">
            Voltar para o grupo
          </Link>
        </div>
      </div>
    )
  }

  const { grupo, participante } = data
  const estaAberto = grupo.esta_aberto

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!estaAberto) {
      toast.error('Este grupo não aceita mais edições.')
      return
    }

    setSubmitting(true)
    try {
      await grupoService.salvarEdicaoPublico(token!, tokenEdicao!, {
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
      })

      toast.success('Alterações salvas com sucesso!')
      refetch()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao salvar alterações.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const modeloSelecionado = (grupo.modelos || []).find((m: GrupoModelo) => m.id === modeloId)

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-zinc-100 flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-xl w-full mx-auto space-y-6">
        
        {/* Topo */}
        <div className="flex items-center justify-between">
          <Link
            to={`/grupo/${token}`}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Ver página do grupo
          </Link>
          <span className="text-xs font-mono text-zinc-500">ID #{participante.id}</span>
        </div>

        {/* Card de Aviso se Travado */}
        {!estaAberto ? (
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
            <Lock className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">Edição Bloqueada</h3>
            <p className="text-xs text-zinc-400">
              O prazo para edição foi encerrado ou o pedido foi confirmado pelo organizador.
            </p>
          </div>
        ) : (
          /* Formulário de Edição */
          <form onSubmit={handleSalvar} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-5 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white">Editar Meus Dados</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Grupo: {grupo.nome}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Nome Completo</label>
                <input
                  type="text"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">WhatsApp</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Modelo</label>
                  <select
                    value={modeloId || ''}
                    onChange={(e) => setModeloId(Number(e.target.value))}
                    className="input"
                    required
                  >
                    {(grupo.modelos || []).map((m: GrupoModelo) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Cor</label>
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
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="input"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tamanho</label>
                  <select
                    value={tamanho}
                    onChange={(e) => setTamanho(e.target.value)}
                    className="input"
                    required
                  >
                    {(grupo.tamanhos_disponiveis || []).map((t: { tamanho: string }) => (
                      <option key={t.tamanho} value={t.tamanho}>{t.tamanho}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
                    className="input font-mono"
                    required
                  />
                </div>
              </div>

              {grupo.campo_nome_camisa && (
                <div>
                  <label className="label">Nome na Camisa</label>
                  <input
                    type="text"
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
                    value={numeroCamisa}
                    onChange={(e) => setNumeroCamisa(e.target.value)}
                    className="input font-mono"
                  />
                </div>
              )}

              {grupo.campo_observacao && (
                <div>
                  <label className="label">Observações</label>
                  <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="textarea"
                    rows={2}
                  />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}


import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { creditoService } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Sparkles, QrCode, Copy, Check, X, ShieldCheck, ArrowRight, Zap } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess?: () => void
}

const PACOTES = [
  { qtd: 1,  preco: 5,   label: '1 Análise',   tag: 'Teste rápido' },
  { qtd: 5,  preco: 25,  label: '5 Análises',  tag: '' },
  { qtd: 10, preco: 50,  label: '10 Análises', tag: 'Mais Escolhido', destaque: true },
  { qtd: 20, preco: 100, label: '20 Análises', tag: 'Economize tempo' },
]

export default function ModalComprarCreditos({ onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const [etapa, setEtapa] = useState<'selecionar' | 'pix' | 'sucesso'>('selecionar')
  const [quantidade, setQuantidade] = useState<number>(10)
  const [qtdPersonalizada, setQtdPersonalizada] = useState<string>('')
  const [copiado, setCopiado] = useState(false)
  const [dadosPix, setDadosPix] = useState<{
    transacao_id: number
    quantidade_creditos: number
    valor_total: number
    valor_formatado: string
    pix_copia_cola: string
    pix_qrcode_url: string
    chave_pix: string
  } | null>(null)

  const qtdFinal = qtdPersonalizada && Number(qtdPersonalizada) > 0
    ? Number(qtdPersonalizada)
    : quantidade

  const valorCalculado = qtdFinal * 5

  const comprarMutation = useMutation({
    mutationFn: () => creditoService.comprar(qtdFinal),
    onSuccess: (data) => {
      setDadosPix(data)
      setEtapa('pix')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao gerar Pix de recarga.')
    },
  })

  const confirmarMutation = useMutation({
    mutationFn: () => creditoService.confirmarPagamento(dadosPix!.transacao_id),
    onSuccess: (data) => {
      toast.success(data.message || 'Pagamento confirmado!')
      qc.invalidateQueries({ queryKey: ['creditos-saldo'] })
      qc.invalidateQueries({ queryKey: ['confeccoes'] })
      setEtapa('sucesso')
      if (onSuccess) onSuccess()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao confirmar pagamento.')
    },
  })

  function handleConfirmarPagamento() {
    if (isAdmin) {
      confirmarMutation.mutate()
    } else {
      toast.success('Pagamento registrado! O administrador irá conferir o Pix e liberar seus créditos.')
      qc.invalidateQueries({ queryKey: ['creditos-saldo'] })
      onClose()
    }
  }

  function handleCopiarPix() {
    if (!dadosPix?.pix_copia_cola) return
    navigator.clipboard.writeText(dadosPix.pix_copia_cola)
    setCopiado(true)
    toast.success('Código Pix copiado!')
    setTimeout(() => setCopiado(false), 3000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden flex flex-col"
        style={{
          background: '#0f0f0f',
          borderColor: '#262626',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 30px rgba(212,160,32,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ background: '#141414', borderColor: '#222' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(212,160,32,0.15)', border: '1px solid rgba(212,160,32,0.3)' }}
            >
              <Sparkles className="w-4 h-4 text-[#d4a020]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Créditos de Análise IA</h2>
              <p className="text-[11px] text-zinc-500">R$ 5,00 por análise detalhada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-5">
          {etapa === 'selecionar' && (
            <>
              {/* Informativo */}
              <div
                className="rounded-xl p-3.5 border flex items-start gap-3"
                style={{ background: 'rgba(212,160,32,0.06)', borderColor: 'rgba(212,160,32,0.2)' }}
              >
                <Zap className="w-4 h-4 text-[#d4a020] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  A IA compara minuciosamente a referência do cliente com a sua arte final (ortografia, cores, logotipos e proporções).
                  <span className="block mt-1 font-semibold text-[#d4a020]">Cada análise utiliza 1 crédito (R$ 5,00).</span>
                </div>
              </div>

              {/* Pacotes Pré-definidos */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Escolha a quantidade de análises:</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {PACOTES.map((p) => {
                    const selecionado = !qtdPersonalizada && quantidade === p.qtd
                    return (
                      <button
                        key={p.qtd}
                        type="button"
                        onClick={() => {
                          setQtdPersonalizada('')
                          setQuantidade(p.qtd)
                        }}
                        className="relative p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between"
                        style={{
                          background: selecionado ? 'rgba(212,160,32,0.12)' : '#151515',
                          borderColor: selecionado ? '#d4a020' : '#262626',
                          boxShadow: selecionado ? '0 0 16px rgba(212,160,32,0.2)' : 'none',
                        }}
                      >
                        {p.tag && (
                          <span
                            className="absolute -top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: p.destaque ? '#d4a020' : '#27272a',
                              color: p.destaque ? '#000' : '#d4d4d8',
                            }}
                          >
                            {p.tag}
                          </span>
                        )}
                        <div>
                          <div className="text-sm font-bold text-white">{p.label}</div>
                          <div className="text-[11px] text-zinc-500">R$ 5,00 cada</div>
                        </div>
                        <div className="text-base font-black text-[#d4a020] mt-2">
                          R$ {p.preco},00
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quantidade Personalizada */}
              <div className="pt-1">
                <label className="text-xs text-zinc-400 mb-1 block">Ou digite outra quantidade:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    placeholder="Ex: 15"
                    value={qtdPersonalizada}
                    onChange={(e) => setQtdPersonalizada(e.target.value)}
                    className="input py-2 text-sm w-32"
                  />
                  <span className="text-xs text-zinc-500">
                    análise(s) = <strong className="text-white">R$ {(Number(qtdPersonalizada || 0) * 5).toFixed(2).replace('.', ',')}</strong>
                  </span>
                </div>
              </div>

              {/* Resumo & Ação */}
              <div
                className="rounded-xl p-4 border flex items-center justify-between"
                style={{ background: '#121212', borderColor: '#222' }}
              >
                <div>
                  <span className="text-xs text-zinc-500 block">Total a pagar:</span>
                  <span className="text-lg font-black text-white">
                    R$ {valorCalculado.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => comprarMutation.mutate()}
                  disabled={comprarMutation.isPending || qtdFinal < 1}
                  className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2"
                >
                  {comprarMutation.isPending ? (
                    'Gerando Pix...'
                  ) : (
                    <>
                      Pagar com Pix <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {etapa === 'pix' && dadosPix && (
            <div className="space-y-5 text-center">
              <div className="flex flex-col items-center">
                <div
                  className="p-3 rounded-2xl bg-white border shadow-md mb-3"
                  style={{ borderColor: '#ddd' }}
                >
                  <img
                    src={dadosPix.pix_qrcode_url}
                    alt="QR Code Pix"
                    className="w-48 h-48 block"
                  />
                </div>
                <div className="text-xs text-zinc-400">
                  Total: <strong className="text-white text-sm">{dadosPix.valor_formatado}</strong> ({dadosPix.quantidade_creditos} análises)
                </div>
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Código Pix Copia e Cola
                </label>
                <div className="relative">
                  <input
                    readOnly
                    value={dadosPix.pix_copia_cola}
                    className="input text-xs font-mono pr-24 select-all text-zinc-300"
                  />
                  <button
                    type="button"
                    onClick={handleCopiarPix}
                    className="absolute right-1 top-1 bottom-1 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-white transition-all"
                    style={{ background: copiado ? '#10b981' : '#27272a' }}
                  >
                    {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmarPagamento}
                  disabled={confirmarMutation.isPending}
                  className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2"
                >
                  {confirmarMutation.isPending ? (
                    'Confirmando pagamento...'
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Já realizei o pagamento Pix
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setEtapa('selecionar')}
                  className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1.5 transition-colors"
                >
                  ← Voltar e escolher outra quantidade
                </button>
              </div>
            </div>
          )}

          {etapa === 'sucesso' && (
            <div className="text-center py-6 space-y-4">
              <div
                className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Créditos Adicionados!</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Seus créditos de IA já estão liberados para uso imediato em qualquer análise.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full py-2.5 text-xs font-bold"
              >
                Começar Análise
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

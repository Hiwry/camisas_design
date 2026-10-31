import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shopService, ShopItem, ShopPedido } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  ShoppingBag,
  Sparkles,
  Palette,
  Zap,
  Box,
  Clock,
  PenTool,
  Bot,
  Cpu,
  Check,
  Copy,
  ShieldCheck,
  ArrowRight,
  X,
  AlertCircle,
  FileText,
  CheckCircle2,
} from 'lucide-react'

interface Props {
  item: ShopItem
  onClose: () => void
  onSuccess?: () => void
}

function getItemIcon(iconName?: string) {
  switch (iconName) {
    case 'palette':
      return Palette
    case 'sparkles':
      return Sparkles
    case 'zap':
      return Zap
    case 'bot':
      return Bot
    case 'cpu':
      return Cpu
    case 'pen-tool':
      return PenTool
    case 'box':
      return Box
    case 'clock':
      return Clock
    default:
      return ShoppingBag
  }
}

export default function ModalComprarItemShop({ item, onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const [etapa, setEtapa] = useState<'detalhes' | 'pix' | 'sucesso'>('detalhes')
  const [detalhes, setDetalhes] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [dadosPix, setDadosPix] = useState<{
    pedido: ShopPedido
    item: ShopItem
    valor_formatado: string
    pix_copia_cola: string
    pix_qrcode_url: string
    chave_pix: string
    beneficiario: string
  } | null>(null)

  const ItemIcon = getItemIcon(item.icone)

  const comprarMutation = useMutation({
    mutationFn: () =>
      shopService.comprar({
        item_id: item.id,
        detalhes: detalhes.trim() || undefined,
      }),
    onSuccess: (data) => {
      setDadosPix(data)
      setEtapa('pix')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao gerar o Pix para este item.')
    },
  })

  const confirmarMutation = useMutation({
    mutationFn: () => shopService.confirmarPagamento(dadosPix!.pedido.id),
    onSuccess: (data) => {
      toast.success(data.message || 'Pagamento confirmado com sucesso!')
      qc.invalidateQueries({ queryKey: ['shop-itens'] })
      qc.invalidateQueries({ queryKey: ['shop-pedidos'] })
      qc.invalidateQueries({ queryKey: ['creditos-saldo'] })
      qc.invalidateQueries({ queryKey: ['auth-me'] })
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
      toast.success('Pagamento informado! O administrador irá conferir o Pix e liberar seu pedido.')
      qc.invalidateQueries({ queryKey: ['shop-pedidos'] })
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

  const precisaInstrucoes = item.categoria === 'servicos' || item.categoria === 'urgencia'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden flex flex-col"
        style={{
          background: '#0f0f0f',
          borderColor: '#262626',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 35px rgba(212,160,32,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b flex-shrink-0"
          style={{ background: '#141414', borderColor: '#222' }}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(212,160,32,0.15)',
                border: '1px solid rgba(212,160,32,0.3)',
              }}
            >
              <ItemIcon className="w-4 h-4 text-[#d4a020]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight truncate">{item.nome}</h2>
              <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">
                {item.entrega_sla} · R$ {item.valor.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[82vh] space-y-4 sm:space-y-5">
          {etapa === 'detalhes' && (
            <>
              {/* Card de Resumo do Item */}
              <div
                className="rounded-xl overflow-hidden border"
                style={{
                  background: 'linear-gradient(145deg, rgba(212,160,32,0.06), rgba(15,15,15,0.8))',
                  borderColor: 'rgba(212,160,32,0.25)',
                }}
              >
                {item.imagem && (
                  <div className="w-full h-36 relative overflow-hidden bg-zinc-950 border-b border-zinc-800">
                    <img
                      src={item.imagem}
                      alt={item.nome}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-transparent opacity-80" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4a020]">
                        {item.badge || 'Item Avulso'}
                      </span>
                    <h3 className="text-base font-extrabold text-white">{item.nome}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.descricao}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.valor_original && item.valor_original > item.valor && (
                      <span className="text-[11px] text-zinc-500 line-through block">
                        R$ {item.valor_original.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    <span className="text-xl font-black text-[#d4a020]">
                      R$ {item.valor.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                {/* Lista de Inclusos */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-300 block">O que está incluso:</span>
                  {item.itens_inclusos.map((inc, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{inc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

              {/* Campo opcional de observações/briefing para serviços técnicos */}
              {precisaInstrucoes && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>Instruções ou links dos arquivos (opcional):</span>
                    <span className="text-[10px] text-zinc-500">Pode preencher agora ou depois</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Link do Google Drive ou Canva com as referências, logo em print, número do pedido que deseja acelerar, etc."
                    value={detalhes}
                    onChange={(e) => setDetalhes(e.target.value)}
                    className="input w-full text-xs py-2 px-3 resize-none"
                  />
                </div>
              )}

              {/* Informação sobre liberação */}
              <div
                className="rounded-xl p-3 border flex items-start gap-2.5 text-xs text-zinc-400"
                style={{ background: '#121212', borderColor: '#222' }}
              >
                <AlertCircle className="w-4 h-4 text-[#d4a020] flex-shrink-0 mt-0.5" />
                <span>
                  {item.categoria === 'artes' &&
                    'O saldo de artes extras é creditado imediatamente após o pagamento do Pix e não expira.'}
                  {item.categoria === 'ia' &&
                    'Os créditos de IA são liberados instantaneamente para uso no revisor de arte.'}
                  {item.categoria === 'servicos' &&
                    'Após o pagamento, o designer recebe a demanda e iniciará a vetorização/mockup com prioridade.'}
                  {item.categoria === 'urgencia' &&
                    'Seu pedido receberá a tag de Urgência Fast-Track e subirá para a primeira posição da fila.'}
                </span>
              </div>

              {/* Footer com ação */}
              <div
                className="rounded-xl p-4 border flex items-center justify-between"
                style={{ background: '#121212', borderColor: '#222' }}
              >
                <div>
                  <span className="text-xs text-zinc-500 block">Total a pagar:</span>
                  <span className="text-lg font-black text-white">
                    R$ {item.valor.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => comprarMutation.mutate()}
                  disabled={comprarMutation.isPending}
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
                  className="p-3.5 rounded-2xl bg-white border shadow-md mb-3"
                  style={{ borderColor: '#ddd' }}
                >
                  <img
                    src={dadosPix.pix_qrcode_url}
                    alt="QR Code Pix"
                    className="w-48 h-48 block"
                  />
                </div>
                <div className="text-xs text-zinc-400">
                  Item: <strong className="text-white text-sm">{item.nome}</strong> · Total:{' '}
                  <strong className="text-[#d4a020] text-sm">{dadosPix.valor_formatado}</strong>
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
                  onClick={() => setEtapa('detalhes')}
                  className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1.5 transition-colors"
                >
                  ← Voltar e revisar detalhes
                </button>
              </div>
            </div>
          )}

          {etapa === 'sucesso' && (
            <div className="text-center py-6 space-y-4">
              <div
                className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
                style={{
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Aquisição Confirmada com Sucesso!</h3>
                <p className="text-xs text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                  {item.categoria === 'artes' &&
                    `Você agora tem +${item.quantidade} arte(s) extra(s) liberadas para abrir novos pedidos no Kanban.`}
                  {item.categoria === 'ia' &&
                    `Seus ${item.quantidade} créditos de IA foram adicionados e já podem ser utilizados.`}
                  {item.categoria === 'servicos' &&
                    `Seu pedido de ${item.nome} foi registrado com sucesso na fila de produção.`}
                  {item.categoria === 'urgencia' &&
                    `A taxa expressa foi aplicada com sucesso!`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full py-2.5 text-xs font-bold"
              >
                Concluir e Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

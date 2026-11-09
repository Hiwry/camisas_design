import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { pedidoService, confeccaoService, shopService, ShopItem } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  Sparkles,
  ShoppingBag,
  Paperclip,
  Clipboard,
  FileText,
  X,
  Zap,
} from 'lucide-react'
import { format, addHours } from 'date-fns'

const PLANO_CFG: Record<string, { label: string; sla: number; expresso: number; cor: string }> = {
  avulso:       { label: 'AVULSO', sla: 48, expresso: 6, cor: '#71717a' },
  basico:       { label: 'START',  sla: 48, expresso: 6, cor: '#6366f1' },
  profissional: { label: 'PRO',    sla: 24, expresso: 6, cor: '#d4a020' },
  premium:      { label: 'VIP',    sla: 12, expresso: 6, cor: '#8b5cf6' },
}

function calcularPrazo(slaHoras: number): string {
  return format(addHours(new Date(), slaHoras), 'yyyy-MM-dd')
}

interface ModalNovoPedidoProps {
  onClose: () => void
  onSuccess?: () => void
}

export default function ModalNovoPedido({ onClose, onSuccess }: ModalNovoPedidoProps) {
  const qc = useQueryClient()
  const { isAdmin, user } = useAuthStore()

  const [referencias, setReferencias]     = useState<File[]>([])
  const [expresso, setExpresso]           = useState(false)
  const [confeccaoSel, setConfeccaoSel]   = useState<{ id: number; nome: string; plano: string } | null>(null)
  const [valorPedido, setValorPedido]     = useState<string>('')
  const [shopItemSel, setShopItemSel]     = useState<string>('')
  const refInputRef                       = useRef<HTMLInputElement>(null)

  // Suporte a colar imagens (Ctrl + V)
  useEffect(() => {
    function handleWindowPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return

      const pasted: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png'
            const newFile = new File([blob], `print_${Date.now()}.${ext}`, { type: blob.type })
            pasted.push(newFile)
          }
        }
      }

      if (pasted.length > 0) {
        e.preventDefault()
        setReferencias((prev) => [...prev, ...pasted])
        toast.success(`${pasted.length} imagem(ns) colada(s) da área de transferência!`, { icon: '📋' })
      }
    }

    window.addEventListener('paste', handleWindowPaste)
    return () => window.removeEventListener('paste', handleWindowPaste)
  }, [])

  const { data: confeccoesRaw } = useQuery({
    queryKey: ['confeccoes-lista'],
    queryFn: () => confeccaoService.listar({ per_page: 100 }),
    enabled: isAdmin(),
  })
  const confeccoesList: { id: number; nome: string; plano: string }[] = useMemo(() => {
    if (!confeccoesRaw) return []
    return Array.isArray(confeccoesRaw) ? confeccoesRaw : (confeccoesRaw?.data ?? [])
  }, [confeccoesRaw])

  const { data: shopData } = useQuery({
    queryKey: ['shop-itens-lista'],
    queryFn: shopService.listarItens,
  })
  const shopItens: ShopItem[] = useMemo(() => {
    if (!shopData) return []
    return shopData?.itens ?? (Array.isArray(shopData) ? (shopData as any) : [])
  }, [shopData])

  const planoAtual = isAdmin()
    ? (confeccaoSel?.plano ?? 'basico')
    : (user?.confeccao?.plano ?? 'basico')
  const cfg = PLANO_CFG[planoAtual] ?? PLANO_CFG.basico
  const prazoCalculado = calcularPrazo(expresso ? cfg.expresso : cfg.sla)

  const criarMutation = useMutation({
    mutationFn: pedidoService.criar,
    onSuccess: () => {
      toast.success('Pedido criado com sucesso!')
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['kanban'] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao criar pedido.'
      toast.error(msg)
    },
  })

  function handleShopItemChange(itemId: string) {
    setShopItemSel(itemId)
    if (!itemId) return
    const found = shopItens.find((it) => String(it.id) === itemId || String(it.db_id) === itemId)
    if (found && found.valor > 0) {
      setValorPedido(String(found.valor))
      toast.success(`Serviço selecionado: ${found.nome} — R$ ${found.valor.toFixed(2).replace('.', ',')}`, { icon: '🛒' })
    }
  }

  function handleNovoPedidoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('prazo', prazoCalculado)
    if (expresso) fd.set('expresso', '1')
    if (valorPedido) fd.set('valor', valorPedido)
    referencias.forEach((file) => fd.append('referencias[]', file))
    criarMutation.mutate(fd as unknown as Record<string, unknown>)
  }

  function addReferencias(files: FileList | null) {
    if (!files) return
    const novos = Array.from(files).filter(
      (f) => !referencias.find((r) => r.name === f.name && r.size === f.size)
    )
    setReferencias((prev) => [...prev, ...novos])
  }

  function removeReferencia(index: number) {
    setReferencias((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl animate-[slideUp_0.15s_ease-out] border"
        style={{
          backgroundColor: '#151516',
          borderColor: '#303034',
          boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{ backgroundColor: '#151516', borderColor: '#303034' }}
        >
          <h3 className="text-sm font-bold text-[#F5F5F6]">Novo Pedido</h3>
          <button
            onClick={onClose}
            className="text-[#909098] hover:text-[#F5F5F6] transition-colors p-1 rounded-lg hover:bg-[#1D1D1F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <form onSubmit={handleNovoPedidoSubmit} className="space-y-4">
            {/* Saldo de Artes (Para usuário Confecção) */}
            {!isAdmin() && user?.confeccao && (() => {
              const conf = user.confeccao
              const artesPlano = Math.max(0, conf.limite_mensal - conf.artes_usadas_mes)
              const extras = conf.artes_extras ?? 0
              const total = artesPlano + extras
              return (
                <div
                  className="rounded-xl p-3 border flex items-center justify-between"
                  style={{
                    backgroundColor: total > 0 ? 'rgba(231,179,44,0.06)' : 'rgba(239,68,68,0.1)',
                    borderColor: total > 0 ? 'rgba(231,179,44,0.25)' : 'rgba(239,68,68,0.3)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#E7B32C]" />
                    <span className="text-xs text-zinc-300">
                      Saldo disponível:{' '}
                      <strong className="text-white">
                        {total} arte{total !== 1 ? 's' : ''}
                      </strong>{' '}
                      ({artesPlano} do plano + {extras} extras)
                    </span>
                  </div>
                  <Link
                    to="/shop"
                    className="text-[11px] font-bold text-[#E7B32C] hover:underline flex items-center gap-1"
                  >
                    <ShoppingBag className="w-3 h-3" /> Shop Avulso
                  </Link>
                </div>
              )
            })()}

            {/* Título */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Título do pedido *
              </label>
              <input
                name="titulo"
                required
                placeholder="Ex: Camiseta Time Alfa"
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              />
            </div>

            {/* Confecção (Se admin) */}
            {isAdmin() && (
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Confecção *
                </label>
                <select
                  name="confeccao_id"
                  required
                  onChange={(e) => {
                    const sel = confeccoesList.find((c) => String(c.id) === e.target.value)
                    setConfeccaoSel(sel ?? null)
                    setExpresso(false)
                  }}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                >
                  <option value="">Selecionar confecção...</option>
                  {confeccoesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} — {PLANO_CFG[c.plano]?.label ?? c.plano}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo de Impressão */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Tipo de impressão *
              </label>
              <select
                name="tipo_impressao"
                required
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                <option value="">Selecionar...</option>
                <option value="sublimacao">Sublimação</option>
                <option value="bordado">Bordado</option>
                <option value="serigrafia">Serigrafia</option>
              </select>
            </div>

            {/* Cliente (Opcional) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Nome do Cliente (opcional)
                </label>
                <input
                  name="cliente_nome"
                  placeholder="Ex: João da Silva"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  WhatsApp (com DDD)
                </label>
                <input
                  name="cliente_whatsapp"
                  placeholder="Ex: 11999998888"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                  Email (opcional)
                </label>
                <input
                  name="cliente_email"
                  type="email"
                  placeholder="Ex: cliente@email.com"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
            </div>

            {/* Serviços e Valores Avulsos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5 flex items-center justify-between">
                  <span>Serviço do Catálogo</span>
                  <span className="text-[10px] text-[#909098]">Opcional</span>
                </label>
                <select
                  value={shopItemSel}
                  onChange={(e) => handleShopItemChange(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                >
                  <option value="">Nenhum (usar cota do plano)</option>
                  {shopItens.map((it) => (
                    <option key={it.id || it.db_id} value={String(it.id || it.db_id)}>
                      {it.nome} — R$ {it.valor.toFixed(2).replace('.', ',')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5 flex items-center justify-between">
                  <span>Valor Cobrado (R$)</span>
                  <span className="text-[10px] text-[#909098]">Opcional</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valorPedido}
                  onChange={(e) => setValorPedido(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: '#1D1D1F',
                    borderColor: '#303034',
                    color: '#F5F5F6',
                  }}
                />
              </div>
            </div>

            {/* Prazo e Entrega Expressa */}
            <div
              className="rounded-xl p-3 border space-y-2"
              style={{ backgroundColor: '#1A1A1D', borderColor: '#303034' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#F5F5F6]">Prazo estimado</span>
                  <p className="text-[11px] text-[#909098]">
                    Plano {cfg.label}: {expresso ? `${cfg.expresso}h (Expresso)` : `${cfg.sla}h`}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#E7B32C]">
                  {prazoCalculado}
                </span>
              </div>

              {/* Toggle Expresso */}
              <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-zinc-800">
                <input
                  type="checkbox"
                  checked={expresso}
                  onChange={(e) => setExpresso(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span className="text-xs text-zinc-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Entrega Expressa ({cfg.expresso}h)
                </span>
              </label>
            </div>

            {/* Observações / Briefing */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Briefing / Observações
              </label>
              <textarea
                name="observacoes"
                rows={3}
                placeholder="Descreva detalhes como cores, posições da estampa, fontes desejadas..."
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border focus:outline-none resize-none"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              />
            </div>

            {/* Upload de Referências / Mockups */}
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F6] mb-1.5">
                Referências visuais ou mockups
              </label>
              <input
                ref={refInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.cdr,.ai,.psd"
                onChange={(e) => addReferencias(e.target.files)}
                className="hidden"
              />

              <div
                onClick={() => refInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors"
                style={{ borderColor: '#303034', backgroundColor: '#1A1A1D' }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#E7B32C'
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = '#303034'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#303034'
                  addReferencias(e.dataTransfer.files)
                }}
              >
                <Paperclip className="w-5 h-5 mx-auto mb-1 text-[#909098]" />
                <p className="text-xs text-zinc-300">
                  Arraste arquivos ou <span style={{ color: '#E7B32C' }}>clique para selecionar</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E7B32C]/10 text-[#E7B32C] border border-[#E7B32C]/25 text-[11px] font-semibold">
                  <Clipboard className="w-3 h-3" />
                  <span>Dica: cole imagens direto com Ctrl + V</span>
                </div>
                <p className="text-[10px] text-[#909098] mt-1.5">PNG, JPG, PDF, CDR, AI, PSD... · até 50MB</p>
              </div>

              {referencias.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                  {referencias.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                      style={{ backgroundColor: '#18181A', borderColor: '#303034' }}
                    >
                      <FileText className="w-4 h-4 text-[#909098] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{file.name}</p>
                        <p className="text-[10px] text-[#909098]">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReferencia(i)}
                        className="text-[#909098] hover:text-[#F87171] p-1 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações do Modal */}
            <div className="flex gap-3 pt-3 border-t" style={{ borderColor: '#303034' }}>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{
                  backgroundColor: '#1D1D1F',
                  borderColor: '#303034',
                  color: '#F5F5F6',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={criarMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                style={{
                  backgroundColor: '#E7B32C',
                  color: '#0B0B0C',
                }}
              >
                {criarMutation.isPending ? 'Salvando...' : 'Criar Pedido'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


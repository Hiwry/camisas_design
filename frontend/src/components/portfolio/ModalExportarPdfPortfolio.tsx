import { useState } from 'react'
import { PortfolioItem } from '@/services/api'
import { gerarPdfCatalogo, DadosContatoPdf } from '@/lib/pdfPortfolio'
import {
  X,
  FileText,
  Download,
  Share2,
  CheckCircle2,
  Sparkles,
  MessageCircle,
  Layers,
  Phone,
  Instagram,
  Building,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  todosItens: PortfolioItem[]
  categoriaAtiva?: string
  servicoAtivo?: string
  onClose: () => void
}

export default function ModalExportarPdfPortfolio({
  todosItens,
  categoriaAtiva = 'todos',
  servicoAtivo = 'todos',
  onClose,
}: Props) {
  const [escopo, setEscopo] = useState<'todos' | 'filtrados' | 'destaques'>('todos')
  const [empresaNome, setEmpresaNome] = useState('Camisetas Design')
  const [whatsapp, setWhatsapp] = useState('(82) 98888-7777')
  const [instagram, setInstagram] = useState('@camisetasdesign')
  const [mensagem, setMensagem] = useState(
    'Arquivos 100% vetorizados em curvas (CorelDraw & Illustrator), CMYK e 300 DPI prontos para corte e estamparia.'
  )

  // Estados de Geração
  const [gerando, setGerando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [statusTexto, setStatusTexto] = useState('')

  // Itens filtrados de acordo com o escopo
  const itensParaExportar = (() => {
    if (escopo === 'destaques') {
      return todosItens.filter((i) => i.destaque)
    }
    if (escopo === 'filtrados') {
      return todosItens.filter((i) => {
        const bateuCat = categoriaAtiva === 'todos' || i.categoria === categoriaAtiva
        const bateuSrv = servicoAtivo === 'todos' || i.servico === servicoAtivo
        return bateuCat && bateuSrv
      })
    }
    return todosItens
  })()

  async function handleGerarPdf() {
    if (itensParaExportar.length === 0) {
      toast.error('Nenhum modelo selecionado para exportar.')
      return
    }

    setGerando(true)
    setProgresso(5)
    setStatusTexto('Preparando modelos e fotos...')

    try {
      const contato: DadosContatoPdf = {
        empresaNome: empresaNome.trim() || 'Camisetas Design',
        whatsapp: whatsapp.trim() || undefined,
        instagram: instagram.trim() || undefined,
        mensagem: mensagem.trim() || undefined,
      }

      const doc = await gerarPdfCatalogo({
        itens: itensParaExportar,
        titulo: 'Catálogo de Modelos & Criações Exclusivas',
        subtitulo: 'Uniformes Esportivos, Fardamentos Escolares, Corporativos e Eventos',
        contato,
        onProgresso: (pct, msg) => {
          setProgresso(pct)
          setStatusTexto(msg)
        },
      })

      const nomeArquivo = `catalogo-modelos-${empresaNome.toLowerCase().replace(/\s+/g, '-')}-${new Date().getFullYear()}.pdf`
      doc.save(nomeArquivo)

      toast.success('Catálogo PDF gerado e baixado com sucesso!')
      onClose()
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err)
      toast.error('Erro ao processar PDF. Verifique sua conexão e tente novamente.')
    } finally {
      setGerando(false)
      setProgresso(0)
      setStatusTexto('')
    }
  }

  function handleCompartilharWhatsApp() {
    const cleanPhone = whatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Olá! Segue o link do nosso Portfólio & Catálogo Oficial com ${itensParaExportar.length} modelos de uniformes e camisas personalizadas em alta definição: ${window.location.origin}/portfolio`
    )
    const url = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`
    window.open(url, '_blank')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (!gerando && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-xl flex flex-col rounded-2xl border overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #131313 0%, #0e0e0e 100%)',
          borderColor: '#262626',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#d4a020]/15 text-[#d4a020] border border-[#d4a020]/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                Exportar Catálogo em PDF
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4a020]/20 text-[#d4a020]">
                  Lookbook VIP
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Gere um arquivo PDF de alto padrão visual para enviar aos seus clientes no WhatsApp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={gerando}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* 1. Escolha de Escopo dos Modelos */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-200">
              Quais modelos deseja incluir no PDF?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setEscopo('todos')}
                disabled={gerando}
                className={clsx(
                  'p-3 rounded-xl border text-left transition-all flex flex-col justify-between',
                  escopo === 'todos'
                    ? 'border-[#d4a020] bg-[#d4a020]/10 text-white shadow-md shadow-[#d4a020]/10 ring-1 ring-[#d4a020]/30'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Todos os Modelos</span>
                  <Layers className="w-3.5 h-3.5 text-[#d4a020]" />
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {todosItens.length} modelos
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEscopo('filtrados')}
                disabled={gerando}
                className={clsx(
                  'p-3 rounded-xl border text-left transition-all flex flex-col justify-between',
                  escopo === 'filtrados'
                    ? 'border-[#d4a020] bg-[#d4a020]/10 text-white shadow-md shadow-[#d4a020]/10 ring-1 ring-[#d4a020]/30'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Filtro Atual</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-[11px] text-zinc-500 font-medium truncate">
                  {categoriaAtiva !== 'todos' ? categoriaAtiva : 'Filtrados'} ({itensParaExportar.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEscopo('destaques')}
                disabled={gerando}
                className={clsx(
                  'p-3 rounded-xl border text-left transition-all flex flex-col justify-between',
                  escopo === 'destaques'
                    ? 'border-[#d4a020] bg-[#d4a020]/10 text-white shadow-md shadow-[#d4a020]/10 ring-1 ring-[#d4a020]/30'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Em Destaque</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {todosItens.filter((i) => i.destaque).length} modelos VIP
                </span>
              </button>
            </div>
          </div>

          {/* 2. Informações de Contato que Aparecerão na Capa e Rodapé */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#d4a020]" />
              Dados da Sua Marca / Confecção (Aparecerão no PDF)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Nome da Marca / Designer
                </label>
                <input
                  type="text"
                  value={empresaNome}
                  onChange={(e) => setEmpresaNome(e.target.value)}
                  placeholder="Ex: Camisetas Design"
                  disabled={gerando}
                  className="input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  WhatsApp para Orçamentos
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(82) 99999-9999"
                  disabled={gerando}
                  className="input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                  <Instagram className="w-3 h-3 text-pink-400" />
                  Instagram
                </label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@camisetasdesign"
                  disabled={gerando}
                  className="input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Nota de Fidelidade Gráfica
                </label>
                <input
                  type="text"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Arquivos em curvas CMYK 300 DPI"
                  disabled={gerando}
                  className="input w-full text-xs"
                />
              </div>
            </div>
          </div>

          {/* Barra de Progresso quando estiver gerando */}
          {gerando && (
            <div className="p-4 rounded-xl border border-[#d4a020]/30 bg-[#d4a020]/10 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#d4a020]" />
                  {statusTexto || 'Gerando Catálogo em Alta Resolução...'}
                </span>
                <span className="text-[#d4a020] font-mono">{progresso}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#d4a020] to-amber-300 transition-all duration-300"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-400">
                O arquivo é montado diretamente no seu navegador, preservando a qualidade máxima dos mockups.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCompartilharWhatsApp}
            disabled={gerando}
            className="w-full sm:w-auto text-xs py-2 px-3.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Compartilhar Link no WhatsApp</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={gerando}
              className="btn-secondary text-xs py-2 px-4 flex-1 sm:flex-initial"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleGerarPdf}
              disabled={gerando || itensParaExportar.length === 0}
              className="btn-primary text-xs py-2 px-5 flex-1 sm:flex-initial flex items-center justify-center gap-2 shadow-lg shadow-[#d4a020]/20 font-bold"
            >
              {gerando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Catálogo PDF ({itensParaExportar.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


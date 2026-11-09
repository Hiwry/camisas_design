import { useState, useRef } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Ruler, Download } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/url'

interface Props {
  imageUrl: string
  onClose: () => void
}

export default function TabelaMedidasModal({ imageUrl, onClose }: Props) {
  const [scale, setScale] = useState(1)
  const fullUrl = resolveMediaUrl(imageUrl)
  const imgRef = useRef<HTMLImageElement>(null)

  function zoomIn() {
    setScale((prev) => Math.min(prev + 0.3, 3))
  }

  function zoomOut() {
    setScale((prev) => Math.max(prev - 0.3, 0.7))
  }

  function resetZoom() {
    setScale(1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Topo do Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">Tabela de Medidas</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-400 font-mono min-w-[45px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              title="Ajustar ao tamanho original"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <a
              href={fullUrl}
              download="tabela_de_medidas.png"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              title="Baixar imagem"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Instrução rápida de medição */}
        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
          <span>💡 <strong>Dica de medição:</strong> Pegue uma camiseta sua que veste bem, estique-a numa superfície plana e meça a <strong>Largura (peito)</strong> e o <strong>Comprimento (altura)</strong> com uma fita métrica ou régua para comparar com a tabela.</span>
        </div>

        {/* Área da Imagem com Zoom */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px] max-h-[70vh] bg-zinc-950/80 select-none">
          <div
            className="transition-transform duration-150 origin-center cursor-grab active:cursor-grabbing flex items-center justify-center"
            style={{ transform: `scale(${scale})` }}
          >
            <img
              ref={imgRef}
              src={fullUrl}
              alt="Tabela de Medidas"
              className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg pointer-events-auto"
              draggable={false}
            />
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-4 py-2.5 bg-zinc-900 border-t border-zinc-800 text-center text-xs text-zinc-400">
          Use os botões no topo ou o gesto de pinça na tela para ampliar os detalhes dos tamanhos.
        </div>
      </div>
    </div>
  )
}


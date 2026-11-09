import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { grupoService } from '@/services/grupoService'
import { resolveMediaUrl } from '@/lib/url'
import GradeProducao from '@/components/grupos/GradeProducao'
import TabelaMedidasModal from '@/components/grupos/TabelaMedidasModal'
import {
  Factory,
  ArrowLeft,
  Calendar,
  Ruler,
  Upload,
  Sparkles,
  Camera,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Shirt,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { TotaisProducaoResponse } from '@/types/grupo'

export default function GrupoConfeccaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const grupoId = Number(id)

  const [showTabelaModal, setShowTabelaModal] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [fotoProntaFile, setFotoProntaFile] = useState<File | null>(null)
  const [fotoProntaPreview, setFotoProntaPreview] = useState<string | null>(null)
  const [submittingStatus, setSubmittingStatus] = useState(false)
  const [uploadingTabela, setUploadingTabela] = useState(false)

  // Busca dados do grupo (sem dados financeiros para confecção)
  const { data: grupo, isLoading, refetch } = useQuery({
    queryKey: ['grupo-confeccao', grupoId],
    queryFn: () => grupoService.buscar(grupoId),
    enabled: !!grupoId,
  })

  // Busca dados agregados de produção
  const { data: dadosProducao, refetch: refetchProducao } = useQuery({
    queryKey: ['grupo-producao-confeccao', grupoId],
    queryFn: () => grupoService.totaisProducao(grupoId),
    enabled: !!grupoId,
  })

  if (isLoading || !grupo) {
    return (
      <div className="p-8 text-center text-zinc-500 text-sm">
        Carregando ordem de produção...
      </div>
    )
  }

  // Upload Tabela de Medidas
  async function handleTabelaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingTabela(true)
    const formData = new FormData()
    formData.append('tabela_medidas', file)
    try {
      await grupoService.salvarTabelaMedidas(grupoId, formData)
      toast.success('Tabela de medidas enviada com sucesso!')
      refetch()
    } catch {
      toast.error('Erro ao enviar tabela de medidas.')
    } finally {
      setUploadingTabela(false)
    }
  }

  // Atualizar Status de Produção ("Em produção" ou "Pronto")
  async function handleMudarStatus(novoStatus: 'em_producao' | 'pronto' | 'entregue') {
    setSubmittingStatus(true)
    const formData = new FormData()
    formData.append('status', novoStatus)
    if (observacoes) formData.append('observacoes_confeccao', observacoes)
    if (fotoProntaFile) formData.append('foto_camisa_pronta', fotoProntaFile)

    try {
      await grupoService.atualizarStatusProducao(grupoId, formData)
      toast.success(
        novoStatus === 'em_producao'
          ? 'Status alterado para "Em Produção"!'
          : 'Status alterado para "Pronto" com sucesso!'
      )
      setFotoProntaFile(null)
      setFotoProntaPreview(null)
      refetch()
    } catch {
      toast.error('Erro ao atualizar status de produção.')
    } finally {
      setSubmittingStatus(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Topo / Voltar */}
      <div className="flex items-center justify-between">
        <Link
          to="/grupos"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para meus grupos
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(grupoService.urlExportarCsv(grupoId), '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Ordem (PDF)
          </button>
        </div>
      </div>

      {/* Card do Cabeçalho da Ordem */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{grupo.nome}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">
                {grupo.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Confecção Responsável: <strong className="text-white">{grupo.confeccao?.nome}</strong> • Total:{' '}
              <strong className="text-amber-400">{grupo.total_pecas || 0} peças</strong> • Prazo limite:{' '}
              {new Date(grupo.prazo_limite).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Bloco de Envio da Tabela de Medidas (Item 4) */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Tabela de Medidas da sua Confecção
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                {grupo.tabela_medidas_url
                  ? 'Tabela cadastrada e visível para os amigos no formulário.'
                  : 'Nenhuma tabela enviada ainda. Envie a imagem para que os amigos saibam como medir.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {grupo.tabela_medidas_url && (
              <button
                onClick={() => setShowTabelaModal(true)}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-200 hover:text-white transition"
              >
                Visualizar Tabela Atual
              </button>
            )}

            <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploadingTabela ? 'Enviando...' : grupo.tabela_medidas_url ? 'Substituir Tabela' : 'Enviar Tabela de Medidas'}
              <input
                type="file"
                accept="image/*"
                onChange={handleTabelaFileChange}
                disabled={uploadingTabela}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Ações de Produção: Atualizar Status e Foto da Peça Pronta */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Factory className="w-4 h-4 text-amber-400" />
            Controle de Produção da Confecção
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Observações da Confecção</label>
              <textarea
                placeholder="Observações internas sobre tecidos, tintas ou prazos de entrega..."
                value={observacoes || grupo.observacoes_confeccao || ''}
                onChange={(e) => setObservacoes(e.target.value)}
                className="textarea text-xs"
                rows={2}
              />
            </div>

            <div>
              <label className="label">Foto da Camisa Pronta (Opcional)</label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border border-dashed border-zinc-700 hover:border-amber-400 rounded-xl cursor-pointer bg-zinc-900 text-xs text-zinc-300">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>{fotoProntaFile ? fotoProntaFile.name : 'Escolher foto da peça pronta'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setFotoProntaFile(f)
                        setFotoProntaPreview(URL.createObjectURL(f))
                      }
                    }}
                    className="hidden"
                  />
                </label>
                {(fotoProntaPreview || grupo.foto_camisa_pronta) && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 flex-shrink-0">
                    <img
                      src={fotoProntaPreview || resolveMediaUrl(grupo.foto_camisa_pronta!)}
                      alt="Pronta"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => handleMudarStatus('em_producao')}
              disabled={submittingStatus}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                grupo.status === 'em_producao'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              Marcar "Em Produção"
            </button>

            <button
              onClick={() => handleMudarStatus('pronto')}
              disabled={submittingStatus}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition ${
                grupo.status === 'pronto'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-black hover:bg-amber-400'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Marcar como "Pronto"
            </button>
          </div>
        </div>
      </div>

      {/* Grade e Totais de Produção (Sem valores monetários) */}
      {dadosProducao && (
        <GradeProducao
          dados={dadosProducao}
          onExportarCsv={() => {
            window.open(grupoService.urlExportarCsv(grupoId), '_blank')
          }}
        />
      )}

      {/* Modal Tabela de Medidas */}
      {showTabelaModal && grupo.tabela_medidas_url && (
        <TabelaMedidasModal
          imageUrl={grupo.tabela_medidas_url}
          onClose={() => setShowTabelaModal(false)}
        />
      )}
    </div>
  )
}


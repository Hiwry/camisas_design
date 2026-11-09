import { Printer, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { TotaisProducaoResponse } from '@/types/grupo'

interface Props {
  dados: TotaisProducaoResponse
  onExportarCsv: () => void
}

export default function GradeProducao({ dados, onExportarCsv }: Props) {
  const { grupo, total_pecas, por_tamanho, por_modelo, grade, numeros_repetidos, lista_nomes_numeros } = dados

  function handleImprimirOrdem() {
    window.print()
  }

  const pedidoMinimoAtingido = grupo.pedido_minimo === 0 || total_pecas >= grupo.pedido_minimo

  return (
    <div className="space-y-6">

      {/* Barra de Ações de Exportação e Alerta de Pedido Mínimo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            Totais de Produção & Ordem de Separação
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5">
            Total consolidado: <strong className="text-amber-400 font-bold text-sm">{total_pecas}</strong> peças
            {grupo.pedido_minimo > 0 && ` (Pedido mínimo: ${grupo.pedido_minimo} peças)`}
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={onExportarCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Excel / CSV
          </button>
          <button
            onClick={handleImprimirOrdem}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition"
          >
            <Printer className="w-4 h-4" />
            Imprimir Ordem (PDF)
          </button>
        </div>
      </div>

      {/* Alerta de Pedido Mínimo Não Atingido */}
      {!pedidoMinimoAtingido && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
          <span>
            <strong>Atenção:</strong> O total atual ({total_pecas} peças) está abaixo do pedido mínimo da confecção ({grupo.pedido_minimo} peças). Faltam {grupo.pedido_minimo - total_pecas} peças para atingir a meta mínima.
          </span>
        </div>
      )}

      {/* Cards de Resumo: Por Tamanho e Por Modelo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Resumo por Tamanho */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h5 className="text-xs uppercase font-bold text-zinc-400 tracking-wider mb-3">
            Peças por Tamanho
          </h5>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Object.entries(por_tamanho).length === 0 ? (
              <span className="text-xs text-zinc-500 col-span-full">Nenhum participante cadastrado ainda.</span>
            ) : (
              Object.entries(por_tamanho).map(([tam, qtd]) => (
                <div key={tam} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-400 font-semibold">{tam}</div>
                  <div className="text-lg font-bold text-amber-400">{qtd}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resumo por Modelo */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h5 className="text-xs uppercase font-bold text-zinc-400 tracking-wider mb-3">
            Peças por Modelo
          </h5>
          <div className="space-y-2">
            {Object.entries(por_modelo).length === 0 ? (
              <span className="text-xs text-zinc-500">Nenhum participante cadastrado ainda.</span>
            ) : (
              Object.entries(por_modelo).map(([mod, qtd]) => (
                <div key={mod} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-xs font-medium text-zinc-200">{mod}</span>
                  <span className="text-sm font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10">
                    {qtd} {qtd === 1 ? 'peça' : 'peças'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Grade Cruzada (Matriz: Modelo -> Cor -> Tamanhos) */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
        <h5 className="text-xs uppercase font-bold text-zinc-400 tracking-wider mb-3">
          Grade Detalhada de Produção (Modelo × Cor × Tamanho)
        </h5>

        {Object.keys(grade).length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Nenhum registro para exibir na grade.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grade).map(([modNome, cores]) => (
              <div key={modNome} className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                <div className="px-3.5 py-2 bg-zinc-800/80 text-xs font-bold text-amber-400 border-b border-zinc-800">
                  {modNome}
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-900/50 text-zinc-400 border-b border-zinc-800 font-semibold">
                    <tr>
                      <th className="px-3 py-2">Cor</th>
                      <th className="px-3 py-2">Tamanhos e Quantidades</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {Object.entries(cores).map(([corNome, tamanhos]) => {
                      const subtotal = Object.values(tamanhos).reduce((acc, v) => acc + v, 0)
                      return (
                        <tr key={corNome} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2.5 font-medium text-zinc-200">
                            <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 border border-zinc-700 bg-zinc-600 align-middle" />
                            {corNome}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(tamanhos).map(([t, q]) => (
                                <span key={t} className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-300">
                                  <strong>{t}</strong>: {q}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-amber-400 font-mono">
                            {subtotal}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerta de Números Repetidos */}
      {numeros_repetidos.length > 0 && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>
            <strong>Atenção: Números Repetidos Detectados!</strong> Os seguintes números foram escolhidos por mais de um participante: {' '}
            {numeros_repetidos.map((num) => (
              <span key={num} className="inline-block px-2 py-0.5 mx-1 rounded bg-red-600 text-white font-bold font-mono">
                #{num}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Lista de Nomes e Números para Estampa */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h5 className="text-xs uppercase font-bold text-zinc-400 tracking-wider mb-3">
          Lista de Nomes e Números para Estampa
        </h5>

        {lista_nomes_numeros.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Nenhum participante com estampa cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-3 py-2.5">Participante</th>
                  <th className="px-3 py-2.5">Modelo / Cor</th>
                  <th className="px-3 py-2.5">Tam</th>
                  <th className="px-3 py-2.5">Nome na Camisa</th>
                  <th className="px-3 py-2.5">Número</th>
                  <th className="px-3 py-2.5">Frase / Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {lista_nomes_numeros.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-zinc-950/40 ${
                      item.numero_duplicado ? 'bg-red-500/10' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium text-white">{item.nome_completo}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{item.modelo} - {item.cor}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-400">{item.tamanho}</td>
                    <td className="px-3 py-2.5 text-zinc-200 font-semibold uppercase">{item.nome_camisa || '-'}</td>
                    <td className="px-3 py-2.5">
                      {item.numero_camisa ? (
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 ${
                            item.numero_duplicado
                              ? 'bg-red-600 text-white animate-pulse'
                              : 'bg-zinc-800 text-amber-400 border border-zinc-700'
                          }`}
                        >
                          #{item.numero_camisa}
                          {item.numero_duplicado && <AlertTriangle className="w-3 h-3" />}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">
                      {item.frase_costas ? `"${item.frase_costas}"` : item.apelido ? `Apelido: ${item.apelido}` : '-'}
                      {item.observacao && <span className="block text-[11px] text-zinc-500 mt-0.5">Obs: {item.observacao}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}


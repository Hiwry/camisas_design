import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { TotaisProducaoResponse } from '@/types/grupo'

function formatarData(dataStr?: string): string {
  if (!dataStr) return '-'
  try {
    const d = new Date(dataStr)
    if (isNaN(d.getTime())) return dataStr
    return d.toLocaleDateString('pt-BR')
  } catch {
    return dataStr
  }
}

export function gerarEBaixarPdfOrdem(dados: TotaisProducaoResponse, nomeFallback?: string): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const grupo = dados.grupo
  const grupoNome = grupo?.nome || nomeFallback || 'Grupo de Camisas'
  const emitidoEm = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  // --- CABEÇALHO ---
  // Barra superior escura
  doc.setFillColor(24, 24, 27) // zinc-900
  doc.rect(0, 0, 210, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ORDEM DE PRODUÇÃO', 14, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(212, 212, 216) // zinc-300
  doc.text(`GRUPO: ${grupoNome.toUpperCase()}`, 14, 18)

  doc.setFontSize(8)
  doc.setTextColor(161, 161, 170)
  doc.text(`Emissão: ${emitidoEm}`, 196, 11, { align: 'right' })
  doc.text(`Total Peças: ${dados.total_pecas || 0} un`, 196, 18, { align: 'right' })

  // --- CARTÃO DE INFORMAÇÕES DO PEDIDO ---
  let cursorY = 32

  doc.setDrawColor(228, 228, 231) // zinc-200
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(14, cursorY, 182, 22, 2, 2, 'FD')

  doc.setFontSize(8)
  doc.setTextColor(113, 113, 122) // zinc-500
  doc.setFont('helvetica', 'bold')
  doc.text('CLIENTE / RESPONSÁVEL', 18, cursorY + 6)
  doc.text('CONFECÇÃO RESPONSÁVEL', 85, cursorY + 6)
  doc.text('PRAZO DE ENTREGA', 150, cursorY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(24, 24, 27)
  doc.setFontSize(9)

  const clienteTexto = grupo?.cliente_nome
    ? `${grupo.cliente_nome}${grupo.cliente_whatsapp ? ` (${grupo.cliente_whatsapp})` : ''}`
    : 'Não vinculado'
  doc.text(clienteTexto, 18, cursorY + 13, { maxWidth: 62 })

  const confeccaoTexto = grupo?.confeccao_nome || 'Não definida'
  doc.text(confeccaoTexto, 85, cursorY + 13, { maxWidth: 60 })

  const prazoTexto = formatarData(grupo?.prazo_limite)
  doc.text(prazoTexto, 150, cursorY + 13)

  cursorY += 28

  // --- RESUMO: TOTAIS POR TAMANHO & MODELO ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(24, 24, 27)
  doc.text('1. Resumo da Produção (Quantidades Totais)', 14, cursorY)
  cursorY += 4

  const tamanhosEntries = Object.entries(dados.por_tamanho || {})
  const modelosEntries = Object.entries(dados.por_modelo || {})

  // Tabela por Tamanhos
  const headTamanhos = [['Tamanho', 'Qtd']]
  const bodyTamanhos = tamanhosEntries.map(([tam, qtd]) => [tam, `${qtd} un`])
  if (bodyTamanhos.length === 0) bodyTamanhos.push(['Nenhum', '0 un'])

  // Tabela por Modelos
  const headModelos = [['Modelo / Tipo', 'Qtd']]
  const bodyModelos = modelosEntries.map(([mod, qtd]) => [mod, `${qtd} un`])
  if (bodyModelos.length === 0) bodyModelos.push(['Nenhum', '0 un'])

  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14 },
    tableWidth: 88,
    head: headTamanhos,
    body: bodyTamanhos,
    theme: 'grid',
    headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  })

  // Tabela por Modelos ao lado
  autoTable(doc, {
    startY: cursorY,
    margin: { left: 108 },
    tableWidth: 88,
    head: headModelos,
    body: bodyModelos,
    theme: 'grid',
    headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  })

  // Pega a maior posição Y após as duas tabelas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTableY = (doc as any).lastAutoTable?.finalY || (cursorY + 30)
  cursorY = Math.max(lastTableY, cursorY + 30) + 8

  // --- MATRIZ MODELO x COR x TAMANHO (GRADE) ---
  if (dados.grade && Object.keys(dados.grade).length > 0) {
    if (cursorY > 230) {
      doc.addPage()
      cursorY = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(24, 24, 27)
    doc.text('2. Matriz de Corte (Modelo × Cor × Tamanho)', 14, cursorY)
    cursorY += 4

    // Descobrir todas as colunas de tamanhos presentes
    const todosTamanhosSet = new Set<string>()
    Object.values(dados.grade).forEach((coresObj) => {
      Object.values(coresObj).forEach((tamsObj) => {
        Object.keys(tamsObj).forEach((t) => todosTamanhosSet.add(t))
      })
    })
    const ordemTamanhos = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'G1', 'G2', 'G3', '2', '4', '6', '8', '10', '12', '14', '16']
    const colunasTamanhos = Array.from(todosTamanhosSet).sort((a, b) => {
      const idxA = ordemTamanhos.indexOf(a)
      const idxB = ordemTamanhos.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })

    const headGrade = [['Modelo', 'Cor', ...colunasTamanhos, 'Total']]
    const bodyGrade: string[][] = []

    Object.entries(dados.grade).forEach(([modNome, coresObj]) => {
      Object.entries(coresObj).forEach(([corNome, tamsObj]) => {
        let totalLinha = 0
        const linha = [modNome, corNome]
        colunasTamanhos.forEach((tam) => {
          const qtd = tamsObj[tam] || 0
          totalLinha += qtd
          linha.push(qtd > 0 ? String(qtd) : '-')
        })
        linha.push(String(totalLinha))
        bodyGrade.push(linha)
      })
    })

    autoTable(doc, {
      startY: cursorY,
      margin: { left: 14, right: 14 },
      head: headGrade,
      body: bodyGrade,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7.5, textColor: [31, 41, 55], halign: 'center' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'left' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY) + 8
  }

  // --- LISTA DE SEPARAÇÃO / NOMES E NÚMEROS ---
  if (cursorY > 220) {
    doc.addPage()
    cursorY = 20
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(24, 24, 27)
  doc.text('3. Separação de Peças & Personalização (Nomes / Números)', 14, cursorY)
  cursorY += 4

  const headLista = [['#', 'Nome Completo', 'Modelo', 'Cor', 'Tam.', 'Qtd', 'Nome Camisa', 'Nº', 'Obs. / Detalhe']]
  const bodyLista = (dados.lista_nomes_numeros || []).map((item, idx) => {
    const numDisplay = item.numero_camisa
      ? item.numero_duplicado
        ? `${item.numero_camisa} [DUPL]`
        : String(item.numero_camisa)
      : '-'

    const obsArray: string[] = []
    if (item.apelido) obsArray.push(`Apelido: ${item.apelido}`)
    if (item.frase_costas) obsArray.push(`Frase: ${item.frase_costas}`)
    if (item.observacao) obsArray.push(item.observacao)

    return [
      String(idx + 1),
      item.nome_completo || '-',
      item.modelo || '-',
      item.cor || '-',
      item.tamanho || '-',
      String(item.quantidade || 1),
      item.nome_camisa || '-',
      numDisplay,
      obsArray.join(' | ') || '-',
    ]
  })

  if (bodyLista.length === 0) {
    bodyLista.push(['-', 'Nenhum participante preencheu ainda', '-', '-', '-', '-', '-', '-', '-'])
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14, right: 14 },
    head: headLista,
    body: bodyLista,
    theme: 'grid',
    headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [31, 41, 55] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 36 },
      2: { cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 26 },
      7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      // Destaca se número duplicado
      if (data.section === 'body' && data.column.index === 7) {
        if (typeof data.cell.raw === 'string' && data.cell.raw.includes('[DUPL]')) {
          data.cell.styles.fillColor = [254, 226, 226] // red-100
          data.cell.styles.textColor = [185, 28, 28] // red-700
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })

  // --- RODAPÉ EM TODAS AS PÁGINAS ---
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(228, 228, 231)
    doc.line(14, 287, 196, 287)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(156, 163, 175) // gray-400
    doc.text(`Camiseta Design • Ordem de Produção - ${grupoNome}`, 14, 292)
    doc.text(`Página ${i} de ${totalPages}`, 196, 292, { align: 'right' })
  }

  // --- SALVAR DIRETO NO COMPUTADOR (HISTÓRICO DE DOWNLOADS) ---
  const safeName = grupoNome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')

  doc.save(`ordem_producao_${safeName}.pdf`)
}


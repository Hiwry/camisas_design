import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface OrcamentoItem {
  id: number
  arte: string
  servico: string
  data: string   // AAAA-MM-DD
  valor: string  // texto do input (aceita vírgula)
  pedido_id?: number | null
}

export interface Orcamento {
  id: number
  numero: number
  cliente: string
  whatsapp: string
  data: string   // data do orçamento AAAA-MM-DD
  obs: string
  itens: OrcamentoItem[]
  criadoEm: string
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function parseValor(v: string): number {
  const s = String(v).trim()
  // "1.250,50" (pt-BR) ou "50.5" / "50"
  const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s)
  return isNaN(n) ? 0 : n
}

export function fmtData(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d || '-'
}

export const totalOrcamento = (o: Pick<Orcamento, 'itens'>) => o.itens.reduce((a, i) => a + parseValor(i.valor), 0)

export function textoWhatsapp(o: Orcamento): string {
  const L: string[] = []
  L.push(`*ORÇAMENTO Nº ${String(o.numero).padStart(4, '0')}*`)
  if (o.cliente) L.push(`Cliente: ${o.cliente}`)
  L.push(`Data: ${fmtData(o.data)}`, '')
  o.itens.forEach((i, idx) => {
    L.push(`${idx + 1}. *${i.arte || 'Arte'}*`, `   Serviço: ${i.servico || '-'}`, `   Data: ${fmtData(i.data)}`, `   Valor: ${brl(parseValor(i.valor))}`, '')
  })
  L.push(`*TOTAL: ${brl(totalOrcamento(o))}*`)
  if (o.obs) L.push('', o.obs)
  return L.join('\n')
}

export function gerarPdfOrcamento(o: Orcamento): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const num = String(o.numero).padStart(4, '0')

  // Cabeçalho
  doc.setFillColor(24, 24, 27)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ORÇAMENTO', 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(231, 179, 44)
  doc.text('Camiseta Design · Criação de artes', 14, 21)
  doc.setTextColor(212, 212, 216)
  doc.text(`Nº ${num}`, 196, 13, { align: 'right' })
  doc.text(`Data: ${fmtData(o.data)}`, 196, 21, { align: 'right' })

  // Cliente
  let y = 36
  doc.setDrawColor(228, 228, 231); doc.setFillColor(250, 250, 250)
  doc.roundedRect(14, y, 182, 18, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(113, 113, 122)
  doc.text('CLIENTE', 18, y + 6)
  doc.text('WHATSAPP', 120, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(24, 24, 27)
  doc.text(o.cliente || '-', 18, y + 13, { maxWidth: 95 })
  doc.text(o.whatsapp || '-', 120, y + 13)
  y += 26

  // Tabela
  autoTable(doc, {
    startY: y,
    head: [['#', 'Arte', 'Serviço', 'Data', 'Valor']],
    body: o.itens.map((i, idx) => [String(idx + 1), i.arte || '-', i.servico || '-', fmtData(i.data), brl(parseValor(i.valor))]),
    foot: [['', '', '', 'TOTAL', brl(totalOrcamento(o))]],
    theme: 'grid',
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontSize: 9 },
    footStyles: { fillColor: [231, 179, 44], textColor: [11, 11, 12], fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 28, halign: 'center' }, 4: { cellWidth: 32, halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20
  if (o.obs) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(113, 113, 122)
    doc.text('OBSERVAÇÕES', 14, finalY + 10)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(24, 24, 27)
    doc.text(o.obs, 14, finalY + 16, { maxWidth: 182 })
  }

  const nome = (o.cliente || 'orcamento').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_')
  doc.save(`orcamento_${num}_${nome}.pdf`)
}

import jsPDF from 'jspdf'
import { PortfolioItem } from '@/services/api'

export interface DadosContatoPdf {
  empresaNome?: string
  whatsapp?: string
  instagram?: string
  email?: string
  site?: string
  mensagem?: string
}

export interface OpcoesCatalogoPdf {
  itens: PortfolioItem[]
  titulo?: string
  subtitulo?: string
  contato?: DadosContatoPdf
  onProgresso?: (porcentagem: number, mensagem: string) => void
}

export interface ImagemCarregada {
  base64: string
  width: number
  height: number
}

/**
 * Converte cor HEX (#RRGGBB ou #RGB) para tupla [R, G, B]
 */
function hexParaRgb(hex: string): [number, number, number] {
  if (!hex || typeof hex !== 'string') return [212, 160, 32]
  const clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0
    const g = parseInt(clean[1] + clean[1], 16) || 0
    const b = parseInt(clean[2] + clean[2], 16) || 0
    return [r, g, b]
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) || 0
    const g = parseInt(clean.substring(2, 4), 16) || 0
    const b = parseInt(clean.substring(4, 6), 16) || 0
    return [r, g, b]
  }
  return [212, 160, 32]
}

/**
 * Carrega imagem a partir de uma URL e retorna base64 e suas dimensões naturais
 */
async function carregarImagemComDimensoes(url: string): Promise<ImagemCarregada | null> {
  if (!url) return null

  return new Promise<ImagemCarregada | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width || 800
        const origH = img.naturalHeight || img.height || 600

        // Redimensiona no canvas apenas para otimizar peso do PDF mantendo a proporção exata
        const maxDim = 1200
        let w = origW
        let h = origH

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          } else {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        const base64 = canvas.toDataURL('image/jpeg', 0.88)

        resolve({
          base64,
          width: origW,
          height: origH,
        })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      // Fallback via fetch blob se falhar
      fetch(url, { mode: 'cors' })
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const b64 = reader.result as string
            const fallbackImg = new Image()
            fallbackImg.onload = () => {
              resolve({
                base64: b64,
                width: fallbackImg.naturalWidth || 800,
                height: fallbackImg.naturalHeight || 600,
              })
            }
            fallbackImg.onerror = () => resolve(null)
            fallbackImg.src = b64
          }
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
        .catch(() => resolve(null))
    }
    img.src = url
  })
}

/**
 * Desenha uma imagem preservando 100% de sua proporção natural (object-fit: contain)
 * Evita que a foto fique amassada, achatada ou esticada!
 */
function desenharImagemContida(
  doc: jsPDF,
  img: ImagemCarregada,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  const imgRatio = img.width / img.height
  const boxRatio = boxW / boxH

  let renderW = boxW
  let renderH = boxH

  if (imgRatio > boxRatio) {
    // Imagem mais horizontal que a caixa -> limita pela largura
    renderW = boxW
    renderH = boxW / imgRatio
  } else {
    // Imagem mais vertical que a caixa -> limita pela altura
    renderH = boxH
    renderW = boxH * imgRatio
  }

  // Centraliza perfeitamente dentro da caixa
  const renderX = boxX + (boxW - renderW) / 2
  const renderY = boxY + (boxH - renderH) / 2

  doc.addImage(img.base64, 'JPEG', renderX, renderY, renderW, renderH, undefined, 'FAST')
}

/**
 * Desenha o cabeçalho padrão das páginas internas
 */
function desenharCabecalhoInterno(doc: jsPDF, tituloSecao: string, empresaNome: string) {
  // Barra superior grafite escuro
  doc.setFillColor(14, 14, 18)
  doc.rect(0, 0, 210, 16, 'F')

  // Linha dourada
  doc.setFillColor(212, 160, 32)
  doc.rect(0, 15.5, 210, 0.5, 'F')

  // Nome da Empresa / Logo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(212, 160, 32)
  doc.text(empresaNome.toUpperCase(), 12, 10.5)

  // Título da Seção
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(161, 161, 170)
  doc.text(tituloSecao, 198, 10.5, { align: 'right' })
}

/**
 * Desenha o rodapé padrão das páginas internas
 */
function desenharRodapeInterno(
  doc: jsPDF,
  paginaAtual: number,
  totalPaginas: number,
  whatsapp?: string
) {
  const y = 286

  // Linha separadora suave
  doc.setDrawColor(38, 38, 44)
  doc.setLineWidth(0.3)
  doc.line(12, y, 198, y)

  // Informação de contato / WhatsApp
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(212, 160, 32)
  const contatoTexto = whatsapp
    ? `SOLICITE UM ORÇAMENTO NO WHATSAPP: ${whatsapp}`
    : 'ARQUIVOS 100% VETORIZADOS (COREL & ILLUSTRATOR) EM CMYK 300 DPI'
  doc.text(contatoTexto, 12, y + 6)

  // Numeração de página
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(113, 113, 122)
  doc.text(`Página ${paginaAtual} de ${totalPaginas}`, 198, y + 6, { align: 'right' })
}

/**
 * Gera um PDF Completo de Catálogo com todos os modelos selecionados
 */
export async function gerarPdfCatalogo(opcoes: OpcoesCatalogoPdf): Promise<jsPDF> {
  const {
    itens,
    titulo = 'Catálogo Oficial de Criações & Modelos',
    subtitulo = 'Uniformes Esportivos, Camisas Personalizadas e Estamparia de Alta Definição',
    contato = {},
    onProgresso,
  } = opcoes

  const empresaNome = contato.empresaNome || 'Camisetas Design'
  const whatsappNum = contato.whatsapp || '(82) 99999-9999'

  onProgresso?.(5, 'Iniciando diagramação do catálogo...')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CAPA PRINCIPAL (Dark Luxury com Detalhes Dourados)
  // ──────────────────────────────────────────────────────────────────────────
  // Fundo principal escuro
  doc.setFillColor(11, 11, 14)
  doc.rect(0, 0, 210, 297, 'F')

  // Moldura decorativa sutil dourada
  doc.setDrawColor(212, 160, 32)
  doc.setLineWidth(0.4)
  doc.roundedRect(8, 8, 194, 281, 3, 3, 'D')

  doc.setDrawColor(35, 35, 42)
  doc.setLineWidth(0.2)
  doc.roundedRect(10, 10, 190, 277, 2, 2, 'D')

  // Faixa de destaque superior
  doc.setFillColor(212, 160, 32)
  doc.rect(20, 28, 45, 1.5, 'F')

  // Selo oficial
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(212, 160, 32)
  doc.text('CATÁLOGO DE MODELOS & UNIFORMES 2026', 20, 36)

  // Nome da Empresa
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(255, 255, 255)
  doc.text(empresaNome, 20, 50)

  // Título Principal
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(228, 228, 231)
  doc.text(titulo, 20, 62, { maxWidth: 170 })

  // Subtítulo
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(161, 161, 170)
  doc.text(subtitulo, 20, 74, { maxWidth: 170 })

  // 3 Blocos de Destaque / Estatísticas
  const yStats = 90
  const wCard = 53
  const hCard = 24

  // Bloco 1: Total Modelos
  doc.setFillColor(18, 18, 22)
  doc.setDrawColor(38, 38, 44)
  doc.roundedRect(20, yStats, wCard, hCard, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(212, 160, 32)
  doc.text(`${itens.length}`, 26, yStats + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(212, 212, 216)
  doc.text('Modelos Exclusivos', 26, yStats + 18)

  // Bloco 2: Fidelidade Gráfica
  doc.setFillColor(18, 18, 22)
  doc.setDrawColor(38, 38, 44)
  doc.roundedRect(78, yStats, wCard, hCard, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(212, 160, 32)
  doc.text('100% Curvas', 84, yStats + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(212, 212, 216)
  doc.text('Corel & Illustrator 300DPI', 84, yStats + 18)

  // Bloco 3: Técnicas
  doc.setFillColor(18, 18, 22)
  doc.setDrawColor(38, 38, 44)
  doc.roundedRect(136, yStats, wCard, hCard, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(212, 160, 32)
  doc.text('Sublimação / Silk', 142, yStats + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(212, 212, 216)
  doc.text('Bordados & Apliques', 142, yStats + 18)

  // Card Central: Pré-visualização ou Apresentação
  const yCentral = 124
  doc.setFillColor(16, 16, 20)
  doc.setDrawColor(45, 45, 52)
  doc.roundedRect(20, yCentral, 170, 72, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text('PADRÃO PROFISSIONAL DE CRIAÇÃO & ACABAMENTO', 28, yCentral + 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(161, 161, 170)
  const textoApresentacao =
    'Desenvolvemos projetos com identidade visual exclusiva, cortes anatômicos e simulação 3D realista para conferência antes da produção. Todas as artes deste catálogo podem ser personalizadas com as cores, nomes, numerações e patrocinadores da sua equipe ou empresa.'
  doc.text(textoApresentacao, 28, yCentral + 24, { maxWidth: 154, lineHeightFactor: 1.5 })

  // Destaques em tópicos
  const topicos = [
    '• Sublimação digital contínua com cores vivas e proteção UV50+',
    '• Modelagens completas: raglan, tradicional, babylook, regata e polo',
    '• Tipografia esportiva moderna com numeração personalizada e sombreado 3D',
  ]
  let yTopico = yCentral + 48
  doc.setFontSize(8)
  doc.setTextColor(212, 160, 32)
  topicos.forEach((t) => {
    doc.text(t, 28, yTopico)
    yTopico += 6.5
  })

  // Caixa de Contato na Capa (Inferior)
  const yContato = 208
  doc.setFillColor(20, 20, 26)
  doc.setDrawColor(212, 160, 32)
  doc.roundedRect(20, yContato, 170, 56, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(212, 160, 32)
  doc.text('CONTATO & SOLICITAÇÃO DE ORÇAMENTO', 28, yContato + 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(244, 244, 245)
  doc.text(`WhatsApp: ${whatsappNum}`, 28, yContato + 22)

  if (contato.instagram) {
    doc.text(`Instagram: @${contato.instagram.replace('@', '')}`, 28, yContato + 30)
  }
  if (contato.email) {
    doc.text(`E-mail: ${contato.email}`, 110, yContato + 22)
  }

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(161, 161, 170)
  const msgRodapeCapa =
    contato.mensagem ||
    'Envie uma mensagem citando o número do modelo para receber seu orçamento em minutos.'
  doc.text(msgRodapeCapa, 28, yContato + 44, { maxWidth: 154 })

  // Data de Emissão no rodapé da capa
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(82, 82, 91)
  const dataHoje = new Date().toLocaleDateString('pt-BR')
  doc.text(`Documento emitido em ${dataHoje} • Camiseta Design Catálogo`, 105, 276, { align: 'center' })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PRÉ-CARREGAMENTO DAS IMAGENS DOS MODELOS (PRESERVANDO PROPORÇÃO)
  // ──────────────────────────────────────────────────────────────────────────
  onProgresso?.(20, 'Carregando fotos dos modelos em alta definição...')
  const imagensCarregadas: (ImagemCarregada | null)[] = []

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    const url = item.imagem_principal || item.galeria?.[0] || ''
    const imgObj = await carregarImagemComDimensoes(url)
    imagensCarregadas.push(imgObj)
    const progressoAtual = Math.round(20 + ((i + 1) / itens.length) * 45)
    onProgresso?.(progressoAtual, `Processando imagem ${i + 1} de ${itens.length}...`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. PÁGINAS DE MODELOS (2 modelos por página para máxima visibilidade)
  // ──────────────────────────────────────────────────────────────────────────
  const modelosPorPagina = 2
  const totalPaginasModelos = Math.ceil(itens.length / modelosPorPagina)
  const totalPaginasFinal = 1 + totalPaginasModelos + 1 // Capa + Modelos + Contracapa

  for (let p = 0; p < totalPaginasModelos; p++) {
    doc.addPage('a4', 'portrait')
    const paginaNumero = p + 2

    // Fundo preto suave
    doc.setFillColor(11, 11, 14)
    doc.rect(0, 0, 210, 297, 'F')

    // Cabeçalho & Rodapé da página
    desenharCabecalhoInterno(doc, 'VITRINE DE CRIAÇÕES & MODELOS', empresaNome)
    desenharRodapeInterno(doc, paginaNumero, totalPaginasFinal, whatsappNum)

    const itensDaPagina = itens.slice(p * modelosPorPagina, (p + 1) * modelosPorPagina)

    itensDaPagina.forEach((item, idxNaPagina) => {
      const idxGlobal = p * modelosPorPagina + idxNaPagina
      const imagemObj = imagensCarregadas[idxGlobal]

      // Posição Y do Card (Card 1: y=22; Card 2: y=152)
      const cardY = 22 + idxNaPagina * 130
      const cardW = 186
      const cardH = 124

      // Container Card
      doc.setFillColor(16, 16, 21)
      doc.setDrawColor(38, 38, 46)
      doc.setLineWidth(0.4)
      doc.roundedRect(12, cardY, cardW, cardH, 3, 3, 'FD')

      // Destaque Dourado na borda esquerda do Card
      doc.setFillColor(212, 160, 32)
      doc.roundedRect(12, cardY, 2.5, cardH, 1, 1, 'F')

      // ── ÁREA DA IMAGEM (Lado Esquerdo: 90mm x 112mm) ──
      const imgBoxX = 17
      const imgBoxY = cardY + 6
      const imgBoxW = 90
      const imgBoxH = 112

      // Moldura escura da imagem
      doc.setFillColor(8, 8, 10)
      doc.setDrawColor(32, 32, 38)
      doc.roundedRect(imgBoxX, imgBoxY, imgBoxW, imgBoxH, 2, 2, 'FD')

      if (imagemObj) {
        try {
          // Renderiza preservando a proporção natural (sem achatar nem amassar!)
          desenharImagemContida(doc, imagemObj, imgBoxX + 2, imgBoxY + 2, imgBoxW - 4, imgBoxH - 4)
        } catch {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(161, 161, 170)
          doc.text('Foto do Modelo', imgBoxX + imgBoxW / 2, imgBoxY + imgBoxH / 2, { align: 'center' })
        }
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(113, 113, 122)
        doc.text('Visualização indisponível', imgBoxX + imgBoxW / 2, imgBoxY + imgBoxH / 2, { align: 'center' })
      }

      // Tag de Identificação sobre a foto
      doc.setFillColor(212, 160, 32)
      doc.roundedRect(imgBoxX + 2, imgBoxY + 2, 18, 5, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(0, 0, 0)
      doc.text(`#${String(idxGlobal + 1).padStart(2, '0')}`, imgBoxX + 11, imgBoxY + 5.5, { align: 'center' })

      // ── ÁREA DE TEXTO E DETALHES (Lado Direito: 112mm a 194mm) ──
      const infoX = 112
      const infoW = 82
      let curY = cardY + 11

      // Tags de Categoria e Técnica
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(212, 160, 32)
      const categoriaFormatada = (item.categoria || 'ESPORTIVO').toUpperCase()
      const servicoFormatado = (item.servico || 'SUBLIMAÇÃO').toUpperCase()
      doc.text(`${categoriaFormatada}  •  ${servicoFormatado}`, infoX, curY)
      curY += 6.5

      // Título do Modelo
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text(item.titulo, infoX, curY, { maxWidth: infoW })
      curY += 6.5

      // Subtítulo / Resumo
      if (item.subtitulo) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(161, 161, 170)
        doc.text(item.subtitulo, infoX, curY, { maxWidth: infoW, lineHeightFactor: 1.2 })
        curY += 7.5
      }

      // Descrição Curta
      if (item.descricao) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(140, 140, 148)
        const descTexto = item.descricao.length > 130 ? item.descricao.substring(0, 127) + '...' : item.descricao
        doc.text(descTexto, infoX, curY, { maxWidth: infoW, lineHeightFactor: 1.3 })
        curY += 13
      } else {
        curY += 4
      }

      // Ficha Técnica Rápida (Grade de 4 caixinhas)
      const fBoxW = 39
      const fBoxH = 11

      // Caixa 1: Tecido
      doc.setFillColor(22, 22, 28)
      doc.setDrawColor(38, 38, 44)
      doc.roundedRect(infoX, curY, fBoxW, fBoxH, 1.5, 1.5, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(113, 113, 122)
      doc.text('TECIDO', infoX + 3, curY + 4)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(244, 244, 245)
      doc.text(item.tecido || 'Dry-Fit UV50+', infoX + 3, curY + 8.5, { maxWidth: 33 })

      // Caixa 2: Técnica (Sempre redefine fill e stroke para não herdar branco!)
      doc.setFillColor(22, 22, 28)
      doc.setDrawColor(38, 38, 44)
      doc.roundedRect(infoX + 43, curY, fBoxW, fBoxH, 1.5, 1.5, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(113, 113, 122)
      doc.text('ESTAMPARIA', infoX + 46, curY + 4)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(244, 244, 245)
      doc.text(item.tecnica || 'Sublimação Total', infoX + 46, curY + 8.5, { maxWidth: 33 })

      curY += 13

      // Caixa 3: Cliente (Sempre redefine fill e stroke)
      doc.setFillColor(22, 22, 28)
      doc.setDrawColor(38, 38, 44)
      doc.roundedRect(infoX, curY, fBoxW, fBoxH, 1.5, 1.5, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(113, 113, 122)
      doc.text('CLIENTE / PROJETO', infoX + 3, curY + 4)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(244, 244, 245)
      doc.text(item.cliente || 'Confecção Parceira', infoX + 3, curY + 8.5, { maxWidth: 33 })

      // Caixa 4: Ano (Sempre redefine fill e stroke)
      doc.setFillColor(22, 22, 28)
      doc.setDrawColor(38, 38, 44)
      doc.roundedRect(infoX + 43, curY, fBoxW, fBoxH, 1.5, 1.5, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(113, 113, 122)
      doc.text('ANO', infoX + 46, curY + 4)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(244, 244, 245)
      doc.text(item.ano || '2026', infoX + 46, curY + 8.5)

      curY += 14.5

      // Paleta de Cores
      if (item.cores && item.cores.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(161, 161, 170)
        doc.text('PALETA DE CORES UTILIZADA:', infoX, curY)
        curY += 4.5

        let colorX = infoX
        item.cores.slice(0, 4).forEach((corHex) => {
          const [r, g, b] = hexParaRgb(corHex)
          // Círculo colorido
          doc.setFillColor(r, g, b)
          doc.setDrawColor(255, 255, 255)
          doc.setLineWidth(0.2)
          doc.circle(colorX + 2.5, curY, 2.5, 'FD')

          // Código Hex
          doc.setFont('courier', 'normal')
          doc.setFontSize(6.5)
          doc.setTextColor(212, 212, 216)
          doc.text(corHex.toUpperCase(), colorX + 6.5, curY + 1)

          colorX += 19
        })

        curY += 7.5
      }

      // Botão / Chamada para o WhatsApp desse modelo
      doc.setFillColor(212, 160, 32)
      doc.roundedRect(infoX, curY, infoW, 7.5, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(0, 0, 0)
      doc.text('PEDIR ESTE MODELO NO WHATSAPP →', infoX + infoW / 2, curY + 5, { align: 'center' })

      if (whatsappNum) {
        const cleanPhone = whatsappNum.replace(/\D/g, '')
        if (cleanPhone) {
          const itemMsg = encodeURIComponent(
            `Olá! Vi o modelo "${item.titulo}" (${item.categoria.toUpperCase()}) no catálogo e gostaria de um orçamento!`
          )
          doc.link(infoX, curY, infoW, 7.5, { url: `https://wa.me/55${cleanPhone}?text=${itemMsg}` })
        }
      }
    })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. CONTRACAPA / PÁGINA FINAL (Chamada para Ação & Encerramento)
  // ──────────────────────────────────────────────────────────────────────────
  onProgresso?.(90, 'Finalizando contracapa e gerando arquivo PDF...')
  doc.addPage('a4', 'portrait')

  doc.setFillColor(11, 11, 14)
  doc.rect(0, 0, 210, 297, 'F')

  doc.setDrawColor(212, 160, 32)
  doc.setLineWidth(0.4)
  doc.roundedRect(8, 8, 194, 281, 3, 3, 'D')

  // Topo da Contracapa
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('COMO FUNCIONA O SEU PEDIDO?', 105, 42, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(161, 161, 170)
  doc.text('Passo a passo simples, ágil e com fidelidade total na impressão', 105, 52, { align: 'center' })

  // 4 Etapas Visuais
  const etapas = [
    {
      num: '01',
      titulo: 'ESCOLHA DO MODELO',
      desc: 'Selecione qualquer criação deste catálogo ou envie sua ideia e referência pelo WhatsApp.',
    },
    {
      num: '02',
      titulo: 'PERSONALIZAÇÃO EXCLUSIVA',
      desc: 'Adaptamos escudos, logomarcas dos patrocinadores, nomes, números e as cores da sua paleta.',
    },
    {
      num: '03',
      titulo: 'APROVAÇÃO EM MOCKUP 3D',
      desc: 'Você recebe a visualização realista em 3D antes da confecção para aprovação da diretoria ou equipe.',
    },
    {
      num: '04',
      titulo: 'ENTREGA DOS ARQUIVOS EM CURVAS',
      desc: 'Arquivos 100% vetorizados em CMYK (CorelDraw e Illustrator) prontos para estamparia e corte.',
    },
  ]

  let yEtapa = 72
  etapas.forEach((et) => {
    doc.setFillColor(18, 18, 24)
    doc.setDrawColor(38, 38, 46)
    doc.roundedRect(25, yEtapa, 160, 26, 2, 2, 'FD')

    // Número dourado
    doc.setFillColor(212, 160, 32)
    doc.roundedRect(25, yEtapa, 18, 26, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text(et.num, 34, yEtapa + 15, { align: 'center' })

    // Texto da Etapa
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text(et.titulo, 48, yEtapa + 9)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(161, 161, 170)
    doc.text(et.desc, 48, yEtapa + 17, { maxWidth: 130 })

    yEtapa += 32
  })

  // Bloco Grande de Contato & Botão WhatsApp
  const yFinalBox = 208
  doc.setFillColor(18, 18, 24)
  doc.setDrawColor(212, 160, 32)
  doc.setLineWidth(0.6)
  doc.roundedRect(25, yFinalBox, 160, 56, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(212, 160, 32)
  doc.text('VAMOS DAR VIDA AO SEU FARDAMENTO?', 105, yFinalBox + 13, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(244, 244, 245)
  doc.text('Fale diretamente conosco e solicite uma demonstração gratuita:', 105, yFinalBox + 22, { align: 'center' })

  // Botão Verde WhatsApp
  doc.setFillColor(22, 163, 74)
  doc.roundedRect(45, yFinalBox + 28, 120, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(`WHATSAPP: ${whatsappNum}`, 105, yFinalBox + 36, { align: 'center' })

  // Link clicável para o WhatsApp
  const cleanPhone = whatsappNum.replace(/\D/g, '')
  if (cleanPhone) {
    const linkUrl = `https://wa.me/55${cleanPhone}?text=Ol%C3%A1!%20Vi%20o%20cat%C3%A1logo%20de%20modelos%20e%20gostaria%20de%20um%20or%C3%A7amento.`
    doc.link(45, yFinalBox + 28, 120, 12, { url: linkUrl })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(113, 113, 122)
  doc.text(`${empresaNome} • Todos os direitos reservados • 2026`, 105, 276, { align: 'center' })

  onProgresso?.(100, 'Catálogo PDF gerado com sucesso!')
  return doc
}

/**
 * Gera um PDF Especial para um Modelo Individual (Apresentação / Ficha Técnica VIP)
 */
export async function gerarPdfModeloIndividual(
  item: PortfolioItem,
  contato: DadosContatoPdf = {},
  onProgresso?: (porcentagem: number, mensagem: string) => void
): Promise<jsPDF> {
  onProgresso?.(10, 'Carregando fotos do modelo...')
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const empresaNome = contato.empresaNome || 'Camisetas Design'
  const whatsappNum = contato.whatsapp || '(82) 99999-9999'

  // Carregar imagem principal
  const imgObj = await carregarImagemComDimensoes(item.imagem_principal)
  onProgresso?.(50, 'Montando layout da ficha técnica...')

  // Fundo escuro
  doc.setFillColor(11, 11, 14)
  doc.rect(0, 0, 210, 297, 'F')

  // Moldura decorativa
  doc.setDrawColor(212, 160, 32)
  doc.setLineWidth(0.4)
  doc.roundedRect(8, 8, 194, 281, 3, 3, 'D')

  // Cabeçalho
  desenharCabecalhoInterno(doc, 'FICHA TÉCNICA DO MODELO', empresaNome)

  // ── FOTO DO MODELO EM ALTA RESOLUÇÃO (PRESERVANDO PROPORÇÃO) ──
  const imgX = 14
  const imgY = 22
  const imgW = 182
  const imgH = 120

  doc.setFillColor(8, 8, 10)
  doc.setDrawColor(38, 38, 46)
  doc.roundedRect(imgX, imgY, imgW, imgH, 3, 3, 'FD')

  if (imgObj) {
    try {
      desenharImagemContida(doc, imgObj, imgX + 2, imgY + 2, imgW - 4, imgH - 4)
    } catch {
      // ignore
    }
  }

  // ── INFORMAÇÕES DO MODELO ──
  let curY = 150

  // Tag de Categoria & Serviço
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(212, 160, 32)
  doc.text(`${item.categoria.toUpperCase()}  •  ${(item.servico || 'SUBLIMAÇÃO TOTAL').toUpperCase()}`, 16, curY)
  curY += 8

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text(item.titulo, 16, curY)
  curY += 7

  // Subtítulo
  if (item.subtitulo) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(161, 161, 170)
    doc.text(item.subtitulo, 16, curY, { maxWidth: 178 })
    curY += 8
  }

  // Grade de Especificações Técnicas
  const yGrid = curY + 2
  const colW = 43
  const colH = 14

  const specs = [
    { label: 'CLIENTE / PROJETO', val: item.cliente || 'Confecção Parceira' },
    { label: 'ANO DE CRIAÇÃO', val: item.ano || '2026' },
    { label: 'TECIDO INDICADO', val: item.tecido || 'Dry-Fit UV50+' },
    { label: 'TÉCNICA DE ESTAMPA', val: item.tecnica || 'Sublimação Total' },
  ]

  specs.forEach((s, i) => {
    const x = 16 + i * (colW + 2)
    doc.setFillColor(18, 18, 24)
    doc.setDrawColor(38, 38, 46)
    doc.roundedRect(x, yGrid, colW, colH, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(113, 113, 122)
    doc.text(s.label, x + 3, yGrid + 4.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(244, 244, 245)
    doc.text(s.val, x + 3, yGrid + 10, { maxWidth: colW - 6 })
  })

  curY = yGrid + colH + 7

  // Conceito Criativo
  if (item.descricao) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(212, 160, 32)
    doc.text('CONCEITO CRIATIVO & DETALHES DA ARTE:', 16, curY)
    curY += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(212, 212, 216)
    doc.text(item.descricao, 16, curY, { maxWidth: 178, lineHeightFactor: 1.4 })
    curY += 18
  }

  // Paleta de Cores
  if (item.cores && item.cores.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(212, 160, 32)
    doc.text('PALETA DE CORES UTILIZADA:', 16, curY)
    curY += 5

    let colorX = 16
    item.cores.forEach((cor) => {
      const [r, g, b] = hexParaRgb(cor)
      doc.setFillColor(r, g, b)
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.2)
      doc.circle(colorX + 3, curY, 3, 'FD')

      doc.setFont('courier', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(212, 212, 216)
      doc.text(cor.toUpperCase(), colorX + 8, curY + 1)
      colorX += 26
    })

    curY += 12
  }

  // Caixa de Contato / Orçamento no Rodapé
  const yBox = 244
  doc.setFillColor(18, 18, 24)
  doc.setDrawColor(212, 160, 32)
  doc.roundedRect(14, yBox, 182, 34, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(212, 160, 32)
  doc.text('SOLICITAR ORÇAMENTO PARA ESTE MODELO', 20, yBox + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(161, 161, 170)
  doc.text(
    `Para encomendar este modelo personalizado para sua equipe ou empresa, chame no WhatsApp: ${whatsappNum}`,
    20,
    yBox + 17,
    { maxWidth: 170 }
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(34, 197, 94)
  doc.text(`WHATSAPP OFICIAL: ${whatsappNum}`, 20, yBox + 26)

  // Rodapé da ficha
  desenharRodapeInterno(doc, 1, 1, whatsappNum)

  onProgresso?.(100, 'Ficha técnica gerada com sucesso!')
  return doc
}


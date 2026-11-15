import type { NestResult } from './types'
import { itemH } from './masks'

export interface DrawOpts {
  mirror?: boolean
  bg?: string | null
  outline?: boolean
  hq?: boolean     // usa o PNG original (exportação)
  offY?: number    // deslocamento vertical em px (partes)
}

export function drawLayout(ctx: CanvasRenderingContext2D, result: NestResult, s: number, o: DrawOpts) {
  const cfg = result.cfg
  const W = cfg.roll * s, H = Math.ceil(result.lenCm * s)
  ctx.save()
  if (o.offY) ctx.translate(0, -o.offY)
  if (o.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1) }
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H) }
  ctx.imageSmoothingQuality = 'high'
  for (const p of result.pl) {
    const it = p.it, w = it.widthCm * s, h = itemH(it) * s
    ctx.save()
    ctx.translate((cfg.margin + p.cx) * s, p.cy * s)
    ctx.rotate(p.angle * Math.PI / 180)
    const src = o.hq && !cfg.ignWhite ? it.img : (it.proc ?? it.src)
    ctx.drawImage(src, -w / 2, -h / 2, w, h)
    if (o.outline) { ctx.strokeStyle = '#e11d48'; ctx.lineWidth = Math.max(1, s * 0.08); ctx.strokeRect(-w / 2, -h / 2, w, h) }
    ctx.restore()
  }
  ctx.restore()
}

/* ---------- PNG com DPI gravado (abre no tamanho real no Corel/Photoshop) ---------- */
const CRC_T = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(u8: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

export async function withDpi(blob: Blob, pxPerMeter: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const chunk = new Uint8Array(21), dv = new DataView(chunk.buffer)
  dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4) // 'pHYs'
  dv.setUint32(8, Math.round(pxPerMeter)); dv.setUint32(12, Math.round(pxPerMeter)); chunk[16] = 1
  dv.setUint32(17, crc32(chunk.subarray(4, 17)))
  const at = 33 // logo depois do IHDR
  const out = new Uint8Array(buf.length + 21)
  out.set(buf.subarray(0, at), 0); out.set(chunk, at); out.set(buf.subarray(at), at + 21)
  return new Blob([out], { type: 'image/png' })
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 8000)
}

const fmtNum = (n: number, d = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d })

/** Exporta o PNG final. Por padrão em arquivo único, reduzindo o dpi só o necessário. */
export async function exportPng(
  result: NestResult,
  o: { dpi: number; mirror: boolean; whiteBg: boolean; split: boolean },
  onStatus: (t: string) => void,
): Promise<string> {
  const cfg = result.cfg, len = result.lenCm
  let s = Math.max(30, o.dpi) / 2.54
  s = Math.min(s, 30000 / cfg.roll)
  if (!o.split) s = Math.min(s, Math.sqrt(230e6 / (cfg.roll * len)), 30000 / len)
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const W = Math.round(cfg.roll * s)
    const tileH = o.split ? Math.max(500, Math.min(30000, Math.floor(140e6 / W))) : Math.round(len * s)
    const totalH = Math.round(len * s), parts = Math.ceil(totalH / tileH)
    try {
      for (let i = 0; i < parts; i++) {
        const y0 = i * tileH, h = Math.min(tileH, totalH - y0)
        onStatus(`Gerando PNG ${i + 1}/${parts}…`)
        await new Promise((r) => setTimeout(r, 15))
        const cv = document.createElement('canvas'); cv.width = W; cv.height = h
        drawLayout(cv.getContext('2d')!, result, s, { mirror: o.mirror, bg: o.whiteBg ? '#ffffff' : null, hq: true, offY: y0 })
        const b0: Blob | null = await new Promise((r) => cv.toBlob(r, 'image/png'))
        if (!b0) throw new Error('memória insuficiente')
        const b = await withDpi(b0, s * 100)
        const base = `encaixe_${fmtNum(cfg.roll, 0)}cm_x_${fmtNum(len / 100)}m`.replace(/,/g, '_')
        download(b, base + (parts > 1 ? `_parte${i + 1}de${parts}` : '') + '.png')
        await new Promise((r) => setTimeout(r, 400))
      }
      return `PNG exportado a ${fmtNum(s * 2.54, 0)} dpi (${W}×${totalH}px)` + (parts > 1 ? `, dividido em ${parts} partes: abra todas.` : '.')
    } catch (e: any) {
      if (tentativa === 3) throw e
      s *= 0.75
    }
  }
  return ''
}

/* ---------- Script VBA do CorelDRAW (PNGs originais, sem perda) ---------- */
export function corelScript(result: NestResult, pasta: string, mirror: boolean): Blob {
  let p = (pasta || 'C:\\Pecas\\').trim()
  if (!/[\\/]$/.test(p)) p += '\\'
  const cfg = result.cfg, f3 = (n: number) => n.toFixed(3), q = (t: string) => t.replace(/"/g, '""')
  const names = [...new Set(result.pl.map((x) => x.it.name))]
  const calls = result.pl.map((x) => `    Colocar "${q(x.it.name)}", ${f3(cfg.margin + x.cx)}, ${f3(x.cy)}, ${f3(x.angle)}, ${f3(x.it.widthCm)}`)
  const L: string[] = []
  L.push('Attribute VB_Name = "EncaixeCalandra"', 'Option Explicit',
    "' Gerado pelo Otimizador de Corte. Alt+F11 > Arquivo > Importar arquivo > este .bas > executar a macro Encaixe.",
    `Const PASTA As String = "${q(p)}"`,
    `Const LARGURA_ROLO As Double = ${f3(cfg.roll)}`,
    `Const COMPRIMENTO As Double = ${f3(result.lenCm + cfg.margin)}`,
    `Const ESPELHAR As Boolean = ${mirror ? 'True' : 'False'}`,
    'Dim lyr As Layer', '',
    'Sub Colocar(arq As String, cx As Double, cy As Double, ang As Double, larg As Double)',
    '    Dim imp As ImportFilter, s As Shape',
    '    Set imp = lyr.Import(PASTA & arq)',
    '    imp.Finish',
    '    Set s = ActiveShape',
    '    s.LockAspectRatio = True',
    '    s.SetSize larg, larg * s.SizeHeight / s.SizeWidth',
    '    If ang <> 0 Then s.Rotate -ang',
    '    If ESPELHAR Then s.Flip cdrFlipHorizontal',
    '    If ESPELHAR Then s.CenterX = LARGURA_ROLO - cx Else s.CenterX = cx',
    '    s.CenterY = COMPRIMENTO - cy',
    'End Sub', '',
    'Sub Encaixe()',
    '    Dim doc As Document, faltam As String',
    '    faltam = ""')
  names.forEach((n) => L.push(`    If Dir(PASTA & "${q(n)}") = "" Then faltam = faltam & vbCrLf & "${q(n)}"`))
  L.push('    If faltam <> "" Then',
    '        MsgBox "Arquivos nao encontrados em " & PASTA & ":" & faltam, vbExclamation',
    '        Exit Sub', '    End If',
    '    Set doc = CreateDocument',
    '    doc.Unit = cdrCentimeter',
    '    doc.ActivePage.SetSize LARGURA_ROLO, COMPRIMENTO',
    '    Set lyr = doc.ActiveLayer',
    '    Application.Optimization = True',
    '    On Error GoTo Falha')
  const parts = Math.ceil(calls.length / 100)
  for (let i = 1; i <= parts; i++) L.push(`    Parte${i}`)
  L.push('    Application.Optimization = False',
    '    Application.Refresh',
    '    ActiveWindow.ActiveView.ToFitPage',
    `    MsgBox "Encaixe pronto: ${calls.length} pecas.", vbInformation`,
    '    Exit Sub', 'Falha:',
    '    Application.Optimization = False',
    '    MsgBox "Erro: " & Err.Description, vbCritical', 'End Sub', '')
  for (let i = 0; i < parts; i++) L.push(`Sub Parte${i + 1}()`, ...calls.slice(i * 100, i * 100 + 100), 'End Sub', '')
  const txt = L.join('\r\n')
  const bytes = new Uint8Array(txt.length)
  for (let i = 0; i < txt.length; i++) { const c = txt.charCodeAt(i); bytes[i] = c < 256 ? c : 63 } // ANSI
  return new Blob([bytes], { type: 'text/plain' })
}

export function downloadBlob(blob: Blob, name: string) { download(blob, name) }

/** Comprimento de referência: encaixe só por retângulos (para comparar). */
export function rectBaselineCm(items: { widthCm: number; qty: number; bbW: number; bbH: number; src: { width: number; height: number } }[], roll: number, margin: number, gap: number) {
  const W = roll - 2 * margin
  const rects: { w: number; h: number }[] = []
  for (const it of items) {
    for (let k = 0; k < it.qty; k++) {
      let w = it.widthCm * it.bbW, h = (it.widthCm * it.src.height / it.src.width) * it.bbH
      if (w > W && h <= W) [w, h] = [h, w]
      rects.push({ w, h })
    }
  }
  rects.sort((a, b) => b.h - a.h)
  let x = 0, sh = 0, ref = 0
  for (const r of rects) {
    if (x + r.w > W && x > 0) { ref += sh + gap; x = 0; sh = 0 }
    x += r.w + gap; sh = Math.max(sh, r.h)
  }
  return ref + sh
}

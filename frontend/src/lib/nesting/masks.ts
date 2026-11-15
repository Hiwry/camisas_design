import type { MaskRot, NestItem, RotMode } from './types'

export const ALPHA_TH = 20
const SS = 3

export function readDpi(buf: ArrayBuffer): number | null {
  try {
    const v = new DataView(buf)
    if (v.getUint32(0) !== 0x89504e47) return null
    let p = 8
    while (p + 8 <= v.byteLength) {
      const len = v.getUint32(p)
      const t = String.fromCharCode(v.getUint8(p + 4), v.getUint8(p + 5), v.getUint8(p + 6), v.getUint8(p + 7))
      if (t === 'pHYs') {
        const ppu = v.getUint32(p + 8), u = v.getUint8(p + 16)
        if (u === 1 && ppu > 0) { const d = ppu * 0.0254; return d >= 20 && d <= 2400 ? d : null }
        return null
      }
      if (t === 'IDAT' || t === 'IEND') return null
      p += 12 + len
    }
  } catch { /* ignora */ }
  return null
}

export function itemH(it: NestItem) { return it.widthCm * it.src.height / it.src.width }

export async function loadNestItem(file: File, id: number, rot: RotMode): Promise<NestItem> {
  const buf = await file.arrayBuffer()
  const dpi = readDpi(buf)
  const url = URL.createObjectURL(new Blob([buf], { type: file.type || 'image/png' }))
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url
  })
  const MAX = 2400
  const sc = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * sc))
  c.height = Math.max(1, Math.round(img.naturalHeight * sc))
  const x = c.getContext('2d')!
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, c.width, c.height)
  const widthCm = Math.round(img.naturalWidth / (dpi || 300) * 2.54 * 10) / 10
  return { id, name: file.name, url, img, src: c, proc: null, frac: 1, bbW: 1, bbH: 1, widthCm, qty: 1, rot, noDpi: !dpi }
}

/** Gera a versão usada nas máscaras: opcionalmente tira o fundo branco ligado às bordas. */
export function buildProc(it: NestItem, ignoreWhite: boolean) {
  const w = it.src.width, h = it.src.height
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.drawImage(it.src, 0, 0)
  const id = x.getImageData(0, 0, w, h), d = id.data
  if (ignoreWhite) {
    const seen = new Uint8Array(w * h), q = new Int32Array(w * h)
    let qs = 0, qe = 0
    const bg = (i: number) => { const o = i * 4; return d[o + 3] < 10 || (d[o] >= 235 && d[o + 1] >= 235 && d[o + 2] >= 235) }
    const push = (i: number) => { if (!seen[i] && bg(i)) { seen[i] = 1; q[qe++] = i } }
    for (let i = 0; i < w; i++) { push(i); push((h - 1) * w + i) }
    for (let j = 0; j < h; j++) { push(j * w); push(j * w + w - 1) }
    while (qs < qe) {
      const i = q[qs++], px = i % w, py = (i / w) | 0
      d[i * 4 + 3] = 0
      if (px > 0) push(i - 1); if (px < w - 1) push(i + 1); if (py > 0) push(i - w); if (py < h - 1) push(i + w)
    }
    x.putImageData(id, 0, 0)
  }
  let cnt = 0, x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (d[(j * w + i) * 4 + 3] > ALPHA_TH) { cnt++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j }
  }
  it.proc = c
  it.frac = cnt / (w * h)
  it.bbW = cnt ? (x1 - x0 + 1) / w : 1
  it.bbH = cnt ? (y1 - y0 + 1) / h : 1
}

export function buildMask(it: NestItem, angleDeg: number, cell: number, r: number): MaskRot | null {
  const proc = it.proc!
  const cpc = 10 / cell, wC = it.widthCm * cpc, hC = wC * proc.height / proc.width
  const th = angleDeg * Math.PI / 180, co = Math.abs(Math.cos(th)), si = Math.abs(Math.sin(th))
  const bw = wC * co + hC * si, bh = wC * si + hC * co
  const nx = Math.ceil(bw) + 2 * r + 2, ny = Math.ceil(bh) + 2 * r + 2
  const cv = document.createElement('canvas'); cv.width = nx * SS; cv.height = ny * SS
  const cx = cv.getContext('2d', { willReadFrequently: true })!
  cx.imageSmoothingQuality = 'high'
  cx.translate(nx * SS / 2, ny * SS / 2); cx.rotate(th)
  cx.drawImage(proc, -wC * SS / 2, -hC * SS / 2, wC * SS, hC * SS)
  const W = cv.width, H = cv.height, d = cx.getImageData(0, 0, W, H).data
  let m = new Uint8Array(nx * ny)
  for (let py = 0; py < H; py++) {
    const row = ((py / SS) | 0) * nx
    for (let px = 0; px < W; px++) { if (d[(py * W + px) * 4 + 3] > ALPHA_TH) m[row + ((px / SS) | 0)] = 1 }
  }
  if (r > 0) {
    const t = new Uint8Array(nx * ny)
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      if (m[y * nx + x]) { const a = Math.max(0, x - r), b = Math.min(nx - 1, x + r); for (let k = a; k <= b; k++) t[y * nx + k] = 1 }
    }
    const o = new Uint8Array(nx * ny)
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      if (t[y * nx + x]) { const a = Math.max(0, y - r), b = Math.min(ny - 1, y + r); for (let k = a; k <= b; k++) o[k * nx + x] = 1 }
    }
    m = o
  }
  let x0 = nx, y0 = ny, x1 = -1, y1 = -1
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    if (m[y * nx + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) return null
  const wm = x1 - x0 + 1, hm = y1 - y0 + 1, data = new Uint8Array(wm * hm)
  for (let y = 0; y < hm; y++) for (let x = 0; x < wm; x++) data[y * wm + x] = m[(y + y0) * nx + x + x0]
  return { angle: angleDeg, wm, hm, data, ox: nx / 2 - x0, oy: ny / 2 - y0 }
}

export function anglesFor(it: NestItem, step: number): number[] {
  if (it.rot === 'none') return [0]
  if (it.rot === '180') return [0, 180]
  const a: number[] = []
  for (let g = 0; g < 360; g += step) a.push(g)
  return a
}

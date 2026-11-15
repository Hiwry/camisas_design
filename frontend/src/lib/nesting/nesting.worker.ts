/* Motor de encaixe (nesting) em máscara raster: bottom-left fill com vários testes de ordem. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const ctx: any = self

interface Rot {
  wm: number
  hm: number
  data: Uint8Array
  sh: (Uint32Array | null)[]
  nw: Int32Array
  rc: Int32Array
}
interface Proto { area: number; qty: number; rots: Rot[] }

let GW = 0, GWw = 0, R = 0, MAXROWS = 0, minWm = 1e9
let grid = new Uint32Array(0), rowCnt = new Int32Array(0)
let rows = 0, usedRows = 0, startRow = 0
let protos: Proto[] = []

function alloc() {
  rows = 512
  grid = new Uint32Array(rows * GWw)
  rowCnt = new Int32Array(rows)
  usedRows = 0
  startRow = 0
}
function ensure(n: number) {
  if (n > rows) {
    const nr = Math.max(n, rows * 2)
    const g = new Uint32Array(nr * GWw); g.set(grid); grid = g
    const c = new Int32Array(nr); c.set(rowCnt); rowCnt = c
    rows = nr
  }
}
function mkRot(r: { wm: number; hm: number; data: Uint8Array }): Rot {
  const w = r.wm, h = r.hm, d = r.data, rc = new Int32Array(h)
  for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) c += d[y * w + x]; rc[y] = c }
  return { wm: w, hm: h, data: d, sh: new Array(32).fill(null), nw: new Int32Array(32), rc }
}
function shifted(rot: Rot, s: number): Uint32Array {
  let a = rot.sh[s]
  if (a) return a
  const nw = (rot.wm + s + 31) >> 5
  a = new Uint32Array(rot.hm * nw)
  const d = rot.data, w = rot.wm
  for (let r = 0; r < rot.hm; r++) {
    const o = r * nw
    for (let c = 0; c < w; c++) {
      if (d[r * w + c]) { const p = c + s; a[o + (p >> 5)] |= (1 << (p & 31)) }
    }
  }
  rot.sh[s] = a; rot.nw[s] = nw
  return a
}
function fits(rot: Rot, x: number, y: number): boolean {
  const s = x & 31, a = shifted(rot, s), nw = rot.nw[s], bx = x >> 5, hm = rot.hm
  for (let r = 0; r < hm; r++) {
    const gi = (y + r) * GWw + bx, di = r * nw
    for (let k = 0; k < nw; k++) { if (grid[gi + k] & a[di + k]) return false }
  }
  return true
}
function stamp(rot: Rot, x: number, y: number) {
  const s = x & 31, a = shifted(rot, s), nw = rot.nw[s], bx = x >> 5, hm = rot.hm
  ensure(y + hm)
  for (let r = 0; r < hm; r++) {
    const gi = (y + r) * GWw + bx, di = r * nw
    for (let k = 0; k < nw; k++) grid[gi + k] |= a[di + k]
    rowCnt[y + r] += rot.rc[r]
  }
  if (y + hm > usedRows) usedRows = y + hm
  while (startRow < usedRows && GW - rowCnt[startRow] < minWm) startRow++
}
function place(p: Proto, f: number) {
  let best: { ri: number; x: number; y: number } | null = null
  let bs = Infinity
  for (let ri = 0; ri < p.rots.length; ri++) {
    const rot = p.rots[ri], maxX = GW - rot.wm
    if (maxX < 0) continue
    let yLim = MAXROWS - rot.hm
    if (bs !== Infinity) yLim = Math.min(yLim, Math.ceil(bs - f * rot.hm) - 1)
    if (yLim > usedRows) yLim = usedRows
    let found = false, fy = 0, fx = 0
    for (let y = startRow; y <= yLim && !found; y++) {
      if (y >= usedRows) { found = true; fy = y; fx = 0; break }
      ensure(y + rot.hm)
      for (let x = 0; x <= maxX; x++) { if (fits(rot, x, y)) { found = true; fy = y; fx = x; break } }
    }
    if (found) { const sc = fy + f * rot.hm; if (sc < bs) { bs = sc; best = { ri, x: fx, y: fy } } }
  }
  return best
}
function runOnce(order: number[], f: number, bestLen: number, report: boolean) {
  alloc()
  const out = new Int32Array(order.length * 4)
  let len = 0
  for (let i = 0; i < order.length; i++) {
    const pi = order[i], p = protos[pi], res = place(p, f)
    if (!res) return { fail: true as const }
    const rot = p.rots[res.ri]
    stamp(rot, res.x, res.y)
    out[i * 4] = pi; out[i * 4 + 1] = res.ri; out[i * 4 + 2] = res.x; out[i * 4 + 3] = res.y
    const bottom = res.y + rot.hm - 2 * R
    if (bottom > len) len = bottom
    if (len >= bestLen) return { pruned: true as const }
    if (report && i % 5 === 0) ctx.postMessage({ type: 'prog', placed: i + 1, total: order.length })
  }
  return { len, out }
}
function rng(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

ctx.onmessage = function (e: MessageEvent) {
  const m = e.data
  GW = m.GW; GWw = (GW + 31) >> 5; R = m.R; MAXROWS = m.maxRows
  protos = m.items.map((it: any) => ({ area: it.area, qty: it.qty, rots: it.rots.map(mkRot) }))
  minWm = 1e9
  protos.forEach((p) => p.rots.forEach((r) => { if (r.wm < minWm) minWm = r.wm }))
  const inst: number[] = []
  protos.forEach((p, i) => { for (let k = 0; k < p.qty; k++) inst.push(i) })
  const keys = [
    (i: number) => protos[i].area,
    (i: number) => Math.max(protos[i].rots[0].wm, protos[i].rots[0].hm),
    (i: number) => protos[i].rots[0].hm,
    (i: number) => protos[i].rots[0].wm,
  ]
  const F = [1, 0.5, 0], rnd = rng(12345), t0 = Date.now()
  let best = Infinity, iter = 0
  while (true) {
    let key: (i: number) => number, f: number
    if (iter < 4) { key = keys[iter]; f = 1 }
    else {
      const kf = keys[Math.floor(rnd() * 4)], noise = protos.map(() => 0.6 + 0.8 * rnd())
      key = (i) => kf(i) * noise[i]; f = F[(iter - 4) % 3]
    }
    const kv = protos.map((_, i) => key(i))
    const order = inst.slice().sort((a, b) => kv[b] - kv[a] || a - b)
    const res: any = runOnce(order, f, best, iter === 0)
    if (res.fail && iter === 0) {
      ctx.postMessage({ type: 'error', msg: 'Não foi possível posicionar todas as peças (limite de comprimento).' })
      return
    }
    if (res.len !== undefined && res.len < best) {
      best = res.len
      ctx.postMessage({ type: 'best', len: best, out: res.out.slice(), iter })
    }
    iter++
    ctx.postMessage({ type: 'iter', iter, best, elapsed: Date.now() - t0 })
    if (Date.now() - t0 > m.timeMs || iter > 3000) break
  }
  ctx.postMessage({ type: 'done', iter, best })
}

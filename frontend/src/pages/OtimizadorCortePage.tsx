import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Scissors, Plus, Minus, X, Download, FileCode2, Loader2, Square, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import type { MaskRot, NestCfg, NestItem, NestResult, RotMode } from '@/lib/nesting/types'
import { anglesFor, buildMask, buildProc, itemH, loadNestItem } from '@/lib/nesting/masks'
import { corelScript, downloadBlob, drawLayout, exportPng, rectBaselineCm } from '@/lib/nesting/output'

// Paleta do sistema: fundo #0B0B0C · card #151516 · superfície #1D1D1F · borda #303034 · primária #E7B32C
const CARD = { background: '#151516', borderColor: '#303034' }
const FIELD = { background: '#1D1D1F', borderColor: '#303034' }
const fieldCls = 'w-full rounded-lg border px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-[#E7B32C]'
const fmt = (n: number, d = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d })

const ROT_NOTE: Record<RotMode, string> = {
  none: 'Não gira: a peça fica sempre como está.',
  '180': 'Só vira de cabeça pra baixo (0° e 180°).',
  '360': 'Gira em qualquer ângulo (encaixa melhor).',
}
const STORE_KEY = 'otimizadorCorteCfg'

interface Form {
  roll: number; gap: number; margin: number; time: number; cell: number; step: number
  defRot: RotMode; ignWhite: boolean; pasta: string; dpi: number
}
const DEFAULTS: Form = {
  roll: 160, gap: 0.5, margin: 0.5, time: 20, cell: 5, step: 15,
  defRot: '180', ignWhite: false, pasta: 'C:\\Pecas\\', dpi: 150,
}
function loadForm(): Form {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } } catch { return DEFAULTS }
}

interface Meta { sent: { it: NestItem; rots: Pick<MaskRot, 'angle' | 'ox' | 'oy'>[] }[]; cell: number; r: number; cfg: NestCfg }

export default function OtimizadorCortePage() {
  const [form, setForm] = useState<Form>(loadForm)
  const [items, setItems] = useState<NestItem[]>([])
  const [result, setResult] = useState<NestResult | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<{ text: string; err?: boolean }>({ text: '' })
  const [zoom, setZoom] = useState(1)
  const [outline, setOutline] = useState(false)
  const [mirror, setMirror] = useState(false)
  const [whiteBg, setWhiteBg] = useState(false)
  const [split, setSplit] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showAdv, setShowAdv] = useState(false)

  const nextId = useRef(1)
  const workerRef = useRef<Worker | null>(null)
  const metaRef = useRef<Meta | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const patchItem = (id: number, p: Partial<NestItem>) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)))

  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(form)) } catch { /* ignora */ } }, [form])
  useEffect(() => () => { workerRef.current?.terminate() }, [])

  async function addFiles(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      try {
        const it = await loadNestItem(f, nextId.current++, form.defRot)
        setItems((l) => [...l, it])
      } catch { toast.error(`Não consegui abrir ${f.name}`) }
    }
  }
  function removeItem(it: NestItem) { URL.revokeObjectURL(it.url); setItems((l) => l.filter((x) => x.id !== it.id)) }

  const totalPecas = items.reduce((a, i) => a + i.qty, 0)

  /* ---------- otimização ---------- */
  async function optimize() {
    if (running) return
    if (!items.length) { setStatus({ text: 'Adicione pelo menos uma peça.', err: true }); return }
    const usable = form.roll - 2 * form.margin
    if (!(usable > 0)) { setStatus({ text: 'Largura do rolo inválida.', err: true }); return }
    setRunning(true)
    setStatus({ text: 'Preparando as peças…' })
    await new Promise((r) => setTimeout(r, 15))

    const cfg: NestCfg = { roll: form.roll, margin: form.margin, gap: form.gap, cell: form.cell, time: form.time, step: form.step, ignWhite: form.ignWhite }
    const cell = cfg.cell
    const r = Math.max(0, Math.round(cfg.gap * 10 / 2 / cell))
    const GW = Math.floor(usable * 10 / cell) + 2 * r
    const sent: Meta['sent'] = []
    const payload: { qty: number; area: number; rots: { wm: number; hm: number; data: Uint8Array }[] }[] = []
    const transfer: ArrayBuffer[] = []
    for (const it of items) {
      buildProc(it, cfg.ignWhite)
      const rots: MaskRot[] = []
      for (const a of anglesFor(it, cfg.step)) {
        const m = buildMask(it, a, cell, r)
        if (m && m.wm <= GW) rots.push(m)
      }
      if (!rots.length) {
        setStatus({ text: `A peça "${it.name}" é mais larga que o rolo útil (${fmt(usable, 1)} cm).`, err: true })
        setRunning(false); return
      }
      sent.push({ it, rots: rots.map((m) => ({ angle: m.angle, ox: m.ox, oy: m.oy })) })
      payload.push({ qty: it.qty, area: Math.max(1, it.frac * it.widthCm * itemH(it)), rots: rots.map((m) => ({ wm: m.wm, hm: m.hm, data: m.data })) })
      rots.forEach((m) => transfer.push(m.data.buffer as ArrayBuffer))
    }
    metaRef.current = { sent, cell, r, cfg }

    const worker = new Worker(new URL('../lib/nesting/nesting.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    const t0 = Date.now()
    const finish = () => { worker.terminate(); if (workerRef.current === worker) workerRef.current = null; setRunning(false) }
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'best') {
        const meta = metaRef.current!, out: Int32Array = m.out, pl: NestResult['pl'] = []
        for (let i = 0; i < out.length; i += 4) {
          const s = meta.sent[out[i]], rot = s.rots[out[i + 1]], gx = out[i + 2], gy = out[i + 3]
          pl.push({ it: s.it, angle: rot.angle, cx: (gx + rot.ox - meta.r) * meta.cell / 10, cy: (gy + rot.oy - meta.r) * meta.cell / 10 })
        }
        setResult({ pl, lenCm: m.len * meta.cell / 10, cfg: meta.cfg })
      } else if (m.type === 'prog') {
        setStatus({ text: `Montando o primeiro encaixe… ${m.placed}/${m.total} peças` })
      } else if (m.type === 'iter') {
        setStatus({ text: `Testando combinações… ${m.iter} tentativas · melhor ${fmt(m.best * cell / 10 / 100)} m` })
      } else if (m.type === 'error') {
        setStatus({ text: m.msg, err: true }); finish()
      } else if (m.type === 'done') {
        setStatus({ text: `Pronto: ${m.iter} combinações testadas em ${fmt((Date.now() - t0) / 1000, 1)} s.` }); finish()
      }
    }
    worker.onerror = (e) => { setStatus({ text: 'Erro no cálculo: ' + e.message, err: true }); finish() }
    worker.postMessage({ GW, R: r, maxRows: Math.floor(300 * 1000 / cell), timeMs: cfg.time * 1000, items: payload }, transfer)
    setStatus({ text: 'Montando o primeiro encaixe…' })
  }
  function stop() {
    if (workerRef.current) {
      workerRef.current.terminate(); workerRef.current = null
      setRunning(false); setStatus({ text: 'Interrompido. Mostrando o melhor encaixe encontrado.' })
    }
  }

  /* ---------- prévia ---------- */
  useEffect(() => {
    const cv = canvasRef.current, view = viewRef.current
    if (!result || !cv || !view) return
    const { cfg, lenCm } = result
    const fit = Math.max(300, view.clientWidth - 30) / cfg.roll
    const s = Math.min(fit * zoom, 30000 / Math.max(lenCm, 1), 12)
    cv.width = Math.round(cfg.roll * s)
    cv.height = Math.max(10, Math.round(lenCm * s))
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#e8e3d6'; ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.strokeStyle = '#0f766e66'; ctx.setLineDash([4, 4])
    ctx.strokeRect(cfg.margin * s, 0, (cfg.roll - 2 * cfg.margin) * s, cv.height); ctx.setLineDash([])
    drawLayout(ctx, result, s, { outline })
    ctx.font = '12px system-ui'; ctx.textBaseline = 'bottom'
    for (let m = 1; m * 100 < lenCm; m++) {
      const y = m * 100 * s
      ctx.strokeStyle = '#0f766e88'; ctx.setLineDash([6, 4])
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = '#0f766e'; ctx.fillText(`${m} m`, 4, y - 2)
    }
  }, [result, zoom, outline])

  const stats = useMemo(() => {
    if (!result) return null
    const { cfg, lenCm, pl } = result
    const areaPcs = pl.reduce((a, p) => a + p.it.frac * p.it.widthCm * itemH(p.it), 0)
    const total = cfg.roll * lenCm
    const ref = rectBaselineCm(items, cfg.roll, cfg.margin, cfg.gap)
    return { len: lenCm, util: areaPcs / total * 100, waste: (total - areaPcs) / 10000, n: pl.length, ref, save: ref - lenCm, savePct: ref > 0 ? (ref - lenCm) / ref * 100 : 0, roll: cfg.roll }
  }, [result, items])

  /* ---------- exportar ---------- */
  async function doPng() {
    if (!result) return
    setExporting(true)
    try {
      const msg = await exportPng(result, { dpi: form.dpi, mirror, whiteBg, split }, (t) => setStatus({ text: t }))
      setStatus({ text: msg })
    } catch (e: any) {
      setStatus({ text: `Falha ao exportar: ${e?.message}. Use o script do CorelDRAW.`, err: true })
    }
    setExporting(false)
  }
  function doCorel() {
    if (!result) return
    downloadBlob(corelScript(result, form.pasta, mirror), 'encaixe_corel.bas')
    setStatus({ text: `Script gerado (${result.pl.length} peças). No Corel: Alt+F11 > Arquivo > Importar arquivo > encaixe_corel.bas > rodar "Encaixe". Os PNGs originais precisam estar em ${form.pasta}` })
  }

  const num = (v: string, d: number) => (v === '' || isNaN(+v) ? d : +v)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(231,179,44,0.12)' }}>
          <Scissors className="w-5 h-5" style={{ color: '#E7B32C' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Otimizador de Corte</h1>
          <p className="text-xs" style={{ color: '#909098' }}>Encaixe as artes no rolo da calandra usando o formato real de cada peça.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[400px_1fr] items-start">
        {/* ───── Coluna esquerda ───── */}
        <div className="space-y-3 min-w-0">
          <section className="rounded-xl border p-4" style={CARD}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>
              <span className="inline-grid place-items-center w-5 h-5 rounded-full mr-1.5 text-[11px]" style={{ background: '#E7B32C', color: '#0B0B0C' }}>1</span>
              Rolo de tecido
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400 space-y-1">Largura do rolo (cm)
                <input className={fieldCls} style={FIELD} type="number" min={10} value={form.roll} onChange={(e) => set('roll', num(e.target.value, 160))} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1">Espaço entre peças (cm)
                <input className={fieldCls} style={FIELD} type="number" min={0} step={0.1} value={form.gap} onChange={(e) => set('gap', num(e.target.value, 0))} />
              </label>
            </div>
            <button type="button" onClick={() => setShowAdv((v) => !v)} className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color: '#E7B32C' }}>
              <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showAdv && 'rotate-180')} /> Mais ajustes
            </button>
            {showAdv && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-zinc-400 space-y-1">Margem nas bordas (cm)
                    <input className={fieldCls} style={FIELD} type="number" min={0} step={0.1} value={form.margin} onChange={(e) => set('margin', num(e.target.value, 0))} />
                  </label>
                  <label className="text-xs text-zinc-400 space-y-1">Tempo de busca (s)
                    <input className={fieldCls} style={FIELD} type="number" min={2} value={form.time} onChange={(e) => set('time', num(e.target.value, 20))} />
                  </label>
                  <label className="text-xs text-zinc-400 space-y-1">Precisão do encaixe
                    <select className={fieldCls} style={FIELD} value={form.cell} onChange={(e) => set('cell', +e.target.value)}>
                      <option value={8}>Rápida (8 mm)</option><option value={5}>Normal (5 mm)</option>
                      <option value={3}>Alta (3 mm)</option><option value={2}>Máxima (2 mm, lenta)</option>
                    </select>
                  </label>
                  <label className="text-xs text-zinc-400 space-y-1">Passo do giro 360°
                    <select className={fieldCls} style={FIELD} value={form.step} onChange={(e) => set('step', +e.target.value)}>
                      {[90, 45, 30, 15, 10].map((v) => <option key={v} value={v}>{v}°</option>)}
                    </select>
                  </label>
                </div>
                <label className="text-xs text-zinc-400 space-y-1 block">Rotação padrão das novas peças
                  <select className={fieldCls} style={FIELD} value={form.defRot} onChange={(e) => set('defRot', e.target.value as RotMode)}>
                    <option value="none">Fixa (0°)</option><option value="180">180° (cima/baixo)</option><option value="360">360° (livre)</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={form.ignWhite} onChange={(e) => set('ignWhite', e.target.checked)} />
                  PNG sem transparência: tratar o fundo branco como vazio
                </label>
              </div>
            )}
          </section>

          <section className="rounded-xl border p-4" style={CARD}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center justify-between" style={{ color: '#909098' }}>
              <span>
                <span className="inline-grid place-items-center w-5 h-5 rounded-full mr-1.5 text-[11px]" style={{ background: '#E7B32C', color: '#0B0B0C' }}>2</span>
                Peças
              </span>
              {items.length > 0 && <span className="normal-case tracking-normal text-zinc-200 font-semibold">{items.length} {items.length > 1 ? 'tipos' : 'tipo'} · {totalPecas} peças</span>}
            </h2>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
              className="rounded-xl border-2 border-dashed p-4 text-center cursor-pointer hover:border-[#E7B32C] transition-colors"
              style={{ borderColor: '#303034' }}
            >
              <div className="font-semibold text-sm text-zinc-100 flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> {items.length ? 'Adicionar mais peças' : 'Adicionar peças'}</div>
              <div className="text-xs mt-0.5" style={{ color: '#909098' }}>Clique ou arraste vários PNGs de uma vez</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />

            <div className="mt-3 space-y-2">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-[72px_1fr_24px] gap-3 rounded-lg border p-2.5" style={{ borderColor: '#303034', background: '#1D1D1F' }}>
                  <img src={it.url} alt="" className="w-[72px] h-[72px] object-contain rounded" style={{ background: 'repeating-conic-gradient(#ffffff14 0 25%, transparent 0 50%) 0 0/12px 12px' }} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-100 truncate" title={it.name}>{it.name}</div>
                    <div className="flex items-center gap-1.5 text-xs mt-1 flex-wrap" style={{ color: '#909098' }}>
                      Largura
                      <input className="w-16 rounded border px-1.5 py-1 text-zinc-100 outline-none focus:border-[#E7B32C]" style={FIELD} type="number" min={0.5} step={0.1}
                        value={it.widthCm} onChange={(e) => patchItem(it.id, { widthCm: Math.max(0.5, +e.target.value || 0.5) })} /> cm
                      <span>× {fmt(itemH(it), 1)} cm</span>
                    </div>
                    {it.noDpi && <div className="text-[11px] text-amber-500 mt-0.5">Sem DPI no arquivo: confira o tamanho.</div>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs" style={{ color: '#909098' }}>Quantidade</span>
                      <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#303034' }}>
                        <button type="button" className="px-2.5 py-1 text-zinc-300 hover:bg-zinc-700/50" onClick={() => patchItem(it.id, { qty: Math.max(1, it.qty - 1) })}><Minus className="w-3.5 h-3.5" /></button>
                        <input className="w-12 text-center text-sm font-bold text-white outline-none py-1" style={{ background: '#151516' }} type="number" min={1}
                          value={it.qty} onChange={(e) => patchItem(it.id, { qty: Math.max(1, Math.floor(+e.target.value || 1)) })} />
                        <button type="button" className="px-2.5 py-1 text-zinc-300 hover:bg-zinc-700/50" onClick={() => patchItem(it.id, { qty: it.qty + 1 })}><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex rounded-lg border overflow-hidden mt-2" style={{ borderColor: '#303034' }}>
                      {(['none', '180', '360'] as RotMode[]).map((r) => (
                        <button key={r} type="button" onClick={() => patchItem(it.id, { rot: r })}
                          className="flex-1 py-1 text-xs font-medium"
                          style={it.rot === r ? { background: '#E7B32C', color: '#0B0B0C', fontWeight: 700 } : { background: '#151516', color: '#909098' }}>
                          {r === 'none' ? 'Fixa' : `${r}°`}
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: '#909098' }}>{ROT_NOTE[it.rot]}</div>
                  </div>
                  <button type="button" title="Remover" onClick={() => removeItem(it)} className="text-zinc-500 hover:text-red-400 self-start"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-3" style={{ color: '#909098' }}>O tamanho vem do DPI do PNG. Sem DPI no arquivo, assumo 300 dpi: confira a largura.</p>
          </section>

          <div className="sticky bottom-0 py-3" style={{ background: 'linear-gradient(transparent, #0B0B0C 35%)' }}>
            <button type="button" onClick={optimize} disabled={running}
              className="w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#E7B32C', color: '#0B0B0C' }}>
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Otimizando…</> : <><Scissors className="w-4 h-4" /> 3 · Otimizar encaixe</>}
            </button>
          </div>
        </div>

        {/* ───── Coluna direita ───── */}
        <div className="min-w-0 space-y-3">
          {status.text && <div className="text-sm" style={{ color: status.err ? '#f87171' : '#909098' }}>{status.text}</div>}

          {stats && (
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
              <Stat big={`${fmt(stats.len / 100)} m`} label="comprimento de tecido" good />
              <Stat big={`${fmt(stats.util, 1)}%`} label="aproveitamento" />
              <Stat big={`${fmt(stats.waste)} m²`} label="sobra / desperdício" />
              <Stat big={String(stats.n)} label={`peças no rolo de ${fmt(stats.roll, 0)} cm`} />
              <Stat big={`${stats.save > 0 ? '−' : ''}${fmt(Math.abs(stats.save) / 100)} m`} good={stats.save > 0}
                label={`vs. encaixe só por retângulos (${fmt(stats.ref / 100)} m, ${fmt(stats.savePct, 1)}%)`} />
            </div>
          )}

          {(result || running) && (
            <div className="rounded-xl border p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-300" style={CARD}>
              <label className="flex items-center gap-2">Zoom <input type="range" min={0.5} max={4} step={0.1} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-32" /></label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} /> Contornos</label>
              <span className="flex-1" />
              {running && <button type="button" onClick={stop} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#303034' }}><Square className="w-3.5 h-3.5" /> Parar e usar o melhor</button>}
              {result && (
                <>
                  <label className="flex items-center gap-1.5" title="Resolução do PNG. 150 dpi costuma bastar; se o arquivo ficar enorme o dpi é reduzido automaticamente.">
                    Qualidade <input className="w-16 rounded border px-1.5 py-1 outline-none" style={FIELD} type="number" min={30} max={300} value={form.dpi} onChange={(e) => set('dpi', num(e.target.value, 150))} /> dpi
                  </label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Espelhar</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={whiteBg} onChange={(e) => setWhiteBg(e.target.checked)} /> Fundo branco</label>
                  <label className="flex items-center gap-1.5" title="Marcado: mantém o dpi escolhido, mas divide em vários arquivos"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Dividir em partes</label>
                  <button type="button" onClick={doPng} disabled={exporting} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ borderColor: '#303034' }}>
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar PNG
                  </button>
                  <label className="flex items-center gap-1.5" title="Pasta do seu PC onde estão os PNGs originais (mesmos nomes)">
                    Pasta dos PNGs <input className="w-44 rounded border px-1.5 py-1 outline-none" style={FIELD} value={form.pasta} onChange={(e) => set('pasta', e.target.value)} />
                  </label>
                  <button type="button" onClick={doCorel} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
                    <FileCode2 className="w-3.5 h-3.5" /> Script CorelDRAW (qualidade total)
                  </button>
                </>
              )}
            </div>
          )}

          <div ref={viewRef} className="rounded-xl border p-3 overflow-auto" style={{ ...CARD, maxHeight: '75vh' }}>
            {result ? <canvas ref={canvasRef} className="block mx-auto" /> : (
              <div className="py-16 text-center text-sm" style={{ color: '#909098' }}>
                Adicione as peças e clique em <b className="text-zinc-200">Otimizar encaixe</b>.<br />
                O resultado aparece aqui, com o comprimento de tecido necessário.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ big, label, good }: { big: string; label: string; good?: boolean }) {
  return (
    <div className="rounded-xl border p-3" style={CARD}>
      <div className="text-xl font-bold" style={{ color: good ? '#45DB92' : '#F5F5F6' }}>{big}</div>
      <div className="text-[11px] leading-tight mt-0.5" style={{ color: '#909098' }}>{label}</div>
    </div>
  )
}

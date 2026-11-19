import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FileText, Plus, Trash2, Download, Copy, Save, FolderOpen, X } from 'lucide-react'
import {
  brl, fmtData, gerarPdfOrcamento, parseValor, textoWhatsapp, totalOrcamento,
  type Orcamento, type OrcamentoItem,
} from '@/lib/pdfOrcamento'

// Paleta do sistema: fundo #0B0B0C · card #151516 · superfície #1D1D1F · borda #303034 · primária #E7B32C
const CARD = { background: '#151516', borderColor: '#303034' }
const FIELD = { background: '#1D1D1F', borderColor: '#303034' }
const fieldCls = 'w-full rounded-lg border px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#E7B32C]'

const STORE = 'orcamentosArtes'
const SERVICOS = ['Criação de arte', 'Ajuste de arte', 'Vetorização', 'Mockup', 'Arte de goleiro', 'Arte de time completo', 'Alteração de nome/número', 'Pacote de artes']

const hoje = () => {
  const d = new Date() // data local (toISOString usaria UTC e viraria o dia à noite)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
let seq = 1
const novoItem = (): OrcamentoItem => ({ id: Date.now() + seq++, arte: '', servico: '', data: hoje(), valor: '' })

function carregar(): Orcamento[] {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]') } catch { return [] }
}
function proximoNumero(lista: Orcamento[]) { return lista.reduce((m, o) => Math.max(m, o.numero), 0) + 1 }

function novo(lista: Orcamento[]): Orcamento {
  return { id: Date.now(), numero: proximoNumero(lista), cliente: '', whatsapp: '', data: hoje(), obs: '', itens: [novoItem()], criadoEm: new Date().toISOString() }
}

export default function OrcamentosPage() {
  const [lista, setLista] = useState<Orcamento[]>(carregar)
  const [orc, setOrc] = useState<Orcamento>(() => novo(carregar()))

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(lista)) } catch { /* ignora */ } }, [lista])

  const total = useMemo(() => totalOrcamento(orc), [orc])
  const patch = (p: Partial<Orcamento>) => setOrc((o) => ({ ...o, ...p }))
  const patchItem = (id: number, p: Partial<OrcamentoItem>) => setOrc((o) => ({ ...o, itens: o.itens.map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const addItem = () => setOrc((o) => ({ ...o, itens: [...o.itens, novoItem()] }))
  const delItem = (id: number) => setOrc((o) => ({ ...o, itens: o.itens.length > 1 ? o.itens.filter((i) => i.id !== id) : o.itens }))

  function validar(): boolean {
    if (!orc.itens.some((i) => i.arte.trim())) { toast.error('Informe o nome de pelo menos uma arte.'); return false }
    return true
  }
  function salvar() {
    if (!validar()) return
    setLista((l) => (l.some((o) => o.id === orc.id) ? l.map((o) => (o.id === orc.id ? orc : o)) : [orc, ...l]))
    toast.success(`Orçamento Nº ${String(orc.numero).padStart(4, '0')} salvo`)
  }
  function pdf() { if (validar()) gerarPdfOrcamento(orc) }
  async function copiar() {
    if (!validar()) return
    try { await navigator.clipboard.writeText(textoWhatsapp(orc)); toast.success('Texto copiado. É só colar no WhatsApp.') }
    catch { toast.error('Não consegui copiar. Use o PDF.') }
  }
  function novoOrc() { setOrc(novo(lista)) }
  function abrir(o: Orcamento) { setOrc(o); window.scrollTo?.({ top: 0 }) }
  function excluir(o: Orcamento) {
    if (!window.confirm(`Excluir o orçamento Nº ${String(o.numero).padStart(4, '0')}?`)) return
    setLista((l) => l.filter((x) => x.id !== o.id))
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(231,179,44,0.12)' }}>
            <FileText className="w-5 h-5" style={{ color: '#E7B32C' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Orçamentos de Artes</h1>
            <p className="text-xs" style={{ color: '#909098' }}>Monte o orçamento e baixe em PDF ou copie para o WhatsApp.</p>
          </div>
        </div>
        <button type="button" onClick={novoOrc} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-zinc-200" style={{ borderColor: '#303034' }}>
          <Plus className="w-4 h-4" /> Novo orçamento
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] items-start">
        <div className="space-y-3 min-w-0">
          <section className="rounded-xl border p-4" style={CARD}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#909098' }}>Orçamento Nº {String(orc.numero).padStart(4, '0')}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-zinc-400 space-y-1 sm:col-span-1">Cliente
                <input className={fieldCls} style={FIELD} placeholder="Nome do cliente" value={orc.cliente} onChange={(e) => patch({ cliente: e.target.value })} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1">WhatsApp (opcional)
                <input className={fieldCls} style={FIELD} placeholder="(00) 00000-0000" value={orc.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1">Data do orçamento
                <input className={fieldCls} style={FIELD} type="date" value={orc.data} onChange={(e) => patch({ data: e.target.value })} />
              </label>
            </div>
          </section>

          <section className="rounded-xl border p-4" style={CARD}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Artes</h2>
            <datalist id="servicos-lista">{SERVICOS.map((s) => <option key={s} value={s} />)}</datalist>

            <div className="hidden md:grid grid-cols-[1.4fr_1.2fr_150px_130px_36px] gap-2 text-[11px] mb-1.5 px-1" style={{ color: '#909098' }}>
              <span>Nome da arte</span><span>Serviço</span><span>Data</span><span>Valor (R$)</span><span />
            </div>
            <div className="space-y-2">
              {orc.itens.map((i) => (
                <div key={i.id} className="grid gap-2 md:grid-cols-[1.4fr_1.2fr_150px_130px_36px] rounded-lg border p-2 md:p-1.5 md:border-0 md:bg-transparent" style={{ borderColor: '#303034' }}>
                  <input className={fieldCls} style={FIELD} placeholder="Nome da arte" value={i.arte} onChange={(e) => patchItem(i.id, { arte: e.target.value })} />
                  <input className={fieldCls} style={FIELD} list="servicos-lista" placeholder="Serviço" value={i.servico} onChange={(e) => patchItem(i.id, { servico: e.target.value })} />
                  <input className={fieldCls} style={FIELD} type="date" value={i.data} onChange={(e) => patchItem(i.id, { data: e.target.value })} />
                  <input className={fieldCls + ' text-right'} style={FIELD} inputMode="decimal" placeholder="0,00" value={i.valor} onChange={(e) => patchItem(i.id, { valor: e.target.value })} />
                  <button type="button" title="Remover linha" onClick={() => delItem(i.id)} disabled={orc.itens.length === 1}
                    className="flex items-center justify-center text-zinc-500 hover:text-red-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-3 flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#E7B32C' }}>
              <Plus className="w-4 h-4" /> Adicionar arte
            </button>

            <label className="text-xs text-zinc-400 space-y-1 block mt-4">Observações (opcional)
              <textarea className={fieldCls} style={FIELD} rows={2} placeholder="Ex.: validade de 7 dias, pagamento via Pix…" value={orc.obs} onChange={(e) => patch({ obs: e.target.value })} />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: '#303034' }}>
              <div>
                <div className="text-xs" style={{ color: '#909098' }}>Total</div>
                <div className="text-2xl font-bold" style={{ color: '#E7B32C' }}>{brl(total)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copiar} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-zinc-200" style={{ borderColor: '#303034' }}><Copy className="w-4 h-4" /> Copiar p/ WhatsApp</button>
                <button type="button" onClick={salvar} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-zinc-200" style={{ borderColor: '#303034' }}><Save className="w-4 h-4" /> Salvar</button>
                <button type="button" onClick={pdf} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold" style={{ background: '#E7B32C', color: '#0B0B0C' }}><Download className="w-4 h-4" /> Baixar PDF</button>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-xl border p-4 min-w-0" style={CARD}>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#909098' }}>Orçamentos salvos</h2>
          {lista.length === 0 ? (
            <p className="text-sm" style={{ color: '#909098' }}>Nenhum salvo ainda. Clique em <b className="text-zinc-200">Salvar</b> para guardar e reabrir depois.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto">
              {lista.map((o) => (
                <div key={o.id} className="rounded-lg border p-2.5 flex items-start gap-2" style={{ borderColor: '#303034', background: o.id === orc.id ? '#1D1D1F' : 'transparent' }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-100 truncate">Nº {String(o.numero).padStart(4, '0')} · {o.cliente || 'Sem cliente'}</div>
                    <div className="text-xs" style={{ color: '#909098' }}>{fmtData(o.data)} · {o.itens.length} {o.itens.length > 1 ? 'artes' : 'arte'}</div>
                    <div className="text-sm font-bold mt-0.5" style={{ color: '#45DB92' }}>{brl(totalOrcamento(o))}</div>
                  </div>
                  <button type="button" title="Abrir" onClick={() => abrir(o)} className="p-1.5 text-zinc-400 hover:text-white"><FolderOpen className="w-4 h-4" /></button>
                  <button type="button" title="Excluir" onClick={() => excluir(o)} className="p-1.5 text-zinc-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] mt-3" style={{ color: '#909098' }}>Os orçamentos salvos ficam neste navegador. Se limpar os dados do navegador, eles somem; baixe o PDF para guardar.</p>
        </section>
      </div>
    </div>
  )
}

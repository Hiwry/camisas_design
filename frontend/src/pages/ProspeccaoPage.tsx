import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Target, Play, Pause, Plus, Upload, Trash2, MessageSquare, Wifi, WifiOff, QrCode,
  Loader2, AlertTriangle, Save, X, Send, ExternalLink,
} from 'lucide-react'
import {
  prospeccaoService, type Prospecto, type ProspeccaoConfig, type ProspeccaoModelo,
  type ProspeccaoCardResposta,
} from '@/services/api'

const STATUS: Record<string, { label: string; cor: string }> = {
  pendente:     { label: 'Aguardando aprovação', cor: '#f97316' },
  novo:         { label: 'Aprovado (na fila)', cor: '#71717a' },
  em_sequencia: { label: 'Em sequência',  cor: '#3b82f6' },
  respondeu:    { label: 'Respondeu',     cor: '#10b981' },
  interessado:  { label: 'Interessado',   cor: '#E7B32C' },
  cliente:      { label: 'Cliente',       cor: '#8b5cf6' },
  perdido:      { label: 'Perdido',       cor: '#78716c' },
  sem_whatsapp: { label: 'Sem WhatsApp',  cor: '#a16207' },
  descartado:   { label: 'Descartado',    cor: '#52525b' },
  optout:       { label: 'Não chamar',    cor: '#ef4444' },
}
const ETAPA = ['—', 'Inicial', 'Follow-up 1', 'Follow-up 2']
const TIPO_MODELO: Record<string, string> = {
  inicial: 'Mensagem inicial', followup1: 'Follow-up 1', followup2: 'Follow-up 2',
}

function erro(e: unknown, padrao = 'Erro.') {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? padrao
}

const card = { background: '#121213', border: '1px solid #222225' }
const input =
  'w-full rounded-lg px-3 py-2 text-sm text-white bg-[#0B0B0C] border border-[#2a2a2e] focus:outline-none focus:border-[#E7B32C]'

export default function ProspeccaoPage() {
  const qc = useQueryClient()
  const [aba, setAba] = useState<'aprovar' | 'fila' | 'respostas' | 'contatos' | 'modelos' | 'config'>('aprovar')

  const { data: resumo } = useQuery({
    queryKey: ['prosp-resumo'], queryFn: prospeccaoService.resumo, refetchInterval: 10000,
  })
  const { data: pipe } = useQuery({
    queryKey: ['prosp-pipeline'], queryFn: prospeccaoService.pipeline, refetchInterval: 15000,
  })
  const naoLidas = pipe?.metricas.nao_lidas ?? 0

  const ligar = useMutation({
    mutationFn: (ativo: boolean) => prospeccaoService.config({ ativo }),
    onSuccess: (_d, ativo) => {
      toast.success(ativo ? 'Envio automático LIGADO' : 'Envio automático pausado')
      qc.invalidateQueries({ queryKey: ['prosp-resumo'] })
    },
    onError: (e) => toast.error(erro(e, 'Não foi possível alterar.')),
  })

  const ativo = resumo?.config.ativo === true
  const f = resumo?.funil ?? {}

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: 'rgba(231,179,44,0.12)', border: '1px solid rgba(231,179,44,0.3)' }}>
            <Target className="w-4 h-4" style={{ color: '#E7B32C' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Prospecção</h1>
            <p className="text-xs text-zinc-500">Confecções novas · envio automático pelo WhatsApp</p>
          </div>
        </div>
        <button
          onClick={() => ligar.mutate(!ativo)}
          disabled={ligar.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={ativo
            ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
            : { background: '#E7B32C', color: '#0B0B0C' }}
        >
          {ativo ? <><Pause className="w-4 h-4" /> Pausar envio</> : <><Play className="w-4 h-4" /> Ligar envio automático</>}
        </button>
      </div>

      {/* Faixa de estado */}
      {resumo && (
        <div className="rounded-xl px-4 py-3 text-xs flex flex-wrap gap-x-6 gap-y-1"
             style={{ ...card, color: '#a1a1aa' }}>
          <span>Envio: <b style={{ color: ativo ? '#10b981' : '#f87171' }}>{ativo ? 'ligado' : 'desligado'}</b></span>
          <span>Hoje: <b className="text-white">{resumo.enviados_hoje}/{resumo.limite_hoje}</b> mensagens</span>
          <span>Horário: <b className="text-white">{resumo.dentro_horario ? 'dentro da janela' : 'fora da janela'}</b>
            {' '}({resumo.config.hora_inicio}h–{resumo.config.hora_fim}h, seg–sex)</span>
          <span>Total na base: <b className="text-white">{resumo.total}</b></span>
        </div>
      )}

      {/* Funil */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        {Object.entries(STATUS).map(([k, v]) => (
          <div key={k} className="rounded-xl p-3 text-center" style={card}>
            <div className="text-xl font-bold" style={{ color: v.cor }}>{f[k] ?? 0}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{v.label}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b" style={{ borderColor: '#222225' }}>
        {(['aprovar', 'fila', 'respostas', 'contatos', 'modelos', 'config'] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
            style={{
              borderColor: aba === a ? '#E7B32C' : 'transparent',
              color: aba === a ? '#E7B32C' : '#71717a',
            }}>
            {a === 'aprovar' ? `Aprovar contatos${f.pendente ? ` (${f.pendente})` : ''}` : a === 'fila' ? 'Prévia do envio'
              : a === 'respostas' ? <>Respostas e vendas{naoLidas > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#ef4444', color: '#fff' }}>{naoLidas}</span>}</>
              : a === 'contatos' ? 'Contatos' : a === 'modelos' ? 'Mensagens' : 'Conexão e ajustes'}
          </button>
        ))}
      </div>

      {aba === 'aprovar' && <Aprovar total={f.pendente ?? 0} />}
      {aba === 'fila' && <Fila />}
      {aba === 'respostas' && <Respostas />}
      {aba === 'contatos' && <Contatos />}
      {aba === 'modelos' && <Modelos porModelo={resumo?.por_modelo ?? []} />}
      {aba === 'config' && resumo && <Ajustes config={resumo.config} />}
    </div>
  )
}

/* ───────────────────────── Aprovação de contatos ───────────────────────── */

function Aprovar({ total }: { total: number }) {
  const qc = useQueryClient()
  const [pagina, setPagina] = useState(1)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [status, setStatus] = useState<'pendente' | 'novo' | 'descartado'>('pendente')
  const [uf, setUf] = useState('')
  const [cidade, setCidade] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [comNome, setComNome] = useState(false)

  const filtros = { status, uf: uf || undefined, cidade: cidade || undefined, busca: buscaAplicada || undefined, com_nome: comNome ? 1 : undefined }
  const mudarFiltro = (fn: () => void) => { fn(); setPagina(1); setSel(new Set()) }

  const { data: opcoes } = useQuery({
    queryKey: ['prosp-filtros', status, uf],
    queryFn: () => prospeccaoService.filtros({ status, uf: uf || undefined }),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['prosp-pendentes', filtros, pagina],
    queryFn: () => prospeccaoService.listar({ ...filtros, page: pagina, por_pagina: 50 }),
  })
  const linhas: Prospecto[] = data?.data ?? []
  const totalFiltrado: number = data?.total ?? 0
  const rotuloStatus = { pendente: 'aguardando', novo: 'aprovado(s)', descartado: 'rejeitado(s)' }[status]

  const acao = useMutation({
    mutationFn: (p: { acao: 'aprovar' | 'rejeitar' | 'pendente'; ids?: number[]; todos?: boolean }) =>
      prospeccaoService.aprovar({ ...p, filtros }),
    onSuccess: (r) => {
      toast.success(`${r.atualizados} contato(s) ${r.acao === 'aprovar' ? 'aprovados' : r.acao === 'rejeitar' ? 'rejeitados' : 'devolvidos para aguardando'}`)
      setSel(new Set())
      qc.invalidateQueries({ queryKey: ['prosp-pendentes'] })
      qc.invalidateQueries({ queryKey: ['prosp-resumo'] })
      qc.invalidateQueries({ queryKey: ['prosp-fila'] })
      qc.invalidateQueries({ queryKey: ['prosp-lista'] })
    },
    onError: (e) => toast.error(erro(e, 'Não foi possível atualizar.')),
  })

  const todosMarcados = linhas.length > 0 && linhas.every((l) => sel.has(l.id))
  const alternar = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const marcarPagina = () => setSel(todosMarcados ? new Set() : new Set(linhas.map((l) => l.id)))

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 text-xs leading-relaxed" style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', color: '#a1a1aa' }}>
        Nenhuma mensagem sai para um contato <b className="text-orange-300">sem a sua aprovação</b>. Marque quem pode receber e clique em
        <b className="text-white"> Aprovar</b>: eles vão para a aba "Prévia do envio", onde você vê a mensagem de cada um.
        Quem você rejeitar nunca será chamado.
      </div>

      {/* Filtros */}
      <div className="rounded-xl p-3 space-y-3" style={card}>
        <div className="flex flex-wrap items-center gap-2">
          {([['pendente', 'Aguardando aprovação'], ['novo', 'Aprovados'], ['descartado', 'Rejeitados']] as const).map(([k, rot]) => (
            <button key={k} onClick={() => mudarFiltro(() => setStatus(k))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                    style={status === k ? { background: '#E7B32C', color: '#0B0B0C', borderColor: '#E7B32C' } : { color: '#a1a1aa', borderColor: '#2a2a2e' }}>
              {rot}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={uf} onChange={(e) => mudarFiltro(() => { setUf(e.target.value); setCidade('') })}
                  className="px-3 py-2 rounded-lg text-xs bg-[#0B0B0C] text-zinc-200 border border-[#2a2a2e]">
            <option value="">Todos os estados</option>
            {(opcoes?.ufs ?? []).map((u) => <option key={u.uf} value={u.uf}>{u.uf} ({u.total})</option>)}
          </select>
          <select value={cidade} disabled={!uf} onChange={(e) => mudarFiltro(() => setCidade(e.target.value))}
                  className="px-3 py-2 rounded-lg text-xs bg-[#0B0B0C] text-zinc-200 border border-[#2a2a2e] disabled:opacity-40 max-w-[220px]">
            <option value="">{uf ? 'Todas as cidades' : 'Escolha um estado'}</option>
            {(opcoes?.cidades ?? []).map((c) => <option key={c.cidade} value={c.cidade}>{c.cidade} ({c.total})</option>)}
          </select>
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); mudarFiltro(() => setBuscaAplicada(busca.trim())) }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, cidade ou telefone"
                   className="px-3 py-2 rounded-lg text-xs bg-[#0B0B0C] text-zinc-200 border border-[#2a2a2e] w-60" />
            <button type="submit" className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-200 border border-[#2a2a2e]">Buscar</button>
          </form>
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={comNome} onChange={(e) => mudarFiltro(() => setComNome(e.target.checked))} />
            Só com nome da marca
          </label>
          {(uf || cidade || buscaAplicada || comNome) && (
            <button onClick={() => mudarFiltro(() => { setUf(''); setCidade(''); setBusca(''); setBuscaAplicada(''); setComNome(false) })}
                    className="text-xs text-amber-400 hover:underline">Limpar filtros</button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={marcarPagina} className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-200 border border-[#2a2a2e] hover:bg-zinc-800/60">
          {todosMarcados ? 'Desmarcar página' : 'Marcar página'}
        </button>
        <span className="text-xs text-zinc-500">{sel.size} selecionado(s) · {totalFiltrado} {rotuloStatus} neste filtro</span>
        <div className="flex-1" />
        {status === 'pendente' && (
          <button disabled={sel.size === 0 || acao.isPending} onClick={() => acao.mutate({ acao: 'rejeitar', ids: [...sel] })}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 disabled:opacity-30">
            Rejeitar selecionados
          </button>
        )}
        {status !== 'pendente' && (
          <button disabled={sel.size === 0 || acao.isPending} onClick={() => acao.mutate({ acao: 'pendente', ids: [...sel] })}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-200 border border-[#2a2a2e] disabled:opacity-30">
            Voltar p/ aguardando
          </button>
        )}
        {status === 'novo' && (
          <button disabled={sel.size === 0 || acao.isPending} onClick={() => acao.mutate({ acao: 'rejeitar', ids: [...sel] })}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 disabled:opacity-30">
            Rejeitar selecionados
          </button>
        )}
        {status !== 'novo' && (
          <button disabled={sel.size === 0 || acao.isPending} onClick={() => acao.mutate({ acao: 'aprovar', ids: [...sel] })}
                  className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-30" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
            Aprovar selecionados
          </button>
        )}
        {status === 'pendente' && (
          <button disabled={totalFiltrado === 0 || acao.isPending}
                  onClick={() => confirm(`Aprovar TODOS os ${totalFiltrado} contatos deste filtro (inclusive de outras páginas)?`) && acao.mutate({ acao: 'aprovar', todos: true })}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-200 border border-[#2a2a2e] disabled:opacity-30">
            Aprovar todos do filtro ({totalFiltrado})
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-x-auto" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b" style={{ borderColor: '#222225' }}>
              <th className="px-4 py-3 w-8" /><th className="px-4 py-3">Marca</th><th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Local</th><th className="px-4 py-3">Aberta em</th><th className="px-4 py-3">Origem</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-zinc-500" /></td></tr>}
            {!isLoading && linhas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-xs">
                {status === 'pendente' && !uf && !cidade && !buscaAplicada && !comNome
                  ? 'Nenhum contato aguardando aprovação. Importe da Receita, cole uma lista ou adicione na aba Contatos.'
                  : 'Nenhum contato encontrado com esses filtros.'}
              </td></tr>
            )}
            {linhas.map((p) => (
              <tr key={p.id} onClick={() => alternar(p.id)} className="border-b last:border-0 cursor-pointer hover:bg-white/[0.02]"
                  style={{ borderColor: '#1c1c1f', background: sel.has(p.id) ? 'rgba(231,179,44,0.06)' : undefined }}>
                <td className="px-4 py-2.5"><input type="checkbox" checked={sel.has(p.id)} onChange={() => alternar(p.id)} onClick={(e) => e.stopPropagation()} /></td>
                <td className="px-4 py-2.5 text-white font-medium">{p.nome || 'Sem nome'}</td>
                <td className="px-4 py-2.5 text-zinc-400">{p.telefone}</td>
                <td className="px-4 py-2.5 text-zinc-400">{[p.cidade, p.uf].filter(Boolean).join(' / ') || '—'}</td>
                <td className="px-4 py-2.5 text-zinc-400">{p.data_abertura ?? '—'}</td>
                <td className="px-4 py-2.5 text-zinc-500 text-xs">{p.origem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
          <button disabled={pagina <= 1} onClick={() => { setPagina(pagina - 1); setSel(new Set()) }} className="px-3 py-1.5 rounded-md border border-[#2a2a2e] disabled:opacity-30">Anterior</button>
          <span>{pagina} / {data.last_page}</span>
          <button disabled={pagina >= data.last_page} onClick={() => { setPagina(pagina + 1); setSel(new Set()) }} className="px-3 py-1.5 rounded-md border border-[#2a2a2e] disabled:opacity-30">Próxima</button>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Prévia da fila ───────────────────────── */

const TIPO_FILA: Record<string, { label: string; cor: string }> = {
  inicial:   { label: 'Mensagem inicial', cor: '#E7B32C' },
  followup1: { label: 'Follow-up 1',      cor: '#3b82f6' },
  followup2: { label: 'Follow-up 2',      cor: '#8b5cf6' },
}

function Fila() {
  const qc = useQueryClient()
  const [limite, setLimite] = useState(20)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['prosp-fila', limite], queryFn: () => prospeccaoService.fila(limite),
  })
  const pular = useMutation({
    mutationFn: (id: number) => prospeccaoService.atualizar(id, { status: 'descartado' }),
    onSuccess: () => {
      toast.success('Contato removido da fila')
      qc.invalidateQueries({ queryKey: ['prosp-fila'] })
      qc.invalidateQueries({ queryKey: ['prosp-resumo'] })
    },
  })

  const fila = data?.fila ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <span>
          Próximos envios, na ordem real. Hoje: <b className="text-white">{data?.enviados_hoje ?? 0}/{data?.limite_hoje ?? 0}</b>.
          As mensagens <b className="text-zinc-300">alternam</b> entre os modelos ativos (A, B, C…), então a mesma quantidade sai de cada um.
        </span>
        <div className="flex-1" />
        <select className={input + ' max-w-[110px]'} value={limite} onChange={(e) => setLimite(Number(e.target.value))}>
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} contatos</option>)}
        </select>
        <button onClick={() => refetch()} className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-200 border border-[#2a2a2e] hover:bg-zinc-800/60">
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Atualizar'}
        </button>
      </div>
      <p className="text-[11px] text-zinc-600">
        O texto mostrado é uma amostra: trechos como [Opa|Oi|Olá] são sorteados no momento do envio. O número só é conferido no WhatsApp na hora de enviar.
      </p>

      {isLoading && <div className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin inline text-zinc-500" /></div>}
      {!isLoading && fila.length === 0 && (
        <div className="rounded-xl p-8 text-center text-xs text-zinc-500" style={card}>
          Fila vazia. Adicione contatos, cole uma lista ou importe da Receita.
        </div>
      )}

      {fila.map((it, i) => {
        const t = TIPO_FILA[it.tipo]
        return (
          <div key={`${it.tipo}-${it.id}`} className="rounded-xl p-4 space-y-2" style={card}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 w-6">#{i + 1}</span>
              <span className="text-sm font-semibold text-white">{it.nome || 'Sem nome'}</span>
              <span className="text-[11px] text-zinc-500">{it.telefone} · {[it.cidade, it.uf].filter(Boolean).join(' / ') || '—'}</span>
              <div className="flex-1" />
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${t.cor}1f`, color: t.cor }}>{t.label}</span>
              {it.modelo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">Modelo: {it.modelo}</span>}
              <button onClick={() => pular.mutate(it.id)} title="Não enviar para este contato"
                      className="p-1.5 text-zinc-500 hover:text-red-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap" style={{ background: 'rgba(231,179,44,0.07)', color: '#d4d4d8' }}>
              {it.mensagem ?? 'Nenhum modelo ativo para este tipo. Ative um na aba Mensagens.'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── Contatos ───────────────────────── */

function Contatos() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [painel, setPainel] = useState<'' | 'novo' | 'lista'>('')
  const [form, setForm] = useState({ nome: '', telefone: '', cidade: '', uf: '' })
  const [lista, setLista] = useState('')
  const [conversa, setConversa] = useState<Prospecto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['prosp-lista', status, busca, pagina],
    queryFn: () => prospeccaoService.listar({ status: status || undefined, busca: busca || undefined, page: pagina }),
  })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['prosp-lista'] })
    qc.invalidateQueries({ queryKey: ['prosp-resumo'] })
  }

  const criar = useMutation({
    mutationFn: () => prospeccaoService.criar(form),
    onSuccess: () => { toast.success('Contato adicionado'); setForm({ nome: '', telefone: '', cidade: '', uf: '' }); setPainel(''); refrescar() },
    onError: (e) => toast.error(erro(e, 'Não foi possível adicionar.')),
  })
  const importar = useMutation({
    mutationFn: () => prospeccaoService.importarLista(lista),
    onSuccess: (r) => {
      toast.success(`${r.importados} importados · ${r.duplicados} repetidos · ${r.invalidos} inválidos`)
      setLista(''); setPainel(''); refrescar()
    },
    onError: (e) => toast.error(erro(e, 'Erro ao importar.')),
  })
  const mudar = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => prospeccaoService.atualizar(id, { status }),
    onSuccess: refrescar,
  })
  const excluir = useMutation({
    mutationFn: (id: number) => prospeccaoService.excluir(id),
    onSuccess: refrescar,
  })

  const linhas: Prospecto[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input className={input + ' max-w-xs'} placeholder="Buscar nome, cidade ou telefone"
               value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} />
        <select className={input + ' max-w-[170px]'} value={status}
                onChange={(e) => { setStatus(e.target.value); setPagina(1) }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => setPainel(painel === 'novo' ? '' : 'novo')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-200 border border-[#2a2a2e] hover:bg-zinc-800/60">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
        <button onClick={() => setPainel(painel === 'lista' ? '' : 'lista')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-200 border border-[#2a2a2e] hover:bg-zinc-800/60">
          <Upload className="w-3.5 h-3.5" /> Colar lista
        </button>
      </div>

      {painel === 'novo' && (
        <div className="rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end" style={card}>
          <input className={input} placeholder="Nome da marca" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className={input} placeholder="Celular com DDD *" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <input className={input} placeholder="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          <input className={input} placeholder="UF" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} />
          <button onClick={() => criar.mutate()} disabled={criar.isPending || !form.telefone}
                  className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
            Salvar
          </button>
        </div>
      )}

      {painel === 'lista' && (
        <div className="rounded-xl p-4 space-y-2" style={card}>
          <p className="text-xs text-zinc-500">
            Uma por linha: <code className="text-zinc-300">nome;celular;cidade;uf</code> (ou só o celular). Fixos e repetidos são ignorados.
          </p>
          <textarea className={input + ' h-32 font-mono'} value={lista} onChange={(e) => setLista(e.target.value)}
                    placeholder={'Fire Moda;82 99912-3456;Maceió;AL\n(81) 98888-7777'} />
          <button onClick={() => importar.mutate()} disabled={importar.isPending || !lista.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
            Importar
          </button>
        </div>
      )}

      <div className="rounded-xl overflow-x-auto" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b" style={{ borderColor: '#222225' }}>
              <th className="px-4 py-3">Marca</th><th className="px-4 py-3">Local</th>
              <th className="px-4 py-3">Aberta em</th><th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Status</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {!isLoading && linhas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-xs">
                Nenhum contato. Adicione, cole uma lista ou importe da Receita (veja "Conexão e ajustes").
              </td></tr>
            )}
            {linhas.map((p) => (
              <tr key={p.id} className="border-b last:border-0" style={{ borderColor: '#1c1c1f' }}>
                <td className="px-4 py-2.5">
                  <div className="text-white font-medium">{p.nome || 'Sem nome'}</div>
                  <div className="text-[11px] text-zinc-500">{p.telefone}</div>
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{[p.cidade, p.uf].filter(Boolean).join(' / ') || '—'}</td>
                <td className="px-4 py-2.5 text-zinc-400">{p.data_abertura ?? '—'}</td>
                <td className="px-4 py-2.5 text-zinc-400">{ETAPA[p.etapa] ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <select value={p.status} onChange={(e) => mudar.mutate({ id: p.id, status: e.target.value })}
                          className="rounded-md px-2 py-1 text-xs bg-[#0B0B0C] border border-[#2a2a2e] focus:outline-none"
                          style={{ color: STATUS[p.status]?.cor ?? '#fff' }}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button title="Ver conversa" onClick={() => setConversa(p)} className="p-1.5 text-zinc-500 hover:text-white"><MessageSquare className="w-4 h-4" /></button>
                  <button title="Remover" onClick={() => confirm('Remover este contato?') && excluir.mutate(p.id)} className="p-1.5 text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
          <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="px-3 py-1.5 rounded-md border border-[#2a2a2e] disabled:opacity-30">Anterior</button>
          <span>{pagina} / {data.last_page}</span>
          <button disabled={pagina >= data.last_page} onClick={() => setPagina(pagina + 1)} className="px-3 py-1.5 rounded-md border border-[#2a2a2e] disabled:opacity-30">Próxima</button>
        </div>
      )}

      {conversa && <Conversa p={conversa} onClose={() => setConversa(null)} />}
    </div>
  )
}

/* ───────────────────────── Atendimento (conversa + controle de venda) ───────────────────────── */

type ContatoBase = Pick<Prospecto, 'id' | 'nome' | 'telefone' | 'cidade' | 'uf' | 'status' | 'notas'> & {
  nao_lida?: boolean; valor_fechado?: number | null; motivo_perda?: string | null; proximo_contato_em?: string | null
}

const ETAPAS_VENDA: { k: string; rot: string }[] = [
  { k: 'respondeu', rot: 'Respondeu' }, { k: 'interessado', rot: 'Interessado' },
  { k: 'cliente', rot: 'Virou cliente' }, { k: 'perdido', rot: 'Perdido' }, { k: 'optout', rot: 'Não chamar' },
]
const MOTIVOS_PERDA = ['Já tem designer', 'Faz a arte internamente', 'Sem interesse', 'Achou caro', 'Parou de responder', 'Outro']

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function tempoRelativo(iso: string | null | undefined) {
  if (!iso) return ''
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.round(min / 60)} h`
  return `${Math.round(min / 1440)} d`
}

function Conversa({ p, onClose }: { p: ContatoBase; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(p.status)
  const [notas, setNotas] = useState(p.notas ?? '')
  const [valor, setValor] = useState(p.valor_fechado != null ? String(p.valor_fechado) : '')
  const [motivo, setMotivo] = useState(p.motivo_perda ?? '')
  const [retorno, setRetorno] = useState(p.proximo_contato_em ?? '')
  const [texto, setTexto] = useState('')

  const { data } = useQuery({
    queryKey: ['prosp-msgs', p.id], queryFn: () => prospeccaoService.mensagens(p.id), refetchInterval: 8000,
  })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['prosp-pipeline'] })
    qc.invalidateQueries({ queryKey: ['prosp-resumo'] })
    qc.invalidateQueries({ queryKey: ['prosp-lista'] })
  }

  // Abrir a conversa marca como lida.
  useQuery({
    queryKey: ['prosp-lida', p.id],
    queryFn: async () => { if (p.nao_lida) { await prospeccaoService.atualizar(p.id, { nao_lida: false }); refrescar() } return true },
    staleTime: Infinity,
  })

  const salvar = useMutation({
    mutationFn: () => prospeccaoService.atualizar(p.id, {
      status,
      notas: notas.trim() || null,
      valor_fechado: status === 'cliente' && valor !== '' ? Number(valor.replace(',', '.')) : null,
      motivo_perda: status === 'perdido' ? (motivo || null) : null,
      proximo_contato_em: retorno || null,
    }),
    onSuccess: () => { toast.success('Salvo'); refrescar() },
    onError: (e) => toast.error(erro(e, 'Não foi possível salvar.')),
  })

  const responder = useMutation({
    mutationFn: () => prospeccaoService.responder(p.id, texto.trim()),
    onSuccess: () => { setTexto(''); qc.invalidateQueries({ queryKey: ['prosp-msgs', p.id] }); refrescar() },
    onError: (e) => toast.error(erro(e, 'Não foi possível enviar.')),
  })

  const msgs: { id: number; direcao: string; tipo: string; texto: string; ok: boolean; created_at: string }[] = data ?? []
  const wa = p.telefone ? `https://wa.me/${p.telefone.replace(/\D/g, '')}` : null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[88vh] rounded-xl overflow-hidden grid md:grid-cols-[1fr_300px]" style={card} onClick={(e) => e.stopPropagation()}>
        {/* Conversa */}
        <div className="flex flex-col min-h-0 min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#222225' }}>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{p.nome || p.telefone}</h3>
              <p className="text-[11px] text-zinc-500">{[p.cidade, p.uf].filter(Boolean).join(' / ')} · {p.telefone}</p>
            </div>
            <div className="flex items-center gap-2">
              {wa && <a href={wa} target="_blank" rel="noreferrer" title="Abrir no WhatsApp" className="text-zinc-500 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
              <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
            {msgs.length === 0 && <p className="text-xs text-zinc-500">Nenhuma mensagem ainda.</p>}
            {msgs.map((m) => (
              <div key={m.id} className={m.direcao === 'saida' ? 'text-right' : 'text-left'}>
                <div className="inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap text-left"
                     style={{ background: m.direcao === 'saida' ? 'rgba(231,179,44,0.12)' : '#1c1c1f', color: m.ok ? '#e4e4e7' : '#f87171' }}>
                  {m.texto}
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  {new Date(m.created_at).toLocaleString('pt-BR')}{m.tipo === 'manual' && ' · você'}{!m.ok && ' · falhou'}
                </div>
              </div>
            ))}
          </div>
          {status !== 'optout' && (
            <div className="p-3 border-t flex gap-2 items-end" style={{ borderColor: '#222225' }}>
              <textarea className={input + ' h-16 resize-none'} placeholder="Responder pelo WhatsApp…" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <button onClick={() => responder.mutate()} disabled={!texto.trim() || responder.isPending}
                      className="p-2.5 rounded-lg disabled:opacity-40" style={{ background: '#E7B32C', color: '#0B0B0C' }} title="Enviar">
                {responder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Controle da venda */}
        <div className="p-4 space-y-3 overflow-y-auto border-t md:border-t-0 md:border-l" style={{ borderColor: '#222225' }}>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5">Etapa</div>
            <div className="flex flex-wrap gap-1.5">
              {ETAPAS_VENDA.map((e) => (
                <button key={e.k} onClick={() => setStatus(e.k)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                        style={status === e.k
                          ? { background: STATUS[e.k].cor, color: '#0B0B0C', borderColor: STATUS[e.k].cor }
                          : { color: '#a1a1aa', borderColor: '#2a2a2e' }}>
                  {e.rot}
                </button>
              ))}
            </div>
          </div>
          {status === 'cliente' && (
            <label className="block text-[11px] text-zinc-500">Valor fechado (R$)
              <input className={input + ' mt-1'} inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            </label>
          )}
          {status === 'perdido' && (
            <label className="block text-[11px] text-zinc-500">Motivo
              <select className={input + ' mt-1'} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="">Selecione…</option>
                {MOTIVOS_PERDA.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          )}
          <label className="block text-[11px] text-zinc-500">Voltar a falar em
            <input type="date" className={input + ' mt-1'} value={retorno} onChange={(e) => setRetorno(e.target.value)} />
          </label>
          <label className="block text-[11px] text-zinc-500">Anotações
            <textarea className={input + ' mt-1 h-24'} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ex.: quer 3 estampas, pediu orçamento…" />
          </label>
          <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: '#E7B32C', color: '#0B0B0C' }}>
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Respostas e vendas ───────────────────────── */

const COLUNAS_RESP: { k: 'respondeu' | 'interessado' | 'cliente' | 'perdido'; rot: string }[] = [
  { k: 'respondeu', rot: 'Responderam' }, { k: 'interessado', rot: 'Interessados' },
  { k: 'cliente', rot: 'Clientes' }, { k: 'perdido', rot: 'Perdidos' },
]

function Respostas() {
  const [aberto, setAberto] = useState<ProspeccaoCardResposta | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['prosp-pipeline'], queryFn: prospeccaoService.pipeline, refetchInterval: 15000,
  })

  if (isLoading || !data) return <div className="py-10 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-zinc-500" /></div>
  const m = data.metricas
  const kpis: { rot: string; val: string; sub?: string; cor: string }[] = [
    { rot: 'Mensagens iniciais', val: String(m.enviados), cor: '#a1a1aa' },
    { rot: 'Responderam', val: String(m.responderam), sub: m.taxa_resposta != null ? `${m.taxa_resposta}% dos enviados` : undefined, cor: '#10b981' },
    { rot: 'Interessados', val: String(m.interessados), sub: 'inclui clientes', cor: '#E7B32C' },
    { rot: 'Clientes', val: String(m.clientes), sub: m.taxa_conversao != null ? `${m.taxa_conversao}% dos enviados` : undefined, cor: '#8b5cf6' },
    { rot: 'Valor fechado', val: brl(m.valor_total), sub: m.clientes > 0 ? `ticket ${brl(m.valor_total / m.clientes)}` : undefined, cor: '#22c55e' },
    { rot: 'Retornos de hoje', val: String(m.retornos_hoje), sub: m.nao_lidas > 0 ? `${m.nao_lidas} não lida(s)` : undefined, cor: m.retornos_hoje > 0 ? '#f97316' : '#71717a' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {kpis.map((k) => (
          <div key={k.rot} className="rounded-xl p-3" style={card}>
            <div className="text-lg font-bold truncate" style={{ color: k.cor }}>{k.val}</div>
            <div className="text-[11px] text-zinc-400">{k.rot}</div>
            {k.sub && <div className="text-[10px] text-zinc-600 mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      {m.responderam === 0 && (
        <p className="text-xs text-zinc-500 rounded-xl p-4" style={card}>
          Ainda não há respostas. Quando alguém responder, o contato aparece aqui na hora (com um aviso vermelho) — e você pode
          conversar, marcar como interessado, registrar a venda e ver quanto cada mensagem converteu.
          Para as respostas chegarem, o WhatsApp precisa estar conectado e "Ligar respostas" ativado em <b className="text-zinc-300">Conexão e ajustes</b>.
        </p>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
        {COLUNAS_RESP.map(({ k, rot }) => {
          const col = data.colunas[k]
          return (
            <div key={k} className="rounded-xl p-2.5 space-y-2" style={{ background: '#0f0f10', border: '1px solid #1c1c1f' }}>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold" style={{ color: STATUS[k].cor }}>{rot}</span>
                <span className="text-[11px] text-zinc-500">{col.total}</span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {col.itens.length === 0 && <p className="text-[11px] text-zinc-600 px-1 py-3">Nenhum por aqui.</p>}
                {col.itens.map((c) => (
                  <button key={c.id} onClick={() => setAberto(c)} className="w-full text-left rounded-lg p-2.5 hover:bg-white/[0.03]"
                          style={{ background: '#121213', border: `1px solid ${c.nao_lida ? 'rgba(239,68,68,0.5)' : '#222225'}` }}>
                    <div className="flex items-center gap-1.5">
                      {c.nao_lida && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                      <span className="text-sm font-medium text-white truncate">{c.nome || c.telefone}</span>
                      <span className="ml-auto text-[10px] text-zinc-600 shrink-0">{tempoRelativo(c.ultima_em)}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500">{[c.cidade, c.uf].filter(Boolean).join(' / ')}</div>
                    {c.ultima_texto && (
                      <div className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                        {c.ultima_direcao === 'saida' ? <span className="text-zinc-600">Você: </span> : null}{c.ultima_texto}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.valor_fechado != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{brl(c.valor_fechado)}</span>}
                      {c.motivo_perda && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{c.motivo_perda}</span>}
                      {c.proximo_contato_em && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300">voltar {new Date(c.proximo_contato_em + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </button>
                ))}
                {col.total > col.itens.length && <p className="text-[10px] text-zinc-600 text-center">mostrando os {col.itens.length} mais recentes</p>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <TabelaDesempenho titulo="Qual mensagem converte mais" colunaNome="Mensagem" linhas={data.por_modelo.map((r) => ({ nome: r.modelo, ...r }))} />
        <TabelaDesempenho titulo="Onde mais responde (top estados)" colunaNome="Estado" linhas={data.por_uf.map((r) => ({ nome: r.uf, ...r }))} />
      </div>

      {data.motivos_perda.length > 0 && (
        <div className="rounded-xl p-4" style={card}>
          <div className="text-xs font-semibold text-zinc-300 mb-2">Por que perdi</div>
          <div className="flex flex-wrap gap-2">
            {data.motivos_perda.map((x) => (
              <span key={x.motivo_perda} className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">{x.motivo_perda} · {x.total}</span>
            ))}
          </div>
        </div>
      )}

      {aberto && <Conversa p={aberto} onClose={() => setAberto(null)} />}
    </div>
  )
}

function TabelaDesempenho({ titulo, colunaNome, linhas }: {
  titulo: string; colunaNome: string
  linhas: { nome: string; enviados: number; respostas: number; clientes: number; valor: number; taxa: number | null }[]
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={card}>
      <div className="px-4 py-3 text-xs font-semibold text-zinc-300 border-b" style={{ borderColor: '#222225' }}>{titulo}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-2">{colunaNome}</th><th className="px-2 py-2 text-right">Env.</th><th className="px-2 py-2 text-right">Resp.</th>
            <th className="px-2 py-2 text-right">%</th><th className="px-2 py-2 text-right">Clientes</th><th className="px-4 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && <tr><td colSpan={6} className="px-4 py-5 text-center text-zinc-600">Sem envios ainda.</td></tr>}
          {linhas.map((r) => (
            <tr key={r.nome} className="border-t" style={{ borderColor: '#1c1c1f' }}>
              <td className="px-4 py-2 text-zinc-200">{r.nome}</td>
              <td className="px-2 py-2 text-right text-zinc-400">{r.enviados}</td>
              <td className="px-2 py-2 text-right text-zinc-400">{r.respostas}</td>
              <td className="px-2 py-2 text-right text-emerald-400">{r.taxa ?? 0}%</td>
              <td className="px-2 py-2 text-right text-zinc-300">{r.clientes}</td>
              <td className="px-4 py-2 text-right text-zinc-400">{r.valor > 0 ? brl(r.valor) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───────────────────────── Modelos ───────────────────────── */

function Modelos({ porModelo }: { porModelo: { id: number; nome: string; enviados: number; respostas: number; taxa: number | null }[] }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['prosp-modelos'], queryFn: prospeccaoService.modelos })
  const [edit, setEdit] = useState<Record<number, string>>({})

  const salvar = useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Partial<ProspeccaoModelo>) => prospeccaoService.atualizarModelo(id, d),
    onSuccess: () => { toast.success('Salvo'); qc.invalidateQueries({ queryKey: ['prosp-modelos'] }) },
    onError: (e) => toast.error(erro(e, 'Erro ao salvar.')),
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 leading-relaxed">
        Variáveis: <code className="text-zinc-300">{'{a_marca}'}</code> (a Fire / a sua confecção),{' '}
        <code className="text-zinc-300">{'{da_marca}'}</code>, <code className="text-zinc-300">{'{meu_nome}'}</code>,{' '}
        <code className="text-zinc-300">{'{cidade}'}</code>. Variações sorteadas:{' '}
        <code className="text-zinc-300">[Opa|Oi|Olá]</code>. Os modelos ativos <b className="text-zinc-300">alternam</b> (cada contato recebe o próximo da rodada),
        e cada card mostra qual gera mais resposta. Desmarque "ativo" para tirar um da rotação.
      </p>
      {(data ?? []).map((m) => {
        const stat = porModelo.find((x) => x.id === m.id)
        const texto = edit[m.id] ?? m.texto
        return (
          <div key={m.id} className="rounded-xl p-4 space-y-2" style={{ ...card, opacity: m.ativo ? 1 : 0.55 }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-white">{m.nome}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{TIPO_MODELO[m.tipo]}</span>
              {stat && stat.enviados > 0 && (
                <span className="text-[11px] text-zinc-500">
                  {stat.enviados} enviadas · {stat.respostas} respostas · <b className="text-emerald-400">{stat.taxa}%</b>
                </span>
              )}
              <div className="flex-1" />
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={m.ativo} onChange={(e) => salvar.mutate({ id: m.id, ativo: e.target.checked })} /> ativo
              </label>
            </div>
            <textarea className={input + ' h-32'} value={texto} onChange={(e) => setEdit({ ...edit, [m.id]: e.target.value })} />
            {edit[m.id] !== undefined && edit[m.id] !== m.texto && (
              <button onClick={() => { salvar.mutate({ id: m.id, texto: edit[m.id] }); setEdit((s) => { const n = { ...s }; delete n[m.id]; return n }) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
                <Save className="w-3.5 h-3.5" /> Salvar texto
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── Conexão e ajustes ───────────────────────── */

function Ajustes({ config }: { config: ProspeccaoConfig }) {
  const qc = useQueryClient()
  const [f, setF] = useState<ProspeccaoConfig>(config)

  const { data: st } = useQuery({ queryKey: ['prosp-wa'], queryFn: prospeccaoService.waStatus, refetchInterval: 5000 })
  const { data: qr, refetch: gerarQr, isFetching } = useQuery({
    queryKey: ['prosp-qr'], queryFn: prospeccaoService.waQrcode,
    enabled: st?.configurado === true && !st?.conectado, refetchOnWindowFocus: false, retry: 1,
  })

  const salvar = useMutation({
    mutationFn: () => prospeccaoService.config({
      meu_nome: f.meu_nome, limite_max_dia: f.limite_max_dia, limite_inicial_dia: f.limite_inicial_dia,
      aquecimento_passo: f.aquecimento_passo, hora_inicio: f.hora_inicio, hora_fim: f.hora_fim,
      intervalo_min_seg: f.intervalo_min_seg, intervalo_max_seg: f.intervalo_max_seg,
      dias_followup_1: f.dias_followup_1, dias_followup_2: f.dias_followup_2,
    }),
    onSuccess: () => { toast.success('Ajustes salvos'); qc.invalidateQueries({ queryKey: ['prosp-resumo'] }) },
    onError: (e) => toast.error(erro(e, 'Erro ao salvar.')),
  })
  const webhook = useMutation({
    mutationFn: prospeccaoService.waWebhook,
    onSuccess: (r) => (r.success ? toast.success('Respostas ligadas ao CRM') : toast.error('Falha ao configurar o webhook')),
  })
  const desconectar = useMutation({
    mutationFn: prospeccaoService.waDesconectar,
    onSuccess: () => { toast.success('Desconectado e envio pausado'); qc.invalidateQueries({ queryKey: ['prosp-wa'] }); qc.invalidateQueries({ queryKey: ['prosp-resumo'] }) },
  })

  const num = (k: keyof ProspeccaoConfig, label: string, suf = '') => (
    <label className="text-xs text-zinc-400 space-y-1 block">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input type="number" className={input} value={f[k] as number}
               onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
        {suf && <span className="text-zinc-600">{suf}</span>}
      </div>
    </label>
  )

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-xl p-4 text-xs leading-relaxed flex gap-3"
           style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: '#a1a1aa' }}>
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          Use um <b className="text-amber-300">chip/número separado</b> do atendimento. Mensagem para quem não te conhece
          pode levar ao banimento do número. Por isso o sistema começa devagar (aquecimento), respeita horário comercial,
          confere se o número tem WhatsApp, varia o texto e pausa sozinho se começar a falhar.
        </div>
      </div>

      {/* Conexão */}
      <div className="rounded-xl p-5 space-y-3" style={card}>
        <div className="flex items-center gap-3">
          {st?.conectado ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
          <div>
            <div className="text-sm font-semibold text-white">
              {st?.configurado === false ? 'Evolution API não configurada' : st?.conectado ? 'WhatsApp de prospecção conectado' : 'WhatsApp de prospecção desconectado'}
            </div>
            <div className="text-[11px] text-zinc-500">Instância: {st?.instance ?? 'prospeccao'}{st?.perfil ? ` · ${st.perfil}` : ''}</div>
          </div>
          <div className="flex-1" />
          {st?.conectado && (
            <>
              <button onClick={() => webhook.mutate()} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#2a2a2e] text-zinc-200 hover:bg-zinc-800/60">Ligar respostas</button>
              <button onClick={() => desconectar.mutate()} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30">Desconectar</button>
            </>
          )}
        </div>
        {st?.configurado && !st?.conectado && (
          <div className="text-center space-y-2">
            {qr?.base64 ? <img src={qr.base64} alt="QR Code" className="mx-auto w-52 h-52 bg-white p-2 rounded-lg" />
              : <div className="text-xs text-zinc-500 py-6">{isFetching ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Clique para gerar o QR Code.'}</div>}
            <button onClick={() => gerarQr()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
              <QrCode className="w-3.5 h-3.5" /> {qr?.base64 ? 'Atualizar QR' : 'Gerar QR Code'}
            </button>
            <p className="text-[11px] text-zinc-600">WhatsApp no celular do chip de prospecção → Aparelhos conectados → Conectar.</p>
          </div>
        )}
      </div>

      {/* Ajustes */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <label className="text-xs text-zinc-400 space-y-1 block">
          <span>Seu nome (aparece nas mensagens) *</span>
          <input className={input} value={f.meu_nome} onChange={(e) => setF({ ...f, meu_nome: e.target.value })} placeholder="Ex.: Harry" />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {num('limite_inicial_dia', 'Mensagens no 1º dia')}
          {num('aquecimento_passo', 'Aumenta por dia', '+')}
          {num('limite_max_dia', 'Teto por dia')}
          {num('hora_inicio', 'Começa às', 'h')}
          {num('hora_fim', 'Termina às', 'h')}
          <div />
          {num('intervalo_min_seg', 'Intervalo mínimo', 's')}
          {num('intervalo_max_seg', 'Intervalo máximo', 's')}
          <div />
          {num('dias_followup_1', 'Follow-up 1 após', 'dias')}
          {num('dias_followup_2', 'Follow-up 2 após o 1º', 'dias')}
        </div>
        <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#E7B32C', color: '#0B0B0C' }}>
          Salvar ajustes
        </button>
      </div>

      {/* Importação da Receita */}
      <div className="rounded-xl p-5 space-y-2" style={card}>
        <h3 className="text-sm font-bold text-white">Importar empresas novas da Receita Federal</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Baixe os arquivos <b>Estabelecimentos0..9</b> e <b>Municipios</b> em dadosabertos.rfb.gov.br/CNPJ, descompacte
          e rode no terminal (pasta <code className="text-zinc-300">backend</code>):
        </p>
        <pre className="text-[11px] rounded-lg p-3 overflow-x-auto" style={{ background: '#0B0B0C', color: '#a1a1aa', border: '1px solid #2a2a2e' }}>{`php artisan prospeccao:importar-receita K3241.K03200Y0.D60913.ESTABELE --municipios=Municipios.csv --meses=12 --uf=AL`}</pre>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Tira <code className="text-zinc-400">--uf</code> para o Brasil inteiro. Só entram confecções ativas, abertas há menos de N meses e com celular.
          Atenção: em muitos CNPJs o telefone é do contador, não do dono.
        </p>
      </div>
    </div>
  )
}

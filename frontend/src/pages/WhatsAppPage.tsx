import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { whatsappService } from '@/services/api'
import toast from 'react-hot-toast'
import {
  Smartphone, Wifi, WifiOff, RefreshCw, LogOut,
  Send, CheckCircle2, AlertTriangle, Info, QrCode,
  Loader2,
} from 'lucide-react'

const QR_TTL = 45 // segundos antes do QR expirar

export default function WhatsAppPage() {
  const qc = useQueryClient()
  const [countdown, setCountdown]   = useState(QR_TTL)
  const [teste, setTeste]           = useState({ numero: '', mensagem: '' })
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Status — polling a cada 5s ── */
  const { data: status } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn:  whatsappService.status,
    refetchInterval: 5000,
  })

  /* ── QR Code — só busca quando desconectado ── */
  const { data: qrData, isFetching: loadingQr, refetch: refetchQr } = useQuery({
    queryKey: ['whatsapp-qr'],
    queryFn:  whatsappService.qrcode,
    enabled:  status?.configurado && !status?.conectado,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  /* ── Countdown para refresh do QR ── */
  useEffect(() => {
    if (!status?.configurado || status?.conectado) return
    setCountdown(QR_TTL)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refetchQr()
          return QR_TTL
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status?.conectado, qrData])

  const desconectarMutation = useMutation({
    mutationFn: whatsappService.desconectar,
    onSuccess: () => {
      toast.success('WhatsApp desconectado.')
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] })
      qc.invalidateQueries({ queryKey: ['whatsapp-qr'] })
    },
  })

  const enviarTesteMutation = useMutation({
    mutationFn: () => whatsappService.enviarTeste(teste.numero, teste.mensagem),
    onSuccess: (data) => {
      if (data.success) toast.success('Mensagem enviada!')
      else toast.error(data.message)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao enviar.')
    },
  })

  const conectado   = status?.conectado === true
  const connecting  = status?.state === 'connecting'
  const semConfig   = status?.configurado === false

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-[fadeIn_0.2s_ease-out]">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)' }}
        >
          <Smartphone className="w-4 h-4" style={{ color: '#25d366' }} />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">WhatsApp</h1>
          <p className="text-xs text-zinc-500">Evolution API — celular principal para automações</p>
        </div>
      </div>

      {/* ── Sem configuração ── */}
      {semConfig && (
        <div
          className="rounded-xl p-5 border"
          style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.25)' }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400 mb-2">Evolution API não configurada</p>
              <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                Adicione as variáveis no arquivo <code className="text-amber-400/80">backend/.env</code>:
              </p>
              <pre
                className="text-xs rounded-lg p-3 overflow-x-auto leading-relaxed"
                style={{ background: '#111', color: '#aaa', border: '1px solid #2a2a2a' }}
              >{`EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-chave-aqui
EVOLUTION_INSTANCE=camiseta-design`}</pre>
              <p className="text-xs text-zinc-600 mt-2">
                Depois rode: <code className="text-zinc-400">php artisan config:clear</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Status de conexão ── */}
      {status?.configurado && (
        <div
          className="rounded-xl p-5 border flex items-center justify-between gap-4"
          style={{
            background: conectado ? 'rgba(37,211,102,0.07)' : connecting ? 'rgba(59,130,246,0.07)' : 'rgba(239,68,68,0.07)',
            borderColor: conectado ? 'rgba(37,211,102,0.25)' : connecting ? 'rgba(59,130,246,0.25)' : 'rgba(239,68,68,0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: conectado ? 'rgba(37,211,102,0.15)' : connecting ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${conectado ? 'rgba(37,211,102,0.3)' : connecting ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {conectado
                ? <Wifi className="w-5 h-5" style={{ color: '#25d366' }} />
                : connecting
                ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                : <WifiOff className="w-5 h-5 text-red-400" />
              }
            </div>
            <div>
              <p className={`text-sm font-bold ${conectado ? 'text-emerald-400' : connecting ? 'text-blue-400' : 'text-red-400'}`}>
                {conectado ? 'Conectado' : connecting ? 'Conectando...' : 'Desconectado'}
              </p>
              <p className="text-xs text-zinc-500">
                {conectado
                  ? (status.perfil ? `Conta: ${status.perfil}` : 'WhatsApp ativo e pronto')
                  : connecting
                  ? 'Aguardando escaneamento do QR Code'
                  : 'Escaneie o QR Code para conectar'
                }
              </p>
            </div>
          </div>
          {conectado && (
            <button
              className="btn-danger text-xs py-1.5 gap-1.5 flex-shrink-0"
              onClick={() => desconectarMutation.mutate()}
              disabled={desconectarMutation.isPending}
            >
              <LogOut className="w-3.5 h-3.5" />
              Desconectar
            </button>
          )}
        </div>
      )}

      {/* ── QR Code ── */}
      {status?.configurado && !conectado && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <QrCode className="w-4 h-4" style={{ color: '#d4a020' }} />
              Escaneie para conectar
            </h2>
            <div className="flex items-center gap-3">
              {/* Countdown */}
              {qrData?.base64 && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <RefreshCw className="w-3 h-3" />
                  Renova em {countdown}s
                </div>
              )}
              <button
                onClick={() => { setCountdown(QR_TTL); refetchQr() }}
                disabled={loadingQr}
                className="btn-secondary text-xs py-1 px-2.5 gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingQr ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          {loadingQr ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#d4a020' }} />
              <p className="text-sm text-zinc-500">Gerando QR Code...</p>
            </div>
          ) : qrData?.base64 ? (
            <div className="flex flex-col items-center gap-5">
              {/* QR Code */}
              <div
                className="p-4 rounded-2xl"
                style={{ background: '#fff' }}
              >
                <img
                  src={qrData.base64}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 block"
                />
              </div>

              {/* Instruções */}
              <div className="text-center space-y-1 max-w-xs">
                <p className="text-sm font-semibold text-zinc-300">Como conectar:</p>
                <ol className="text-xs text-zinc-500 space-y-1 text-left list-none">
                  {[
                    'Abra o WhatsApp no celular',
                    'Toque em ⋮ (Android) ou Configurações (iPhone)',
                    'Selecione "Aparelhos conectados"',
                    'Toque em "Conectar um aparelho"',
                    'Escaneie este QR Code',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(37,211,102,0.15)', color: '#25d366' }}
                      >
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Barra de progresso do countdown */}
              <div className="w-56 h-1 rounded-full overflow-hidden" style={{ background: '#2a2a2a' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(countdown / QR_TTL) * 100}%`,
                    background: countdown > 15 ? '#25d366' : '#f59e0b',
                    transition: 'width 1s linear, background 0.3s',
                  }}
                />
              </div>
            </div>
          ) : qrData?.conectado ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-sm text-emerald-400 font-semibold">Conectado!</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 gap-3 text-zinc-600">
              <AlertTriangle className="w-8 h-8 opacity-40" />
              <p className="text-sm">Não foi possível gerar o QR Code.</p>
              <p className="text-xs text-zinc-700">Verifique se a Evolution API está rodando em <code>{status?.instance ?? 'localhost:8080'}</code></p>
              <button onClick={() => refetchQr()} className="btn-secondary text-xs gap-1.5 mt-1">
                <RefreshCw className="w-3 h-3" /> Tentar novamente
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Enviar mensagem de teste ── */}
      {conectado && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" style={{ color: '#25d366' }} />
            Enviar mensagem de teste
          </h2>
          <div className="space-y-3">
            <div>
              <label className="label">Número do WhatsApp</label>
              <input
                className="input"
                placeholder="Ex: 82 99999-1234 ou 5582999991234"
                value={teste.numero}
                onChange={e => setTeste(p => ({ ...p, numero: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Mensagem</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="Olá! Esta é uma mensagem de teste do Camiseta Design 👕"
                value={teste.mensagem}
                onChange={e => setTeste(p => ({ ...p, mensagem: e.target.value }))}
              />
            </div>
            <button
              className="btn-primary w-full gap-2"
              onClick={() => enviarTesteMutation.mutate()}
              disabled={enviarTesteMutation.isPending || !teste.numero || !teste.mensagem}
            >
              {enviarTesteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4" /> Enviar teste</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Info sobre automações ── */}
      <div
        className="rounded-xl p-4 border flex items-start gap-3"
        style={{ background: 'rgba(37,211,102,0.04)', borderColor: 'rgba(37,211,102,0.15)' }}
      >
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#25d366' }} />
        <div className="text-xs text-zinc-500 leading-relaxed space-y-1">
          <p className="font-semibold text-zinc-400">Automações ativas quando conectado:</p>
          <p>✓ Notificação ao cliente quando arte é enviada para aprovação</p>
          <p>✓ Confirmação quando arte é aprovada</p>
          <p>✓ Aviso quando revisão é solicitada</p>
          <p className="text-zinc-600 pt-1">
            Configure o número do cliente em cada pedido para ativar as notificações automáticas.
          </p>
        </div>
      </div>

    </div>
  )
}

<?php

namespace App\Http\Controllers;

use App\Services\WhatsAppService;
use App\Services\WhatsAppAIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WhatsAppController extends Controller
{
    public function __construct(
        private WhatsAppService $wa,
        private WhatsAppAIService $ai,
    ) {}

    /** GET /api/whatsapp/status */
    public function status(): JsonResponse
    {
        if (!$this->wa->configurado()) {
            return response()->json([
                'configurado' => false,
                'message'     => 'EVOLUTION_API_KEY não configurada no .env',
            ]);
        }

        $status = $this->wa->status();

        return response()->json([
            'configurado' => true,
            'state'       => $status['state'],   // open | connecting | close
            'perfil'      => $status['perfil'],
            'instance'    => $status['instance'],
            'conectado'   => $status['state'] === 'open',
        ]);
    }

    /** GET /api/whatsapp/qrcode */
    public function qrcode(): JsonResponse
    {
        if (!$this->wa->configurado()) {
            return response()->json(['message' => 'EVOLUTION_API_KEY não configurada.'], 503);
        }

        try {
            $qr = $this->wa->obterQrCode();

            if (!$qr['base64']) {
                // Pode estar já conectado
                $status = $this->wa->status();
                if ($status['state'] === 'open') {
                    return response()->json(['conectado' => true, 'state' => 'open']);
                }
                return response()->json(['message' => 'Não foi possível gerar o QR Code.'], 502);
            }

            return response()->json([
                'base64'    => $qr['base64'],
                'code'      => $qr['code'],
                'conectado' => false,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erro ao conectar à Evolution API: ' . $e->getMessage()], 502);
        }
    }

    /** POST /api/whatsapp/desconectar */
    public function desconectar(): JsonResponse
    {
        $ok = $this->wa->desconectar();
        return response()->json(['success' => $ok]);
    }

    /** POST /api/whatsapp/enviar-teste */
    public function enviarTeste(Request $request): JsonResponse
    {
        $request->validate([
            'numero'   => 'required|string|min:8|max:20',
            'mensagem' => 'required|string|max:500',
        ]);

        if (!$this->wa->configurado()) {
            return response()->json(['message' => 'WhatsApp não configurado.'], 503);
        }

        $status = $this->wa->status();
        if ($status['state'] !== 'open') {
            return response()->json(['message' => 'WhatsApp não está conectado. Escaneie o QR Code primeiro.'], 422);
        }

        $ok = $this->wa->enviarTexto($request->numero, $request->mensagem);

        return response()->json([
            'success' => $ok,
            'message' => $ok ? 'Mensagem enviada com sucesso!' : 'Falha ao enviar mensagem.',
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // CHATBOT IA — Webhook e configuração
    // ═══════════════════════════════════════════════════════════

    /**
     * POST /api/whatsapp/webhook
     *
     * Recebe mensagens da Evolution API (rota PÚBLICA — sem auth:sanctum)
     * A validação é feita pelo número do remetente (admin)
     */
    public function webhook(Request $request): JsonResponse
    {
        // Validação da chave da Evolution API para impedir requisições forjadas
        $expectedKey = config('services.evolution.key');
        if (!empty($expectedKey)) {
            $providedKey = $request->header('apikey')
                ?? $request->header('x-api-key')
                ?? $request->bearerToken()
                ?? $request->query('apikey');

            if ($providedKey !== $expectedKey) {
                Log::warning('WhatsApp Webhook: tentativa não autorizada com chave inválida ou ausente.', [
                    'ip' => $request->ip(),
                ]);
                return response()->json(['status' => 'unauthorized', 'message' => 'Chave de webhook inválida.'], 401);
            }
        }

        $payload = $request->all();

        Log::debug('WhatsApp webhook recebido', [
            'event' => $payload['event'] ?? 'unknown',
            'keys'  => array_keys($payload),
        ]);

        // Só processa eventos de mensagem
        $evento = $payload['event'] ?? '';
        if (!in_array($evento, ['messages.upsert', 'MESSAGES_UPSERT', ''])) {
            return response()->json(['status' => 'ignored', 'reason' => 'event_type']);
        }

        // Extrai dados da mensagem — formato pode variar entre versões da Evolution API
        $dados = $payload['data'] ?? $payload;

        // Se for um array de mensagens, pega o primeiro item
        if (isset($dados[0]) && is_array($dados[0])) {
            $dados = $dados[0];
        }

        // Tenta extrair a mensagem de texto
        $mensagem = null;
        $numero   = null;
        $fromMe   = false;

        if (isset($dados['key'])) {
            // Se remoteJid for @lid, busca nos outros campos onde o número real está presente
            $candidatos = [
                $dados['key']['remoteJidAlt'] ?? null,
                $dados['sender'] ?? null,
                $dados['key']['participantAlt'] ?? null,
                $dados['key']['participant'] ?? null,
                $dados['key']['remoteJid'] ?? null,
            ];
            foreach ($candidatos as $cand) {
                if ($cand && !str_contains($cand, '@lid')) {
                    $numero = $cand;
                    break;
                }
            }
            if (!$numero && isset($dados['key']['remoteJid'])) {
                $numero = $dados['key']['remoteJid'];
            }
            $fromMe = $dados['key']['fromMe'] ?? false;
        }

        if (isset($dados['message'])) {
            $mensagem = $dados['message']['conversation'] 
                ?? $dados['message']['extendedTextMessage']['text'] 
                ?? $dados['message']['imageMessage']['caption'] 
                ?? $dados['message']['videoMessage']['caption'] 
                ?? null;
        }

        // Se não encontrou mensagem de texto, ignora (pode ser imagem, áudio etc.)
        if (!$mensagem || !$numero) {
            return response()->json(['status' => 'ignored', 'reason' => 'no_text_message']);
        }

        // Extrai número limpo (remove @s.whatsapp.net etc.)
        $numeroLimpo = preg_replace('/[^0-9]/', '', explode('@', $numero)[0]);

        // Ignora mensagens enviadas por nós mesmos para terceiros (clientes/grupos),
        // mas permite se for mensagem do próprio admin em conversa consigo mesmo
        if ($fromMe && !$this->ai->isAutorizado($numeroLimpo)) {
            return response()->json(['status' => 'ignored', 'reason' => 'from_me']);
        }

        Log::info("WhatsApp Bot: Mensagem recebida de {$numeroLimpo}: {$mensagem} (fromMe: " . ($fromMe ? 'sim' : 'nao') . ")");

        // Verifica se o número é autorizado
        if (!$this->ai->isAutorizado($numeroLimpo)) {
            Log::warning("WhatsApp Bot: Número não autorizado: {$numeroLimpo}");
            return response()->json(['status' => 'ignored', 'reason' => 'unauthorized']);
        }

        // Processa a mensagem
        $this->ai->processarMensagem($numeroLimpo, $mensagem);

        return response()->json(['status' => 'success']);
    }

    /**
     * POST /api/whatsapp/configurar-webhook
     *
     * Configura o webhook na Evolution API (admin)
     * Pode receber url customizada ou usa a URL padrão do backend
     */
    public function configurarWebhook(Request $request): JsonResponse
    {
        $request->validate([
            'url' => 'nullable|url',
        ]);

        if (!$this->wa->configurado()) {
            return response()->json(['message' => 'WhatsApp não configurado.'], 503);
        }

        // URL do webhook: customizada ou padrão
        $webhookUrl = $request->url ?? rtrim(config('app.url'), '/') . '/api/whatsapp/webhook';

        $ok = $this->wa->configurarWebhook($webhookUrl);

        return response()->json([
            'success'     => $ok,
            'webhook_url' => $webhookUrl,
            'message'     => $ok
                ? "Webhook configurado! A Evolution API enviará mensagens para: {$webhookUrl}"
                : 'Falha ao configurar webhook. Verifique os logs.',
        ]);
    }

    /**
     * GET /api/whatsapp/webhook-status
     *
     * Consulta o status do webhook configurado (admin)
     */
    public function webhookStatus(): JsonResponse
    {
        if (!$this->wa->configurado()) {
            return response()->json(['message' => 'WhatsApp não configurado.'], 503);
        }

        $webhook = $this->wa->obterWebhook();

        return response()->json([
            'webhook'        => $webhook,
            'admin_number'   => config('services.evolution.admin_number') ? 'configurado' : 'não configurado',
            'openrouter_key' => config('services.openrouter.key') ? 'configurado' : 'não configurado',
        ]);
    }
}


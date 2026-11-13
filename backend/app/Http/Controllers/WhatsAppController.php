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
            return response()->json(['message' => 'Erro ao conectar à Evolution API.'], 502);
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
        // Validação da chave da Evolution API para impedir requisições forjadas.
        // Sem chave configurada, o webhook é recusado (fail-closed): ele controla o bot
        // com privilégios de admin, então nunca pode ficar aberto.
        $expectedKey = (string) config('services.evolution.key');
        $webhookSecret = (string) config('services.evolution.webhook_secret');
        $ip = $request->ip();
        // Chamada local legítima = loopback SEM cabeçalhos de proxy (evita spoof via proxy reverso)
        $isLocal = in_array($ip, ['127.0.0.1', '::1'], true)
            && !$request->headers->has('X-Forwarded-For')
            && !$request->headers->has('X-Real-IP');

        $providedKey = $request->header('apikey')
            ?? $request->header('x-api-key')
            ?? $request->bearerToken()
            ?? $request->input('apikey')
            ?? $request->input('data.apikey');

        $payload = $request->all();

        $chaveConfere = $expectedKey !== '' && is_string($providedKey) && $providedKey !== ''
            && hash_equals($expectedKey, $providedKey);
        $segredoConfere = $webhookSecret !== '' && hash_equals($webhookSecret, (string) $request->query('secret', ''));

        if (!$chaveConfere && !$segredoConfere && !$isLocal) {
            Log::warning('WhatsApp Webhook: tentativa não autorizada com chave inválida ou ausente.', [
                'ip' => $ip,
            ]);
            return response()->json(['status' => 'unauthorized', 'message' => 'Chave de webhook inválida.'], 401);
        }

        Log::debug('WhatsApp webhook recebido', [
            'event' => $payload['event'] ?? 'unknown',
            'keys'  => array_keys($payload),
            'ip'    => $ip,
        ]);

        // Só processa eventos de mensagem
        $evento = strtolower($payload['event'] ?? '');
        if (!in_array($evento, ['messages.upsert', 'messages_upsert', ''])) {
            return response()->json(['status' => 'ignored', 'reason' => 'event_type', 'event' => $evento]);
        }

        // Extrai dados da mensagem — formato pode variar entre versões da Evolution API
        $dados = $payload['data'] ?? $payload;

        // Se for um array de mensagens, pega o primeiro item
        if (isset($dados[0]) && is_array($dados[0])) {
            $dados = $dados[0];
        }

        // Deduplicação: a Evolution às vezes reenvia o mesmo evento (evita responder 2x)
        $idMensagem = $dados['key']['id'] ?? null;
        if (is_string($idMensagem) && $idMensagem !== '') {
            if (!\Illuminate\Support\Facades\Cache::add('wa_msg_' . $idMensagem, 1, now()->addMinutes(15))) {
                return response()->json(['status' => 'ignored', 'reason' => 'duplicate']);
            }
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
                if ($cand && !str_contains($cand, '@lid') && !str_contains($cand, '@g.us')) {
                    $numero = $cand;
                    break;
                }
            }
            if (!$numero && isset($dados['key']['remoteJid']) && !str_contains($dados['key']['remoteJid'], '@g.us')) {
                $numero = $dados['key']['remoteJid'];
            }
            $fromMe = $dados['key']['fromMe'] ?? false;
        }

        // Ignora grupos do WhatsApp (@g.us)
        $remoteJid = $dados['key']['remoteJid'] ?? '';
        if (str_contains($remoteJid, '@g.us') || (is_string($numero) && str_contains($numero, '@g.us'))) {
            return response()->json(['status' => 'ignored', 'reason' => 'group_message']);
        }

        $midiaInfo = null;

        if (isset($dados['message'])) {
            $msgObj = $dados['message'];

            // Desencapsula mensagens efêmeras/temporárias
            if (isset($msgObj['ephemeralMessage']['message'])) {
                $msgObj = $msgObj['ephemeralMessage']['message'];
            }
            if (isset($msgObj['viewOnceMessage']['message'])) {
                $msgObj = $msgObj['viewOnceMessage']['message'];
            }
            if (isset($msgObj['viewOnceMessageV2']['message'])) {
                $msgObj = $msgObj['viewOnceMessageV2']['message'];
            }

            // Identifica imagem ou documento recebido
            if (isset($msgObj['imageMessage'])) {
                $midiaInfo = [
                    'tipo'     => 'imagem',
                    'mimetype' => $msgObj['imageMessage']['mimetype'] ?? 'image/jpeg',
                    'caption'  => $msgObj['imageMessage']['caption'] ?? null,
                    'base64'   => $dados['base64'] ?? $msgObj['base64'] ?? $msgObj['imageMessage']['base64'] ?? null,
                    'msgDados' => $dados,
                ];
            } elseif (isset($msgObj['documentMessage'])) {
                $midiaInfo = [
                    'tipo'     => 'documento',
                    'mimetype' => $msgObj['documentMessage']['mimetype'] ?? 'application/octet-stream',
                    'caption'  => $msgObj['documentMessage']['caption'] ?? null,
                    'fileName' => $msgObj['documentMessage']['fileName'] ?? 'documento',
                    'base64'   => $dados['base64'] ?? $msgObj['base64'] ?? $msgObj['documentMessage']['base64'] ?? null,
                    'msgDados' => $dados,
                ];
            }

            $mensagem = $msgObj['conversation'] 
                ?? $msgObj['extendedTextMessage']['text'] 
                ?? $msgObj['imageMessage']['caption'] 
                ?? $msgObj['videoMessage']['caption'] 
                ?? $msgObj['buttonsResponseMessage']['selectedDisplayText']
                ?? $msgObj['buttonsResponseMessage']['selectedButtonId']
                ?? $msgObj['templateButtonReplyMessage']['selectedId']
                ?? $msgObj['listResponseMessage']['title']
                ?? $msgObj['listResponseMessage']['singleSelectReply']['selectedRowId']
                ?? null;
        }

        // Fallback para mensagens diretas da Evolution
        if (!$mensagem) {
            $mensagem = $dados['text'] ?? $dados['content'] ?? $dados['body'] ?? null;
        }

        // Se veio mídia mas sem texto de legenda, define legenda padrão para o fluxo
        if (empty($mensagem) && $midiaInfo) {
            $mensagem = '[FOTO/REFERÊNCIA ENVIADA]';
        }

        // Se não encontrou mensagem de texto nem mídia, ignora
        if (!$mensagem || !$numero) {
            return response()->json(['status' => 'ignored', 'reason' => 'no_text_or_media_message']);
        }

        // Extrai número limpo (remove @s.whatsapp.net etc.)
        $numeroLimpo = preg_replace('/[^0-9]/', '', explode('@', $numero)[0]);

        // Ignora mensagens enviadas por nós mesmos para terceiros (clientes/grupos),
        // mas permite se for mensagem do próprio admin em conversa consigo mesmo
        if ($fromMe && !$this->ai->isAdmin($numeroLimpo)) {
            return response()->json(['status' => 'ignored', 'reason' => 'from_me']);
        }

        Log::info("WhatsApp Bot: Mensagem recebida de {$numeroLimpo}: {$mensagem} (midia: " . ($midiaInfo ? $midiaInfo['tipo'] : 'nao') . ", fromMe: " . ($fromMe ? 'sim' : 'nao') . ")");

        // Processa a mensagem com roteamento de perfis (admin, confecção parceira, cliente ou novo lead)
        $this->ai->processarMensagem($numeroLimpo, $mensagem, $midiaInfo);

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


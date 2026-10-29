<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    private string $baseUrl;
    private string $apiKey;
    private string $instance;

    public function __construct()
    {
        $this->baseUrl  = rtrim(config('services.evolution.url'), '/');
        $this->apiKey   = config('services.evolution.key', '');
        $this->instance = config('services.evolution.instance', 'camiseta-design');
    }

    public function configurado(): bool
    {
        return !empty($this->apiKey) && !empty($this->baseUrl);
    }

    /** Cria a instância se não existir e retorna o QR code em base64 */
    public function obterQrCode(): array
    {
        // Tenta criar a instância (idempotente — se já existe, ignora o erro)
        // Em Evolution API v2, 'token' define o apikey da instância.
        // Usando o mesmo key global garante que chamadas subsequentes funcionem.
        try {
            $this->requisicao('POST', '/instance/create', [
                'instanceName' => $this->instance,
                'token'        => $this->apiKey,
                'qrcode'       => true,
                'integration'  => 'WHATSAPP-BAILEYS',
            ]);
        } catch (\Exception $e) {
            // Instância já existe — OK
        }

        $res = $this->requisicao('GET', "/instance/connect/{$this->instance}");

        return [
            'base64' => $res['base64']  ?? $res['qrcode']['base64'] ?? null,
            'code'   => $res['code']    ?? $res['qrcode']['code']   ?? null,
        ];
    }

    /** Retorna o estado da conexão: open | connecting | close */
    public function status(): array
    {
        try {
            $res = $this->requisicao('GET', "/instance/connectionState/{$this->instance}");

            $state  = $res['instance']['state']  ?? $res['state']  ?? 'close';
            $number = $res['instance']['profilePictureUrl'] ?? null;

            // Tenta pegar o número conectado
            $perfil = null;
            if ($state === 'open') {
                try {
                    $info   = $this->requisicao('GET', "/instance/fetchInstances");
                    $found  = collect($info)->firstWhere('instance.instanceName', $this->instance);
                    $perfil = $found['instance']['profileName'] ?? $found['instance']['owner'] ?? null;
                } catch (\Exception $e) {}
            }

            return [
                'state'   => $state,   // open | connecting | close
                'perfil'  => $perfil,
                'instance' => $this->instance,
            ];
        } catch (\Exception $e) {
            Log::warning('WhatsApp status error: ' . $e->getMessage());
            return ['state' => 'close', 'perfil' => null, 'instance' => $this->instance];
        }
    }

    /** Desconecta a instância */
    public function desconectar(): bool
    {
        try {
            $this->requisicao('DELETE', "/instance/logout/{$this->instance}");
            return true;
        } catch (\Exception $e) {
            Log::error('WhatsApp logout error: ' . $e->getMessage());
            return false;
        }
    }

    /** Envia mensagem de texto */
    public function enviarTexto(string $numero, string $mensagem): bool
    {
        // Normaliza número: remove +, espaços, traços
        $numero = preg_replace('/[^0-9]/', '', $numero);

        // Garante DDI 55
        if (!str_starts_with($numero, '55')) {
            $numero = '55' . $numero;
        }

        try {
            $this->requisicao('POST', "/message/sendText/{$this->instance}", [
                'number'      => $numero,
                'linkPreview' => true,
                'options'     => ['delay' => 1200, 'presence' => 'composing', 'linkPreview' => true],
                'text'        => $mensagem,
            ]);
            return true;
        } catch (\Exception $e) {
            Log::error("WhatsApp send error para {$numero}: " . $e->getMessage());
            return false;
        }
    }

    public function configurarWebhook(string $url): bool
    {
        try {
            $this->requisicao('POST', "/webhook/set/{$this->instance}", [
                'webhook' => [
                    'enabled' => true,
                    'url'     => $url,
                    'webhookByEvents' => false,
                    'webhookBase64'    => false,
                    'events'  => [
                        'MESSAGES_UPSERT',
                    ],
                ]
            ]);

            Log::info("WhatsApp webhook configurado: {$url}");
            return true;
        } catch (\Exception $e) {
            Log::error("Erro ao configurar webhook: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Consulta o webhook configurado na instância
     */
    public function obterWebhook(): ?array
    {
        try {
            return $this->requisicao('GET', "/webhook/find/{$this->instance}");
        } catch (\Exception $e) {
            Log::warning("Erro ao consultar webhook: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Envia notificação automática de mudança de status de um pedido via WhatsApp
     * para os números cadastrados (cliente e/ou confecção)
     */
    public function notificarMudancaStatus(\App\Models\Pedido $pedido, string $novoStatus): array
    {
        if (!$this->configurado()) {
            Log::warning("WhatsApp não configurado. Notificação de status '{$novoStatus}' não enviada para o pedido #{$pedido->id}.");
            return ['enviado' => false, 'motivo' => 'nao_configurado'];
        }

        if (!$pedido->relationLoaded('confeccao')) {
            $pedido->load('confeccao.user');
        }

        $link = $pedido->linkAprovacao();
        $nomeCliente = $pedido->cliente_nome ?? $pedido->nome_cliente ?? null;
        $saudacao = !empty($nomeCliente) ? ", {$nomeCliente}" : "";

        $mensagem = match ($novoStatus) {
            'aguardando_briefing' =>
                "Olá{$saudacao}! 👋\n\n" .
                "O status do seu pedido *\"{$pedido->titulo}\"* (#{$pedido->id}) foi atualizado para:\n" .
                "📝 *Aguardando Briefing*\n\n" .
                "Nossa equipe está aguardando as orientações e referências para iniciar o design.",

            'em_producao' =>
                "Olá{$saudacao}! 🎨\n\n" .
                "Boas notícias! O seu pedido *\"{$pedido->titulo}\"* (#{$pedido->id}) agora está:\n" .
                "🔨 *Em Produção*\n\n" .
                "Nossos designers já estão trabalhando na criação da sua arte!",

            'aguardando_aprovacao' =>
                "Olá{$saudacao}! 👋\n\n" .
                "A arte do seu pedido *\"{$pedido->titulo}\"* (#{$pedido->id}) está pronta para aprovação! ⏳\n\n" .
                "Acesse o link abaixo para visualizar a prévia e aprovar ou solicitar ajustes:\n\n" .
                "{$link}\n\n" .
                "💡 _Dica: Se o link acima não estiver azul/clicável, salve este contato ou envie uma resposta rápida (como um \"Ok\") para o WhatsApp liberar os links do chat._",

            'aprovado' =>
                "Olá{$saudacao}! ✅\n\n" .
                "A arte do seu pedido *\"{$pedido->titulo}\"* (#{$pedido->id}) foi marcada como *Aprovada*! 🎉\n\n" .
                "Estamos dando andamento aos próximos passos da produção.",

            'finalizado' =>
                "Olá{$saudacao}! 🎉\n\n" .
                "O seu pedido *\"{$pedido->titulo}\"* (#{$pedido->id}) foi *Finalizado* com sucesso! 👕✨\n\n" .
                "Muito obrigado pela confiança e preferência!",

            default => null,
        };

        if (!$mensagem) {
            return ['enviado' => false, 'motivo' => 'status_sem_template'];
        }

        // Identifica todos os números cadastrados
        $destinatarios = [];

        // 1. WhatsApp do cliente cadastrado no pedido
        $clienteWa = $pedido->cliente_whatsapp ?? $pedido->whatsapp_cliente ?? null;
        if (!empty($clienteWa)) {
            $destinatarios[] = $clienteWa;
        }

        // 2. WhatsApp da confecção cadastrada (se houver e for diferente)
        $confeccaoWa = $pedido->confeccao?->whatsapp ?? $pedido->confeccao?->user?->whatsapp ?? null;
        if (!empty($confeccaoWa)) {
            $destinatarios[] = $confeccaoWa;
        }

        // Remove duplicados normalizados
        $enviados = [];
        $falhas   = [];

        foreach ($destinatarios as $num) {
            $limpo = preg_replace('/[^0-9]/', '', $num);
            if (empty($limpo) || strlen($limpo) < 8) continue;

            $ok = $this->enviarTexto($limpo, $mensagem);
            if ($ok) {
                $enviados[] = $limpo;
                Log::info("WhatsApp: Notificação de '{$novoStatus}' enviada com sucesso para {$limpo} (Pedido #{$pedido->id})");
            } else {
                $falhas[] = $limpo;
                Log::warning("WhatsApp: Falha ao enviar notificação de '{$novoStatus}' para {$limpo} (Pedido #{$pedido->id})");
            }
        }

        return [
            'enviado'       => count($enviados) > 0,
            'destinatarios' => $enviados,
            'falhas'        => $falhas,
        ];
    }

    /** Faz requisição à Evolution API */
    private function requisicao(string $method, string $path, array $body = []): array
    {
        $url = $this->baseUrl . $path;

        Log::info("Evolution API request: {$method} {$url}", [
            'apikey_len' => strlen($this->apiKey),
            'body'       => $body,
        ]);

        $req = Http::timeout(15)
            ->withHeaders(['apikey' => $this->apiKey])
            ->asJson();

        $response = match (strtoupper($method)) {
            'GET'    => $req->get($url),
            'POST'   => $req->post($url, $body),
            'PUT'    => $req->put($url, $body),
            'DELETE' => $req->delete($url),
            default  => throw new \InvalidArgumentException("Método inválido: {$method}"),
        };

        Log::info("Evolution API response: {$method} {$url}", [
            'status' => $response->status(),
            'body'   => $response->body(),
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException(
                "Evolution API erro [{$response->status()}]: " . $response->body()
            );
        }

        return $response->json() ?? [];
    }
}

<?php

namespace App\Services;

use App\Models\Pedido;
use App\Models\Confeccao;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class WhatsAppAIService
{
    private WhatsAppService $wa;
    private string $adminNumber;

    /**
     * Mapeamento de intenções → palavras-chave (classificação local, sem IA)
     * Cada intenção tem um array de padrões regex
     */
    private array $intencoes = [
        'novo_pedido' => [
            'novo pedido', 'fazer pedido', 'fazer um pedido', 'quero fazer um pedido',
            'criar pedido', 'encomendar', 'nova arte', 'quero uma arte', 'fazer fardamento',
            'solicitar arte', 'solicitar pedido', 'fazer camisa', 'encomenda',
        ],
        'meus_pedidos' => [
            'meus pedidos', 'meu pedido', 'como est[aá] meu pedido', 'onde est[aá] meu pedido',
            'status do meu pedido', 'acompanhar pedido', 'rastrear', 'rastreio',
            'ver meus pedidos', 'lista dos meus pedidos',
        ],
        'resumo_geral' => [
            'resumo', 'relat[oó]rio', 'todos os pedidos',
            'como est[aã]o os pedidos', 'vis[aã]o geral', 'overview',
            'me manda os pedidos', 'quero ver os pedidos', 'lista de pedidos',
            'quantos pedidos',
        ],
        'pedidos_atrasados' => [
            'atrasad[oa]s?', 'atraso', 'vencid[oa]s?', 'atras[oó]',
            'pendentes? atrasad', 'fora do prazo', 'prazo vencid',
            'o que est[aá] atrasado', 'tem algo atrasado', 'algum atraso',
        ],
        'prazos_entrega' => [
            'entrega', 'prazos?', 'datas? de entrega', 'quando entrega',
            'pr[oó]ximas? entregas?', 'calendário', 'agenda',
            'quando vence', 'vencimento', 'deadline',
        ],
        'detalhe_pedido' => [
            'pedido\s*#?\s*(\d+)', 'detalhes?\s+(?:do\s+)?pedido\s*#?\s*(\d+)',
            'ver\s+pedido\s*#?\s*(\d+)', 'info\s+pedido\s*#?\s*(\d+)',
            'pedido\s+n[uú]mero\s*(\d+)',
        ],
        'dashboard' => [
            'dashboard', 'estat[ií]sticas?', 'n[uú]meros', 'indicadores',
            'kpi', 'painel', 'status geral',
        ],
        'pedidos_por_status' => [
            'em produ[cç][aã]o', 'aguardando briefing', 'aguardando aprova[cç][aã]o',
            'aprovados?', 'finalizados?', 'cancelados?',
        ],
        'ajuda' => [
            'ajuda', 'help', 'comandos', 'o que voc[eê] faz',
            'menu', 'op[cç][oõ]es', 'como funciona',
        ],
    ];

    public function __construct(WhatsAppService $wa)
    {
        $this->wa = $wa;
        $this->adminNumber = config('services.evolution.admin_number', '');
    }

    /**
     * Verifica se o número é o administrador do sistema
     */
    public function isAdmin(string $numero): bool
    {
        if (empty($this->adminNumber)) {
            return false;
        }

        if (trim($this->adminNumber) === '*') {
            return true;
        }

        $numeroNorm = $this->normalizarNumeroBR($numero);
        $admins = explode(',', $this->adminNumber);

        foreach ($admins as $admin) {
            $adminClean = trim($admin);
            if (empty($adminClean)) continue;

            if ($numeroNorm === $this->normalizarNumeroBR($adminClean)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Verifica se o número pode interagir com o bot (aberto para admin, confecções, clientes e leads)
     */
    public function isAutorizado(string $numero): bool
    {
        return true;
    }

    /**
     * Identifica o perfil do remetente (admin, confecção parceira, cliente com pedido ou novo lead)
     */
    public function identificarRemetente(string $numero): array
    {
        if ($this->isAdmin($numero)) {
            return [
                'tipo'      => 'admin',
                'nome'      => 'Administrador',
                'confeccao' => null,
                'pedido'    => null,
            ];
        }

        $variants = $this->gerarVariacoesNumero($numero);

        // 1. Confecção cadastrada (mesmo sem login/senha)
        $confeccao = Confeccao::where(function ($q) use ($variants) {
            foreach ($variants as $v) {
                $q->orWhere('whatsapp', 'like', "%{$v}%")
                  ->orWhere('telefone', 'like', "%{$v}%");
            }
        })->first();

        if ($confeccao) {
            return [
                'tipo'      => 'confeccao',
                'nome'      => $confeccao->nome,
                'confeccao' => $confeccao,
                'pedido'    => null,
            ];
        }

        // 2. Cliente final com pedido registrado
        $pedido = Pedido::where(function ($q) use ($variants) {
            foreach ($variants as $v) {
                $q->orWhere('whatsapp_cliente', 'like', "%{$v}%")
                  ->orWhere('cliente_whatsapp', 'like', "%{$v}%");
            }
        })->latest()->first();

        if ($pedido) {
            return [
                'tipo'      => 'cliente',
                'nome'      => $pedido->nome_cliente ?? $pedido->cliente_nome ?? 'Cliente',
                'confeccao' => $pedido->confeccao,
                'pedido'    => $pedido,
            ];
        }

        // 3. Novo visitante / Lead
        return [
            'tipo'      => 'lead',
            'nome'      => null,
            'confeccao' => null,
            'pedido'    => null,
        ];
    }

    /**
     * Gera variações do número para buscas seguras (com/sem DDI 55, com/sem 9º dígito)
     */
    public function gerarVariacoesNumero(string $numero): array
    {
        $digits = preg_replace('/\D/', '', $numero);
        $variants = [$digits];

        $semDdi = $digits;
        if (str_starts_with($digits, '55') && strlen($digits) >= 12) {
            $semDdi = substr($digits, 2);
            $variants[] = $semDdi;
        } else {
            $variants[] = '55' . $digits;
        }

        if (strlen($semDdi) === 11 && $semDdi[2] === '9') {
            $sem9 = substr($semDdi, 0, 2) . substr($semDdi, 3);
            $variants[] = $sem9;
            $variants[] = '55' . $sem9;
        }

        if (strlen($semDdi) === 10) {
            $com9 = substr($semDdi, 0, 2) . '9' . substr($semDdi, 2);
            $variants[] = $com9;
            $variants[] = '55' . $com9;
        }

        if (strlen($semDdi) >= 8) {
            $variants[] = substr($semDdi, -8);
        }

        return array_values(array_unique(array_filter($variants)));
    }

    /**
     * Processa uma mensagem recebida e responde adequadamente ao perfil
     */
    public function processarMensagem(string $numero, string $mensagem): void
    {
        try {
            $mensagem = trim($mensagem);

            if (empty($mensagem)) {
                return;
            }

            Log::info("WhatsApp Bot: Mensagem de {$numero}: {$mensagem}");

            $remetente = $this->identificarRemetente($numero);
            $stateKey = 'wa_fluxo_pedido_' . $numero;
            $estado = Cache::get($stateKey);

            $msgLower = mb_strtolower($mensagem);

            // Verificação de cancelamento de fluxo
            if (in_array($msgLower, ['cancelar', 'sair', 'parar', 'cancela', 'abortar'])) {
                if ($estado) {
                    Cache::forget($stateKey);
                    $this->wa->enviarTexto($numero, "❌ *Criação de pedido cancelada.*\n\nSe precisar de ajuda ou consultar pedidos, digite *menu*.");
                    return;
                }
            }

            // Se o usuário está no meio do fluxo conversacional para criar um pedido
            if ($estado) {
                $resposta = $this->processarEtapaPedido($numero, $mensagem, $estado, $remetente);
                $this->wa->enviarTexto($numero, $resposta);
                return;
            }

            // Camada 1: Classificação local (0 tokens)
            $classificacao = $this->classificarLocal($mensagem);

            // Camada 2: Se não classificou localmente, tenta com IA
            if (!$classificacao) {
                $classificacao = $this->classificarComIA($mensagem);
            }

            $intencao = $classificacao['intencao'] ?? 'ajuda';

            // INTENÇÃO: Criar Novo Pedido via Chatbot
            if ($intencao === 'novo_pedido') {
                Cache::put($stateKey, [
                    'etapa'        => 'titulo',
                    'confeccao_id' => $remetente['confeccao']?->id ?? null,
                    'nome_cliente' => $remetente['nome'] ?? null,
                ], now()->addMinutes(30));

                $saudacao = !empty($remetente['nome']) ? "Olá, *{$remetente['nome']}*! " : "Olá! ";
                $resposta = "🎨 *{$saudacao}Vamos iniciar seu novo pedido de arte!* 👕\n"
                    . "━━━━━━━━━━━━━━━━━━━━━\n\n"
                    . "Por favor, informe o *título ou descrição da peça*:\n"
                    . "_(Ex: Camiseta Terceirão 2026, Fardamento Futebol Real Madrid, Polo Corporativa Azul)_\n\n"
                    . "_(Para cancelar a qualquer momento, digite *cancelar*)_";

                $this->wa->enviarTexto($numero, $resposta);
                return;
            }

            // INTENÇÃO: Consultar "Meus Pedidos"
            if ($intencao === 'meus_pedidos') {
                if ($remetente['tipo'] === 'confeccao') {
                    $resposta = $this->relatorioPedidosConfeccao($remetente['confeccao'], $numero);
                } elseif ($remetente['tipo'] === 'cliente') {
                    $resposta = $this->relatorioPedidosCliente($numero);
                } elseif ($remetente['tipo'] === 'admin') {
                    $resposta = $this->relatorioResumoGeral();
                } else {
                    $resposta = "🔍 *Consultar Pedidos*\n\nNão encontramos pedidos vinculados a este número.\n\n"
                        . "• Para fazer um pedido agora pelo WhatsApp, digite *Novo Pedido*.\n"
                        . "• Para consultar um pedido específico, digite *pedido #número* (ex: _pedido 12_).\n"
                        . "• Para rastrear no site: https://camisetadesign.com.br/rastreio?tel={$numero}";
                }

                $this->wa->enviarTexto($numero, $resposta);
                return;
            }

            // INTENÇÃO: Detalhe de Pedido Específico (#123)
            if ($intencao === 'detalhe_pedido' && !empty($classificacao['pedido_id'])) {
                $resposta = $this->relatorioDetalhePedidoSeguro($classificacao['pedido_id'], $remetente, $numero);
                $this->wa->enviarTexto($numero, $resposta);
                return;
            }

            // Roteamento por tipo de usuário:
            // 1. ADMIN: mantém comandos gerenciais completos
            if ($remetente['tipo'] === 'admin') {
                $resposta = $this->gerarResposta($classificacao, $mensagem);
                $this->wa->enviarTexto($numero, $resposta);
                return;
            }

            // 2. CONFECÇÃO CADASTRADA (mesmo sem login/senha)
            if ($remetente['tipo'] === 'confeccao') {
                if (in_array($intencao, ['pedidos_atrasados', 'prazos_entrega', 'resumo_geral', 'pedidos_por_status'])) {
                    $resposta = $this->relatorioPedidosConfeccao($remetente['confeccao'], $numero);
                } else {
                    $resposta = $this->mensagemAjudaConfeccao($remetente['confeccao'], $numero);
                }
                $this->wa->enviarTexto($numero, $resposta);
                return;
            }

            // 3. CLIENTE COM PEDIDO
            if ($remetente['tipo'] === 'cliente') {
                $resposta = $this->relatorioPedidosCliente($numero);
                $this->wa->enviarTexto($numero, $resposta);
                return;
            }

            // 4. VISITANTE / NOVO LEAD
            $resposta = $this->mensagemAjudaVisitante();
            $this->wa->enviarTexto($numero, $resposta);

        } catch (\Exception $e) {
            Log::error("WhatsApp Bot erro: " . $e->getMessage(), [
                'numero'   => $numero,
                'mensagem' => $mensagem,
                'trace'    => $e->getTraceAsString(),
            ]);

            try {
                $this->wa->enviarTexto($numero, "❌ Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente em instantes.");
            } catch (\Throwable $e2) {}
        }
    }

    /**
     * CAMADA 1: Classificação local via regex/keywords (0 tokens)
     */
    private function classificarLocal(string $mensagem): ?array
    {
        $mensagemLower = mb_strtolower($mensagem);

        foreach ($this->intencoes as $intencao => $padroes) {
            foreach ($padroes as $padrao) {
                if (preg_match('/' . $padrao . '/iu', $mensagemLower, $matches)) {
                    $resultado = [
                        'intencao'  => $intencao,
                        'via_ia'    => false,
                        'confianca' => 1.0,
                    ];

                    // Extrai ID do pedido se presente
                    if ($intencao === 'detalhe_pedido') {
                        // Pega o primeiro grupo de captura numérico
                        $id = null;
                        for ($i = 1; $i < count($matches); $i++) {
                            if (!empty($matches[$i]) && is_numeric($matches[$i])) {
                                $id = (int) $matches[$i];
                                break;
                            }
                        }
                        $resultado['pedido_id'] = $id;
                    }

                    // Extrai status se mencionado
                    if ($intencao === 'pedidos_por_status') {
                        $resultado['status'] = $this->extrairStatus($mensagemLower);
                    }

                    Log::info("WhatsApp Bot: Classificação LOCAL → {$intencao}");
                    return $resultado;
                }
            }
        }

        // Tenta extrair ID de pedido mesmo sem match de intenção
        if (preg_match('/\b(\d{1,6})\b/', $mensagem, $matches)) {
            $possivelId = (int) $matches[1];
            if ($possivelId > 0 && $possivelId < 999999) {
                if (Pedido::where('id', $possivelId)->exists()) {
                    Log::info("WhatsApp Bot: Classificação LOCAL → detalhe_pedido (ID detectado: {$possivelId})");
                    return [
                        'intencao'  => 'detalhe_pedido',
                        'via_ia'    => false,
                        'confianca' => 0.7,
                        'pedido_id' => $possivelId,
                    ];
                }
            }
        }

        return null;
    }

    /**
     * CAMADA 2: Classificação via IA — prompt curto (~100-200 tokens)
     */
    private function classificarComIA(string $mensagem): array
    {
        $apiKey = config('services.openrouter.key');

        if (!$apiKey) {
            Log::warning("WhatsApp Bot: Sem API key para IA, usando fallback");
            return ['intencao' => 'ajuda', 'via_ia' => false];
        }

        try {
            $response = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'HTTP-Referer'  => config('app.url'),
                    'X-Title'       => config('app.name'),
                    'Content-Type'  => 'application/json',
                ])
                ->post(config('services.openrouter.base_url') . '/chat/completions', [
                    'model'      => config('services.openrouter.model', 'anthropic/claude-sonnet-4-5'),
                    'max_tokens' => 80,
                    'temperature' => 0,
                    'messages'   => [
                        [
                            'role'    => 'system',
                            'content' => $this->promptClassificacao(),
                        ],
                        [
                            'role'    => 'user',
                            'content' => $mensagem,
                        ],
                    ],
                ]);

            if (!$response->ok()) {
                Log::error("WhatsApp Bot IA erro: " . $response->body());
                return ['intencao' => 'ajuda', 'via_ia' => true];
            }

            $rawText = $response->json('choices.0.message.content') ?? '';

            // Tenta extrair JSON da resposta
            if (preg_match('/\{[^}]+\}/m', $rawText, $m)) {
                $resultado = json_decode($m[0], true);
            } else {
                $resultado = json_decode($rawText, true);
            }

            if ($resultado && isset($resultado['intencao'])) {
                $resultado['via_ia'] = true;
                Log::info("WhatsApp Bot: Classificação IA → {$resultado['intencao']}");
                return $resultado;
            }

            Log::warning("WhatsApp Bot: IA não retornou JSON válido: {$rawText}");
            return ['intencao' => 'ajuda', 'via_ia' => true];

        } catch (\Exception $e) {
            Log::error("WhatsApp Bot IA exception: " . $e->getMessage());
            return ['intencao' => 'ajuda', 'via_ia' => false];
        }
    }

    /**
     * Prompt curto para classificação de intenção via IA (~100 tokens de input)
     */
    private function promptClassificacao(): string
    {
        return 'Classifique a intenção do usuário em uma destas categorias para um sistema de gestão de pedidos de camisetas. Retorne APENAS JSON, sem texto extra.

Categorias:
- novo_pedido: quer fazer um novo pedido, encomendar arte ou criar fardamento
- meus_pedidos: quer consultar seus próprios pedidos ou acompanhar status
- resumo_geral: quer ver todos os pedidos gerais do sistema (admin)
- pedidos_atrasados: quer ver pedidos em atraso
- prazos_entrega: quer ver datas de entrega
- detalhe_pedido: quer detalhes de um pedido específico (extraia pedido_id se mencionado)
- dashboard: quer estatísticas gerais
- pedidos_por_status: quer pedidos de um status específico (extraia status: aguardando_briefing|em_producao|aguardando_aprovacao|aprovado|finalizado|cancelado)
- ajuda: não entendeu ou quer saber os comandos

Formato: {"intencao":"categoria","pedido_id":null,"status":null}';
    }

    /**
     * Gera a resposta formatada baseada na intenção classificada
     */
    private function gerarResposta(array $classificacao, string $mensagemOriginal): string
    {
        $intencao = $classificacao['intencao'] ?? 'ajuda';

        return match ($intencao) {
            'resumo_geral'       => $this->relatorioResumoGeral(),
            'pedidos_atrasados'  => $this->relatorioPedidosAtrasados(),
            'prazos_entrega'     => $this->relatorioPrazosEntrega(),
            'detalhe_pedido'     => $this->relatorioDetalhePedido($classificacao['pedido_id'] ?? null),
            'dashboard'          => $this->relatorioDashboard(),
            'pedidos_por_status' => $this->relatorioPorStatus($classificacao['status'] ?? null),
            'ajuda'              => $this->mensagemAjuda(),
            default              => $this->mensagemAjuda(),
        };
    }

    // ═══════════════════════════════════════════════════════════
    // RELATÓRIOS
    // ═══════════════════════════════════════════════════════════

    private function relatorioResumoGeral(): string
    {
        $pedidos = Pedido::with('confeccao')
            ->whereNotIn('status', ['cancelado', 'finalizado'])
            ->orderBy('prazo')
            ->get();

        if ($pedidos->isEmpty()) {
            return "📋 *Resumo de Pedidos*\n\n✅ Nenhum pedido ativo no momento!";
        }

        $texto = "📋 *Resumo de Pedidos Ativos*\n";
        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n\n";

        $porStatus = $pedidos->groupBy('status');

        foreach ($porStatus as $status => $grupo) {
            $emoji = $this->emojiStatus($status);
            $label = Pedido::STATUS_LABELS[$status] ?? $status;
            $texto .= "{$emoji} *{$label}* ({$grupo->count()})\n";

            foreach ($grupo->take(5) as $p) {
                $prazo = $p->prazo ? $p->prazo->format('d/m') : 'Sem prazo';
                $atrasado = $p->estaAtrasado() ? ' ⚠️' : '';
                $confeccao = $p->confeccao?->nome ?? '';
                $texto .= "  • #{$p->id} {$p->titulo} — {$prazo}{$atrasado}\n";
                if ($confeccao) {
                    $texto .= "    _({$confeccao})_\n";
                }
            }

            if ($grupo->count() > 5) {
                $restante = $grupo->count() - 5;
                $texto .= "  _... e mais {$restante}_\n";
            }

            $texto .= "\n";
        }

        $totalAtrasados = $pedidos->filter(fn($p) => $p->estaAtrasado())->count();
        if ($totalAtrasados > 0) {
            $texto .= "⚠️ *{$totalAtrasados} pedido(s) em atraso!*\n";
            $texto .= "_Envie \"atrasados\" para ver detalhes._\n";
        }

        $texto .= "\n📊 *Total: {$pedidos->count()} pedidos ativos*";

        return $texto;
    }

    private function relatorioPedidosAtrasados(): string
    {
        $atrasados = Pedido::with('confeccao')
            ->whereNotNull('prazo')
            ->where('prazo', '<', now()->toDateString())
            ->whereNotIn('status', ['aprovado', 'finalizado', 'cancelado'])
            ->orderBy('prazo')
            ->get();

        if ($atrasados->isEmpty()) {
            return "✅ *Pedidos em Atraso*\n\nNenhum pedido em atraso! Tudo em dia. 🎉";
        }

        $texto = "🚨 *Pedidos em Atraso*\n";
        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n\n";

        foreach ($atrasados as $p) {
            $diasAtraso = $p->prazo->diffInDays(now());
            $emoji = $diasAtraso >= 7 ? '🔴' : ($diasAtraso >= 3 ? '🟠' : '🟡');
            $statusLabel = Pedido::STATUS_LABELS[$p->status] ?? $p->status;
            $confeccao = $p->confeccao?->nome ?? 'N/A';

            $texto .= "{$emoji} *#{$p->id} — {$p->titulo}*\n";
            $texto .= "  📅 Prazo: {$p->prazo->format('d/m/Y')} (*{$diasAtraso} dias*)\n";
            $texto .= "  📌 Status: {$statusLabel}\n";
            $texto .= "  🏭 Confecção: {$confeccao}\n\n";
        }

        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n";
        $texto .= "📊 *Total: {$atrasados->count()} em atraso*";

        return $texto;
    }

    private function relatorioPrazosEntrega(): string
    {
        $pedidos = Pedido::with('confeccao')
            ->whereNotNull('prazo')
            ->whereNotIn('status', ['finalizado', 'cancelado'])
            ->orderBy('prazo')
            ->get();

        if ($pedidos->isEmpty()) {
            return "📅 *Prazos de Entrega*\n\nNenhum pedido com prazo definido no momento.";
        }

        $texto = "📅 *Prazos de Entrega*\n";
        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n\n";

        $hoje = now()->startOfDay();

        // Agrupa: atrasados, hoje, esta semana, próximas semanas
        $grupos = [
            'atrasados'  => $pedidos->filter(fn($p) => $p->prazo->lt($hoje)),
            'hoje'       => $pedidos->filter(fn($p) => $p->prazo->isToday()),
            'semana'     => $pedidos->filter(fn($p) => $p->prazo->gt($hoje) && $p->prazo->lte($hoje->copy()->addDays(7))),
            'proximas'   => $pedidos->filter(fn($p) => $p->prazo->gt($hoje->copy()->addDays(7))),
        ];

        if ($grupos['atrasados']->isNotEmpty()) {
            $texto .= "🔴 *ATRASADOS*\n";
            foreach ($grupos['atrasados'] as $p) {
                $dias = $p->prazo->diffInDays(now());
                $texto .= "  ⚠️ #{$p->id} {$p->titulo} — {$p->prazo->format('d/m')} ({$dias}d atrás)\n";
            }
            $texto .= "\n";
        }

        if ($grupos['hoje']->isNotEmpty()) {
            $texto .= "🟡 *HOJE*\n";
            foreach ($grupos['hoje'] as $p) {
                $texto .= "  ⏰ #{$p->id} {$p->titulo}\n";
            }
            $texto .= "\n";
        }

        if ($grupos['semana']->isNotEmpty()) {
            $texto .= "🟢 *PRÓXIMOS 7 DIAS*\n";
            foreach ($grupos['semana'] as $p) {
                $diasRestantes = now()->diffInDays($p->prazo);
                $texto .= "  📆 #{$p->id} {$p->titulo} — {$p->prazo->format('d/m')} ({$diasRestantes}d)\n";
            }
            $texto .= "\n";
        }

        if ($grupos['proximas']->isNotEmpty()) {
            $texto .= "🔵 *MAIS DE 7 DIAS*\n";
            foreach ($grupos['proximas']->take(10) as $p) {
                $texto .= "  📆 #{$p->id} {$p->titulo} — {$p->prazo->format('d/m/Y')}\n";
            }
            if ($grupos['proximas']->count() > 10) {
                $texto .= "  _... e mais " . ($grupos['proximas']->count() - 10) . "_\n";
            }
            $texto .= "\n";
        }

        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n";
        $texto .= "📊 *Total: {$pedidos->count()} pedidos com prazo*";

        return $texto;
    }

    private function relatorioDetalhePedido(?int $id): string
    {
        if (!$id) {
            return "🔍 *Detalhe do Pedido*\n\nInforme o número do pedido.\nExemplo: _\"pedido 42\"_ ou _\"#42\"_";
        }

        $pedido = Pedido::with(['confeccao', 'arteAtiva', 'ultimaAprovacao'])->find($id);

        if (!$pedido) {
            return "❌ Pedido *#{$id}* não encontrado.";
        }

        $statusLabel = Pedido::STATUS_LABELS[$pedido->status] ?? $pedido->status;
        $emoji = $this->emojiStatus($pedido->status);
        $prazo = $pedido->prazo ? $pedido->prazo->format('d/m/Y') : 'Não definido';
        $atrasado = $pedido->estaAtrasado() ? "\n⚠️ *ATRASADO!*" : '';
        $confeccao = $pedido->confeccao?->nome ?? 'N/A';
        $tipo = ucfirst($pedido->tipo_impressao ?? 'N/A');
        $cliente = $pedido->nome_cliente ?? 'Não informado';
        $criado = $pedido->created_at->format('d/m/Y H:i');
        $atualizado = $pedido->updated_at->format('d/m/Y H:i');

        $texto  = "🔍 *Pedido #{$pedido->id}*\n";
        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n\n";
        $texto .= "📝 *Título:* {$pedido->titulo}\n";
        $texto .= "{$emoji} *Status:* {$statusLabel}{$atrasado}\n";
        $texto .= "🎨 *Tipo:* {$tipo}\n";
        $texto .= "🏭 *Confecção:* {$confeccao}\n";
        $texto .= "👤 *Cliente:* {$cliente}\n";
        $texto .= "📅 *Prazo:* {$prazo}\n";
        $texto .= "🕐 *Criado:* {$criado}\n";
        $texto .= "🔄 *Atualizado:* {$atualizado}\n";

        if ($pedido->observacoes) {
            $obs = mb_strlen($pedido->observacoes) > 200
                ? mb_substr($pedido->observacoes, 0, 200) . '...'
                : $pedido->observacoes;
            $texto .= "\n💬 *Observações:*\n{$obs}\n";
        }

        if ($pedido->arteAtiva) {
            $texto .= "\n🖼️ *Arte ativa:* v{$pedido->arteAtiva->versao}\n";
        }

        if ($pedido->ultimaAprovacao) {
            $decisao = $pedido->ultimaAprovacao->decisao ?? 'pendente';
            $texto .= "✅ *Última aprovação:* {$decisao}\n";
        }

        return $texto;
    }

    private function relatorioDashboard(): string
    {
        $porStatus = Pedido::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $statusZerados = array_fill_keys(Pedido::STATUS, 0);
        $porStatus = array_merge($statusZerados, $porStatus);

        $totalGeral = array_sum($porStatus);
        $totalAtivos = $totalGeral - ($porStatus['cancelado'] ?? 0);

        $atrasados = Pedido::whereNotNull('prazo')
            ->where('prazo', '<', now()->toDateString())
            ->whereNotIn('status', ['aprovado', 'finalizado', 'cancelado'])
            ->count();

        $recentes = Pedido::where('created_at', '>=', now()->subDays(7))->count();

        $texto  = "📊 *Dashboard — Camiseta Design*\n";
        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n\n";

        foreach (Pedido::STATUS_LABELS as $status => $label) {
            $emoji = $this->emojiStatus($status);
            $qtd = $porStatus[$status] ?? 0;
            $texto .= "{$emoji} {$label}: *{$qtd}*\n";
        }

        $texto .= "\n━━━━━━━━━━━━━━━━━━━━━\n";
        $texto .= "📦 Total geral: *{$totalGeral}*\n";
        $texto .= "🔄 Ativos: *{$totalAtivos}*\n";
        $texto .= "🚨 Em atraso: *{$atrasados}*\n";
        $texto .= "🆕 Novos (7 dias): *{$recentes}*\n";

        // Uso por confecção
        $confeccoes = Confeccao::where('ativo', true)
            ->orderBy('nome')
            ->get(['nome', 'plano', 'limite_mensal', 'artes_usadas_mes']);

        if ($confeccoes->isNotEmpty()) {
            $texto .= "\n🏭 *Uso por Confecção:*\n";
            foreach ($confeccoes as $c) {
                $pct = $c->limite_mensal > 0
                    ? round(($c->artes_usadas_mes / $c->limite_mensal) * 100)
                    : 0;
                $barra = $this->barraProgresso($pct);
                $texto .= "  {$c->nome}: {$barra} {$c->artes_usadas_mes}/{$c->limite_mensal}\n";
            }
        }

        return $texto;
    }

    private function relatorioPorStatus(?string $status): string
    {
        if (!$status || !in_array($status, Pedido::STATUS)) {
            return "📌 *Pedidos por Status*\n\nInforme o status desejado:\n"
                . "• em produção\n• aguardando briefing\n• aguardando aprovação\n"
                . "• aprovados\n• finalizados\n• cancelados";
        }

        $pedidos = Pedido::with('confeccao')
            ->where('status', $status)
            ->orderByDesc('updated_at')
            ->get();

        $label = Pedido::STATUS_LABELS[$status] ?? $status;
        $emoji = $this->emojiStatus($status);

        if ($pedidos->isEmpty()) {
            return "{$emoji} *{$label}*\n\nNenhum pedido com este status.";
        }

        $texto = "{$emoji} *Pedidos: {$label}*\n";
        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n\n";

        foreach ($pedidos->take(15) as $p) {
            $prazo = $p->prazo ? $p->prazo->format('d/m') : '';
            $confeccao = $p->confeccao?->nome ?? '';
            $atrasado = $p->estaAtrasado() ? ' ⚠️' : '';
            $texto .= "• *#{$p->id}* {$p->titulo}";
            if ($prazo) $texto .= " — {$prazo}{$atrasado}";
            if ($confeccao) $texto .= "\n  _({$confeccao})_";
            $texto .= "\n";
        }

        if ($pedidos->count() > 15) {
            $texto .= "\n_... e mais " . ($pedidos->count() - 15) . " pedidos_\n";
        }

        $texto .= "\n📊 *Total: {$pedidos->count()}*";

        return $texto;
    }

    private function mensagemAjuda(): string
    {
        return "🤖 *Assistente Camiseta Design*\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n\n"
            . "Comandos disponíveis:\n\n"
            . "📋 *\"resumo\"* — Ver todos os pedidos ativos\n"
            . "🚨 *\"atrasados\"* — Pedidos em atraso\n"
            . "📅 *\"prazos\"* ou *\"entregas\"* — Datas de entrega\n"
            . "🔍 *\"pedido 42\"* — Detalhes do pedido #42\n"
            . "📊 *\"dashboard\"* — Estatísticas gerais\n"
            . "📌 *\"em produção\"* — Pedidos por status\n\n"
            . "💡 _Você também pode perguntar em linguagem natural!_\n"
            . "Exemplos:\n"
            . "  • _\"O que está atrasado?\"_\n"
            . "  • _\"Quando entrega o pedido 15?\"_\n"
            . "  • _\"Quantos pedidos temos?\"_";
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    private function emojiStatus(string $status): string
    {
        return match ($status) {
            'aguardando_briefing'  => '📝',
            'em_producao'          => '🔨',
            'aguardando_aprovacao' => '⏳',
            'aprovado'             => '✅',
            'finalizado'           => '🎉',
            'cancelado'            => '❌',
            default                => '📌',
        };
    }

    private function extrairStatus(string $mensagem): ?string
    {
        $mapa = [
            'em produ[cç][aã]o'      => 'em_producao',
            'aguardando briefing'     => 'aguardando_briefing',
            'aguardando aprova'       => 'aguardando_aprovacao',
            'aprovado'                => 'aprovado',
            'finalizado'              => 'finalizado',
            'cancelado'               => 'cancelado',
        ];

        foreach ($mapa as $padrao => $status) {
            if (preg_match('/' . $padrao . '/iu', $mensagem)) {
                return $status;
            }
        }

        return null;
    }

    private function barraProgresso(int $pct): string
    {
        $pct = min(100, max(0, $pct));
        $preenchido = (int) round($pct / 10);
        $vazio = 10 - $preenchido;

        $barra = str_repeat('█', $preenchido) . str_repeat('░', $vazio);

        if ($pct >= 90) return "🔴 {$barra} {$pct}%";
        if ($pct >= 70) return "🟡 {$barra} {$pct}%";
        return "🟢 {$barra} {$pct}%";
    }

    // ═══════════════════════════════════════════════════════════
    // FLUXO INTERATIVO & RELATÓRIOS POR PERFIL (CONFECÇÃO / CLIENTE)
    // ═══════════════════════════════════════════════════════════

    /**
     * Processa cada etapa da máquina de estados para criação de pedido via WhatsApp
     */
    private function processarEtapaPedido(string $numero, string $mensagem, array $estado, array $remetente): string
    {
        $stateKey = 'wa_fluxo_pedido_' . $numero;
        $etapa = $estado['etapa'] ?? 'titulo';

        // ETAPA 1: Coleta o Título da Peça
        if ($etapa === 'titulo') {
            $estado['titulo'] = $mensagem;
            $estado['etapa'] = 'tipo_impressao';
            Cache::put($stateKey, $estado, now()->addMinutes(30));

            return "👕 *Tipo de Estampa / Produção:*\n\n"
                . "Qual o processo deste pedido?\n\n"
                . "*1* — Sublimação Total (Fardamento Esportivo / Terceirão)\n"
                . "*2* — Bordado (Polos / Jalecos / Bonés)\n"
                . "*3* — Serigrafia / Silk (Algodão / Moda)\n\n"
                . "_Responda apenas com *1*, *2* ou *3*._";
        }

        // ETAPA 2: Coleta o Tipo de Impressão
        if ($etapa === 'tipo_impressao') {
            $opcao = trim(mb_strtolower($mensagem));
            $tipo = match ($opcao) {
                '1', 'sublimacao', 'sublimação' => 'sublimacao',
                '2', 'bordado' => 'bordado',
                '3', 'serigrafia', 'silk' => 'serigrafia',
                default => null,
            };

            if (!$tipo) {
                return "⚠️ Por favor, escolha uma opção válida:\n\n"
                    . "*1* — Sublimação Total\n"
                    . "*2* — Bordado\n"
                    . "*3* — Serigrafia / Silk\n\n"
                    . "_(Ou digite *cancelar* para desistir)_";
            }

            $estado['tipo_impressao'] = $tipo;
            $estado['etapa'] = 'observacoes';
            Cache::put($stateKey, $estado, now()->addMinutes(30));

            $tipoNome = match ($tipo) {
                'sublimacao' => 'Sublimação Total',
                'bordado'    => 'Bordado',
                'serigrafia' => 'Serigrafia / Silk',
            };

            return "📝 *Detalhes e Observações ({$tipoNome})*\n\n"
                . "Descreva cores predominantes, mascote, referências, posições ou quantidade de peças.\n\n"
                . "_(Se não tiver observações agora, digite *nenhuma*)_";
        }

        // ETAPA 3: Coleta Observações e Cria o Pedido no Banco
        if ($etapa === 'observacoes') {
            $obsLower = mb_strtolower(trim($mensagem));
            $obs = ($obsLower === 'nenhuma' || $obsLower === 'nao' || $obsLower === 'não') ? null : $mensagem;

            $confeccaoId = $estado['confeccao_id'] ?? null;
            if (!$confeccaoId) {
                // Tenta associar à primeira confecção ativa ou cria stub
                $primeira = Confeccao::where('ativo', true)->first();
                $confeccaoId = $primeira?->id ?? 1;
            }

            $pedido = Pedido::create([
                'confeccao_id'     => $confeccaoId,
                'titulo'           => $estado['titulo'],
                'tipo_impressao'   => $estado['tipo_impressao'],
                'status'           => 'aguardando_briefing',
                'observacoes'      => $obs,
                'whatsapp_cliente' => $numero,
                'nome_cliente'     => $remetente['nome'] ?? 'Cliente WhatsApp',
            ]);

            Cache::forget($stateKey);

            $tipoNome = match ($pedido->tipo_impressao) {
                'sublimacao' => 'Sublimação Total',
                'bordado'    => 'Bordado',
                'serigrafia' => 'Serigrafia / Silk',
                default      => $pedido->tipo_impressao,
            };

            // Notifica Admin no WhatsApp
            if (!empty($this->adminNumber)) {
                try {
                    $admins = explode(',', $this->adminNumber);
                    $adminDestino = trim($admins[0]);
                    if (!empty($adminDestino) && $adminDestino !== '*') {
                        $msgAdmin = "🚨 *Novo Pedido via WhatsApp Bot!*\n"
                            . "━━━━━━━━━━━━━━━━━━━━━\n"
                            . "• *Pedido:* #{$pedido->id} — {$pedido->titulo}\n"
                            . "• *Cliente / Confecção:* " . ($remetente['nome'] ?? 'Cliente WhatsApp') . "\n"
                            . "• *WhatsApp:* {$numero}\n"
                            . "• *Processo:* {$tipoNome}\n"
                            . ($obs ? "• *Obs:* {$obs}\n" : "")
                            . "\n👉 Acesse o painel: https://camisetadesign.com.br/pedidos/{$pedido->id}";
                        $this->wa->enviarTexto($adminDestino, $msgAdmin);
                    }
                } catch (\Throwable $te) {
                    Log::error("WhatsApp Bot: Erro ao notificar admin: " . $te->getMessage());
                }
            }

            return "✅ *Pedido Criado com Sucesso!*\n"
                . "━━━━━━━━━━━━━━━━━━━━━\n\n"
                . "📋 *Resumo:*\n"
                . "• *Pedido:* #{$pedido->id}\n"
                . "• *Título:* {$pedido->titulo}\n"
                . "• *Processo:* {$tipoNome}\n"
                . "• *Status:* 📝 Aguardando Briefing / Produção\n"
                . ($obs ? "• *Obs:* {$obs}\n" : "")
                . "\n🎨 Nossa equipe já foi acionada para iniciar sua arte!\n\n"
                . "Acompanhe seus pedidos em tempo real:\n"
                . "👉 https://camisetadesign.com.br/rastreio?tel={$numero}\n\n"
                . "_Se precisar de mais alguma informação, basta mandar uma mensagem!_";
        }

        Cache::forget($stateKey);
        return "⚠️ Fluxo reiniciado. Como posso te ajudar?";
    }

    /**
     * Relatório de pedidos pertencentes a uma confecção específica
     */
    public function relatorioPedidosConfeccao(Confeccao $confeccao, string $numero): string
    {
        $pedidos = Pedido::where('confeccao_id', $confeccao->id)
            ->whereNotIn('status', ['cancelado'])
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        if ($pedidos->isEmpty()) {
            return "📦 *Olá, {$confeccao->nome}!* 👋\n\n"
                . "Você não possui pedidos ativos no momento.\n\n"
                . "💡 Deseja iniciar uma nova arte? Digite *Novo Pedido*!";
        }

        $texto = "📦 *Pedidos Ativos — {$confeccao->nome}*\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n\n";

        foreach ($pedidos as $p) {
            $emoji = $this->emojiStatus($p->status);
            $label = Pedido::STATUS_LABELS[$p->status] ?? $p->status;
            $prazo = $p->prazo ? $p->prazo->format('d/m') : 'A definir';
            $atrasado = $p->estaAtrasado() ? ' ⚠️' : '';

            $texto .= "{$emoji} *#{$p->id} — {$p->titulo}*\n";
            $texto .= "  • Status: *{$label}*\n";
            $texto .= "  • Prazo: {$prazo}{$atrasado}\n";

            if ($p->status === 'aguardando_aprovacao') {
                $texto .= "  • 👉 *Aprovar arte:* https://camisetadesign.com.br/aprovar/{$p->token_aprovacao}\n";
            }
            $texto .= "\n";
        }

        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n";
        $texto .= "🎨 Para fazer outro pedido, digite *Novo Pedido*.\n";
        $texto .= "🌐 Acompanhe no portal: https://camisetadesign.com.br/rastreio?tel={$numero}";

        return $texto;
    }

    /**
     * Relatório de pedidos para cliente final
     */
    public function relatorioPedidosCliente(string $numero): string
    {
        $variants = $this->gerarVariacoesNumero($numero);

        $pedidos = Pedido::where(function ($q) use ($variants) {
            foreach ($variants as $v) {
                $q->orWhere('whatsapp_cliente', 'like', "%{$v}%")
                  ->orWhere('cliente_whatsapp', 'like', "%{$v}%");
            }
        })
        ->orderBy('created_at', 'desc')
        ->limit(10)
        ->get();

        if ($pedidos->isEmpty()) {
            return "🔍 *Seus Pedidos*\n\nNenhum pedido encontrado para o seu número.\n\n"
                . "Para criar uma nova arte, digite *Novo Pedido*.";
        }

        $texto = "📦 *Seus Pedidos — Camiseta Design*\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n\n";

        foreach ($pedidos as $p) {
            $emoji = $this->emojiStatus($p->status);
            $label = Pedido::STATUS_LABELS[$p->status] ?? $p->status;
            $prazo = $p->prazo ? $p->prazo->format('d/m') : 'A definir';

            $texto .= "{$emoji} *#{$p->id} — {$p->titulo}*\n";
            $texto .= "  • Status: *{$label}*\n";
            $texto .= "  • Prazo: {$prazo}\n";

            if ($p->status === 'aguardando_aprovacao') {
                $texto .= "  • 👉 *Aprovar arte:* https://camisetadesign.com.br/aprovar/{$p->token_aprovacao}\n";
            }
            $texto .= "\n";
        }

        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n";
        $texto .= "🌐 Acompanhe no portal: https://camisetadesign.com.br/rastreio?tel={$numero}";

        return $texto;
    }

    /**
     * Detalhes seguros de um pedido com validação de pertencimento
     */
    public function relatorioDetalhePedidoSeguro(int $pedidoId, array $remetente, string $numero): string
    {
        $pedido = Pedido::with(['confeccao', 'arteAtiva', 'ultimaAprovacao'])->find($pedidoId);

        if (!$pedido) {
            return "❌ Pedido *#{$pedidoId}* não foi encontrado.";
        }

        if ($remetente['tipo'] === 'confeccao' && $pedido->confeccao_id !== $remetente['confeccao']?->id) {
            return "⚠️ O pedido *#{$pedidoId}* não pertence à sua conta de confecção.";
        }

        $emoji = $this->emojiStatus($pedido->status);
        $statusLabel = Pedido::STATUS_LABELS[$pedido->status] ?? $pedido->status;
        $prazo = $pedido->prazo ? $pedido->prazo->format('d/m/Y') : 'Em definição';
        $tipo = ucfirst($pedido->tipo_impressao ?? 'Sublimação');

        $texto = "🔍 *Pedido #{$pedido->id} — {$pedido->titulo}*\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n\n"
            . "{$emoji} *Status:* {$statusLabel}\n"
            . "👕 *Tipo:* {$tipo}\n"
            . "📅 *Prazo:* {$prazo}\n";

        if ($pedido->observacoes) {
            $texto .= "📝 *Observações:* {$pedido->observacoes}\n";
        }

        if ($pedido->status === 'aguardando_aprovacao') {
            $texto .= "\n👉 *Aprovar Arte Online:*\n"
                . "https://camisetadesign.com.br/aprovar/{$pedido->token_aprovacao}\n";
        } elseif ($pedido->status === 'aprovado' || $pedido->status === 'finalizado') {
            $texto .= "\n✅ *Arte aprovada com sucesso!* Pronta para estampar.\n";
        }

        return $texto;
    }

    /**
     * Menu de ajuda para Confecções cadastradas
     */
    public function mensagemAjudaConfeccao(Confeccao $confeccao, string $numero): string
    {
        return "🤖 *Olá, {$confeccao->nome}!* 👋\n"
            . "Sou o assistente virtual da *Camiseta Design*.\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n\n"
            . "Como posso ajudar você hoje?\n\n"
            . "📦 *\"Meus Pedidos\"* — Ver a lista e status dos seus pedidos\n"
            . "🎨 *\"Novo Pedido\"* — Encomendar uma nova arte ou fardamento\n"
            . "🔍 *\"Pedido #12\"* — Ver detalhes de um pedido específico\n"
            . "🌐 *\"Rastreio\"* — Link do portal de acompanhamento\n\n"
            . "💡 Você também pode perguntar naturalmente, ex:\n"
            . "• _\"Como tá o fardamento do Real?\"_\n"
            . "• _\"Tem alguma arte aguardando aprovação?\"_";
    }

    /**
     * Menu de ajuda para Visitantes / Novos Leads
     */
    public function mensagemAjudaVisitante(): string
    {
        return "👋 *Olá! Bem-vindo à Camiseta Design!* 🎨👕\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Somos especialistas em criação e vetorização de artes para fardamentos esportivos, camisetas escolares e moda.\n\n"
            . "Como posso te ajudar hoje?\n\n"
            . "🎨 *\"Novo Pedido\"* — Encomendar arte ou fardamento\n"
            . "🔍 *\"Rastrear\"* — Consultar o andamento de um pedido\n"
            . "🌐 *Nosso Site:* https://camisetadesign.com.br\n"
            . "🖼️ *Portfólio:* https://camisetadesign.com.br/portfolio\n\n"
            . "Se preferir, deixe sua mensagem que um designer falará com você em breve!";
    }
}

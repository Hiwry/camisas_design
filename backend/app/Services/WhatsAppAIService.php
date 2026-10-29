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
        'resumo_geral' => [
            'resumo', 'pedidos', 'relat[oó]rio', 'todos os pedidos',
            'como est[aã]o os pedidos', 'vis[aã]o geral', 'overview',
            'me manda os pedidos', 'quero ver os pedidos', 'lista de pedidos',
            'quantos pedidos', 'meus pedidos',
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
     * Verifica se o número é autorizado a usar o chatbot
     */
    public function isAutorizado(string $numero): bool
    {
        if (empty($this->adminNumber)) {
            return false;
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
     * Normaliza número brasileiro para DDD + 8 dígitos (remove DDI 55 e nono dígito opcional)
     */
    private function normalizarNumeroBR(string $numero): string
    {
        $num = preg_replace('/[^0-9]/', '', $numero);

        if (str_starts_with($num, '55') && strlen($num) >= 12) {
            $num = substr($num, 2);
        }

        if (strlen($num) === 11 && $num[2] === '9') {
            $num = substr($num, 0, 2) . substr($num, 3);
        }

        return $num;
    }

    /**
     * Processa uma mensagem recebida e retorna a resposta
     */
    public function processarMensagem(string $numero, string $mensagem): void
    {
        try {
            $mensagem = trim($mensagem);

            if (empty($mensagem)) {
                return;
            }

            Log::info("WhatsApp Bot: Mensagem recebida de {$numero}: {$mensagem}");

            // Camada 1: Classificação local (sem IA, 0 tokens)
            $classificacao = $this->classificarLocal($mensagem);

            // Camada 2: Se não classificou localmente, tenta com IA (poucos tokens)
            if (!$classificacao) {
                $classificacao = $this->classificarComIA($mensagem);
            }

            // Gerar resposta baseada na intenção
            $resposta = $this->gerarResposta($classificacao, $mensagem);

            // Enviar resposta via WhatsApp
            $this->wa->enviarTexto($numero, $resposta);

            Log::info("WhatsApp Bot: Resposta enviada para {$numero}", [
                'intencao' => $classificacao['intencao'] ?? 'desconhecida',
                'usou_ia'  => $classificacao['via_ia'] ?? false,
            ]);
        } catch (\Exception $e) {
            Log::error("WhatsApp Bot erro: " . $e->getMessage(), [
                'numero'   => $numero,
                'mensagem' => $mensagem,
                'trace'    => $e->getTraceAsString(),
            ]);

            // Tenta enviar mensagem de erro amigável
            try {
                $this->wa->enviarTexto($numero, "❌ Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.");
            } catch (\Exception $e2) {
                Log::error("WhatsApp Bot: Falha ao enviar erro: " . $e2->getMessage());
            }
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
- resumo_geral: quer ver todos os pedidos
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
}

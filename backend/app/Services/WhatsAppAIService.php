<?php

namespace App\Services;

use App\Models\Pedido;
use App\Models\Confeccao;
use App\Models\Grupo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;
use App\Services\Concerns\AtendimentoWhatsApp;

class WhatsAppAIService
{
    use AtendimentoWhatsApp;

    /** Confecção interna que recebe pedidos de clientes diretos (não é um parceiro, não conta cota) */
    public const NOME_CONFECCAO_DIRETA = 'Atendimento Direto (WhatsApp)';

    /** Número da conversa em processamento (usado por menus personalizados) */
    private ?string $numeroAtual = null;

    private WhatsAppService $wa;
    private string $adminNumber;

    /**
     * Mapeamento de intenções → palavras-chave (classificação local, sem IA)
     * Cada intenção tem um array de padrões regex
     */
    private array $intencoes = [
        'falar_humano' => [
            'atendente', 'atendimento humano', '\bhumano\b', 'falar com (?:algu[eé]m|uma pessoa|o dono|a equipe|um humano)',
            'pessoa real', 'quero falar com', 'reclama[cç][aã]o', 'preciso de ajuda urgente',
        ],
        'orcamento' => [
            'or[cç]amento', 'quanto custa', 'quanto (?:fica|sai|[eé]|cobra)', 'qual (?:o )?(?:valor|pre[cç]o)',
            '\bpre[cç]os?\b', 'tabela de pre', 'valores?\b', 'formas? de pagamento', 'como funciona o pedido',
        ],
        'portfolio' => [
            'portf[oó]lio', 'trabalhos? (?:j[aá] )?(?:feitos?|realizados?)', 'exemplos? de', 'cat[aá]logo', 'modelos? prontos?',
        ],
        'planos' => [
            '\bplanos?\b', 'mensalidade', 'ser parceir[oa]', 'virar parceir[oa]',
        ],
        'saldo' => [
            '\bsaldo\b', 'cr[eé]ditos?', 'artes? extras?', 'quantas artes', 'artes dispon[ií]veis',
        ],
        'rastreio_link' => [
            'link d[oe] (?:rastreio|acompanhamento)', '\bportal\b', 'link para acompanhar',
        ],
        'admin_confeccoes' => [
            'confec[cç][oõ]es', 'parceiras?', 'n[uú]meros? das? confec', 'lista de confec',
        ],
        'admin_avulsos' => [
            '\bavulsos?\b', 'compras? avulsas?', '\bshop\b', '\bloja\b', 'pix pendente', 'pagamentos? pendentes?',
        ],
        'pix' => [
            '\bpix\b', 'chave pix', 'como (?:eu )?pago', 'quero pagar', 'dados para pagamento', 'comprovante',
        ],
        'admin_leads' => [
            '\bleads?\b', 'novos? contatos?', 'primeiros? contatos?', '\bcontatos\b', 'quem (?:me )?chamou',
        ],
        'novo_pedido' => [
            '^\s*1\s*$', '^\s*1️⃣\s*$',
            '^\s*pedido\s*$', '^\s*pedidos\s*$', '^\s*novo\s*$',
            'novo pedido', 'fazer pedido', 'fazer um pedido', 'quero fazer um pedido',
            'criar pedido', 'encomendar', 'nova arte', 'quero uma arte', 'fazer fardamento',
            'solicitar arte', 'solicitar pedido', 'fazer camisa', 'encomenda',
            'realizar pedido', 'realizar um pedido', 'fazer arte', 'pedir arte',
        ],
        'meus_pedidos' => [
            '^\s*2\s*$', '^\s*2️⃣\s*$',
            'meus pedidos', 'meu pedido', 'como est[aá] meu pedido', 'onde est[aá] meu pedido',
            'status do meu pedido', 'acompanhar pedido', 'rastrear', 'rastreio',
            'ver meus pedidos', 'lista dos meus pedidos', 'consultar',
        ],
        'resumo_geral' => [
            '^\s*2\s*$', '^\s*2️⃣\s*$',
            'resumo', 'relat[oó]rio', 'todos os pedidos',
            'como est[aã]o os pedidos', 'vis[aã]o geral', 'overview',
            'me manda os pedidos', 'quero ver os pedidos', 'lista de pedidos',
            'quantos pedidos',
        ],
        'pedidos_atrasados' => [
            '^\s*3\s*$', '^\s*3️⃣\s*$',
            'atrasad[oa]s?', 'atraso', 'vencid[oa]s?', 'atras[oó]',
            'pendentes? atrasad', 'fora do prazo', 'prazo vencid',
            'o que est[aá] atrasado', 'tem algo atrasado', 'algum atraso',
        ],
        'prazos_entrega' => [
            '^\s*4\s*$', '^\s*4️⃣\s*$',
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
            '^\s*5\s*$', '^\s*5️⃣\s*$',
            'dashboard', 'estat[ií]sticas?', 'n[uú]meros', 'indicadores',
            'kpi', 'painel', 'status geral',
        ],
        'pedidos_por_status' => [
            'em produ[cç][aã]o', 'aguardando briefing', 'aguardando aprova[cç][aã]o',
            'aprovados?', 'finalizados?', 'cancelados?',
        ],
        'ajuda' => [
            '^\s*menu\s*$', '^\s*ajuda\s*$', '^\s*oi\s*$', '^\s*ol[aá]\s*$', '^\s*ola\s*$',
            '^\s*bom\s+dia\s*$', '^\s*boa\s+tarde\s*$', '^\s*boa\s+noite\s*$',
            'ajuda', 'help', 'comandos', 'o que voc[eê] faz',
            'menu', 'op[cç][oõ]es', 'como funciona', 'in[ií]cio', 'come[cç]ar',
        ],
    ];

    public function __construct(WhatsAppService $wa)
    {
        $this->wa = $wa;
        $this->adminNumber = config('services.evolution.admin_number', '');
    }

    /** Confecção interna para pedidos de clientes diretos (sem parceiro) */
    private function confeccaoDireta(): Confeccao
    {
        return Confeccao::firstOrCreate(
            ['nome' => self::NOME_CONFECCAO_DIRETA],
            ['plano' => 'avulso', 'limite_mensal' => 0, 'ativo' => true]
        );
    }

    private function hasColumnSafe(string $table, string $column): bool
    {
        static $cache = [];
        $key = "{$table}.{$column}";
        if (!isset($cache[$key])) {
            try {
                $cache[$key] = Schema::hasTable($table) && Schema::hasColumn($table, $column);
            } catch (\Throwable $e) {
                $cache[$key] = false;
            }
        }
        return $cache[$key];
    }

    /**
     * Normaliza número brasileiro removendo DDI 55 e nono dígito para comparações robustas
     * Retorna sempre DDD + 8 dígitos (10 dígitos limpos)
     */
    public function normalizarNumeroBR(?string $numero): string
    {
        if (!$numero) {
            return '';
        }

        $d = preg_replace('/\D/', '', $numero);
        if (empty($d)) {
            return '';
        }

        if (str_starts_with($d, '55') && strlen($d) >= 12) {
            $d = substr($d, 2);
        }

        if (strlen($d) === 11 && $d[2] === '9') {
            return substr($d, 0, 2) . substr($d, 3);
        }

        return $d;
    }

    /**
     * Compara se dois números representam o mesmo telefone brasileiro
     */
    public function numerosBatem(?string $numeroA, ?string $numeroB): bool
    {
        $normA = $this->normalizarNumeroBR($numeroA);
        $normB = $this->normalizarNumeroBR($numeroB);

        if (empty($normA) || empty($normB)) {
            return false;
        }

        return $normA === $normB;
    }

    /**
     * Valida de forma estrita se um pedido pertence ao telefone de WhatsApp informado
     */
    public function pedidoPertenceAoNumero(Pedido $pedido, string $numero): bool
    {
        $numeroNorm = $this->normalizarNumeroBR($numero);
        if (empty($numeroNorm)) {
            return false;
        }

        $telefones = array_filter([
            $pedido->cliente_whatsapp,
            $pedido->whatsapp_cliente,
        ]);

        foreach ($telefones as $tel) {
            if ($this->numerosBatem($tel, $numeroNorm)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Busca EXCLUSIVAMENTE os pedidos vinculados ao número de WhatsApp que está falando
     */
    public function buscarPedidosPorNumero(string $numero): \Illuminate\Support\Collection
    {
        $numeroNorm = $this->normalizarNumeroBR($numero);
        if (empty($numeroNorm) || strlen($numeroNorm) < 10) {
            return collect();
        }

        $ddd = substr($numeroNorm, 0, 2);
        $oitoDigitos = substr($numeroNorm, 2);
        $comNove = $ddd . '9' . $oitoDigitos;

        // Padrões para query LIKE rápida no banco cobrindo com/sem pontuação e com/sem 9
        $likePatterns = array_filter(array_unique([
            $numeroNorm,
            $comNove,
            '55' . $numeroNorm,
            '55' . $comNove,
            $oitoDigitos,
            substr($oitoDigitos, 0, 4) . '-' . substr($oitoDigitos, 4),
            substr($comNove, 2, 5) . '-' . substr($comNove, 7),
        ]));

        $hasWhatsappCliente = $this->hasColumnSafe('pedidos', 'whatsapp_cliente');
        $hasClienteWhatsapp = $this->hasColumnSafe('pedidos', 'cliente_whatsapp');

        $candidatos = Pedido::with(['confeccao', 'arteAtiva', 'ultimaAprovacao'])
            ->where(function ($q) use ($likePatterns, $hasWhatsappCliente, $hasClienteWhatsapp) {
                foreach ($likePatterns as $pat) {
                    if ($hasClienteWhatsapp) {
                        $q->orWhere('cliente_whatsapp', 'like', "%{$pat}%");
                    }
                    if ($hasWhatsappCliente) {
                        $q->orWhere('whatsapp_cliente', 'like', "%{$pat}%");
                    }
                }
            })
            ->orderBy('created_at', 'desc')
            ->get();

        // Filtro estrito: apenas pedidos cujo número normalizado bate exatamente com o do cliente
        return $candidatos->filter(fn(Pedido $p) => $this->pedidoPertenceAoNumero($p, $numero))->values();
    }

    /**
     * Busca grupos de camisas onde o cliente é responsável
     */
    public function buscarGruposPorNumero(string $numero): \Illuminate\Support\Collection
    {
        $numeroNorm = $this->normalizarNumeroBR($numero);
        if (empty($numeroNorm) || !Schema::hasTable('grupos') || !Schema::hasColumn('grupos', 'cliente_whatsapp')) {
            return collect();
        }

        return Grupo::whereNotNull('cliente_whatsapp')
            ->orderBy('created_at', 'desc')
            ->get()
            ->filter(fn(Grupo $g) => $this->numerosBatem($g->cliente_whatsapp, $numeroNorm))
            ->values();
    }

    /**
     * Verifica se o número é o administrador do sistema (comparação estrita de DDD + número)
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
        if (empty($numeroNorm)) {
            return false;
        }

        $admins = explode(',', $this->adminNumber);

        foreach ($admins as $admin) {
            $adminClean = trim($admin);
            if (empty($adminClean)) continue;

            $adminNorm = $this->normalizarNumeroBR($adminClean);
            if (!empty($adminNorm) && $numeroNorm === $adminNorm) {
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

        $numeroNorm = $this->normalizarNumeroBR($numero);

        // 1. Confecção cadastrada (mesmo sem login/senha)
        $temTelefone = $this->hasColumnSafe('confeccoes', 'telefone');
        $confeccoes = Confeccao::where('nome', '!=', self::NOME_CONFECCAO_DIRETA)->get();
        $confeccao = $confeccoes->first(function ($c) use ($numeroNorm, $temTelefone) {
            if ($this->numerosBatem($c->whatsapp, $numeroNorm)) {
                return true;
            }
            if ($temTelefone && $this->numerosBatem($c->telefone, $numeroNorm)) {
                return true;
            }
            return false;
        });

        if ($confeccao) {
            return [
                'tipo'      => 'confeccao',
                'nome'      => $confeccao->nome,
                'confeccao' => $confeccao,
                'pedido'    => null,
            ];
        }

        // 2. Cliente final com pedido(s) registrado(s) vinculado(s) a este número
        $pedidos = $this->buscarPedidosPorNumero($numero);
        $grupos = $this->buscarGruposPorNumero($numero);

        if ($pedidos->isNotEmpty() || $grupos->isNotEmpty()) {
            $primeiro = $pedidos->first();
            $nome = $primeiro?->nome_cliente ?? $primeiro?->cliente_nome ?? $grupos->first()?->cliente_nome ?? 'Cliente';
            return [
                'tipo'      => 'cliente',
                'nome'      => $nome,
                'confeccao' => $primeiro?->confeccao,
                'pedido'    => $primeiro,
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
     * Processa uma mensagem recebida e responde de forma personalizada ao perfil
     */
    public function processarMensagem(string $numero, string $mensagem, ?array $midiaInfo = null): void
    {
        try {
            $mensagem = trim($mensagem);

            if (empty($mensagem) && empty($midiaInfo)) {
                return;
            }

            $this->numeroAtual = $numero;
            Log::info("WhatsApp Bot: Mensagem de {$numero}: " . mb_substr($mensagem, 0, 200) . ($midiaInfo ? " [midia: {$midiaInfo['tipo']}]" : ""));

            $remetente = $this->identificarRemetente($numero);
            $tipo = $remetente['tipo'];
            $stateKey = 'wa_fluxo_pedido_' . $numero;
            $estado = Cache::get($stateKey);
            $msgLower = mb_strtolower($mensagem);

            // Memória de contatos: registra todo mundo que fala com o bot (primeiro contato, leads, etc.)
            $reg = $this->registrarContato($numero, $remetente, $mensagem);
            $contato = $reg['contato'];

            // Leads: se já se apresentou antes, lembramos o nome (atendimento personalizado)
            if ($tipo === 'lead' && empty($remetente['nome']) && $contato && !empty($contato->nome)) {
                $remetente['nome'] = $contato->nome;
            }

            // Aviso ao admin sobre NOVO primeiro contato
            if ($reg['novo'] && $tipo === 'lead') {
                $this->notificarAdmins(
                    "🆕 *Novo contato no WhatsApp!*\n━━━━━━━━━━━━━━━━━━━━━\n"
                    . "• *Número:* " . $this->formatarTelefone($numero) . "\n"
                    . "• *Mensagem:* " . mb_substr($mensagem !== '' ? $mensagem : '[mídia]', 0, 200) . "\n\n"
                    . "👉 " . $this->linkWa($numero)
                );
            }

            // ADMIN: comandos diretos (enviar / retomar / buscar)
            if ($tipo === 'admin' && !$estado) {
                $respCmd = $this->comandoAdmin($mensagem);
                if ($respCmd !== null) {
                    $this->responder($numero, $respCmd);
                    return;
                }
            }

            // Atendimento humano em andamento: o bot fica quieto e só repassa ao admin (no máx. 1 aviso / 30 min)
            if ($tipo !== 'admin' && Cache::has($this->chaveHumano($numero))) {
                if (Cache::add('wa_humano_aviso_' . $this->normalizarNumeroBR($numero), 1, now()->addMinutes(60))) {
                    $this->notificarAdmins(
                        "💬 *" . ($remetente['nome'] ?? 'Contato') . "* (" . $this->formatarTelefone($numero) . ") escreveu durante o atendimento humano:\n"
                        . "“" . mb_substr($mensagem, 0, 300) . "”\n👉 " . $this->linkWa($numero)
                    );
                }
                return;
            }

            // Cancelamento de fluxo
            if ($estado && in_array($msgLower, ['cancelar', 'sair', 'parar', 'cancela', 'abortar'])) {
                Cache::forget($stateKey);
                $this->responder($numero, "❌ *Pedido cancelado.*\n\nSem problema! Quando quiser retomar, digite *menu*.");
                return;
            }

            // Está no meio do fluxo de criação de pedido
            if ($estado) {
                // Pediu menu/ajuda/atendente no meio do fluxo: não perde o progresso
                if (in_array($msgLower, ['menu', 'ajuda'])) {
                    $this->responder($numero, "📝 Você está no meio de um pedido. Responda a última pergunta para continuar ou digite *cancelar* para sair.");
                    return;
                }
                if (preg_match('/\b(atendente|humano|pessoa|falar com algu[eé]m)\b/iu', $mensagem)) {
                    Cache::forget($stateKey);
                    $this->responder($numero, $this->solicitarHumano($numero, $remetente, $mensagem));
                    return;
                }
                $resposta = $this->processarEtapaPedido($numero, $mensagem, $estado, $remetente, $midiaInfo);
                $this->responder($numero, $resposta);
                return;
            }

            // FOTO/DOCUMENTO fora do fluxo: anexa ao último pedido ativo do cliente
            if (!empty($midiaInfo)) {
                if ($this->anexarMidiaAoUltimoPedido($numero, $remetente, $midiaInfo)) {
                    return;
                }
                if ($tipo === 'lead') {
                    $this->responder($numero, "📸 Recebi sua imagem, obrigado! Para ela ficar registrada no seu pedido, vamos começar rapidinho: digite *1* para iniciar o pedido e envie a foto novamente na etapa de observações. 😉");
                    return;
                }
            }

            // ─── Classificação de intenção ───
            $intencao = $this->atalhoNumerico($tipo, $mensagem);
            $classificacao = ['intencao' => $intencao, 'via_ia' => false];

            if (!$intencao) {
                $classificacao = $this->classificarLocal($mensagem);
                $intencao = $classificacao['intencao'] ?? null;
            }

            // Intenções exclusivas de admin não vazam para outros perfis
            if ($intencao && str_starts_with($intencao, 'admin_') && $tipo !== 'admin') {
                $intencao = null;
                $classificacao = null;
            }
            // Relatórios gerais do sistema também são só do admin: outros perfis veem apenas o que é seu
            if ($tipo !== 'admin' && in_array($intencao, ['dashboard'], true)) {
                $intencao = 'ajuda';
            }

            $respostaIA = null;
            if (!$intencao) {
                if ($tipo === 'admin') {
                    $classificacao = $this->classificarComIA($mensagem);
                    $intencao = $classificacao['intencao'] ?? 'ajuda';
                } else {
                    // Clientes/leads/confecções: uma única chamada de IA que classifica E responde
                    $respostaIA = $this->conversarComIA($mensagem, $remetente, $numero);
                    $intencao = $respostaIA['intencao'] ?? 'ajuda';
                    $classificacao = ['intencao' => $intencao, 'via_ia' => true];
                }
            }

            // Interesse registrado para o funil de leads
            if ($tipo === 'lead' && in_array($intencao, ['novo_pedido', 'orcamento', 'portfolio', 'falar_humano', 'planos'], true)) {
                $this->atualizarContato($numero, ['interesse' => $intencao]);
            }

            // ─── Intenções comuns a todos os perfis ───
            switch ($intencao) {
                case 'novo_pedido':
                    $this->responder($numero, $this->iniciarFluxoPedido($numero, $remetente, $mensagem));
                    return;

                case 'falar_humano':
                    $this->responder($numero, $this->solicitarHumano($numero, $remetente, $mensagem));
                    return;

                case 'orcamento':
                    $this->responder($numero, $this->respostaOrcamento());
                    return;

                case 'portfolio':
                    $this->responder($numero, $this->respostaPortfolio());
                    return;

                case 'planos':
                    $this->responder($numero, $this->respostaPlanos());
                    return;

                case 'rastreio_link':
                    $this->responder($numero, $this->respostaRastreio($numero));
                    return;

                case 'saldo':
                    $this->responder($numero, $tipo === 'confeccao'
                        ? $this->respostaSaldo($remetente['confeccao'])
                        : "ℹ️ O saldo de artes e créditos está disponível para confecções parceiras. Digite *5* para falar com a equipe.");
                    return;

                case 'pix':
                    if ($tipo === 'admin') {
                        $this->responder($numero, $this->relatorioOrcamentosAdmin());
                    } else {
                        $r = $this->respostaPixCliente($numero, $remetente);
                        if ($r) $this->responder($numero, $r);
                    }
                    return;

                case 'conversa':
                    if (!empty($respostaIA['resposta'])) {
                        $this->responder($numero, $respostaIA['resposta'] . "\n\n_Digite *menu* para ver as opções._");
                        return;
                    }
                    break;

                case 'detalhe_pedido':
                    if (!empty($classificacao['pedido_id'])) {
                        $this->responder($numero, $this->relatorioDetalhePedidoSeguro($classificacao['pedido_id'], $remetente, $numero));
                        return;
                    }
                    break;
            }

            // ─── Por perfil ───
            if ($tipo === 'admin') {
                $resposta = match ($intencao) {
                    'meus_pedidos', 'resumo_geral' => $this->relatorioResumoGeral(),
                    'pedidos_atrasados'  => $this->relatorioPedidosAtrasados(),
                    'prazos_entrega'     => $this->relatorioPrazosEntrega(),
                    'dashboard'          => $this->relatorioDashboard(),
                    'pedidos_por_status' => $this->relatorioPorStatus($classificacao['status'] ?? null),
                    'admin_confeccoes'   => $this->relatorioConfeccoesAdmin(),
                    'admin_avulsos'      => $this->relatorioAvulsosAdmin(),
                    'admin_leads'        => $this->relatorioLeadsAdmin(),
                    'admin_orcamentos'   => $this->relatorioOrcamentosAdmin(),
                    default              => $this->menuAdminPersonalizado(),
                };
                $this->responder($numero, $resposta);
                return;
            }

            if ($tipo === 'confeccao') {
                $resposta = in_array($intencao, ['meus_pedidos', 'pedidos_atrasados', 'prazos_entrega', 'resumo_geral', 'pedidos_por_status'], true)
                    ? $this->relatorioPedidosConfeccao($remetente['confeccao'], $numero)
                    : $this->menuConfeccaoPersonalizado($remetente['confeccao']);
                $this->responder($numero, $resposta);
                return;
            }

            if ($tipo === 'cliente') {
                if (in_array($intencao, ['meus_pedidos', 'pedidos_atrasados', 'prazos_entrega', 'resumo_geral', 'pedidos_por_status'], true)) {
                    $resposta = $this->relatorioPedidosCliente($numero, $intencao, $classificacao['status'] ?? null);
                } else {
                    $resposta = $this->menuCliente($remetente['nome'] ?? 'Cliente');
                }
                $this->responder($numero, $resposta);
                return;
            }

            // ─── LEAD / primeiro contato ───
            if (in_array($intencao, ['meus_pedidos', 'pedidos_atrasados', 'prazos_entrega', 'resumo_geral', 'pedidos_por_status'], true)) {
                $this->responder($numero, "🔍 *Consultar pedido*\n\nNão encontrei pedidos neste número de WhatsApp.\n\n"
                    . "• Se o pedido foi feito com *outro telefone*, consulte pelo portal: {$this->siteUrl()}/rastreio\n"
                    . "• Para fazer um pedido agora, digite *1*\n"
                    . "• Para falar com a equipe, digite *5*");
                return;
            }

            // Saudação / menu: boas-vindas personalizadas (reconhece lead que já falou antes)
            $retorno = $contato && !$reg['novo'] && $contato->total_mensagens > 1;
            $this->responder($numero, $this->menuLead($remetente['nome'] ?? null, $retorno));

        } catch (\Exception $e) {
            Log::error("WhatsApp Bot erro: " . $e->getMessage(), [
                'numero'   => $numero,
                'mensagem' => $mensagem,
                'trace'    => $e->getTraceAsString(),
            ]);

            try {
                $this->wa->enviarTexto($numero, "❌ Desculpe, tive um problema para processar sua mensagem. Tente novamente em instantes ou digite *5* para falar com um atendente.");
            } catch (\Throwable $e2) {}
        }
    }

    /**
     * Inicia o fluxo guiado de pedido, já personalizado pelo que sabemos do contato
     */
    private function iniciarFluxoPedido(string $numero, array $remetente, string $mensagemOriginal): string
    {
        $stateKey = 'wa_fluxo_pedido_' . $numero;
        $tipo = $remetente['tipo'];
        $nome = $tipo === 'admin' ? null : ($remetente['nome'] ?? null);
        $pn = $this->primeiroNome($nome);

        $estado = [
            'etapa'        => $nome ? 'titulo' : 'nome',
            'confeccao_id' => $remetente['confeccao']?->id ?? null,
            'nome_cliente' => $nome,
        ];

        // Se a primeira mensagem já traz detalhes (ex: "quero 30 camisas de futebol"), guardamos como observação prévia
        $semGatilho = trim(preg_replace('/^\s*(1|novo pedido|fazer pedido|quero fazer um pedido)\s*$/iu', '', $mensagemOriginal));
        if (mb_strlen($semGatilho) > 20) {
            $estado['obs_previa'] = mb_substr($semGatilho, 0, 500);
        }

        Cache::put($stateKey, $estado, now()->addMinutes(60));

        $rodape = "\n\n_(Para cancelar a qualquer momento, digite *cancelar*)_";

        if ($tipo === 'admin') {
            return "🎨 *Novo pedido (admin)*\n━━━━━━━━━━━━━━━━━━━━━\n\n*Qual é o nome do cliente ou da confecção?*" . $rodape;
        }

        if ($nome) {
            $extra = !empty($estado['obs_previa']) ? "\n_Anotei o que você escreveu e vou incluir nas observações._\n" : '';
            return "🎨 *{$this->saudacao()}, {$pn}! Vamos montar seu pedido* 👕\n━━━━━━━━━━━━━━━━━━━━━\n{$extra}\n"
                . "Qual é o *título ou descrição da peça*?\n"
                . "_(Ex: Camiseta Terceirão 2026, Fardamento Futebol, Polo Corporativa Azul)_" . $rodape;
        }

        return "🎨 *{$this->saudacao()}! Vamos montar seu pedido de arte* 👕\n━━━━━━━━━━━━━━━━━━━━━\n\n"
            . "Para começar, *qual é o seu nome?*" . $rodape;
    }

    /**
     * Anexa foto/documento recebido ao último pedido do cliente. Retorna true se tratou a mídia.
     */
    private function anexarMidiaAoUltimoPedido(string $numero, array $remetente, array $midiaInfo): bool
    {
        $ultimoPedidoId = Cache::get('wa_ultimo_pedido_' . $numero)
            ?? $this->buscarPedidosPorNumero($numero)->first()?->id;

        if (!$ultimoPedidoId) {
            return false;
        }

        $pedido = Pedido::find($ultimoPedidoId);
        // Segurança: só anexa se o pedido realmente pertence a este número (ou a confecção dele)
        if (!$pedido) {
            return false;
        }
        if ($remetente['tipo'] === 'confeccao') {
            if ($pedido->confeccao_id !== $remetente['confeccao']?->id) return false;
        } elseif ($remetente['tipo'] !== 'admin' && !$this->pedidoPertenceAoNumero($pedido, $numero)) {
            return false;
        }

        $arquivoSalvo = $this->salvarMidiaWhatsApp($midiaInfo, $pedido->id);
        if (!$arquivoSalvo) {
            return false;
        }

        $refs = $pedido->referencias ?? [];
        $refs[] = $arquivoSalvo;
        $pedido->referencias = $refs;
        $pedido->save();

        $comprovante = $this->pagamentoDisponivel() && $pedido->pagamento_status === 'aguardando_pagamento';
        if ($comprovante) {
            $this->responder($numero, "🧾 *Comprovante recebido!* Vamos conferir o pagamento do pedido *#{$pedido->id}* e liberar a produção em instantes. 🎨");
            $this->notificarAdmins("🧾 *Possível comprovante de pagamento!*\n• *Pedido:* #{$pedido->id} — {$pedido->titulo}\n• *Valor:* " . $this->brl((float) $pedido->valor) . "\n• *Cliente:* " . ($pedido->nome_cliente ?? $pedido->cliente_nome ?? '—') . " — " . $this->linkWa($numero) . "\n\nConfira no seu banco e confirme: *pago {$pedido->id}*\n👉 " . rtrim(config('app.url'), '/') . "/pedidos/{$pedido->id}");
            return true;
        }

        $pn = $this->primeiroNome($remetente['nome'] ?? null);
        $this->responder($numero, "📸 *Recebido" . ($pn ? ", {$pn}" : '') . "!* Anexei ao seu *Pedido #{$pedido->id} — {$pedido->titulo}*.\n\n"
            . "Pode mandar mais fotos ou arquivos por aqui, ou acompanhar pelo portal:\n👉 {$this->siteUrl()}/rastreio?tel={$numero}");

        $appUrl = rtrim(config('app.url'), '/');
        $this->notificarAdmins("📸 *Nova referência anexada via WhatsApp*\n• *Pedido:* #{$pedido->id} — {$pedido->titulo}\n• *Cliente:* " . ($pedido->nome_cliente ?? $pedido->cliente_nome ?? $remetente['nome'] ?? '—') . "\n• *Painel:* {$appUrl}/pedidos/{$pedido->id}");

        return true;
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

        // Tenta extrair ID de pedido se o usuário explicitamente mencionou pedido/ordem ou digitou apenas o número
        if (preg_match('/^\s*#?(\d{1,6})\s*$/', $mensagem, $matches) || preg_match('/(?:pedido|ordem)\s*(?:n[uú]mero\s*|n[ºo]\s*|#\s*)?(\d{1,6})/iu', $mensagem, $matches)) {
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
        return "👋 *Olá! Bem-vindo ao Assistente Camiseta Design* 🎨👕\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Aqui você pode gerenciar a produção ou *realizar novos pedidos de arte diretamente pelo WhatsApp!*\n\n"
            . "📌 *O que você deseja fazer?*\n\n"
            . "1️⃣ *\"novo pedido\"* — Registrar um novo pedido de arte/fardamento agora\n"
            . "2️⃣ *\"resumo\"* — Ver todos os pedidos ativos\n"
            . "3️⃣ *\"atrasados\"* — Pedidos em atraso ou urgentes\n"
            . "4️⃣ *\"prazos\"* — Consultar próximas datas de entrega\n"
            . "5️⃣ *\"dashboard\"* — Estatísticas e status da produção\n\n"
            . "🔍 *\"pedido 42\"* — Detalhes de um pedido específico\n"
            . "📌 *\"em produção\"* — Filtrar pedidos por status\n\n"
            . "💡 _Você pode responder digitando o número (ex: *1* ou *2*) ou perguntar naturalmente:_\n"
            . "  • _\"novo pedido\"_\n"
            . "  • _\"O que está atrasado?\"_\n"
            . "  • _\"Quando entrega o pedido 15?\"_";
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
    private function processarEtapaPedido(string $numero, string $mensagem, array $estado, array $remetente, ?array $midiaInfo = null): string
    {
        $stateKey = 'wa_fluxo_pedido_' . $numero;
        $etapa = $estado['etapa'] ?? 'nome';

        // ETAPA 0: Coleta o Nome do Cliente (essencial para números sem cadastro)
        if ($etapa === 'nome') {
            $nomeLimpo = $this->limparNomeUsuario($mensagem);

            if (mb_strlen($nomeLimpo) < 2) {
                return "👋 Por favor, informe seu nome ou como prefere ser chamado para identificarmos seu pedido:\n\n_(Ex: Carlos Silva)_";
            }

            $estado['nome_cliente'] = $nomeLimpo;
            $this->atualizarContato($numero, ['nome' => $nomeLimpo]);
            $estado['etapa'] = 'titulo';
            Cache::put($stateKey, $estado, now()->addMinutes(60));

            return "Prazer em te conhecer, *{$nomeLimpo}*! 😊\n\n"
                . "Agora me conta: *qual é o modelo, peça ou título do seu pedido?*\n"
                . "_(Ex: Camiseta Terceirão 2026, Fardamento de Futebol, Camisa Polo Corporativa, Regata de Basquete)_\n\n"
                . "_(Para cancelar a qualquer momento, digite *cancelar*)_";
        }

        // ETAPA 1: Coleta o Título da Peça
        if ($etapa === 'titulo') {
            $titulo = trim($mensagem);
            if (mb_strlen($titulo) < 2) {
                return "👕 Por favor, informe uma descrição ou título para sua peça (Ex: Camiseta Terceirão, Fardamento Futebol):";
            }

            $estado['titulo'] = $titulo;
            $estado['etapa'] = 'tipo_impressao';
            Cache::put($stateKey, $estado, now()->addMinutes(60));

            return "👕 *Tipo de Estampa / Produção:*\n\n"
                . "Qual o processo deste pedido?\n\n"
                . "*1* — Sublimação Total (Fardamento Esportivo / Terceirão / Atléticas)\n"
                . "*2* — Bordado (Polos / Jalecos / Bonés)\n"
                . "*3* — Serigrafia / Silk (Camisetas Algodão / Moda / Eventos)\n\n"
                . "_Responda apenas com *1*, *2* ou *3*._\n\n"
                . "_(Para cancelar a qualquer momento, digite *cancelar*)_";
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
            $estado['etapa'] = 'quantidade';
            Cache::put($stateKey, $estado, now()->addMinutes(60));

            return "🔢 *Quantidade aproximada*

"
                . "Quantas peças você pretende produzir?
"
                . "_(Ex: 25, 120 — ou digite *não sei* se ainda não definiu)_";
        }

        // ETAPA 2.5: Quantidade estimada
        if ($etapa === 'quantidade') {
            $txt = mb_strtolower(trim($mensagem));
            $qtd = null;
            if (preg_match('/(\d{1,5})/', $txt, $mq)) {
                $qtd = (int) $mq[1];
            }
            if ($qtd === null && !preg_match('/n[aã]o sei|depois|indefinid|a definir|ainda n[aã]o/iu', $txt)) {
                return "🔢 Me diga só o *número aproximado de peças* (ex: 30), ou *não sei* se ainda não definiu.";
            }

            $estado['quantidade'] = $qtd && $qtd > 0 ? (string) $qtd : 'a definir';
            $estado['etapa'] = 'observacoes';
            Cache::put($stateKey, $estado, now()->addMinutes(60));

            $tipoNome = match ($estado['tipo_impressao'] ?? 'sublimacao') {
                'sublimacao' => 'Sublimação Total',
                'bordado'    => 'Bordado',
                'serigrafia' => 'Serigrafia / Silk',
                default      => 'Produção',
            };
            $previa = !empty($estado['obs_previa']) ? "
_Já anotei: “" . mb_substr($estado['obs_previa'], 0, 80) . "”. Se não tiver mais nada, digite *nenhuma*._
" : '';

            return "📝 *Detalhes e observações ({$tipoNome})*
{$previa}
"
                . "Descreva cores, referências e detalhes, ou *envie fotos da peça/estampa direto aqui*:

"
                . "_(Se preferir explicar depois, basta digitar *nenhuma*)_";
        }

        // ETAPA 3: Coleta Observações / Foto e Cria o Pedido no Banco
        if ($etapa === 'observacoes') {
            $obsLower = mb_strtolower(trim($mensagem));
            $obs = ($obsLower === 'nenhuma' || $obsLower === 'nao' || $obsLower === 'não' || $obsLower === '[foto/referência enviada]') ? null : $mensagem;

            if ($obs === null && !empty($estado['obs_previa'])) {
                $obs = $estado['obs_previa'];
            }
            if (!empty($estado['quantidade'])) {
                $obs = trim(($obs ?? '') . "
Quantidade estimada: " . $estado['quantidade']);
            }

            // Salva foto de referência enviada nesta etapa se houver
            $referenciasIniciais = $estado['referencias'] ?? [];
            if (!empty($midiaInfo)) {
                $fotoSalva = $this->salvarMidiaWhatsApp($midiaInfo);
                if ($fotoSalva) {
                    $referenciasIniciais[] = $fotoSalva;
                }
            }

            // Busca ou associa à confecção correta
            $confeccao = null;
            if (!empty($estado['confeccao_id'])) {
                $confeccao = Confeccao::find($estado['confeccao_id']);
            }
            if (!$confeccao && !empty($remetente['confeccao'])) {
                $confeccao = $remetente['confeccao'];
            }
            if (!$confeccao) {
                // Cliente direto: nunca atribuímos a uma confecção parceira aleatória
                $confeccao = $this->confeccaoDireta();
            }

            $slaHoras = Confeccao::PLANOS[$confeccao->plano]['sla_horas'] ?? 48;
            $prazoCalculado = now()->addHours($slaHoras);

            $nomeCliente = $estado['nome_cliente'] ?? $remetente['nome'] ?? 'Cliente WhatsApp';

            try {
                $dadosPedido = [
                    'confeccao_id'   => $confeccao->id,
                    'titulo'         => $estado['titulo'] ?? 'Pedido via WhatsApp',
                    'tipo_impressao' => $estado['tipo_impressao'] ?? 'sublimacao',
                    'status'         => 'aguardando_briefing',
                    'observacoes'    => $obs,
                    'prazo'          => $prazoCalculado,
                    'referencias'    => !empty($referenciasIniciais) ? $referenciasIniciais : null,
                ];

                if ($this->hasColumnSafe('pedidos', 'cliente_whatsapp')) {
                    $dadosPedido['cliente_whatsapp'] = $numero;
                }
                if ($this->hasColumnSafe('pedidos', 'whatsapp_cliente')) {
                    $dadosPedido['whatsapp_cliente'] = $numero;
                }

                if ($this->hasColumnSafe('pedidos', 'cliente_nome')) {
                    $dadosPedido['cliente_nome'] = $nomeCliente;
                }
                if ($this->hasColumnSafe('pedidos', 'nome_cliente')) {
                    $dadosPedido['nome_cliente'] = $nomeCliente;
                }

                // Cliente direto (sem confecção parceira): produção só depois de orçamento + Pix pago
                $exigePagamento = $confeccao->nome === self::NOME_CONFECCAO_DIRETA && $this->pagamentoDisponivel();
                if ($exigePagamento) {
                    $dadosPedido['pagamento_status'] = 'aguardando_orcamento';
                }

                $pedido = Pedido::create($dadosPedido);

                // Incrementa contador da confecção
                if (method_exists($confeccao, 'incrementarArteUsada') && $confeccao->nome !== self::NOME_CONFECCAO_DIRETA) {
                    $confeccao->incrementarArteUsada();
                }

                Cache::forget($stateKey);

                // Salva em cache o último pedido do usuário para anexar fotos subsequentes
                Cache::put('wa_ultimo_pedido_' . $numero, $pedido->id, now()->addDays(2));

                // Funil de leads: contato convertido em pedido
                if ($this->contatosDisponivel()) {
                    try {
                        $this->atualizarContato($numero, ['status' => 'convertido', 'nome' => $nomeCliente]);
                        \App\Models\WhatsAppContato::where('numero', $this->normalizarNumeroBR($numero))->increment('pedidos_criados');
                    } catch (\Throwable $ec) {}
                }
            } catch (\Throwable $e) {
                Log::error("WhatsApp Bot: Erro ao criar pedido no banco: " . $e->getMessage(), [
                    'estado' => $estado,
                    'numero' => $numero,
                ]);
                Cache::forget($stateKey);
                throw $e;
            }

            $tipoNome = match ($pedido->tipo_impressao) {
                'sublimacao' => 'Sublimação Total',
                'bordado'    => 'Bordado',
                'serigrafia' => 'Serigrafia / Silk',
                default      => $pedido->tipo_impressao,
            };

            // Notifica TODOS os admins no WhatsApp
            $appUrl = rtrim(config('app.url'), '/');
            $perfilTxt = match ($remetente['tipo']) {
                'confeccao' => 'Confecção parceira',
                'cliente'   => 'Cliente recorrente',
                'admin'     => 'Admin',
                default     => 'Novo cliente (1º contato)',
            };
            $this->notificarAdmins("🚨 *Novo Pedido via WhatsApp Bot!*
"
                . "━━━━━━━━━━━━━━━━━━━━━
"
                . "• *Pedido:* #{$pedido->id} — {$pedido->titulo}
"
                . "• *Cliente:* {$nomeCliente} ({$perfilTxt})
"
                . "• *WhatsApp:* " . $this->formatarTelefone($numero) . " — " . $this->linkWa($numero) . "
"
                . "• *Processo:* {$tipoNome}
"
                . ($obs ? "• *Obs:* {$obs}
" : "")
                . (!empty($referenciasIniciais) ? "• *Fotos anexadas:* " . count($referenciasIniciais) . " arquivo(s)
" : "")
                . (!empty($exigePagamento) ? "\n💰 *Defina o valor e envie o Pix ao cliente:*\n➜ *valor {$pedido->id} 150*\n" : '')
                . "\n👉 Painel: {$appUrl}/pedidos/{$pedido->id}");

            $prazoTxt = $pedido->prazo ? $pedido->prazo->format('d/m/Y') : null;
            $urlRastreio = rtrim(config('app.url'), '/') . "/rastreio?tel={$numero}";

            $avisoFoto = !empty($referenciasIniciais)
                ? "📸 *Foto de referência anexada com sucesso ao pedido!* ✅\n\n"
                : "";

            return "🎉 *Excelente, {$nomeCliente}! Seu pedido foi criado com sucesso!* 👕🎨\n"
                . "━━━━━━━━━━━━━━━━━━━━━\n\n"
                . "📋 *Resumo do Pedido:*\n"
                . "• *Pedido:* #{$pedido->id}\n"
                . "• *Peça:* {$pedido->titulo}\n"
                . "• *Processo:* {$tipoNome}\n"
                . ($prazoTxt ? "• *Previsão Inicial:* {$prazoTxt}\n" : "")
                . "• *Status:* 📝 Aguardando Briefing / Criação\n"
                . ($obs ? "• *Obs:* {$obs}\n" : "")
                . "\n" . $avisoFoto
                . (!empty($exigePagamento)
                    ? "💰 *Próximo passo:* nossa equipe vai preparar o *orçamento* e enviar o valor e o *Pix* aqui mesmo, neste WhatsApp.\n🎨 A criação da arte começa assim que o pagamento for confirmado.\n\n"
                    : "🎨 Nossa equipe de designers já recebeu seus dados e vai iniciar sua arte!\n\n")
                . "📸 *Deseja enviar mais fotos, logos ou referências da estampa?*\n"
                . "• Você pode mandar as fotos diretamente aqui no WhatsApp 💬\n"
                . "• Ou anexar fotos através do link do seu pedido:\n"
                . "👉 {$urlRastreio} 🌐\n\n"
                . "_Muito obrigado pela preferência! Se precisar de algo, é só mandar mensagem._";
        }

        Cache::forget($stateKey);
        return "⚠️ Fluxo reiniciado. Como posso te ajudar?";
    }

    /**
     * Salva a mídia recebida pelo WhatsApp (imagem/documento) em storage/pedidos/referencias
     */
    public function salvarMidiaWhatsApp(array $midiaInfo, ?int $pedidoId = null): ?array
    {
        try {
            $base64 = $midiaInfo['base64'] ?? null;
            $mimetype = $midiaInfo['mimetype'] ?? 'image/jpeg';

            // Se não veio base64 direto no webhook, tenta buscar na Evolution API
            if (empty($base64) && !empty($midiaInfo['msgDados'])) {
                $busca = $this->wa->obterMidiaBase64($midiaInfo['msgDados']);
                if ($busca && !empty($busca['base64'])) {
                    $base64 = $busca['base64'];
                    $mimetype = $busca['mimetype'] ?? $mimetype;
                }
            }

            if (empty($base64)) {
                Log::warning("salvarMidiaWhatsApp: Não foi possível obter base64 da mídia.");
                return null;
            }

            // Remove cabeçalho data:image/...;base64, se existir
            if (str_contains($base64, ',')) {
                $base64 = explode(',', $base64)[1];
            }

            $binaryData = base64_decode($base64);
            if (!$binaryData) {
                Log::warning("salvarMidiaWhatsApp: Falha ao decodificar base64.");
                return null;
            }

            $ext = match ($mimetype) {
                'image/png'               => 'png',
                'image/webp'              => 'webp',
                'image/gif'               => 'gif',
                'application/pdf'         => 'pdf',
                'image/jpeg', 'image/jpg' => 'jpg',
                default                   => 'jpg',
            };

            $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
            $pasta = 'pedidos/referencias';
            $prefix = $pedidoId ? "ref_pedido_{$pedidoId}_" : "ref_wa_";
            $filename = $prefix . uniqid() . '.' . $ext;
            $path = "{$pasta}/{$filename}";

            Storage::disk($disk)->put($path, $binaryData);

            $url = Storage::disk($disk)->url($path);

            // Garante URL absoluta caso o disco seja public local
            if (!str_starts_with($url, 'http')) {
                $url = rtrim(config('app.url'), '/') . '/' . ltrim($url, '/');
            }

            Log::info("salvarMidiaWhatsApp: Imagem salva com sucesso em {$path} (URL: {$url})");

            return [
                'url'      => $url,
                'nome'     => "WhatsApp_Ref_" . date('dmy_Hi') . ".{$ext}",
                'tipo'     => $ext,
                'tamanho'  => strlen($binaryData),
            ];
        } catch (\Throwable $e) {
            Log::error("salvarMidiaWhatsApp erro: " . $e->getMessage());
            return null;
        }
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
     * Relatório de pedidos para cliente final — EXCLUSIVAMENTE os pedidos do seu número
     */
    public function relatorioPedidosCliente(string $numero, ?string $intencao = null, ?string $filtroStatus = null): string
    {
        $pedidos = $this->buscarPedidosPorNumero($numero);
        $grupos = $this->buscarGruposPorNumero($numero);

        if ($pedidos->isEmpty() && $grupos->isEmpty()) {
            return "🔍 *Seus Pedidos*\n\nNenhum pedido encontrado vinculado ao seu número de WhatsApp.\n\n"
                . "• Para criar uma nova arte ou fardamento, digite *Novo Pedido*.\n"
                . "• Se o seu pedido foi cadastrado com outro telefone, entre em contato com nossa equipe para atualizarmos seu contato.";
        }

        // Filtro por status específico solicitado (ex: "aprovados", "em produção")
        if ($filtroStatus) {
            $pedidos = $pedidos->filter(fn(Pedido $p) => $p->status === $filtroStatus)->values();
        }

        // Filtro se pediu apenas atrasados
        if ($intencao === 'pedidos_atrasados') {
            $pedidos = $pedidos->filter(fn(Pedido $p) => $p->estaAtrasado())->values();
            if ($pedidos->isEmpty()) {
                return "✅ *Seus Pedidos — Prazos*\n\nNenhum dos seus pedidos está em atraso! Tudo dentro do cronograma. 🎉\n\n"
                    . "Digite *Meus Pedidos* para ver o status completo.";
            }
        }

        $texto = "📦 *Seus Pedidos — Camiseta Design*\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n\n";

        if ($pedidos->isNotEmpty()) {
            foreach ($pedidos as $p) {
                $emoji = $this->emojiStatus($p->status);
                $label = Pedido::STATUS_LABELS[$p->status] ?? $p->status;
                $prazo = $p->prazo ? $p->prazo->format('d/m/Y') : 'A definir';

                $texto .= "{$emoji} *#{$p->id} — {$p->titulo}*\n";
                $texto .= "  • Status: *{$label}*\n";
                $texto .= "  • Prazo de entrega: {$prazo}\n";
                $texto .= $this->linhaPagamento($p);

                if ($p->status === 'aguardando_aprovacao') {
                    $texto .= "  • 👉 *Aprovar arte:* https://camisetadesign.com.br/aprovar/{$p->token_aprovacao}\n";
                }
                $texto .= "\n";
            }
        }

        // Grupos de Camisas vinculados ao número
        if ($grupos->isNotEmpty()) {
            $texto .= "👕 *Seus Grupos de Camisas:*\n";
            foreach ($grupos as $g) {
                $labelStatus = ucfirst(str_replace('_', ' ', $g->status));
                $texto .= "  • *{$g->nome}* (Status: {$labelStatus})\n";
                $texto .= "    👉 Link do grupo: https://camisetadesign.com.br/grupo/{$g->token}\n\n";
            }
        }

        $texto .= "━━━━━━━━━━━━━━━━━━━━━\n";
        $texto .= "🌐 Acompanhe detalhes no portal: https://camisetadesign.com.br/rastreio?tel={$numero}";

        return $texto;
    }

    /**
     * Detalhes seguros de um pedido com validação estrita de pertencimento
     */
    public function relatorioDetalhePedidoSeguro(int $pedidoId, array $remetente, string $numero): string
    {
        $pedido = Pedido::with(['confeccao', 'arteAtiva', 'ultimaAprovacao'])->find($pedidoId);

        if (!$pedido) {
            return "❌ Pedido *#{$pedidoId}* não foi encontrado.";
        }

        // Validação estrita de segurança e pertencimento:
        // Apenas Administradores do sistema podem ver pedidos de qualquer cliente.
        if ($remetente['tipo'] !== 'admin') {
            if ($remetente['tipo'] === 'confeccao') {
                if ($pedido->confeccao_id !== $remetente['confeccao']?->id) {
                    return "⚠️ O pedido *#{$pedidoId}* não pertence à sua conta de confecção.";
                }
            } else {
                // Cliente ou visitante: SÓ pode acessar pedidos vinculados ao seu próprio número de WhatsApp
                if (!$this->pedidoPertenceAoNumero($pedido, $numero)) {
                    return "⚠️ O pedido *#{$pedidoId}* não está vinculado ao seu número de WhatsApp ({$numero}).\n\nPor questões de privacidade e segurança, você só tem acesso aos seus próprios pedidos.";
                }
            }
        }

        $emoji = $this->emojiStatus($pedido->status);
        $statusLabel = Pedido::STATUS_LABELS[$pedido->status] ?? $pedido->status;
        $prazo = $pedido->prazo ? $pedido->prazo->format('d/m/Y') : 'Em definição';
        $tipo = ucfirst($pedido->tipo_impressao ?? 'Sublimação');

        $texto = "🔍 *Pedido #{$pedido->id} — {$pedido->titulo}*\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n\n"
            . "{$emoji} *Status:* {$statusLabel}\n"
            . "👕 *Tipo:* {$tipo}\n"
            . "📅 *Prazo:* {$prazo}\n"
            . str_replace('  • ', '💳 ', $this->linhaPagamento($pedido));

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
        return "👋 *Olá, {$confeccao->nome}!* 🎨👕\n"
            . "Sou o assistente virtual da *Camiseta Design*.\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Aqui você pode acompanhar suas artes ou *realizar novos pedidos diretamente pelo WhatsApp!*\n\n"
            . "📌 *Como posso ajudar você hoje?*\n\n"
            . "1️⃣ *\"Novo Pedido\"* — Encomendar uma nova arte ou fardamento agora\n"
            . "2️⃣ *\"Meus Pedidos\"* — Ver status e andamento das suas artes\n"
            . "3️⃣ *\"Prazos\"* — Previsão de entrega dos seus pedidos\n"
            . "4️⃣ *\"Rastreio\"* — Link do portal de acompanhamento\n\n"
            . "🔍 *\"Pedido #12\"* — Detalhes de um pedido específico\n\n"
            . "💡 _Responda com o número (ex: *1*) ou escreva o que você precisa!_";
    }

    /**
     * Menu de ajuda para Clientes cadastrados
     */
    public function mensagemAjudaCliente(string $nome, string $numero): string
    {
        return "👋 *Olá, {$nome}! Bem-vindo à Camiseta Design!* 🎨👕\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Aqui você pode acompanhar suas artes ou *realizar novos pedidos diretamente pelo WhatsApp!*\n\n"
            . "📌 *Como posso ajudar você hoje?*\n\n"
            . "1️⃣ *\"Novo Pedido\"* — Encomendar uma nova arte ou fardamento agora\n"
            . "2️⃣ *\"Meus Pedidos\"* — Acompanhar status dos seus pedidos\n"
            . "3️⃣ *\"Rastreio\"* — Ver detalhes e link de aprovação no portal\n\n"
            . "💡 _Digite o número da opção (ex: *1*) ou envie uma mensagem!_";
    }

    /**
     * Menu de ajuda para Visitantes / Novos Leads
     */
    public function mensagemAjudaVisitante(): string
    {
        return "👋 *Olá! Bem-vindo à Camiseta Design!* 🎨👕\n"
            . "━━━━━━━━━━━━━━━━━━━━━\n"
            . "Somos especialistas em criação e vetorização de artes para fardamentos esportivos, camisetas escolares e eventos.\n\n"
            . "✨ *Você pode realizar o seu pedido de arte diretamente aqui pelo WhatsApp!*\n\n"
            . "📌 *Como posso te ajudar hoje?*\n\n"
            . "1️⃣ *\"Novo Pedido\"* — Encomendar arte ou fardamento agora\n"
            . "2️⃣ *\"Rastrear\"* — Consultar o andamento de um pedido\n"
            . "🌐 *Nosso Site:* https://camisetadesign.com.br\n"
            . "🖼️ *Portfólio:* https://camisetadesign.com.br/portfolio\n\n"
            . "💡 _Digite *1* para iniciar seu pedido ou envie uma mensagem!_";
    }

    /**
     * Limpa e padroniza o nome do usuário coletado no WhatsApp
     */
    public function limparNomeUsuario(string $texto): string
    {
        $nome = trim($texto);
        $nome = rtrim($nome, '.!,;:?');

        // Remove saudações e prefixos comuns em português
        $padroes = [
            '/^(?:ol[aá]|oi|oii|oiee|bom\s+dia|boa\s+tarde|boa\s+noite)[,!\s]+/iu',
            '/^(?:meu\s+nome\s+[eé]|me\s+chamo|sou\s+(?:o|a)?|aqui\s+[eé]\s+(?:o|a)?|pode\s+me\s+chamar\s+de)\s+/iu',
        ];
        foreach ($padroes as $p) {
            $nome = preg_replace($p, '', $nome);
        }

        $nome = trim($nome);
        if (empty($nome) || mb_strlen($nome) > 60) {
            $nome = mb_substr(trim($texto), 0, 60);
        }

        return mb_convert_case($nome, MB_CASE_TITLE, 'UTF-8');
    }
}

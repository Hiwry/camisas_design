<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\ShopPedido;
use App\Models\ShopItem;
use App\Services\PixService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ShopController extends Controller
{
    private PixService $pixService;

    public function __construct(PixService $pixService)
    {
        $this->pixService = $pixService;
    }

    /**
     * Catálogo completo de itens e serviços avulsos
     */
    public static function catalogo(): array
    {
        return [
            [
                'id'              => 'arte_avulsa_1',
                'nome'            => '1 Arte Avulsa Extra',
                'categoria'       => 'artes',
                'quantidade'      => 1,
                'valor'           => 35.00,
                'valor_original'  => 35.00,
                'descricao'       => 'Adicione 1 arte extra à sua conta para criar um novo pedido imediatamente.',
                'entrega_sla'     => 'Liberação imediata',
                'badge'           => 'Essencial',
                'destaque'        => false,
                'icone'           => 'palette',
                'imagem'          => '/shop/arte_avulsa_1.jpg',
                'itens_inclusos'  => [
                    '+1 crédito de pedido no Kanban',
                    'Sem necessidade de mudar de plano',
                    'SLA de entrega padrão do seu plano',
                    'Saldo cumulativo sem prazo de validade',
                ],
            ],
            [
                'id'              => 'arte_avulsa_3',
                'nome'            => 'Combo 3 Artes Avulsas',
                'categoria'       => 'artes',
                'quantidade'      => 3,
                'valor'           => 89.00,
                'valor_original'  => 105.00,
                'descricao'       => 'Pacote com 3 artes adicionais com desconto de R$ 16,00.',
                'entrega_sla'     => 'Liberação imediata',
                'badge'           => 'Mais Escolhido',
                'destaque'        => true,
                'icone'           => 'sparkles',
                'imagem'          => '/shop/arte_avulsa_3.jpg',
                'itens_inclusos'  => [
                    '+3 créditos de pedidos liberados na hora',
                    'Economia de R$ 16,00 no combo',
                    'Use no seu ritmo em qualquer mês',
                    'Ideal para semanas de alta demanda',
                ],
            ],
            [
                'id'              => 'arte_avulsa_5',
                'nome'            => 'Pack 5 Artes Avulsas',
                'categoria'       => 'artes',
                'quantidade'      => 5,
                'valor'           => 139.00,
                'valor_original'  => 175.00,
                'descricao'       => 'Maior economia para confecções com grande volume de encomendas.',
                'entrega_sla'     => 'Liberação imediata',
                'badge'           => 'Super Desconto',
                'destaque'        => false,
                'icone'           => 'zap',
                'imagem'          => '/shop/arte_avulsa_5.jpg',
                'itens_inclusos'  => [
                    '+5 créditos de pedidos no sistema',
                    'Apenas R$ 27,80 por arte avulsa',
                    'Mais de 20% de desconto',
                    'Foco total em fechar novos clientes',
                ],
            ],
            [
                'id'              => 'creditos_ia_5',
                'nome'            => '5 Análises de IA',
                'categoria'       => 'ia',
                'quantidade'      => 5,
                'valor'           => 25.00,
                'valor_original'  => 25.00,
                'descricao'       => 'Créditos para revisão automática e minuciosa de arte com inteligência artificial.',
                'entrega_sla'     => 'Liberação imediata',
                'badge'           => 'Instantâneo',
                'destaque'        => false,
                'icone'           => 'bot',
                'imagem'          => '/shop/creditos_ia_5.svg',
                'itens_inclusos'  => [
                    '5 análises detalhadas com Gemini 2.5 Pro',
                    'Comparação automática da referência com a arte',
                    'Detecção de erros ortográficos e nomes',
                    'Validação de cores, logos e proporções',
                ],
            ],
            [
                'id'              => 'creditos_ia_15',
                'nome'            => '15 Análises de IA',
                'categoria'       => 'ia',
                'quantidade'      => 15,
                'valor'           => 65.00,
                'valor_original'  => 75.00,
                'descricao'       => 'Pacote intermediário de créditos de IA com valor promocional por análise.',
                'entrega_sla'     => 'Liberação imediata',
                'badge'           => 'Melhor Valor IA',
                'destaque'        => true,
                'icone'           => 'cpu',
                'imagem'          => '/shop/creditos_ia_15.svg',
                'itens_inclusos'  => [
                    '15 análises completas liberadas',
                    'Apenas R$ 4,33 por análise (desconto)',
                    'Histórico e relatório comparativo',
                    'Zero erros na produção final',
                ],
            ],
            [
                'id'              => 'vetorizacao_logo',
                'nome'            => 'Vetorização Profissional de Logo',
                'categoria'       => 'servicos',
                'quantidade'      => 1,
                'valor'           => 45.00,
                'valor_original'  => 45.00,
                'descricao'       => 'Conversão de foto, print ou imagem de baixa resolução em vetor escalável de alta definição.',
                'entrega_sla'     => 'Entrega em até 12h úteis',
                'badge'           => 'Serviço Técnico',
                'destaque'        => false,
                'icone'           => 'pen-tool',
                'imagem'          => '/shop/vetorizacao_logo.svg',
                'itens_inclusos'  => [
                    'Arquivos em AI, CDR, PDF e PNG 300 DPI',
                    'Separação de cores e curvas limpas',
                    'Pronto para sublimação, serigrafia e bordado',
                    'Revisão inclusa até aprovação',
                ],
            ],
            [
                'id'              => 'mockup_3d',
                'nome'            => 'Mockup 3D Realista Ultra-HD',
                'categoria'       => 'servicos',
                'quantidade'      => 1,
                'valor'           => 29.90,
                'valor_original'  => 29.90,
                'descricao'       => 'Render fotorrealista da peça vestida no corpo com iluminação de estúdio para catálogo e vendas.',
                'entrega_sla'     => 'Entrega em até 8h úteis',
                'badge'           => 'Apresentação VIP',
                'destaque'        => false,
                'icone'           => 'box',
                'imagem'          => '/shop/mockup_3d.svg',
                'itens_inclusos'  => [
                    'Vistas frente, costas e detalhe de perto',
                    'Resolução 4K para Instagram e WhatsApp',
                    'Textura realista do tecido e costura',
                    'Aumenta conversão de vendas em até 40%',
                ],
            ],
            [
                'id'              => 'taxa_expressa',
                'nome'            => 'Taxa de Entrega Expressa (Fast-Track 6h)',
                'categoria'       => 'urgencia',
                'quantidade'      => 1,
                'valor'           => 30.00,
                'valor_original'  => 30.00,
                'descricao'       => 'Passe o seu pedido para o topo da fila prioritária com entrega garantida em até 6 horas.',
                'entrega_sla'     => 'Prioridade Máxima (6h)',
                'badge'           => 'Fast-Track',
                'destaque'        => false,
                'icone'           => 'clock',
                'imagem'          => '/shop/taxa_expressa.svg',
                'itens_inclusos'  => [
                    'Salto imediato para o topo da esteira Kanban',
                    'Designer dedicado à sua entrega em até 6h úteis',
                    'Ideal para pedidos de última hora do cliente',
                    'Notificação prioritária no WhatsApp',
                ],
            ],
        ];
    }

    /**
     * Retorna os itens do catálogo e os saldos atuais da confecção
     * GET /api/shop/itens
     */
    public function itens(Request $request): JsonResponse
    {
        $user = $request->user();
        $confeccao = $user->confeccao;

        $dbItens = ShopItem::where('ativo', true)->orderBy('ordem')->orderBy('id')->get();
        if ($dbItens->isNotEmpty()) {
            $itens = $dbItens->map(function ($i) {
                return [
                    'id'             => $i->codigo ?: (string) $i->id,
                    'db_id'          => $i->id,
                    'codigo'         => $i->codigo,
                    'nome'           => $i->nome,
                    'categoria'      => $i->categoria,
                    'quantidade'     => (int) $i->quantidade,
                    'valor'          => (float) $i->valor,
                    'valor_original' => $i->valor_original ? (float) $i->valor_original : (float) $i->valor,
                    'descricao'      => $i->descricao,
                    'entrega_sla'    => $i->entrega_sla,
                    'badge'          => $i->badge,
                    'destaque'       => (bool) $i->destaque,
                    'icone'          => $i->icone,
                    'imagem'         => $i->imagem,
                    'itens_inclusos' => is_array($i->itens_inclusos) ? $i->itens_inclusos : (json_decode($i->itens_inclusos, true) ?: []),
                    'ativo'          => (bool) $i->ativo,
                    'ordem'          => (int) $i->ordem,
                ];
            })->all();
        } else {
            $itens = self::catalogo();
        }

        $saldoInfo = [
            'is_admin'         => $user->isAdmin(),
            'artes_extras'     => $confeccao ? (int) $confeccao->artes_extras : 0,
            'creditos_ia'      => $confeccao ? (int) $confeccao->creditos_ia : (int) ($user->creditos_ia ?? 0),
            'artes_usadas_mes' => $confeccao ? (int) $confeccao->artes_usadas_mes : 0,
            'limite_mensal'    => $confeccao ? (int) $confeccao->limite_mensal : 0,
            'artes_disponiveis'=> $confeccao ? $confeccao->artesDisponiveis() : 0,
            'confeccao_nome'   => $confeccao?->nome,
        ];

        return response()->json([
            'itens' => $itens,
            'saldo' => $saldoInfo,
        ]);
    }

    /**
     * Inicia a compra de um item do shop gerando o Pix
     * POST /api/shop/comprar
     */
    public function comprar(Request $request): JsonResponse
    {
        $request->validate([
            'item_id'    => 'required|string',
            'detalhes'   => 'nullable|string|max:1000',
            'pedido_id'  => 'nullable|exists:pedidos,id',
        ]);

        $dbItem = ShopItem::where('ativo', true)
            ->where(function ($q) use ($request) {
                $q->where('codigo', $request->item_id)
                  ->orWhere('id', $request->item_id);
            })->first();

        if ($dbItem) {
            $item = [
                'id'         => $dbItem->codigo,
                'nome'       => $dbItem->nome,
                'categoria'  => $dbItem->categoria,
                'quantidade' => (int) $dbItem->quantidade,
                'valor'      => (float) $dbItem->valor,
            ];
        } else {
            $catalogo = collect(self::catalogo());
            $item = $catalogo->firstWhere('id', $request->item_id);
        }

        if (!$item) {
            return response()->json(['message' => 'Item não encontrado no catálogo.'], 404);
        }

        $user = $request->user();
        $confeccao = $user->confeccao;

        $valorTotal = (float) $item['valor'];
        $txid = 'SH' . strtoupper(substr(uniqid(), -6)) . rand(10, 99);
        $pixPayload = $this->pixService->gerarPayload($valorTotal, $txid);
        $pixQrCode  = $this->pixService->gerarQrCodeUrl($pixPayload);

        $detalhesTexto = $request->detalhes;
        if ($request->pedido_id) {
            $detalhesTexto = "Vinculado ao Pedido #{$request->pedido_id}. " . ($detalhesTexto ?? '');
        }

        $pedidoShop = ShopPedido::create([
            'confeccao_id'   => $confeccao?->id,
            'user_id'        => $user->id,
            'item_id'        => $item['id'],
            'item_nome'      => $item['nome'],
            'categoria'      => $item['categoria'],
            'quantidade'     => $item['quantidade'],
            'valor_unitario' => $valorTotal,
            'valor_total'    => $valorTotal,
            'status'         => 'pendente',
            'txid'           => $txid,
            'pix_codigo'     => $pixPayload,
            'pix_qrcode'     => $pixQrCode,
            'detalhes'       => $detalhesTexto,
        ]);

        return response()->json([
            'pedido'          => $pedidoShop,
            'item'            => $item,
            'valor_formatado' => 'R$ ' . number_format($valorTotal, 2, ',', '.'),
            'pix_copia_cola'  => $pixPayload,
            'pix_qrcode_url'  => $pixQrCode,
            'chave_pix'       => config('services.pix.chave', 'financeiro@camisasdesign.com'),
            'beneficiario'    => config('services.pix.beneficiario', 'Camiseta Design'),
        ], 201);
    }

    /**
     * Confirmação de pagamento do item do shop
     * POST /api/shop/pedidos/{pedido}/confirmar-pagamento
     */
    public function confirmarPagamento(Request $request, ShopPedido $pedido): JsonResponse
    {
        $user = $request->user();

        // Apenas administrador pode confirmar o recebimento do Pix estático
        if (!$user->isAdmin()) {
            return response()->json([
                'message' => 'A confirmação manual de pagamento Pix é restrita ao administrador após a validação bancária.',
            ], 403);
        }

        if ($pedido->status === 'pago' || $pedido->status === 'concluido') {
            return response()->json([
                'message' => 'Este pedido já está confirmado.',
                'pedido'  => $pedido,
            ]);
        }

        $pedido->marcarComoPago();

        $confeccao = $pedido->confeccao ? $pedido->confeccao->fresh() : null;

        return response()->json([
            'message'      => "Pagamento confirmado com sucesso! {$pedido->item_nome} liberado.",
            'pedido'       => $pedido->fresh(['confeccao', 'user']),
            'artes_extras' => $confeccao?->artes_extras ?? 0,
            'creditos_ia'  => $confeccao?->creditos_ia ?? ($user->fresh()->creditos_ia ?? 0),
        ]);
    }

    /**
     * Lista de compras avulsas da confecção logada
     * GET /api/shop/pedidos
     */
    public function meusPedidos(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = ShopPedido::with(['confeccao', 'user'])->latest();

        if (!$user->isAdmin()) {
            if ($user->confeccao) {
                $query->where('confeccao_id', $user->confeccao->id);
            } else {
                $query->where('user_id', $user->id);
            }
        }

        $pedidos = $query->limit(50)->get();

        return response()->json($pedidos);
    }

    /**
     * Lista de todos os pedidos do shop para o Admin
     * GET /api/admin/shop/pedidos
     */
    public function adminPedidos(Request $request): JsonResponse
    {
        $query = ShopPedido::with(['confeccao', 'user'])->latest();

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->categoria) {
            $query->where('categoria', $request->categoria);
        }

        if ($request->confeccao_id) {
            $query->where('confeccao_id', $request->confeccao_id);
        }

        $pedidos = $query->paginate(30);

        return response()->json($pedidos);
    }

    /**
     * Atualização de status e entrega de serviço pelo Admin
     * PATCH /api/admin/shop/pedidos/{pedido}
     */
    public function adminAtualizarStatus(Request $request, ShopPedido $pedido): JsonResponse
    {
        $request->validate([
            'status'   => 'required|in:pendente,pago,concluido,cancelado',
            'detalhes' => 'nullable|string',
        ]);

        $statusAnterior = $pedido->status;
        $novoStatus     = $request->status;

        if ($novoStatus === 'pago' && $statusAnterior === 'pendente') {
            $pedido->marcarComoPago();
        } else {
            $pedido->status = $novoStatus;
            if ($novoStatus === 'concluido' && !$pedido->concluido_em) {
                $pedido->concluido_em = now();
            }
            if ($request->has('detalhes')) {
                $pedido->detalhes = $request->detalhes;
            }
            $pedido->save();
        }

        return response()->json([
            'message' => 'Status do pedido atualizado com sucesso.',
            'pedido'  => $pedido->fresh(['confeccao', 'user']),
        ]);
    }

    /**
     * Lista todos os itens/produtos/combos do shop (Admin)
     * GET /api/admin/shop/itens
     */
    public function adminListarItens(Request $request): JsonResponse
    {
        $query = ShopItem::orderBy('ordem')->orderBy('id');

        if ($request->filled('categoria') && $request->categoria !== 'todos') {
            $query->where('categoria', $request->categoria);
        }

        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('nome', 'like', "%{$s}%")
                  ->orWhere('codigo', 'like', "%{$s}%")
                  ->orWhere('descricao', 'like', "%{$s}%");
            });
        }

        if ($request->has('ativo') && $request->ativo !== '') {
            $query->where('ativo', filter_var($request->ativo, FILTER_VALIDATE_BOOLEAN));
        }

        $itens = $query->get();

        return response()->json($itens);
    }

    /**
     * Cria um novo item, produto ou combo no Shop (Admin)
     * POST /api/admin/shop/itens
     */
    public function adminCriarItem(Request $request): JsonResponse
    {
        $request->validate([
            'nome'            => 'required|string|max:150',
            'codigo'          => 'nullable|string|max:60|unique:shop_itens,codigo',
            'categoria'       => 'required|string|max:50',
            'quantidade'      => 'required|integer|min:1',
            'valor'           => 'required|numeric|min:0',
            'valor_original'  => 'nullable|numeric|min:0',
            'descricao'       => 'nullable|string',
            'entrega_sla'     => 'required|string|max:80',
            'badge'           => 'nullable|string|max:60',
            'destaque'        => 'nullable|boolean',
            'icone'           => 'nullable|string|max:50',
            'imagem'          => 'nullable|string|max:255',
            'imagem_file'     => 'nullable|image|max:10240', // até 10MB
            'itens_inclusos'  => 'nullable',
            'ativo'           => 'nullable|boolean',
            'ordem'           => 'nullable|integer',
        ]);

        $codigo = $request->codigo ?: Str::slug($request->nome, '_') . '_' . rand(100, 999);

        // Upload de imagem se fornecido arquivo
        $imagemPath = $request->imagem ?: '/shop/arte_avulsa_1.jpg';
        if ($request->hasFile('imagem_file')) {
            $file = $request->file('imagem_file');
            $filename = 'item_' . time() . '_' . Str::random(6) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('public/shop', $filename);
            $imagemPath = '/storage/shop/' . $filename;
        }

        $itensInclusos = $request->itens_inclusos;
        if (is_string($itensInclusos)) {
            $decoded = json_decode($itensInclusos, true);
            $itensInclusos = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode("\n", $itensInclusos)));
        }

        $item = ShopItem::create([
            'codigo'         => $codigo,
            'nome'           => $request->nome,
            'categoria'      => $request->categoria,
            'quantidade'     => (int) $request->quantidade,
            'valor'          => (float) $request->valor,
            'valor_original' => $request->valor_original ? (float) $request->valor_original : (float) $request->valor,
            'descricao'      => $request->descricao,
            'entrega_sla'    => $request->entrega_sla,
            'badge'          => $request->badge,
            'destaque'       => filter_var($request->destaque ?? false, FILTER_VALIDATE_BOOLEAN),
            'icone'          => $request->icone ?: 'palette',
            'imagem'         => $imagemPath,
            'itens_inclusos' => $itensInclusos ?: [],
            'ativo'          => filter_var($request->ativo ?? true, FILTER_VALIDATE_BOOLEAN),
            'ordem'          => (int) ($request->ordem ?? 0),
        ]);

        return response()->json([
            'message' => 'Item do shop cadastrado com sucesso!',
            'item'    => $item,
        ], 201);
    }

    /**
     * Atualiza um item/combo existente (Admin)
     * POST|PUT /api/admin/shop/itens/{item}
     */
    public function adminAtualizarItem(Request $request, ShopItem $item): JsonResponse
    {
        $request->validate([
            'nome'            => 'sometimes|required|string|max:150',
            'codigo'          => 'sometimes|nullable|string|max:60|unique:shop_itens,codigo,' . $item->id,
            'categoria'       => 'sometimes|required|string|max:50',
            'quantidade'      => 'sometimes|required|integer|min:1',
            'valor'           => 'sometimes|required|numeric|min:0',
            'valor_original'  => 'nullable|numeric|min:0',
            'descricao'       => 'nullable|string',
            'entrega_sla'     => 'sometimes|required|string|max:80',
            'badge'           => 'nullable|string|max:60',
            'destaque'        => 'nullable|boolean',
            'icone'           => 'nullable|string|max:50',
            'imagem'          => 'nullable|string|max:255',
            'imagem_file'     => 'nullable|image|max:10240',
            'itens_inclusos'  => 'nullable',
            'ativo'           => 'nullable|boolean',
            'ordem'           => 'nullable|integer',
        ]);

        $data = $request->only([
            'nome', 'categoria', 'quantidade', 'valor', 'valor_original',
            'descricao', 'entrega_sla', 'badge', 'destaque', 'icone', 'ordem'
        ]);

        if ($request->filled('codigo')) {
            $data['codigo'] = $request->codigo;
        }

        if ($request->has('destaque')) {
            $data['destaque'] = filter_var($request->destaque, FILTER_VALIDATE_BOOLEAN);
        }

        if ($request->has('ativo')) {
            $data['ativo'] = filter_var($request->ativo, FILTER_VALIDATE_BOOLEAN);
        }

        if ($request->hasFile('imagem_file')) {
            $file = $request->file('imagem_file');
            $filename = 'item_' . time() . '_' . Str::random(6) . '.' . $file->getClientOriginalExtension();
            $file->storeAs('public/shop', $filename);
            $data['imagem'] = '/storage/shop/' . $filename;
        } elseif ($request->filled('imagem')) {
            $data['imagem'] = $request->imagem;
        }

        if ($request->has('itens_inclusos')) {
            $itensInclusos = $request->itens_inclusos;
            if (is_string($itensInclusos)) {
                $decoded = json_decode($itensInclusos, true);
                $itensInclusos = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode("\n", $itensInclusos)));
            }
            $data['itens_inclusos'] = $itensInclusos ?: [];
        }

        $item->update($data);

        return response()->json([
            'message' => 'Item do shop atualizado com sucesso!',
            'item'    => $item->fresh(),
        ]);
    }

    /**
     * Alterna status ativo/inativo de um item (Admin)
     * PATCH /api/admin/shop/itens/{item}/toggle-ativo
     */
    public function adminToggleAtivo(Request $request, ShopItem $item): JsonResponse
    {
        $item->ativo = !$item->ativo;
        $item->save();

        return response()->json([
            'message' => $item->ativo ? 'Item ativado no catálogo!' : 'Item desativado do catálogo.',
            'item'    => $item,
        ]);
    }

    /**
     * Remove um item do catálogo (Admin)
     * DELETE /api/admin/shop/itens/{item}
     */
    public function adminExcluirItem(Request $request, ShopItem $item): JsonResponse
    {
        $item->delete();

        return response()->json([
            'message' => 'Item excluído do catálogo com sucesso.',
        ]);
    }
}


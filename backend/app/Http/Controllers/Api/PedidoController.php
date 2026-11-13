<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\Confeccao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PedidoController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Pedido::with(['confeccao', 'arteAtiva', 'ultimaAprovacao'])
            ->orderBy('created_at', 'desc');

        // Confecção só vê os seus próprios
        if ($user->isConfeccao()) {
            $query->where('confeccao_id', $user->confeccao->id);
        }

        // Filtros opcionais
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('confeccao_id') && $user->isAdmin()) {
            $query->where('confeccao_id', $request->confeccao_id);
        }
        if ($request->filled('tipo_impressao')) {
            $query->where('tipo_impressao', $request->tipo_impressao);
        }

        return response()->json($query->get());
    }

    public function show(Pedido $pedido)
    {
        $this->authorizePedido($pedido);

        return response()->json(
            $pedido->load(['confeccao', 'artes', 'aprovacoes'])
        );
    }

    public function store(Request $request)
    {
        try {
            $user = $request->user();

            // Confecção usa automaticamente a própria confecção; admin precisa informar
            $confeccaoId = $user->isAdmin()
                ? $request->confeccao_id
                : $user->confeccao?->id;

            if (!$confeccaoId) {
                return response()->json(['message' => 'Confecção não encontrada para este usuário.'], 422);
            }

            // Normaliza campos de cliente
            if ($request->filled('nome_cliente') && !$request->filled('cliente_nome')) {
                $request->merge(['cliente_nome' => $request->nome_cliente]);
            }
            if ($request->filled('cliente_nome') && !$request->filled('nome_cliente')) {
                $request->merge(['nome_cliente' => $request->cliente_nome]);
            }
            if ($request->filled('whatsapp_cliente') && !$request->filled('cliente_whatsapp')) {
                $request->merge(['cliente_whatsapp' => $request->whatsapp_cliente]);
            }
            if ($request->filled('cliente_whatsapp') && !$request->filled('whatsapp_cliente')) {
                $request->merge(['whatsapp_cliente' => $request->cliente_whatsapp]);
            }
            if ($request->filled('email_cliente') && !$request->filled('cliente_email')) {
                $request->merge(['cliente_email' => $request->email_cliente]);
            }
            if ($request->filled('cliente_email') && !$request->filled('email_cliente')) {
                $request->merge(['email_cliente' => $request->cliente_email]);
            }

            // Injeta no request para validação e uso posterior
            $request->merge(['confeccao_id' => $confeccaoId]);

            $request->validate([
                'confeccao_id'     => 'required|exists:confeccoes,id',
                'titulo'           => 'required|string|max:255',
                'imagem_capa'      => 'nullable|file|mimes:jpeg,jpg,png,webp,svg,gif|max:20480',
                'tipo_impressao'   => 'required|in:sublimacao,bordado,serigrafia',
                'observacoes'      => 'nullable|string',
                'referencias'      => 'nullable',
                'prazo'            => 'nullable|date',
                'valor'            => 'nullable|numeric|min:0',
                'cliente_nome'     => 'nullable|string|max:255',
                'cliente_email'    => 'nullable|email',
                'cliente_whatsapp' => 'nullable|string|max:50',
                'nome_cliente'     => 'nullable|string|max:255',
                'email_cliente'    => 'nullable|email',
                'whatsapp_cliente' => 'nullable|string|max:50',
            ]);

            $confeccao = Confeccao::findOrFail($confeccaoId);

            $user = auth()->user();
            $isArtePagaExtra = $user && $user->isAdmin() && $request->filled('valor') && (float) $request->valor > 0;
            $isAvulso = ($confeccao->plano === 'avulso') || ((int) $confeccao->limite_mensal === 0) || ((int) $confeccao->limite_mensal >= 999);
            $isAdmin = $user && $user->isAdmin();
            $bypassLimite = $isAdmin || $isArtePagaExtra || $isAvulso;

            if (!$bypassLimite && !$confeccao->podecriarPedido()) {
                return response()->json([
                    'message' => 'Limite mensal de artes atingido para este plano. Adquira artes extras no Shop Avulso.',
                    'disponivel' => 0,
                ], 422);
            }

            // Processa imagem de capa caso enviada
            $capaUrl = null;
            if ($request->hasFile('imagem_capa')) {
                try {
                    @mkdir(storage_path('app/public/pedidos/capas'), 0775, true);
                    $path = $request->file('imagem_capa')->store("pedidos/capas", 'public');
                    $capaUrl = Storage::disk('public')->url($path);
                } catch (\Throwable $e) {
                    Log::warning("Falha ao salvar capa do pedido: " . $e->getMessage());
                }
            }

            // Processa arquivos de referências de forma rápida e segura
            $refsData = [];
            if ($request->hasFile('referencias')) {
                @mkdir(storage_path('app/public/pedidos/referencias'), 0775, true);
                foreach ($request->file('referencias') as $arquivo) {
                    try {
                        $path = $arquivo->store("pedidos/referencias", 'public');
                        $refsData[] = [
                            'url'      => Storage::disk('public')->url($path),
                            'nome'     => $arquivo->getClientOriginalName(),
                            'tipo'     => $arquivo->getClientOriginalExtension(),
                            'tamanho'  => $arquivo->getSize(),
                        ];
                    } catch (\Throwable $e) {
                        Log::warning("Falha ao gravar arquivo de referência em public: " . $e->getMessage());
                    }
                }
            } elseif (is_array($request->referencias)) {
                // Aceita apenas URLs http(s)/caminhos locais e campos conhecidos (evita javascript:, SSRF e lixo)
                foreach ($request->referencias as $ref) {
                    $u = is_array($ref) ? ($ref['url'] ?? null) : (is_string($ref) ? $ref : null);
                    if (is_string($u) && (preg_match('#^https?://#i', $u) || str_starts_with($u, '/storage/'))) {
                        $refsData[] = [
                            'url'     => mb_substr($u, 0, 500),
                            'nome'    => is_array($ref) ? mb_substr((string) ($ref['nome'] ?? ''), 0, 150) : '',
                            'tipo'    => is_array($ref) ? mb_substr((string) ($ref['tipo'] ?? ''), 0, 20) : '',
                            'tamanho' => is_array($ref) ? (int) ($ref['tamanho'] ?? 0) : 0,
                        ];
                    }
                }
            }

            $pedidoData = $request->only([
                'confeccao_id', 'titulo', 'tipo_impressao', 'observacoes',
                'prazo',
                'cliente_nome', 'cliente_email', 'cliente_whatsapp',
                'nome_cliente', 'email_cliente', 'whatsapp_cliente',
            ]);

            // Se nenhuma capa explícita foi enviada mas há referências com imagem, usa a primeira como capa
            if (!$capaUrl && !empty($refsData)) {
                foreach ($refsData as $ref) {
                    $u = is_array($ref) ? ($ref['url'] ?? null) : (is_string($ref) ? $ref : null);
                    if ($u && preg_match('/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i', $u)) {
                        $capaUrl = $u;
                        break;
                    }
                }
            }

            // Se a coluna capa_url existir no banco, inclui
            if (\Illuminate\Support\Facades\Schema::hasColumn('pedidos', 'capa_url')) {
                $pedidoData['capa_url'] = $capaUrl;
            }
            if ($user->isAdmin() && $request->filled('valor')) {
                $pedidoData['valor'] = $request->valor;
            }
            $pedidoData['referencias'] = !empty($refsData) ? $refsData : null;

            $pedido = Pedido::create($pedidoData);

            // Se uma imagem de capa foi fornecida, cria automaticamente a Arte v1 ativa
            if ($capaUrl) {
                try {
                    \App\Models\Arte::create([
                        'pedido_id'      => $pedido->id,
                        'versao'         => 1,
                        'arquivo_url'    => $capaUrl,
                        'preview_url'    => $capaUrl,
                        'preview_nome'   => 'Capa Inicial',
                        'arquivo_nome'   => $request->file('imagem_capa')?->getClientOriginalName() ?? 'capa.png',
                        'arquivo_tipo'   => $request->file('imagem_capa')?->getClientOriginalExtension() ?? 'png',
                        'arquivo_tamanho'=> $request->file('imagem_capa')?->getSize() ?? 0,
                        'notas'          => 'Imagem de capa anexada na abertura do pedido',
                        'ativa'          => true,
                        'enviada_em'     => now(),
                    ]);
                } catch (\Throwable $e) {
                    Log::warning("Falha ao registrar Arte v1 para a capa do pedido #{$pedido->id}: " . $e->getMessage());
                }
            }

            // Se for arte avulsa paga à parte (com valor > 0), não consome a cota do plano mensal
            if (!$isArtePagaExtra) {
                $confeccao->incrementarArteUsada();
            }

            return response()->json($pedido->load(['confeccao', 'arteAtiva']), 201);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            throw $ve;
        } catch (\Throwable $e) {
            Log::error("Erro crítico ao criar pedido: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json([
                'message' => config('app.debug') ? 'Erro ao criar pedido: ' . $e->getMessage() : 'Erro ao criar pedido.',
            ], 500);
        }
    }

    public function update(Request $request, Pedido $pedido)
    {
        $this->authorizePedido($pedido);

        // Normaliza campos de cliente
        if ($request->filled('nome_cliente') && !$request->filled('cliente_nome')) {
            $request->merge(['cliente_nome' => $request->nome_cliente]);
        }
        if ($request->filled('cliente_nome') && !$request->filled('nome_cliente')) {
            $request->merge(['nome_cliente' => $request->cliente_nome]);
        }
        if ($request->filled('whatsapp_cliente') && !$request->filled('cliente_whatsapp')) {
            $request->merge(['cliente_whatsapp' => $request->whatsapp_cliente]);
        }
        if ($request->filled('cliente_whatsapp') && !$request->filled('whatsapp_cliente')) {
            $request->merge(['whatsapp_cliente' => $request->cliente_whatsapp]);
        }
        if ($request->filled('email_cliente') && !$request->filled('cliente_email')) {
            $request->merge(['cliente_email' => $request->email_cliente]);
        }
        if ($request->filled('cliente_email') && !$request->filled('email_cliente')) {
            $request->merge(['email_cliente' => $request->cliente_email]);
        }

        $request->validate([
            'titulo'           => 'sometimes|string|max:255',
            'tipo_impressao'   => 'sometimes|in:sublimacao,bordado,serigrafia',
            'observacoes'      => 'nullable|string',
            'referencias'      => 'nullable|array',
            'prazo'            => 'nullable|date',
            'valor'            => 'nullable|numeric|min:0',
            'cliente_nome'     => 'nullable|string|max:255',
            'cliente_email'    => 'nullable|email',
            'cliente_whatsapp' => 'nullable|string|max:50',
            'nome_cliente'     => 'nullable|string|max:255',
            'email_cliente'    => 'nullable|email',
            'whatsapp_cliente' => 'nullable|string|max:50',
        ]);

        $campos = [
            'titulo', 'tipo_impressao', 'observacoes',
            'referencias', 'prazo',
            'cliente_nome', 'cliente_email', 'cliente_whatsapp',
            'nome_cliente', 'email_cliente', 'whatsapp_cliente',
        ];
        // Somente admin altera o valor financeiro do pedido
        if (auth()->user()->isAdmin()) {
            $campos[] = 'valor';
        }

        $pedido->update($request->only($campos));

        return response()->json($pedido->fresh('confeccao'));
    }

    // Somente admin move o status (kanban)
    public function moverStatus(Request $request, Pedido $pedido)
    {
        $request->validate([
            'status' => 'required|in:' . implode(',', Pedido::STATUS),
        ]);

        $antigoStatus = $pedido->status;
        $novoStatus   = $request->status;

        $pedido->update(['status' => $novoStatus]);

        $notificacao = null;
        if ($antigoStatus !== $novoStatus) {
            try {
                $notificacao = app(\App\Services\WhatsAppService::class)->notificarMudancaStatus($pedido, $novoStatus);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error("Erro ao enviar notificação WhatsApp para Pedido #{$pedido->id}: " . $e->getMessage());
                $notificacao = ['enviado' => false, 'motivo' => 'erro_excecao', 'erro' => config('app.debug') ? $e->getMessage() : null];
            }
        }

        $dados = $pedido->fresh(['confeccao', 'arteAtiva', 'ultimaAprovacao'])->toArray();
        $dados['notificacao'] = $notificacao;

        return response()->json($dados);
    }

    public function linkAprovacao(Pedido $pedido)
    {
        $this->authorizePedido($pedido);

        return response()->json([
            'link' => rtrim(env('FRONTEND_URL', config('app.url')), '/') . "/aprovar/{$pedido->token_aprovacao}",
        ]);
    }

    public function cancelar(Request $request, Pedido $pedido)
    {
        $this->authorizePedido($pedido);

        if ($pedido->status === 'cancelado') {
            return response()->json(['message' => 'Pedido já está cancelado.'], 422);
        }

        if ($pedido->status === 'finalizado') {
            return response()->json(['message' => 'Pedidos finalizados não podem ser cancelados.'], 422);
        }

        $pedido->update(['status' => 'cancelado']);

        return response()->json($pedido->fresh(['confeccao', 'arteAtiva', 'ultimaAprovacao']));
    }

    public function destroy(Pedido $pedido)
    {
        $this->authorizePedido($pedido);
        $pedido->delete();
        return response()->json(null, 204);
    }

    private function authorizePedido(Pedido $pedido): void
    {
        $user = auth()->user();
        if ($user->isAdmin()) return;
        if ($user->confeccao?->id !== $pedido->confeccao_id) abort(403);
    }
}

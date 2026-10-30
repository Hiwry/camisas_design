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
        $user = $request->user();

        // Confecção usa automaticamente a própria confecção; admin precisa informar
        $confeccaoId = $user->isAdmin()
            ? $request->confeccao_id
            : $user->confeccao?->id;

        if (!$confeccaoId) {
            return response()->json(['message' => 'Confecção não encontrada para este usuário.'], 422);
        }

        // Injeta no request para validação e uso posterior
        $request->merge(['confeccao_id' => $confeccaoId]);

        $request->validate([
            'confeccao_id'    => 'required|exists:confeccoes,id',
            'titulo'          => 'required|string|max:255',
            'tipo_impressao'  => 'required|in:sublimacao,bordado,serigrafia',
            'observacoes'     => 'nullable|string',
            'referencias'     => 'nullable',
            'prazo'           => 'nullable|date',
            'valor'           => 'nullable|numeric|min:0',
            'cliente_nome'    => 'nullable|string|max:255',
            'cliente_email'   => 'nullable|email',
            'cliente_whatsapp'=> 'nullable|string|max:20',
        ]);

        $confeccao = Confeccao::findOrFail($confeccaoId);

        if (!$confeccao->podecriarPedido()) {
            return response()->json([
                'message' => 'Limite mensal de artes atingido para este plano.',
                'disponivel' => 0,
            ], 422);
        }

        // Processa arquivos de referências (upload normal ou colados da área de transferência)
        $refsData = [];
        if ($request->hasFile('referencias')) {
            $disk = config('filesystems.default', 'public');
            foreach ($request->file('referencias') as $arquivo) {
                $path = $arquivo->store("pedidos/referencias", $disk);
                $refsData[] = [
                    'url'      => Storage::disk($disk)->url($path),
                    'nome'     => $arquivo->getClientOriginalName(),
                    'tipo'     => $arquivo->getClientOriginalExtension(),
                    'tamanho'  => $arquivo->getSize(),
                ];
            }
        } elseif (is_array($request->referencias)) {
            $refsData = $request->referencias;
        }

        $pedidoData = $request->only([
            'confeccao_id', 'titulo', 'tipo_impressao', 'observacoes',
            'prazo', 'valor',
            'cliente_nome', 'cliente_email', 'cliente_whatsapp',
        ]);
        $pedidoData['referencias'] = !empty($refsData) ? $refsData : null;

        $pedido = Pedido::create($pedidoData);
        $confeccao->incrementarArteUsada();

        return response()->json($pedido->load('confeccao'), 201);
    }

    public function update(Request $request, Pedido $pedido)
    {
        $this->authorizePedido($pedido);

        $request->validate([
            'titulo'           => 'sometimes|string|max:255',
            'tipo_impressao'   => 'sometimes|in:sublimacao,bordado,serigrafia',
            'observacoes'      => 'nullable|string',
            'referencias'      => 'nullable|array',
            'prazo'            => 'nullable|date',
            'valor'            => 'nullable|numeric|min:0',
            'cliente_nome'     => 'nullable|string|max:255',
            'cliente_email'    => 'nullable|email',
            'cliente_whatsapp' => 'nullable|string|max:20',
        ]);

        $pedido->update($request->only([
            'titulo', 'tipo_impressao', 'observacoes',
            'referencias', 'prazo', 'valor',
            'cliente_nome', 'cliente_email', 'cliente_whatsapp',
        ]));

        return response()->json($pedido->fresh('confeccao'));
    }

    // Somente admin move o status (kanban)
    public function moverStatus(Request $request, Pedido $pedido)
    {
        $request->validate([
            'status' => 'required|in:' . implode(',', Pedido::STATUS),
        ]);

        $pedido->update(['status' => $request->status]);

        return response()->json($pedido->fresh(['confeccao', 'arteAtiva', 'ultimaAprovacao']));
    }

    public function linkAprovacao(Pedido $pedido)
    {
        $this->authorizePedido($pedido);

        return response()->json([
            'link' => rtrim(env('FRONTEND_URL', config('app.url')), '/') . "/aprovar/{$pedido->token_aprovacao}",
        ]);
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

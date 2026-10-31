<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\Confeccao;
use App\Notifications\ArteEnviadaParaAprovacao;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PedidoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Pedido::with(['confeccao', 'arteAtiva', 'ultimaAprovacao'])
            ->when($user->isConfeccao(), fn($q) => $q->where('confeccao_id', $user->confeccao->id))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->search, fn($q) => $q->where('titulo', 'like', "%{$request->search}%"))
            ->latest();

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'titulo'           => 'required|string|max:255',
            'tipo_impressao'   => 'required|in:sublimacao,bordado,serigrafia',
            'observacoes'      => 'nullable|string',
            'prazo'            => 'nullable|date',
            'valor'            => 'nullable|numeric|min:0',
            'nome_cliente'     => 'nullable|string|max:255',
            'email_cliente'    => 'nullable|email',
            'whatsapp_cliente' => 'nullable|string|max:20',
            'confeccao_id'     => 'sometimes|exists:confeccoes,id',
            'referencias'      => 'nullable|array',
            'referencias.*'    => 'file|max:51200', // 50MB, aceita qualquer formato de referência
        ]);

        // Determinar a confecção
        if ($user->isAdmin()) {
            $confeccaoId = $data['confeccao_id'] ?? null;
            if (!$confeccaoId) {
                return response()->json(['message' => 'Informe a confecção.'], 422);
            }
            $confeccao = Confeccao::findOrFail($confeccaoId);
        } else {
            $confeccao = $user->confeccao;
        }

        // Verificar limite do plano (Bypass para admin, arte paga extra ou cliente avulso)
        $isArtePagaExtra = $request->filled('valor') && (float) $request->valor > 0;
        $isAvulso = ($confeccao->plano === 'avulso') || ((int) $confeccao->limite_mensal === 0) || ((int) $confeccao->limite_mensal >= 999);
        $isAdmin = $user && $user->isAdmin();
        $bypassLimite = $isAdmin || $isArtePagaExtra || $isAvulso;

        if (!$bypassLimite && !$confeccao->temArteDisponivel()) {
            return response()->json([
                'message' => "Limite mensal de {$confeccao->limite_mensal} artes atingido.",
            ], 422);
        }

        // Upload das referências
        $refsData = [];
        if ($request->hasFile('referencias')) {
            $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
            foreach ($request->file('referencias') as $arquivo) {
                $path = $arquivo->store("pedidos/referencias", $disk);
                $refsData[] = [
                    'url'      => Storage::disk($disk)->url($path),
                    'nome'     => $arquivo->getClientOriginalName(),
                    'tipo'     => $arquivo->getClientOriginalExtension(),
                    'tamanho'  => $arquivo->getSize(),
                ];
            }
        }

        unset($data['referencias']); // remover array de files do $data antes do create
        $pedido = Pedido::create(array_merge($data, [
            'confeccao_id' => $confeccao->id,
            'referencias'  => !empty($refsData) ? $refsData : null,
        ]));
        $confeccao->incrementarUso();

        return response()->json($pedido->load(['confeccao', 'artes']), 201);
    }

    public function show(Request $request, Pedido $pedido): JsonResponse
    {
        $this->authorizeAccess($request, $pedido);

        return response()->json(
            $pedido->load(['confeccao', 'artes', 'aprovacoes.arte'])
        );
    }

    public function update(Request $request, Pedido $pedido): JsonResponse
    {
        $this->authorizeAccess($request, $pedido);

        $data = $request->validate([
            'titulo'           => 'sometimes|string|max:255',
            'tipo_impressao'   => 'sometimes|in:sublimacao,bordado,serigrafia',
            'observacoes'      => 'nullable|string',
            'prazo'            => 'nullable|date',
            'valor'            => 'nullable|numeric|min:0',
            'nome_cliente'     => 'nullable|string|max:255',
            'email_cliente'    => 'nullable|email',
            'whatsapp_cliente' => 'nullable|string|max:20',
        ]);

        $pedido->update($data);

        return response()->json($pedido->fresh(['confeccao', 'arteAtiva']));
    }

    public function destroy(Pedido $pedido): JsonResponse
    {
        $pedido->delete();

        return response()->json(['message' => 'Pedido removido.']);
    }

    public function mudarStatus(Request $request, Pedido $pedido): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:' . implode(',', Pedido::STATUS),
        ]);

        $pedido->update(['status' => $request->status]);

        // Dispara notificação automática por WhatsApp para número cadastrado
        \App\Jobs\NotificarMudancaStatusPedido::dispatch($pedido, $request->status);

        // Email (mantido para compatibilidade)
        if ($request->status === 'aguardando_aprovacao' && $pedido->email_cliente) {
            $pedido->notify(new ArteEnviadaParaAprovacao($pedido));
        }

        return response()->json($pedido->fresh(['confeccao', 'arteAtiva']));
    }

    public function cancelar(Request $request, Pedido $pedido): JsonResponse
    {
        $this->authorizeAccess($request, $pedido);

        if ($pedido->status === 'cancelado') {
            return response()->json(['message' => 'Pedido já está cancelado.'], 422);
        }

        if ($pedido->status === 'finalizado') {
            return response()->json(['message' => 'Pedidos finalizados não podem ser cancelados.'], 422);
        }

        $pedido->update(['status' => 'cancelado']);

        return response()->json($pedido->fresh(['confeccao', 'arteAtiva']));
    }

    public function linkAprovacao(Request $request, Pedido $pedido): JsonResponse
    {
        $this->authorizeAccess($request, $pedido);

        return response()->json([
            'link'  => $pedido->linkAprovacao(),
            'token' => $pedido->token_aprovacao,
        ]);
    }

    private function authorizeAccess(Request $request, Pedido $pedido): void
    {
        $user = $request->user();
        if ($user->isConfeccao() && $pedido->confeccao_id !== $user->confeccao->id) {
            abort(403, 'Acesso negado.');
        }
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KanbanController extends Controller
{
    /**
     * Retorna todos os pedidos agrupados por coluna do kanban.
     */
    public function index(): JsonResponse
    {
        $pedidos = Pedido::with(['confeccao:id,nome', 'arteAtiva', 'ultimaAprovacao'])
            ->whereNotIn('status', Pedido::STATUS_OCULTOS_KANBAN)
            ->orderBy('ordem_kanban')
            ->get();

        $colunas = [];
        foreach (Pedido::STATUS as $status) {
            if (in_array($status, Pedido::STATUS_OCULTOS_KANBAN)) continue;
            $colunas[$status] = [
                'id'     => $status,
                'titulo' => Pedido::STATUS_LABELS[$status],
                'cards'  => $pedidos->where('status', $status)->values(),
            ];
        }

        return response()->json($colunas);
    }

    /**
     * Move um card para outra coluna (muda status + reordena).
     */
    public function mover(Request $request): JsonResponse
    {
        $request->validate([
            'pedido_id'  => 'required|exists:pedidos,id',
            'novo_status' => 'required|in:' . implode(',', array_diff(Pedido::STATUS, Pedido::STATUS_OCULTOS_KANBAN)),
            'ordem'      => 'nullable|integer|min:0',
        ]);

        $pedido = Pedido::findOrFail($request->pedido_id);

        $pedido->update([
            'status'       => $request->novo_status,
            'ordem_kanban' => $request->ordem ?? 0,
        ]);

        return response()->json([
            'message' => 'Card movido com sucesso.',
            'pedido'  => $pedido->fresh(['confeccao', 'arteAtiva']),
        ]);
    }
}

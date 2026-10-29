<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KanbanController extends Controller
{
    /**
     * Retorna todas as colunas do Kanban com seus cards.
     * Formato: { aguardando_briefing: { id, titulo, cards: [...] }, ... }
     */
    public function index(): JsonResponse
    {
        $colunas = [
            'aguardando_briefing'  => 'Aguardando Briefing',
            'em_producao'          => 'Em Produção',
            'aguardando_aprovacao' => 'Aguardando Aprovação',
            'aprovado'             => 'Aprovado',
            'finalizado'           => 'Finalizado',
        ];

        // Carrega todos os pedidos não cancelados com relações necessárias
        $pedidos = Pedido::with(['confeccao', 'arteAtiva', 'ultimaAprovacao'])
            ->whereNotIn('status', ['cancelado'])
            ->orderBy('updated_at', 'desc')
            ->get();

        $resultado = [];

        foreach ($colunas as $status => $titulo) {
            $cards = $pedidos->where('status', $status)->values()->map(function (Pedido $p) {
                $arteAtiva = $p->arteAtiva;
                $ultimaAp  = $p->ultimaAprovacao;

                return [
                    'id'              => $p->id,
                    'titulo'          => $p->titulo,
                    'tipo_impressao'  => $p->tipo_impressao,
                    'status'          => $p->status,
                    'prazo'           => $p->prazo?->toDateString(),
                    'confeccao'       => [
                        'id'   => $p->confeccao?->id,
                        'nome' => $p->confeccao?->nome ?? '—',
                    ],
                    'cliente_nome'     => $p->cliente_nome,
                    'cliente_whatsapp' => $p->cliente_whatsapp ?? $p->confeccao?->user?->whatsapp ?? $p->confeccao?->telefone ?? null,
                    'arte_ativa' => $arteAtiva ? [
                        'arquivo_url'  => $arteAtiva->arquivo_url,
                        'arquivo_tipo' => $arteAtiva->arquivo_tipo,
                        'preview_url'  => $arteAtiva->preview_url ?? null,
                        'versao'       => $arteAtiva->versao,
                    ] : null,
                    'ultima_aprovacao' => $ultimaAp ? [
                        'status'     => $ultimaAp->status,
                        'comentario' => $ultimaAp->comentario,
                    ] : null,
                ];
            });

            $resultado[$status] = [
                'id'     => $status,
                'titulo' => $titulo,
                'cards'  => $cards,
            ];
        }

        return response()->json($resultado);
    }

    /**
     * Move um card para outro status (coluna) e notifica o número cadastrado via WhatsApp.
     * Apenas admin pode mover.
     */
    public function mover(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pedido_id'  => 'required|integer|exists:pedidos,id',
            'novo_status' => 'required|string|in:aguardando_briefing,em_producao,aguardando_aprovacao,aprovado,finalizado',
        ]);

        $pedido = Pedido::with('confeccao.user')->findOrFail($validated['pedido_id']);

        if ($pedido->status === 'cancelado') {
            return response()->json(['message' => 'Pedido cancelado não pode ser movido.'], 422);
        }

        $antigoStatus = $pedido->status;
        $novoStatus   = $validated['novo_status'];

        $pedido->status = $novoStatus;
        $pedido->save();

        // Dispara notificação automática por WhatsApp se houve mudança de coluna/status
        if ($antigoStatus !== $novoStatus) {
            \App\Jobs\NotificarMudancaStatusPedido::dispatch($pedido, $novoStatus);
        }

        return response()->json([
            'message' => 'Status atualizado com sucesso e notificação disparada.',
            'status'  => $pedido->status,
        ]);
    }
}

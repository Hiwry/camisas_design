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

                // Identifica capa do pedido ou primeira referência com imagem como fallback
                $capaUrl = $p->capa_url;
                if (!$capaUrl && is_array($p->referencias)) {
                    foreach ($p->referencias as $ref) {
                        $u = is_array($ref) ? ($ref['url'] ?? null) : (is_string($ref) ? $ref : null);
                        if ($u && preg_match('/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i', $u)) {
                            $capaUrl = $u;
                            break;
                        }
                    }
                }

                return [
                    'id'              => $p->id,
                    'titulo'          => $p->titulo,
                    'capa_url'        => $capaUrl,
                    'tipo_impressao'  => $p->tipo_impressao,
                    'status'          => $p->status,
                    'prazo'           => $p->prazo?->toDateString(),
                    'valor'           => $p->valor,
                    'token_aprovacao' => $p->token_aprovacao,
                    'confeccao'       => [
                        'id'   => $p->confeccao?->id,
                        'nome' => $p->confeccao?->nome ?? '—',
                    ],
                    'cliente_nome'     => $p->cliente_nome ?? $p->nome_cliente,
                    'cliente_whatsapp' => $p->cliente_whatsapp ?? $p->whatsapp_cliente ?? $p->confeccao?->user?->whatsapp ?? $p->confeccao?->telefone ?? null,
                    'arte_ativa' => $arteAtiva ? [
                        'arquivo_url'  => $arteAtiva->arquivo_url,
                        'arquivo_tipo' => $arteAtiva->arquivo_tipo,
                        'preview_url'  => $arteAtiva->preview_url ?? null,
                        'versao'       => $arteAtiva->versao,
                    ] : null,
                    'referencias'     => $p->referencias ?? null,
                    'ultima_aprovacao' => $ultimaAp ? [
                        'status'     => $ultimaAp->status,
                        'comentario' => $ultimaAp->comentario,
                    ] : null,
                    'updated_at'      => $p->updated_at?->toISOString(),
                    'created_at'      => $p->created_at?->toISOString(),
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
        $notificacao = null;
        if ($antigoStatus !== $novoStatus) {
            try {
                $notificacao = app(\App\Services\WhatsAppService::class)->notificarMudancaStatus($pedido, $novoStatus);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error("Erro ao enviar notificação WhatsApp para Pedido #{$pedido->id}: " . $e->getMessage());
                $notificacao = ['enviado' => false, 'motivo' => 'erro_excecao', 'erro' => config('app.debug') ? $e->getMessage() : null];
            }
        }

        return response()->json([
            'message'     => 'Status atualizado com sucesso.',
            'status'      => $pedido->status,
            'notificacao' => $notificacao,
        ]);
    }
}

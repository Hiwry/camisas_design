<?php

namespace App\Http\Controllers;

use App\Models\Aprovacao;
use App\Models\Pedido;
use App\Notifications\ArteAprovada;
use App\Notifications\RevisaoSolicitada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AprovacaoController extends Controller
{
    /**
     * Retorna os dados do pedido para a página pública de aprovação.
     */
    public function show(string $token): JsonResponse
    {
        $pedido = Pedido::where('token_aprovacao', $token)
            ->with(['confeccao', 'arteAtiva', 'artes', 'ultimaAprovacao'])
            ->firstOrFail();

        return response()->json([
            'pedido' => [
                'id'             => $pedido->id,
                'titulo'         => $pedido->titulo,
                'tipo_impressao' => $pedido->tipo_impressao,
                'status'         => $pedido->status,
                'observacoes'    => $pedido->observacoes,
                'prazo'          => $pedido->prazo,
                'confeccao'      => ['nome' => $pedido->confeccao->nome],
            ],
            'arte_ativa'      => $pedido->arteAtiva,
            'ultima_aprovacao' => $pedido->ultimaAprovacao,
            'historico_artes'  => $pedido->artes->map(fn($a) => [
                'id'          => $a->id,
                'versao'      => $a->versao,
                'arquivo_url' => $a->arquivo_url,
                'arquivo_tipo'=> $a->arquivo_tipo,
                'enviada_em'  => $a->enviada_em,
                'ativa'       => $a->ativa,
            ]),
        ]);
    }

    /**
     * Cliente aprova a arte.
     */
    public function aprovar(Request $request, string $token): JsonResponse
    {
        $request->validate([
            'nome_aprovador' => 'nullable|string|max:255',
        ]);

        $pedido = Pedido::where('token_aprovacao', $token)
            ->with('arteAtiva')
            ->firstOrFail();

        if (!$pedido->arteAtiva) {
            return response()->json(['message' => 'Nenhuma arte disponível para aprovação.'], 422);
        }

        if ($pedido->status === 'aprovado' || $pedido->status === 'finalizado') {
            return response()->json(['message' => 'Pedido já aprovado.'], 422);
        }

        $aprovacao = Aprovacao::create([
            'pedido_id'      => $pedido->id,
            'arte_id'        => $pedido->arteAtiva->id,
            'status'         => 'aprovado',
            'nome_aprovador' => $request->nome_aprovador,
            'ip_aprovador'   => $request->ip(),
            'aprovado_em'    => now(),
        ]);

        // Mover status do pedido para aprovado
        $pedido->update(['status' => 'aprovado']);

        // Notificar admin/confecção (assíncrono)
        dispatch(fn() => $pedido->confeccao->user->notify(new ArteAprovada($pedido)));

        return response()->json([
            'message'   => 'Arte aprovada com sucesso!',
            'aprovacao' => $aprovacao,
        ]);
    }

    /**
     * Cliente solicita revisão.
     */
    public function pedirRevisao(Request $request, string $token): JsonResponse
    {
        $request->validate([
            'comentario'     => 'required|string|min:5|max:2000',
            'nome_aprovador' => 'nullable|string|max:255',
        ]);

        $pedido = Pedido::where('token_aprovacao', $token)
            ->with('arteAtiva')
            ->firstOrFail();

        if (!$pedido->arteAtiva) {
            return response()->json(['message' => 'Nenhuma arte disponível.'], 422);
        }

        $aprovacao = Aprovacao::create([
            'pedido_id'      => $pedido->id,
            'arte_id'        => $pedido->arteAtiva->id,
            'status'         => 'revisao',
            'comentario'     => $request->comentario,
            'nome_aprovador' => $request->nome_aprovador,
            'ip_aprovador'   => $request->ip(),
            'aprovado_em'    => now(),
        ]);

        // Voltar para em_producao
        $pedido->update(['status' => 'em_producao']);

        // Notificar admin/confecção (assíncrono)
        dispatch(fn() => $pedido->confeccao->user->notify(new RevisaoSolicitada($pedido, $request->comentario)));

        return response()->json([
            'message'   => 'Revisão solicitada. O designer será notificado.',
            'aprovacao' => $aprovacao,
        ]);
    }
}

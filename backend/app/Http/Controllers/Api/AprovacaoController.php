<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Aprovacao;
use App\Models\Pedido;
use App\Jobs\NotificarAprovacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AprovacaoController extends Controller
{
    // Página pública: busca pedido pelo token (sem autenticação)
    public function showPublico(string $token)
    {
        $pedido = Pedido::where('token_aprovacao', $token)
            ->with(['arteAtiva', 'ultimaAprovacao', 'confeccao'])
            ->firstOrFail();

        return response()->json([
            'pedido' => [
                'id'             => $pedido->id,
                'titulo'         => $pedido->titulo,
                'tipo_impressao' => $pedido->tipo_impressao,
                'status'         => $pedido->status,
                'prazo'          => $pedido->prazo,
                'confeccao'      => ['nome' => $pedido->confeccao->nome],
                'observacoes'    => $pedido->observacoes,
            ],
            'arte_ativa'       => $pedido->arteAtiva,
            'historico_artes'  => $pedido->artes()->orderBy('versao')->get(),
            'ultima_aprovacao' => $pedido->ultimaAprovacao,
        ]);
    }

    public function aprovar(Request $request, string $token)
    {
        $request->merge(['status' => 'aprovado', 'nome' => $request->nome_aprovador]);
        return $this->responder($request, $token);
    }

    public function pedirRevisao(Request $request, string $token)
    {
        $request->merge(['status' => 'revisao', 'nome' => $request->nome_aprovador]);
        return $this->responder($request, $token);
    }

    // Aprovar ou pedir revisão (sem autenticação, via token)
    public function responder(Request $request, string $token)
    {
        $pedido = Pedido::where('token_aprovacao', $token)->firstOrFail();

        if (!$pedido->aguardandoAprovacao()) {
            return response()->json([
                'message' => 'Este pedido não está aguardando aprovação.',
            ], 422);
        }

        $request->validate([
            'status'     => 'required|in:aprovado,revisao',
            'comentario' => 'nullable|string|max:1000',
            'nome'       => 'nullable|string|max:255',
        ]);

        $arte = $pedido->arteAtiva;

        if (!$arte) {
            return response()->json(['message' => 'Nenhuma arte ativa encontrada.'], 422);
        }

        $aprovacaoData = [
            'pedido_id'  => $pedido->id,
            'arte_id'    => $arte->id,
            'status'     => $request->status,
            'comentario' => $request->comentario,
        ];

        // Campos de auditoria opcionais (só insere se a coluna existir)
        if (Schema::hasColumn('aprovacoes', 'aprovado_por_nome')) {
            $aprovacaoData['aprovado_por_nome'] = $request->nome;
            $aprovacaoData['aprovado_por_ip']   = $request->ip();
            $aprovacaoData['aprovado_em']        = now();
        }

        $aprovacao = Aprovacao::create($aprovacaoData);

        // Atualiza status do pedido
        $novoStatus = $request->status === 'aprovado' ? 'aprovado' : 'em_producao';
        $pedido->update(['status' => $novoStatus]);

        // Dispara notificação em fila
        NotificarAprovacao::dispatch($aprovacao);

        return response()->json([
            'message'   => $request->status === 'aprovado' ? 'Arte aprovada!' : 'Revisão solicitada.',
            'aprovacao' => $aprovacao,
        ]);
    }

    // Histórico de aprovações do pedido (autenticado)
    public function historico(Pedido $pedido)
    {
        $user = auth()->user();
        if ($user->isConfeccao() && $user->confeccao?->id !== $pedido->confeccao_id) {
            abort(403);
        }

        return response()->json($pedido->aprovacoes()->with('arte')->get());
    }
}

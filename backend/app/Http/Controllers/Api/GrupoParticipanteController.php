<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grupo;
use App\Models\GrupoLog;
use App\Models\GrupoModelo;
use App\Models\GrupoPagamento;
use App\Models\GrupoParticipante;
use App\Models\GrupoSolicitacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GrupoParticipanteController extends Controller
{
    /**
     * Adicionar participante manualmente via painel (Admin ou Cliente).
     */
    public function store(Request $request, $grupoId)
    {
        $grupo = Grupo::with('modelos')->findOrFail($grupoId);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $request->validate([
            'nome_completo' => 'required|string|max:150',
            'whatsapp' => 'nullable|string|max:25',
            'grupo_modelo_id' => 'required|exists:grupo_modelos,id',
            'cor' => 'required|string|max:50',
            'tamanho' => 'required|string|max:20',
            'quantidade' => 'required|integer|min:1',
            'nome_camisa' => 'nullable|string|max:50',
            'numero_camisa' => 'nullable|string|max:10',
            'apelido' => 'nullable|string|max:50',
            'frase_costas' => 'nullable|string|max:120',
            'observacao' => 'nullable|string',
        ]);

        $modelo = GrupoModelo::where('id', $request->grupo_modelo_id)
            ->where('grupo_id', $grupo->id)
            ->firstOrFail();

        $valorBase = (float) $modelo->valor_base;
        $quantidade = (int) $request->quantidade;
        $valorUnitario = $valorBase;
        $valorTotal = $valorUnitario * $quantidade;

        DB::beginTransaction();
        try {
            $participante = GrupoParticipante::create([
                'grupo_id' => $grupo->id,
                'grupo_modelo_id' => $modelo->id,
                'token_edicao' => Str::random(40),
                'nome_completo' => $request->nome_completo,
                'whatsapp' => $request->whatsapp,
                'cor' => $request->cor,
                'tamanho' => $request->tamanho,
                'quantidade' => $quantidade,
                'nome_camisa' => $request->nome_camisa,
                'numero_camisa' => $request->numero_camisa,
                'apelido' => $request->apelido,
                'frase_costas' => $request->frase_costas,
                'observacao' => $request->observacao,
                'valor_unitario' => $valorUnitario,
                'valor_total' => $valorTotal,
                'status_pagamento' => 'pendente',
            ]);

            GrupoLog::create([
                'grupo_id' => $grupo->id,
                'user_id' => $user->id,
                'tipo' => 'participante_inserido_painel',
                'descricao' => "Participante '{$participante->nome_completo}' adicionado manualmente pelo usuário '{$user->name}'.",
                'dados_novos' => $participante->toArray(),
                'ip' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Participante adicionado com sucesso!',
                'participante' => $participante->load('modelo', 'pagamentos'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => (config('app.debug') ? 'Erro ao adicionar participante: ' . $e->getMessage() : 'Erro ao adicionar participante.')], 500);
        }
    }

    /**
     * Editar participante pelo painel (Admin ou Cliente organizador).
     */
    public function update(Request $request, $grupoId, $participanteId)
    {
        $grupo = Grupo::findOrFail($grupoId);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $participante = GrupoParticipante::where('grupo_id', $grupo->id)
            ->where('id', $participanteId)
            ->firstOrFail();

        $request->validate([
            'nome_completo' => 'sometimes|required|string|max:150',
            'whatsapp' => 'nullable|string|max:25',
            'grupo_modelo_id' => 'sometimes|required|exists:grupo_modelos,id',
            'cor' => 'sometimes|required|string|max:50',
            'tamanho' => 'sometimes|required|string|max:20',
            'quantidade' => 'sometimes|required|integer|min:1',
            'nome_camisa' => 'nullable|string|max:50',
            'numero_camisa' => 'nullable|string|max:10',
            'apelido' => 'nullable|string|max:50',
            'frase_costas' => 'nullable|string|max:120',
            'observacao' => 'nullable|string',
        ]);

        $modeloId = $request->input('grupo_modelo_id', $participante->grupo_modelo_id);
        $modelo = GrupoModelo::where('id', $modeloId)->where('grupo_id', $grupo->id)->firstOrFail();
        $tamanho = $request->input('tamanho', $participante->tamanho);
        $quantidade = (int) $request->input('quantidade', $participante->quantidade);

        $valorBase = (float) $modelo->valor_base;
        $valorUnitario = $valorBase;
        $valorTotal = $valorUnitario * $quantidade;

        $dadosAnteriores = $participante->toArray();

        $participante->update([
            'grupo_modelo_id' => $modelo->id,
            'nome_completo' => $request->input('nome_completo', $participante->nome_completo),
            'whatsapp' => $request->input('whatsapp', $participante->whatsapp),
            'cor' => $request->input('cor', $participante->cor),
            'tamanho' => $tamanho,
            'quantidade' => $quantidade,
            'nome_camisa' => $request->input('nome_camisa', $participante->nome_camisa),
            'numero_camisa' => $request->input('numero_camisa', $participante->numero_camisa),
            'apelido' => $request->input('apelido', $participante->apelido),
            'frase_costas' => $request->input('frase_costas', $participante->frase_costas),
            'observacao' => $request->input('observacao', $participante->observacao),
            'valor_unitario' => $valorUnitario,
            'valor_total' => $valorTotal,
        ]);

        $participante->recalcularStatusPagamento();

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'user_id' => $user->id,
            'tipo' => 'participante_editado_painel',
            'descricao' => "Participante #{$participante->id} ('{$participante->nome_completo}') alterado por '{$user->name}'.",
            'dados_anteriores' => $dadosAnteriores,
            'dados_novos' => $participante->toArray(),
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Participante atualizado com sucesso!',
            'participante' => $participante->load('modelo', 'pagamentos'),
        ]);
    }

    /**
     * Excluir participante.
     */
    public function destroy(Request $request, $grupoId, $participanteId)
    {
        $grupo = Grupo::findOrFail($grupoId);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $participante = GrupoParticipante::where('grupo_id', $grupo->id)
            ->where('id', $participanteId)
            ->firstOrFail();

        $nome = $participante->nome_completo;
        $dadosAnteriores = $participante->toArray();

        $participante->delete();

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'user_id' => $user->id,
            'tipo' => 'participante_excluido',
            'descricao' => "Participante '{$nome}' excluído por '{$user->name}'.",
            'dados_anteriores' => $dadosAnteriores,
            'ip' => $request->ip(),
        ]);

        return response()->json(['message' => 'Participante excluído com sucesso.']);
    }

    /**
     * Registrar pagamento (total ou parcial).
     */
    public function registrarPagamento(Request $request, $grupoId, $participanteId)
    {
        $grupo = Grupo::findOrFail($grupoId);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $participante = GrupoParticipante::where('grupo_id', $grupo->id)
            ->where('id', $participanteId)
            ->firstOrFail();

        $request->validate([
            'valor' => 'required|numeric|min:0.01',
            'forma_pagamento' => 'required|string|max:50',
            'data_pagamento' => 'required|date',
            'observacao' => 'nullable|string|max:255',
        ]);

        $pagamento = GrupoPagamento::create([
            'grupo_participante_id' => $participante->id,
            'valor' => $request->valor,
            'forma_pagamento' => $request->forma_pagamento,
            'data_pagamento' => $request->data_pagamento,
            'observacao' => $request->observacao,
            'registrado_por' => $user->id,
        ]);

        $participante->recalcularStatusPagamento();

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'user_id' => $user->id,
            'tipo' => 'pagamento_registrado',
            'descricao' => "Pagamento de R$ " . number_format($request->valor, 2, ',', '.') . " registrado para '{$participante->nome_completo}' ({$request->forma_pagamento}).",
            'dados_novos' => $pagamento->toArray(),
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Pagamento registrado com sucesso!',
            'pagamento' => $pagamento,
            'participante' => $participante->fresh(['modelo', 'pagamentos']),
        ]);
    }

    /**
     * Excluir um pagamento registrado.
     */
    public function excluirPagamento(Request $request, $grupoId, $participanteId, $pagamentoId)
    {
        $grupo = Grupo::findOrFail($grupoId);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $participante = GrupoParticipante::where('grupo_id', $grupo->id)
            ->where('id', $participanteId)
            ->firstOrFail();

        $pagamento = GrupoPagamento::where('grupo_participante_id', $participante->id)
            ->where('id', $pagamentoId)
            ->firstOrFail();

        $valor = $pagamento->valor;
        $pagamento->delete();

        $participante->recalcularStatusPagamento();

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'user_id' => $user->id,
            'tipo' => 'pagamento_excluido',
            'descricao' => "Pagamento de R$ " . number_format($valor, 2, ',', '.') . " excluído de '{$participante->nome_completo}'.",
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Pagamento removido com sucesso!',
            'participante' => $participante->fresh(['modelo', 'pagamentos']),
        ]);
    }

    /**
     * Aprovar ou recusar solicitação fora do prazo ("Esqueci de preencher" - item 11).
     */
    public function avaliarSolicitacao(Request $request, $grupoId, $solicitacaoId)
    {
        $grupo = Grupo::with('modelos')->findOrFail($grupoId);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado para avaliar esta solicitação.'], 403);
        }

        $solicitacao = GrupoSolicitacao::where('grupo_id', $grupo->id)
            ->where('id', $solicitacaoId)
            ->firstOrFail();

        $request->validate([
            'acao' => 'required|in:aprovar,recusar',
            'resposta' => 'nullable|string|max:500',
        ]);

        if ($request->acao === 'recusar') {
            $solicitacao->update([
                'status' => 'recusado',
                'resposta_admin' => $request->resposta,
                'avaliado_por' => $user->id,
                'avaliado_em' => now(),
            ]);

            GrupoLog::create([
                'grupo_id' => $grupo->id,
                'user_id' => $user->id,
                'tipo' => 'solicitacao_recusada',
                'descricao' => "Solicitação fora do prazo de '{$solicitacao->dados_participante['nome_completo']}' recusada pelo admin.",
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'Solicitação recusada.',
                'solicitacao' => $solicitacao,
            ]);
        }

        // Se aprovar: insere como participante
        $dados = $solicitacao->dados_participante;
        $modelo = GrupoModelo::where('id', $dados['grupo_modelo_id'])
            ->where('grupo_id', $grupo->id)
            ->firstOrFail();

        $valorBase = (float) $modelo->valor_base;
        $quantidade = (int) ($dados['quantidade'] ?? 1);
        $valorUnitario = $valorBase;
        $valorTotal = $valorUnitario * $quantidade;

        DB::beginTransaction();
        try {
            $participante = GrupoParticipante::create([
                'grupo_id' => $grupo->id,
                'grupo_modelo_id' => $modelo->id,
                'token_edicao' => Str::random(40),
                'nome_completo' => $dados['nome_completo'],
                'whatsapp' => $dados['whatsapp'] ?? null,
                'cor' => $dados['cor'] ?? '',
                'tamanho' => $dados['tamanho'] ?? '',
                'quantidade' => $quantidade,
                'nome_camisa' => $dados['nome_camisa'] ?? null,
                'numero_camisa' => $dados['numero_camisa'] ?? null,
                'apelido' => $dados['apelido'] ?? null,
                'frase_costas' => $dados['frase_costas'] ?? null,
                'observacao' => $dados['observacao'] ?? null,
                'valor_unitario' => $valorUnitario,
                'valor_total' => $valorTotal,
                'status_pagamento' => 'pendente',
            ]);

            $solicitacao->update([
                'status' => 'aprovado',
                'resposta_admin' => $request->resposta,
                'avaliado_por' => $user->id,
                'avaliado_em' => now(),
            ]);

            // Se o grupo já estiver em produção, registrar aviso
            $alertaConfeccao = null;
            if ($grupo->status === 'em_producao') {
                $alertaConfeccao = 'Atenção: o grupo já está em produção! A confecção responsável deve ser avisada sobre este acréscimo.';
            }

            GrupoLog::create([
                'grupo_id' => $grupo->id,
                'user_id' => $user->id,
                'tipo' => 'solicitacao_aprovada',
                'descricao' => "Solicitação fora do prazo de '{$participante->nome_completo}' APROVADA pelo admin e convertida em participante." . ($alertaConfeccao ? " [ALERTA: {$alertaConfeccao}]" : ""),
                'ip' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Solicitação aprovada e participante incluído com sucesso!',
                'alerta_confeccao' => $alertaConfeccao,
                'participante' => $participante->load('modelo', 'pagamentos'),
                'solicitacao' => $solicitacao,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => (config('app.debug') ? 'Erro ao aprovar solicitação: ' . $e->getMessage() : 'Erro ao aprovar solicitação.')], 500);
        }
    }
}


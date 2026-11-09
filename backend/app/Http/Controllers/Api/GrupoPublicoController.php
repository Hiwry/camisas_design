<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grupo;
use App\Models\GrupoLog;
use App\Models\GrupoModelo;
use App\Models\GrupoParticipante;
use App\Models\GrupoSolicitacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GrupoPublicoController extends Controller
{
    /**
     * Retorna os dados públicos do grupo para o formulário do participante.
     */
    public function showPublico($token, Request $request)
    {
        $grupo = Grupo::with(['modelos' => function ($q) {
            $q->orderBy('ordem');
        }])->where('token', $token)->firstOrFail();

        // Verifica encerramento de prazo automático
        $prazoExpirado = $grupo->prazo_limite && now()->isAfter($grupo->prazo_limite);
        $estaAberto = ($grupo->status === 'aberto') && !$prazoExpirado;

        // Se o prazo expirou e o status ainda for 'aberto', atualiza internamente
        if ($prazoExpirado && $grupo->status === 'aberto') {
            $grupo->atualizarStatus('prazo_encerrado', null, 'Prazo limite atingido automaticamente');
        }

        $totalParticipantes = $grupo->participantes()->count();
        $totalPecas = (int) $grupo->participantes()->sum('quantidade');

        $temSenha = !empty($grupo->senha_acesso);
        $senhaInformada = $request->query('senha') ?? $request->header('X-Grupo-Senha');
        $senhaValida = false;
        if ($temSenha && !empty($senhaInformada)) {
            $senhaValida = strcasecmp(trim($grupo->senha_acesso), trim((string)$senhaInformada)) === 0;
        }

        // Retorna somente dados não-sensíveis para a página pública
        return response()->json([
            'id' => $grupo->id,
            'token' => $grupo->token,
            'nome' => $grupo->nome,
            'descricao' => $grupo->descricao,
            'imagem_capa' => $grupo->imagem_capa,
            'prazo_limite' => $grupo->prazo_limite,
            'total_esperado' => $grupo->total_esperado,
            'pedido_minimo' => $grupo->pedido_minimo,
            'total_participantes' => $totalParticipantes,
            'total_pecas' => $totalPecas,
            'meta_atingida' => $totalParticipantes >= $grupo->total_esperado,
            'status' => $grupo->status,
            'esta_aberto' => $estaAberto,
            'tem_senha' => $temSenha,
            'senha_valida' => $senhaValida,
            'tabela_medidas_url' => $grupo->tabela_medidas_url,
            'tem_tabela_medidas' => !empty($grupo->tabela_medidas_url),
            'campo_nome_camisa' => $grupo->campo_nome_camisa,
            'campo_numero_camisa' => $grupo->campo_numero_camisa,
            'campo_apelido' => $grupo->campo_apelido,
            'campo_frase_costas' => $grupo->campo_frase_costas,
            'campo_observacao' => $grupo->campo_observacao,
            'tamanhos_disponiveis' => $grupo->tamanhos_disponiveis ?? [],
            'modelos' => $grupo->modelos,
        ]);
    }

    /**
     * Checa se o número de camisa já foi escolhido por outro amigo.
     */
    public function verificarNumero($token, Request $request)
    {
        $numero = $request->query('numero');
        if (empty($numero)) {
            return response()->json(['em_uso' => false]);
        }

        $grupo = Grupo::where('token', $token)->firstOrFail();
        $query = GrupoParticipante::where('grupo_id', $grupo->id)
            ->where('numero_camisa', $numero);

        if ($request->filled('ignorar_participante_id')) {
            $query->where('id', '!=', $request->ignorar_participante_id);
        }

        $existe = $query->exists();

        return response()->json([
            'em_uso' => $existe,
            'numero' => $numero,
        ]);
    }

    /**
     * Valida a senha digitada pelo participante para desbloquear o formulário.
     */
    public function validarSenha($token, Request $request)
    {
        $grupo = Grupo::where('token', $token)->firstOrFail();

        if (empty($grupo->senha_acesso)) {
            return response()->json(['valida' => true]);
        }

        $senha = (string) $request->input('senha', '');
        $valida = strcasecmp(trim($grupo->senha_acesso), trim($senha)) === 0;

        return response()->json([
            'valida' => $valida,
            'message' => $valida ? 'Senha correta!' : 'Senha incorreta.',
        ]);
    }

    /**
     * Submissão pública do formulário de participante.
     */
    public function participar($token, Request $request)
    {
        $grupo = Grupo::with('modelos')->where('token', $token)->firstOrFail();

        // Validação anti-spam honeypot
        if ($request->filled('website_url_honeypot')) {
            return response()->json(['message' => 'Requisição inválida.'], 400);
        }

        // Checagem de senha do grupo
        if (!empty($grupo->senha_acesso)) {
            $senhaEnviada = (string) $request->input('senha_acesso', '');
            if (strcasecmp(trim($grupo->senha_acesso), trim($senhaEnviada)) !== 0) {
                return response()->json(['message' => 'Senha de acesso ao grupo incorreta.'], 403);
            }
        }

        // Checagem de grupo aberto
        if (!$grupo->estaAberto()) {
            return response()->json([
                'message' => 'O prazo para este grupo já foi encerrado ou o pedido já foi confirmado.',
                'fechado' => true,
            ], 422);
        }

        $request->validate([
            'nome_completo' => 'required|string|max:150',
            'whatsapp' => 'nullable|string|max:25',
            'grupo_modelo_id' => 'required|exists:grupo_modelos,id',
            'cor' => 'required|string|max:50',
            'tamanho' => 'required|string|max:20',
            'quantidade' => 'required|integer|min:1|max:100',
            'nome_camisa' => 'nullable|string|max:50',
            'numero_camisa' => 'nullable|string|max:10',
            'apelido' => 'nullable|string|max:50',
            'frase_costas' => 'nullable|string|max:120',
            'observacao' => 'nullable|string|max:1000',
        ]);

        $modelo = GrupoModelo::where('id', $request->grupo_modelo_id)
            ->where('grupo_id', $grupo->id)
            ->firstOrFail();

        // Cálculo de valor: valor base do modelo sem acréscimo por tamanho
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
                'tipo' => 'participante_adicionado',
                'descricao' => "Participante '{$participante->nome_completo}' preencheu o formulário ({$quantidade}x {$modelo->nome}, Tam {$participante->tamanho}).",
                'dados_novos' => $participante->toArray(),
                'ip' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Dados enviados com sucesso!',
                'participante' => $participante->load('modelo'),
                'token_edicao' => $participante->token_edicao,
                'link_edicao' => "/grupo/{$grupo->token}/participante/{$participante->token_edicao}",
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao salvar dados: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Consulta os dados do participante pelo token pessoal de edição.
     */
    public function consultarEdicao($token, $tokenEdicao)
    {
        $grupo = Grupo::with('modelos')->where('token', $token)->firstOrFail();
        $participante = GrupoParticipante::with('modelo')
            ->where('grupo_id', $grupo->id)
            ->where('token_edicao', $tokenEdicao)
            ->firstOrFail();

        return response()->json([
            'grupo' => [
                'nome' => $grupo->nome,
                'prazo_limite' => $grupo->prazo_limite,
                'status' => $grupo->status,
                'esta_aberto' => $grupo->estaAberto(),
                'campo_nome_camisa' => $grupo->campo_nome_camisa,
                'campo_numero_camisa' => $grupo->campo_numero_camisa,
                'campo_apelido' => $grupo->campo_apelido,
                'campo_frase_costas' => $grupo->campo_frase_costas,
                'campo_observacao' => $grupo->campo_observacao,
                'tamanhos_disponiveis' => $grupo->tamanhos_disponiveis ?? [],
                'tabela_medidas_url' => $grupo->tabela_medidas_url,
                'modelos' => $grupo->modelos,
            ],
            'participante' => $participante,
        ]);
    }

    /**
     * Salva as alterações feitas pelo próprio participante antes do prazo/confirmação.
     */
    public function salvarEdicao($token, $tokenEdicao, Request $request)
    {
        $grupo = Grupo::where('token', $token)->firstOrFail();

        if (!$grupo->estaAberto()) {
            return response()->json([
                'message' => 'Não é mais possível editar seus dados porque o prazo encerrou ou o grupo foi confirmado.',
            ], 422);
        }

        $participante = GrupoParticipante::where('grupo_id', $grupo->id)
            ->where('token_edicao', $tokenEdicao)
            ->firstOrFail();

        $request->validate([
            'nome_completo' => 'required|string|max:150',
            'whatsapp' => 'nullable|string|max:25',
            'grupo_modelo_id' => 'required|exists:grupo_modelos,id',
            'cor' => 'required|string|max:50',
            'tamanho' => 'required|string|max:20',
            'quantidade' => 'required|integer|min:1|max:100',
            'nome_camisa' => 'nullable|string|max:50',
            'numero_camisa' => 'nullable|string|max:10',
            'apelido' => 'nullable|string|max:50',
            'frase_costas' => 'nullable|string|max:120',
            'observacao' => 'nullable|string|max:1000',
        ]);

        $modelo = GrupoModelo::where('id', $request->grupo_modelo_id)
            ->where('grupo_id', $grupo->id)
            ->firstOrFail();

        $valorBase = (float) $modelo->valor_base;
        $quantidade = (int) $request->quantidade;
        $valorUnitario = $valorBase;
        $valorTotal = $valorUnitario * $quantidade;

        $dadosAnteriores = $participante->toArray();

        $participante->update([
            'grupo_modelo_id' => $modelo->id,
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
        ]);

        $participante->recalcularStatusPagamento();

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'tipo' => 'participante_auto_editado',
            'descricao' => "Participante '{$participante->nome_completo}' atualizou seus próprios dados via link de edição.",
            'dados_anteriores' => $dadosAnteriores,
            'dados_novos' => $participante->toArray(),
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Dados atualizados com sucesso!',
            'participante' => $participante->load('modelo'),
        ]);
    }

    /**
     * Solicitação de inclusão fora do prazo ("Esqueci de preencher" - item 11).
     */
    public function solicitarForaPrazo($token, Request $request)
    {
        $grupo = Grupo::where('token', $token)->firstOrFail();

        $request->validate([
            'nome_completo' => 'required|string|max:150',
            'whatsapp' => 'nullable|string|max:25',
            'grupo_modelo_id' => 'required|exists:grupo_modelos,id',
            'cor' => 'required|string|max:50',
            'tamanho' => 'required|string|max:20',
            'quantidade' => 'required|integer|min:1|max:100',
            'nome_camisa' => 'nullable|string|max:50',
            'numero_camisa' => 'nullable|string|max:10',
            'apelido' => 'nullable|string|max:50',
            'frase_costas' => 'nullable|string|max:120',
            'observacao' => 'nullable|string|max:1000',
            'motivo' => 'nullable|string|max:500',
        ]);

        $solicitacao = GrupoSolicitacao::create([
            'grupo_id' => $grupo->id,
            'dados_participante' => $request->only([
                'nome_completo',
                'whatsapp',
                'grupo_modelo_id',
                'cor',
                'tamanho',
                'quantidade',
                'nome_camisa',
                'numero_camisa',
                'apelido',
                'frase_costas',
                'observacao',
            ]),
            'motivo' => $request->motivo,
            'status' => 'pendente',
        ]);

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'tipo' => 'solicitacao_fora_prazo',
            'descricao' => "Nova solicitação fora do prazo recebida de '{$request->nome_completo}'. Motivo: " . ($request->motivo ?? 'Não informado'),
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Sua solicitação foi enviada para o administrador do grupo e está aguardando aprovação.',
            'solicitacao' => $solicitacao,
        ], 201);
    }
}


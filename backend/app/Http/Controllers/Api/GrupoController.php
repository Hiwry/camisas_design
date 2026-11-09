<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\Grupo;
use App\Models\GrupoLog;
use App\Models\GrupoModelo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class GrupoController extends Controller
{
    /**
     * Lista os grupos de acordo com o perfil do usuário logado.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Grupo::with(['modelos', 'user:id,name,email,whatsapp', 'confeccao:id,nome'])
            ->withCount(['participantes', 'solicitacoes as solicitacoes_pendentes_count' => function ($q) {
                $q->where('status', 'pendente');
            }]);

        if ($user->isAdmin()) {
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('confeccao_id')) {
                $query->where('confeccao_id', $request->confeccao_id);
            }
        } elseif ($user->isConfeccao()) {
            $confeccaoId = $user->confeccao?->id;
            // A confecção vê tanto os grupos criados por ela quanto os atribuídos a ela
            $query->where(function ($q) use ($user, $confeccaoId) {
                $q->where('user_id', $user->id);
                if ($confeccaoId) {
                    $q->orWhere('confeccao_id', $confeccaoId);
                }
            });
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
        } else {
            // Cliente organizador
            $query->where('user_id', $user->id);
        }

        if ($request->filled('busca')) {
            $busca = $request->busca;
            $query->where(function ($q) use ($busca) {
                $q->where('nome', 'like', "%{$busca}%")
                  ->orWhere('descricao', 'like', "%{$busca}%")
                  ->orWhere('cliente_nome', 'like', "%{$busca}%")
                  ->orWhere('cliente_whatsapp', 'like', "%{$busca}%");
            });
        }

        $grupos = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));

        // Calcula totais: donos do grupo (admin, cliente ou confecção criadora) vêem dados financeiros
        $grupos->getCollection()->transform(function ($grupo) use ($user) {
            $grupo->total_pecas = (int) $grupo->participantes()->sum('quantidade');
            $ehDonoOuAdmin = $user->isAdmin() || ($grupo->user_id === $user->id);

            if ($ehDonoOuAdmin) {
                $grupo->total_previsto = (float) $grupo->participantes()->sum('valor_total');
                $grupo->total_pago = (float) DB::table('grupo_pagamentos')
                    ->join('grupo_participantes', 'grupo_pagamentos.grupo_participante_id', '=', 'grupo_participantes.id')
                    ->where('grupo_participantes.grupo_id', $grupo->id)
                    ->sum('grupo_pagamentos.valor');
                $grupo->total_pendente = max(0, $grupo->total_previsto - $grupo->total_pago);
            }
            return $grupo;
        });

        return response()->json($grupos);
    }

    /**
     * Criação de um novo grupo (cliente ou admin).
     */
    public function store(Request $request)
    {
        $request->validate([
            'nome' => 'required|string|max:150',
            'cliente_nome' => 'nullable|string|max:150',
            'cliente_whatsapp' => 'nullable|string|max:50',
            'descricao' => 'nullable|string',
            'total_esperado' => 'required|integer|min:1',
            'prazo_limite' => 'required|date',
            'pedido_minimo' => 'nullable|integer|min:0',
            'confeccao_id' => 'nullable|exists:confeccoes,id',
            'imagem_capa' => 'nullable|image|max:10240', // até 10MB
            'modelos' => 'nullable|array|min:1',
            'modelos.*.nome' => 'required|string|max:100',
            'modelos.*.valor_base' => 'required|numeric|min:0',
            'modelos.*.cores' => 'nullable|array',
            'tamanhos_disponiveis' => 'nullable|array',
        ]);

        $user = $request->user();

        DB::beginTransaction();
        try {
            $imagemCapaPath = null;
            if ($request->hasFile('imagem_capa')) {
                $imagemCapaPath = $request->file('imagem_capa')->store('grupos/capas', 'public');
            }

            $confeccaoId = null;
            if ($user->isAdmin()) {
                $confeccaoId = $request->confeccao_id;
            } elseif ($user->isConfeccao()) {
                $confeccaoId = $user->confeccao?->id;
            }

            $grupo = Grupo::create([
                'user_id' => $user->isAdmin() && $request->filled('cliente_user_id') ? $request->cliente_user_id : $user->id,
                'confeccao_id' => $confeccaoId,
                'cliente_nome' => $request->cliente_nome,
                'cliente_whatsapp' => $request->cliente_whatsapp,
                'nome' => $request->nome,
                'descricao' => $request->descricao,
                'imagem_capa' => $imagemCapaPath,
                'token' => Str::random(40),
                'senha_acesso' => $request->filled('senha_acesso') ? trim($request->senha_acesso) : (string) mt_rand(100000, 999999),
                'total_esperado' => $request->total_esperado,
                'pedido_minimo' => $request->pedido_minimo ?? 0,
                'prazo_limite' => $request->prazo_limite,
                'status' => 'aberto',
                'campo_nome_camisa' => $request->boolean('campo_nome_camisa', true),
                'campo_numero_camisa' => $request->boolean('campo_numero_camisa', true),
                'campo_apelido' => $request->boolean('campo_apelido', false),
                'campo_frase_costas' => $request->boolean('campo_frase_costas', false),
                'campo_observacao' => $request->boolean('campo_observacao', true),
                'tamanhos_disponiveis' => $request->tamanhos_disponiveis ?? [
                    ['tamanho' => 'PP', 'acrescimo' => 0],
                    ['tamanho' => 'P', 'acrescimo' => 0],
                    ['tamanho' => 'M', 'acrescimo' => 0],
                    ['tamanho' => 'G', 'acrescimo' => 0],
                    ['tamanho' => 'GG', 'acrescimo' => 0],
                    ['tamanho' => 'XG', 'acrescimo' => 0],
                    ['tamanho' => 'XXG', 'acrescimo' => 0],
                ],
                'datas_status' => [
                    'aberto' => now()->toIso8601String(),
                ],
            ]);

            // Modelos padrão ou passados
            $modelosInput = $request->modelos;
            if (empty($modelosInput)) {
                $modelosInput = [
                    [
                        'nome' => 'Camiseta Manga Curta',
                        'valor_base' => 45.00,
                        'cores' => ['Preto', 'Branco', 'Azul Marinho', 'Cinza Mescla'],
                    ]
                ];
            }

            foreach ($modelosInput as $idx => $mod) {
                GrupoModelo::create([
                    'grupo_id' => $grupo->id,
                    'nome' => $mod['nome'],
                    'valor_base' => $mod['valor_base'] ?? 0,
                    'cores' => $mod['cores'] ?? [],
                    'ordem' => $idx,
                ]);
            }

            GrupoLog::create([
                'grupo_id' => $grupo->id,
                'user_id' => $user->id,
                'tipo' => 'grupo_criado',
                'descricao' => "Grupo '{$grupo->nome}' criado com sucesso.",
                'ip' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Grupo criado com sucesso!',
                'grupo' => $grupo->load(['modelos', 'user:id,name,email,whatsapp', 'confeccao:id,nome']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao criar grupo: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Detalhes do grupo (respeitando visibilidade de perfil).
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $grupo = Grupo::with([
            'modelos',
            'confeccao:id,nome,telefone,whatsapp,email',
            'user:id,name,email,whatsapp',
            'participantes' => function ($q) {
                $q->with(['modelo', 'pagamentos'])->orderBy('nome_completo');
            },
            'solicitacoes' => function ($q) {
                $q->orderBy('created_at', 'desc');
            },
            'logs' => function ($q) {
                $q->with('user:id,name')->take(50);
            }
        ])->findOrFail($id);

        // Verificação de permissão: se a confecção é a criadora do grupo, tem acesso total
        $ehCriadorOuAdmin = $user->isAdmin() || ($grupo->user_id === $user->id);

        if (!$ehCriadorOuAdmin && $user->isConfeccao()) {
            if ($grupo->confeccao_id !== $user->confeccao?->id) {
                return response()->json(['message' => 'Acesso não autorizado para esta confecção.'], 403);
            }
            if (!in_array($grupo->status, ['confirmado', 'em_producao', 'pronto', 'entregue'])) {
                return response()->json(['message' => 'Este grupo ainda não foi confirmado pelo administrador.'], 403);
            }

            // Oculta informações financeiras para confecção em grupos de terceiros
            $grupoArray = $grupo->toArray();
            unset($grupoArray['participantes']);
            
            // Participantes sem dados financeiros
            $participantesLimpos = $grupo->participantes->map(function ($p) {
                return [
                    'id' => $p->id,
                    'nome_completo' => $p->nome_completo,
                    'modelo' => $p->modelo?->nome,
                    'cor' => $p->cor,
                    'tamanho' => $p->tamanho,
                    'quantidade' => $p->quantidade,
                    'nome_camisa' => $p->nome_camisa,
                    'numero_camisa' => $p->numero_camisa,
                    'apelido' => $p->apelido,
                    'frase_costas' => $p->frase_costas,
                    'observacao' => $p->observacao,
                ];
            });

            $grupoArray['participantes_producao'] = $participantesLimpos;
            $grupoArray['total_pecas'] = $grupo->participantes->sum('quantidade');
            return response()->json($grupoArray);
        }

        if (!$ehCriadorOuAdmin) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        // Cálculos financeiros para admin e cliente
        $grupo->total_pecas = (int) $grupo->participantes->sum('quantidade');
        $grupo->total_previsto = (float) $grupo->participantes->sum('valor_total');
        $grupo->total_pago = (float) $grupo->participantes->sum(function ($p) {
            return $p->pagamentos->sum('valor');
        });
        $grupo->total_pendente = max(0, $grupo->total_previsto - $grupo->total_pago);

        return response()->json($grupo);
    }

    /**
     * Atualização do grupo (dados gerais ou config de admin).
     */
    public function update(Request $request, $id)
    {
        $grupo = Grupo::findOrFail($id);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $request->validate([
            'nome' => 'sometimes|required|string|max:150',
            'cliente_nome' => 'nullable|string|max:150',
            'cliente_whatsapp' => 'nullable|string|max:50',
            'descricao' => 'nullable|string',
            'total_esperado' => 'sometimes|required|integer|min:1',
            'prazo_limite' => 'nullable|date',
            'pedido_minimo' => 'nullable|integer|min:0',
            'confeccao_id' => 'nullable|exists:confeccoes,id',
            'imagem_capa' => 'nullable|image|max:10240',
            'tamanhos_disponiveis' => 'nullable|array',
        ]);

        $dadosAnteriores = $grupo->toArray();

        if ($request->hasFile('imagem_capa')) {
            if ($grupo->imagem_capa) {
                Storage::disk('public')->delete($grupo->imagem_capa);
            }
            $grupo->imagem_capa = $request->file('imagem_capa')->store('grupos/capas', 'public');
        }

        if ($request->filled('nome')) $grupo->nome = $request->nome;
        if ($request->has('cliente_nome')) $grupo->cliente_nome = $request->cliente_nome;
        if ($request->has('cliente_whatsapp')) $grupo->cliente_whatsapp = $request->cliente_whatsapp;
        if ($request->has('descricao')) $grupo->descricao = $request->descricao;
        if ($request->filled('total_esperado')) $grupo->total_esperado = $request->total_esperado;
        if ($request->filled('senha_acesso')) $grupo->senha_acesso = trim($request->senha_acesso);

        // Campos restritos ao admin ou quando grupo ainda está aberto
        if ($user->isAdmin()) {
            if ($request->has('prazo_limite')) $grupo->prazo_limite = $request->prazo_limite;
            if ($request->has('pedido_minimo')) $grupo->pedido_minimo = $request->pedido_minimo ?? 0;
            if ($request->has('confeccao_id')) $grupo->confeccao_id = $request->confeccao_id;
            if ($request->has('tamanhos_disponiveis')) $grupo->tamanhos_disponiveis = $request->tamanhos_disponiveis;
            if ($request->has('campo_nome_camisa')) $grupo->campo_nome_camisa = $request->boolean('campo_nome_camisa');
            if ($request->has('campo_numero_camisa')) $grupo->campo_numero_camisa = $request->boolean('campo_numero_camisa');
            if ($request->has('campo_apelido')) $grupo->campo_apelido = $request->boolean('campo_apelido');
            if ($request->has('campo_frase_costas')) $grupo->campo_frase_costas = $request->boolean('campo_frase_costas');
            if ($request->has('campo_observacao')) $grupo->campo_observacao = $request->boolean('campo_observacao');
        }

        $grupo->save();

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'user_id' => $user->id,
            'tipo' => 'grupo_atualizado',
            'descricao' => "Grupo '{$grupo->nome}' atualizado.",
            'dados_anteriores' => $dadosAnteriores,
            'dados_novos' => $grupo->toArray(),
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Grupo atualizado com sucesso!',
            'grupo' => $grupo->load(['modelos', 'user:id,name,email,whatsapp', 'confeccao:id,nome']),
        ]);
    }

    /**
     * Duplicar um grupo anterior.
     */
    public function duplicar(Request $request, $id)
    {
        $grupoOriginal = Grupo::with('modelos')->findOrFail($id);
        $user = $request->user();

        if (!$user->isAdmin() && $grupoOriginal->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado para duplicar este grupo.'], 403);
        }

        DB::beginTransaction();
        try {
            $novoGrupo = $grupoOriginal->replicate([
                'token',
                'status',
                'datas_status',
                'tabela_medidas_url',
                'foto_camisa_pronta',
                'observacoes_confeccao',
            ]);

            $novoGrupo->nome = $request->input('nome', $grupoOriginal->nome . ' (Cópia)');
            $novoGrupo->token = Str::random(40);
            $novoGrupo->senha_acesso = (string) mt_rand(100000, 999999);
            $novoGrupo->status = 'aberto';
            $novoGrupo->prazo_limite = $request->input('prazo_limite', now()->addDays(15));
            $novoGrupo->datas_status = [
                'aberto' => now()->toIso8601String(),
            ];
            $novoGrupo->save();

            // Duplica os modelos
            foreach ($grupoOriginal->modelos as $modelo) {
                $novoModelo = $modelo->replicate();
                $novoModelo->grupo_id = $novoGrupo->id;
                $novoModelo->save();
            }

            GrupoLog::create([
                'grupo_id' => $novoGrupo->id,
                'user_id' => $user->id,
                'tipo' => 'grupo_duplicado',
                'descricao' => "Grupo duplicado a partir do grupo #{$grupoOriginal->id} ('{$grupoOriginal->nome}').",
                'ip' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Grupo duplicado com sucesso!',
                'grupo' => $novoGrupo->load('modelos'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao duplicar grupo: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Confirmar e travar o grupo (Admin).
     */
    public function confirmar(Request $request, $id)
    {
        $grupo = Grupo::findOrFail($id);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado para confirmar este grupo.'], 403);
        }

        $grupo->atualizarStatus('confirmado', $user->id, 'Confirmado e travado');

        return response()->json([
            'message' => 'Grupo confirmado e travado com sucesso! Nenhuma alteração direta pelos amigos será permitida.',
            'grupo' => $grupo,
        ]);
    }

    /**
     * Reabrir o grupo (Admin ou Criador).
     */
    public function reabrir(Request $request, $id)
    {
        $grupo = Grupo::findOrFail($id);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado para reabrir este grupo.'], 403);
        }

        $grupo->atualizarStatus('aberto', $user->id, 'Reaberto');

        return response()->json([
            'message' => 'Grupo reaberto com sucesso.',
            'grupo' => $grupo,
        ]);
    }

    /**
     * Excluir grupo.
     */
    public function destroy(Request $request, $id)
    {
        $grupo = Grupo::findOrFail($id);
        $user = $request->user();

        if (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $grupo->delete();

        return response()->json(['message' => 'Grupo excluído com sucesso.']);
    }
}


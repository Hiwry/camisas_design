<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ConfeccaoController extends Controller
{
    // Listagem (admin vê todas | confecção vê apenas a si mesma)
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            $confeccoes = Confeccao::with('user')
                ->withCount('pedidos')
                ->orderBy('nome')
                ->get();

            return response()->json($confeccoes);
        }

        if (!$user->confeccao) {
            return response()->json([]);
        }

        return response()->json([
            $user->confeccao->load('user')->loadCount('pedidos')
        ]);
    }

    public function show(Confeccao $confeccao)
    {
        $this->authorizeConfeccao($confeccao);
        return response()->json($confeccao->load('user'));
    }

    // Cria confecção (com ou sem conta de login) (somente admin)
    public function store(Request $request)
    {
        if (!auth()->user()?->isAdmin()) {
            abort(403, 'Apenas administradores podem cadastrar novas confecções.');
        }

        $request->validate([
            'nome'          => 'required|string|max:255',
            'telefone'      => 'nullable|string|max:20',
            'whatsapp'      => 'nullable|string|max:20',
            'email'         => 'nullable|email|max:255',
            'plano'         => 'required|in:avulso,basico,profissional,premium',
            'criar_usuario' => 'nullable',
            'password'      => 'nullable|string|min:8',
        ]);

        $userId = null;
        $email = !empty($request->email) ? trim($request->email) : null;
        $criarUsuario = filter_var($request->input('criar_usuario', false), FILTER_VALIDATE_BOOLEAN);

        if ($criarUsuario) {
            $request->validate([
                'email'    => 'required|email|unique:users,email',
                'password' => 'required|min:8',
            ]);

            $user = User::create([
                'name'      => $request->nome,
                'email'     => $email,
                'password'  => Hash::make($request->password),
                'role'      => 'confeccao',
                'whatsapp'  => $request->whatsapp ?? $request->telefone,
            ]);

            $userId = $user->id;
        }

        try {
            $confeccao = Confeccao::create([
                'user_id'       => $userId,
                'nome'          => $request->nome,
                'telefone'      => $request->telefone ?? $request->whatsapp,
                'whatsapp'      => $request->whatsapp ?? $request->telefone,
                'email'         => $request->email,
                'plano'         => $request->plano,
                'limite_mensal' => Confeccao::LIMITES_PLANO[$request->plano] ?? 0,
                'reset_em'      => now()->toDateString(),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            Log::warning("ConfeccaoController: Erro SQL ao cadastrar confecção. Aplicando fallback de compatibilidade: " . $e->getMessage());

            // Fallback 1: Se o banco legado ainda tem user_id NOT NULL (migração pendente), cria um stub silencioso
            if (!$userId) {
                $stubEmail = 'cliente_' . preg_replace('/\D/', '', $request->whatsapp ?? '') . '_' . Str::random(6) . '@camisetadesign.local';
                $stubUser = User::create([
                    'name'     => $request->nome,
                    'email'    => $request->email ?: $stubEmail,
                    'password' => Hash::make(Str::random(32)),
                    'role'     => 'confeccao',
                    'whatsapp' => $request->whatsapp ?? $request->telefone,
                ]);
                $userId = $stubUser->id;
            }

            // Fallback 2: Se o banco legado ainda tem o ENUM sem 'avulso', usa 'basico' no banco mas com limite 0
            $planoDb = $request->plano;
            if ($planoDb === 'avulso') {
                $planoDb = 'basico';
            }

            $confeccao = Confeccao::create([
                'user_id'       => $userId,
                'nome'          => $request->nome,
                'telefone'      => $request->telefone ?? $request->whatsapp,
                'whatsapp'      => $request->whatsapp ?? $request->telefone,
                'email'         => $request->email,
                'plano'         => $planoDb,
                'limite_mensal' => 0,
                'reset_em'      => now()->toDateString(),
            ]);
        }

        return response()->json($confeccao->load('user'), 201);
    }

    public function update(Request $request, Confeccao $confeccao)
    {
        $this->authorizeConfeccao($confeccao);
        $user = auth()->user();

        $rules = [
            'nome'     => 'sometimes|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'whatsapp' => 'nullable|string|max:20',
            'email'    => 'nullable|email|max:255',
        ];

        // Apenas admin tem permissão para alterar plano e status ativo
        if ($user->isAdmin()) {
            $rules['plano'] = 'sometimes|in:avulso,basico,profissional,premium';
            $rules['ativo'] = 'sometimes|boolean';
        }

        $request->validate($rules);

        $camposPermitidos = $user->isAdmin()
            ? ['nome', 'telefone', 'whatsapp', 'email', 'plano', 'ativo']
            : ['nome', 'telefone', 'whatsapp', 'email'];

        $confeccao->update($request->only($camposPermitidos));

        return response()->json($confeccao->fresh('user'));
    }

    public function destroy(Confeccao $confeccao)
    {
        if (!auth()->user()?->isAdmin()) {
            abort(403, 'Apenas administradores podem excluir confecções.');
        }

        if ($confeccao->user_id) {
            $confeccao->user()?->delete();
        }
        $confeccao->delete();
        return response()->json(null, 204);
    }

    private function authorizeConfeccao(Confeccao $confeccao): void
    {
        $user = auth()->user();
        if ($user->isAdmin()) return;
        if ($user->confeccao?->id !== $confeccao->id) abort(403, 'Acesso não autorizado a esta confecção.');
    }
}

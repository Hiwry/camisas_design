<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
            'plano'         => 'required|in:basico,profissional,premium',
            'criar_usuario' => 'nullable',
            'password'      => 'nullable|string|min:8',
        ]);

        $userId = null;
        $criarUsuario = filter_var($request->input('criar_usuario', false), FILTER_VALIDATE_BOOLEAN)
            || (!empty($request->email) && !empty($request->password));

        if ($criarUsuario) {
            $request->validate([
                'email'    => 'required|email|unique:users,email',
                'password' => 'required|min:8',
            ]);

            $user = User::create([
                'name'      => $request->nome,
                'email'     => $request->email,
                'password'  => Hash::make($request->password),
                'role'      => 'confeccao',
                'whatsapp'  => $request->whatsapp ?? $request->telefone,
            ]);

            $userId = $user->id;
        }

        $confeccao = Confeccao::create([
            'user_id'       => $userId,
            'nome'          => $request->nome,
            'telefone'      => $request->telefone ?? $request->whatsapp,
            'whatsapp'      => $request->whatsapp ?? $request->telefone,
            'email'         => $request->email,
            'plano'         => $request->plano,
            'limite_mensal' => Confeccao::LIMITES_PLANO[$request->plano] ?? 10,
            'reset_em'      => now()->toDateString(),
        ]);

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
            $rules['plano'] = 'sometimes|in:basico,profissional,premium';
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

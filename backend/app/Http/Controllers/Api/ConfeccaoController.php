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

    // Cria usuário + confecção (somente admin)
    public function store(Request $request)
    {
        if (!auth()->user()?->isAdmin()) {
            abort(403, 'Apenas administradores podem cadastrar novas confecções.');
        }

        $request->validate([
            'nome'      => 'required|string|max:255',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|min:8',
            'telefone'  => 'nullable|string|max:20',
            'whatsapp'  => 'nullable|string|max:20',
            'plano'     => 'required|in:basico,profissional,premium',
        ]);

        $user = User::create([
            'name'      => $request->nome,
            'email'     => $request->email,
            'password'  => Hash::make($request->password),
            'role'      => 'confeccao',
            'whatsapp'  => $request->whatsapp,
        ]);

        $confeccao = Confeccao::create([
            'user_id'  => $user->id,
            'nome'     => $request->nome,
            'telefone' => $request->telefone,
            'email'    => $request->email,
            'plano'    => $request->plano,
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
        ];

        // Apenas admin tem permissão para alterar plano e status ativo
        if ($user->isAdmin()) {
            $rules['plano'] = 'sometimes|in:basico,profissional,premium';
            $rules['ativo'] = 'sometimes|boolean';
        }

        $request->validate($rules);

        $camposPermitidos = $user->isAdmin()
            ? ['nome', 'telefone', 'plano', 'ativo']
            : ['nome', 'telefone'];

        $confeccao->update($request->only($camposPermitidos));

        return response()->json($confeccao->fresh('user'));
    }

    public function destroy(Confeccao $confeccao)
    {
        if (!auth()->user()?->isAdmin()) {
            abort(403, 'Apenas administradores podem excluir confecções.');
        }

        $confeccao->user()->delete();
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

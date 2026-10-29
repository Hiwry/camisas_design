<?php

namespace App\Http\Controllers;

use App\Models\Confeccao;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConfeccaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $confeccoes = Confeccao::with('user')
            ->when($request->search, fn($q) => $q->where('nome', 'like', "%{$request->search}%"))
            ->when($request->plano, fn($q) => $q->where('plano', $request->plano))
            ->orderBy('nome')
            ->paginate(20);

        return response()->json($confeccoes);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nome'      => 'required|string|max:255',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:8',
            'whatsapp'  => 'nullable|string|max:20',
            'plano'     => 'required|in:basico,profissional,premium',
        ]);

        $confeccao = DB::transaction(function () use ($data) {
            $user = User::create([
                'name'     => $data['nome'],
                'email'    => $data['email'],
                'password' => $data['password'],
                'role'     => 'confeccao',
                'whatsapp' => $data['whatsapp'] ?? null,
            ]);

            return Confeccao::create([
                'user_id'       => $user->id,
                'nome'          => $data['nome'],
                'email'         => $data['email'],
                'whatsapp'      => $data['whatsapp'] ?? null,
                'plano'         => $data['plano'],
                'limite_mensal' => Confeccao::PLANOS[$data['plano']],
                'reset_em'      => now()->toDateString(),
            ]);
        });

        return response()->json($confeccao->load('user'), 201);
    }

    public function show(Confeccao $confeccao): JsonResponse
    {
        return response()->json($confeccao->load(['user', 'pedidos' => fn($q) => $q->latest()->limit(10)]));
    }

    public function update(Request $request, Confeccao $confeccao): JsonResponse
    {
        $data = $request->validate([
            'nome'     => 'sometimes|string|max:255',
            'whatsapp' => 'nullable|string|max:20',
            'plano'    => 'sometimes|in:basico,profissional,premium',
            'ativo'    => 'sometimes|boolean',
        ]);

        if (isset($data['plano'])) {
            $data['limite_mensal'] = Confeccao::PLANOS[$data['plano']];
        }

        $confeccao->update($data);

        return response()->json($confeccao->fresh('user'));
    }

    public function destroy(Confeccao $confeccao): JsonResponse
    {
        $confeccao->delete();

        return response()->json(['message' => 'Confecção removida.']);
    }

    public function resetarUso(Confeccao $confeccao): JsonResponse
    {
        $confeccao->resetarUsoMensal();

        return response()->json([
            'message'         => 'Uso mensal resetado.',
            'artes_usadas_mes' => 0,
        ]);
    }
}

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
            'nome'          => 'required|string|max:255',
            'telefone'      => 'nullable|string|max:20',
            'whatsapp'      => 'nullable|string|max:20',
            'email'         => 'nullable|email',
            'plano'         => 'required|in:avulso,basico,profissional,premium',
            'criar_usuario' => 'nullable',
            'password'      => 'nullable|string|min:8',
        ]);

        $criarUsuario = filter_var($request->input('criar_usuario', false), FILTER_VALIDATE_BOOLEAN)
            || (!empty($data['email']) && !empty($data['password']));

        $confeccao = DB::transaction(function () use ($data, $criarUsuario) {
            $userId = null;
            if ($criarUsuario) {
                $user = User::create([
                    'name'     => $data['nome'],
                    'email'    => $data['email'],
                    'password' => $data['password'],
                    'role'     => 'confeccao',
                    'whatsapp' => $data['whatsapp'] ?? $data['telefone'] ?? null,
                ]);
                $userId = $user->id;
            }

            return Confeccao::create([
                'user_id'       => $userId,
                'nome'          => $data['nome'],
                'telefone'      => $data['telefone'] ?? $data['whatsapp'] ?? null,
                'email'         => $data['email'] ?? null,
                'whatsapp'      => $data['whatsapp'] ?? $data['telefone'] ?? null,
                'plano'         => $data['plano'],
                'limite_mensal' => Confeccao::LIMITES_PLANO[$data['plano']] ?? 10,
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

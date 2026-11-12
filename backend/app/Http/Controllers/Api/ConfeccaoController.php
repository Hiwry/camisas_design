<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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
            'logo_url'      => 'nullable|string|max:500',
            'logo_arquivo'  => 'nullable|file|mimes:jpeg,jpg,png,webp,svg|max:10240',
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

        // Upload de logo se fornecido arquivo
        $logoUrl = $request->input('logo_url');
        if ($request->hasFile('logo_arquivo')) {
            try {
                @mkdir(storage_path('app/public/confeccoes/logos'), 0775, true);
                $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
                $path = $request->file('logo_arquivo')->store('confeccoes/logos', $disk);
                $logoUrl = Storage::disk($disk)->url($path);
            } catch (\Throwable $e) {
                Log::warning("ConfeccaoController@store: Falha em {$disk}: " . $e->getMessage() . ". Tentando disco public...");
                try {
                    $path = $request->file('logo_arquivo')->store('confeccoes/logos', 'public');
                    $logoUrl = Storage::disk('public')->url($path);
                } catch (\Throwable $e2) {
                    Log::error("ConfeccaoController@store: Erro crítico ao salvar arquivo de logo: " . $e2->getMessage());
                }
            }
        }

        $plano = $request->plano;
        $limiteMensal = ($plano === 'avulso') ? 0 : (Confeccao::LIMITES_PLANO[$plano] ?? 10);

        try {
            $confeccao = Confeccao::create([
                'user_id'       => $userId,
                'nome'          => $request->nome,
                'telefone'      => $request->telefone ?? $request->whatsapp,
                'whatsapp'      => $request->whatsapp ?? $request->telefone,
                'email'         => $request->email,
                'logo_url'      => $logoUrl,
                'plano'         => $plano,
                'limite_mensal' => $limiteMensal,
                'reset_em'      => now()->toDateString(),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            Log::warning("ConfeccaoController: Erro SQL ao cadastrar confecção. Aplicando fallback de compatibilidade: " . $e->getMessage());

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

            $confeccao = Confeccao::create([
                'user_id'       => $userId,
                'nome'          => $request->nome,
                'telefone'      => $request->telefone ?? $request->whatsapp,
                'whatsapp'      => $request->whatsapp ?? $request->telefone,
                'email'         => $request->email,
                'logo_url'      => $logoUrl,
                'plano'         => $plano,
                'limite_mensal' => $limiteMensal,
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
            'nome'         => 'sometimes|string|max:255',
            'telefone'     => 'nullable|string|max:20',
            'whatsapp'     => 'nullable|string|max:20',
            'email'        => 'nullable|email|max:255',
            'logo_url'     => 'nullable|string|max:500',
            'logo_arquivo' => 'nullable|file|mimes:jpeg,jpg,png,webp,svg|max:10240',
            'remover_logo' => 'nullable',
        ];

        // Apenas admin tem permissão para alterar plano e status ativo
        if ($user->isAdmin()) {
            $rules['plano'] = 'sometimes|in:avulso,basico,profissional,premium';
            $rules['limite_mensal'] = 'nullable|integer|min:0';
            $rules['ativo'] = 'sometimes|boolean';
        }

        $request->validate($rules);

        try {
            $camposPermitidos = $user->isAdmin()
                ? ['nome', 'telefone', 'whatsapp', 'email', 'plano', 'limite_mensal', 'ativo', 'logo_url']
                : ['nome', 'telefone', 'whatsapp', 'email', 'logo_url'];

            $dados = $request->only($camposPermitidos);

            // Upload de logo com fallback
            if ($request->hasFile('logo_arquivo')) {
                try {
                    @mkdir(storage_path('app/public/confeccoes/logos'), 0775, true);
                    $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
                    $path = $request->file('logo_arquivo')->store('confeccoes/logos', $disk);
                    $dados['logo_url'] = Storage::disk($disk)->url($path);
                } catch (\Throwable $e) {
                    Log::warning("ConfeccaoController@update: Falha em {$disk}: " . $e->getMessage() . ". Tentando disco public...");
                    try {
                        $path = $request->file('logo_arquivo')->store('confeccoes/logos', 'public');
                        $dados['logo_url'] = Storage::disk('public')->url($path);
                    } catch (\Throwable $e2) {
                        Log::error("ConfeccaoController@update: Erro crítico ao salvar arquivo de logo: " . $e2->getMessage());
                    }
                }
            } elseif ($request->boolean('remover_logo') || $request->input('remover_logo') === '1') {
                $dados['logo_url'] = null;
            }

            // Se o plano for alterado, sincroniza limite mensal se necessário
            if (isset($dados['plano'])) {
                if ($dados['plano'] === 'avulso') {
                    $dados['limite_mensal'] = 0;
                } elseif (!isset($dados['limite_mensal'])) {
                    $dados['limite_mensal'] = Confeccao::LIMITES_PLANO[$dados['plano']] ?? 10;
                }
            }

            $confeccao->update($dados);

            // Se tiver usuário associado, sincroniza nome e email de forma segura
            if ($confeccao->user && $confeccao->user->role === 'confeccao') {
                try {
                    $userUpdates = [];
                    if (!empty($dados['nome'])) {
                        $userUpdates['name'] = $dados['nome'];
                    }
                    if (!empty($dados['email']) && $dados['email'] !== $confeccao->user->email) {
                        $emailEmUso = User::where('email', $dados['email'])
                            ->where('id', '!=', $confeccao->user->id)
                            ->exists();
                        if (!$emailEmUso) {
                            $userUpdates['email'] = $dados['email'];
                        } else {
                            Log::warning("ConfeccaoController: email {$dados['email']} já está em uso por outro usuário. Sincronização de email ignorada.");
                        }
                    }
                    if (!empty($userUpdates)) {
                        $confeccao->user->update($userUpdates);
                    }
                } catch (\Throwable $e) {
                    Log::warning("ConfeccaoController: Falha ao sincronizar dados do usuário: " . $e->getMessage());
                }
            }

            return response()->json($confeccao->fresh('user'));
        } catch (\Throwable $e) {
            Log::error("ConfeccaoController@update erro fatal: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Erro ao atualizar dados da confecção: ' . $e->getMessage()
            ], 500);
        }
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

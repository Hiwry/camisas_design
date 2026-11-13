<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Bloqueia tokens de usuários desativados: o campo `ativo` só era checado no login,
 * então uma conta desativada continuava usando o token já emitido.
 */
class EnsureUserAtivo
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->ativo === false) {
            $user->tokens()->delete();
            return response()->json(['message' => 'Conta desativada.'], 403);
        }

        return $next($request);
    }
}

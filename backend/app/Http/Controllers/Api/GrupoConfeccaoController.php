<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grupo;
use App\Models\GrupoLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class GrupoConfeccaoController extends Controller
{
    /**
     * Enviar ou substituir a tabela de medidas do grupo (Confecção ou Admin).
     */
    public function salvarTabelaMedidas(Request $request, $grupoId)
    {
        $grupo = Grupo::findOrFail($grupoId);
        $user = $request->user();

        // Permissão: admin ou a confecção atribuída
        if (!$user->isAdmin()) {
            if (!$user->isConfeccao() || $grupo->confeccao_id !== $user->confeccao?->id) {
                return response()->json(['message' => 'Acesso não autorizado para esta confecção.'], 403);
            }
        }

        $request->validate([
            'tabela_medidas' => 'required|image|mimes:jpeg,png,jpg,webp|max:10240', // até 10MB
        ]);

        if ($grupo->tabela_medidas_url) {
            Storage::disk('public')->delete($grupo->tabela_medidas_url);
        }

        $path = $request->file('tabela_medidas')->store('grupos/tabelas_medidas', 'public');
        $grupo->update(['tabela_medidas_url' => $path]);

        GrupoLog::create([
            'grupo_id' => $grupo->id,
            'user_id' => $user->id,
            'tipo' => 'tabela_medidas_atualizada',
            'descricao' => "Tabela de medidas enviada por '{$user->name}'.",
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Tabela de medidas enviada com sucesso!',
            'tabela_medidas_url' => $path,
            'grupo' => $grupo,
        ]);
    }

    /**
     * Atualização do status de produção e observações pela Confecção (ou Admin).
     */
    public function atualizarStatusProducao(Request $request, $grupoId)
    {
        $grupo = Grupo::findOrFail($grupoId);
        $user = $request->user();

        // Permissão: admin ou a confecção atribuída
        if (!$user->isAdmin()) {
            if (!$user->isConfeccao() || $grupo->confeccao_id !== $user->confeccao?->id) {
                return response()->json(['message' => 'Acesso não autorizado para esta confecção.'], 403);
            }
        }

        $request->validate([
            'status' => 'required|in:em_producao,pronto,entregue',
            'observacoes_confeccao' => 'nullable|string',
            'foto_camisa_pronta' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:10240',
        ]);

        if ($request->hasFile('foto_camisa_pronta')) {
            if ($grupo->foto_camisa_pronta) {
                Storage::disk('public')->delete($grupo->foto_camisa_pronta);
            }
            $grupo->foto_camisa_pronta = $request->file('foto_camisa_pronta')->store('grupos/camisas_prontas', 'public');
        }

        if ($request->has('observacoes_confeccao')) {
            $grupo->observacoes_confeccao = $request->observacoes_confeccao;
        }

        $grupo->save();

        if ($request->status !== $grupo->status) {
            $grupo->atualizarStatus($request->status, $user->id, 'Atualizado pela confecção: ' . ($request->observacoes_confeccao ?? ''));
        }

        return response()->json([
            'message' => 'Status de produção atualizado com sucesso!',
            'grupo' => $grupo->fresh(['confeccao', 'user']),
        ]);
    }
}


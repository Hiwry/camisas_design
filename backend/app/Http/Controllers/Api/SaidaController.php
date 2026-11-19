<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Saida;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaidaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Saida::query()->orderByDesc('data')->orderByDesc('id');

        if ($request->filled('origem') && in_array($request->origem, Saida::ORIGENS, true)) {
            $q->where('origem', $request->origem);
        }
        if ($request->filled('mes') && preg_match('/^\d{4}-\d{2}$/', $request->mes)) {
            $q->whereBetween('data', [$request->mes . '-01', date('Y-m-t', strtotime($request->mes . '-01'))]);
        }

        return response()->json($q->limit(500)->get());
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(Saida::create($this->validar($request)), 201);
    }

    public function update(Request $request, Saida $saida): JsonResponse
    {
        $saida->update($this->validar($request));

        return response()->json($saida->fresh());
    }

    public function destroy(Saida $saida): JsonResponse
    {
        $saida->delete();

        return response()->json(['message' => 'Saída excluída.']);
    }

    private function validar(Request $request): array
    {
        $v = $request->validate([
            'descricao'   => 'required|string|max:255',
            'categoria'   => 'nullable|string|max:60',
            'valor'       => 'required|numeric|gt:0|max:9999999',
            'data'        => 'required|date',
            'origem'      => 'required|in:pedidos,orcamentos',
            'observacoes' => 'nullable|string|max:2000',
        ]);

        $v['valor'] = round((float) $v['valor'], 2);
        $v['categoria'] = isset($v['categoria']) && trim($v['categoria']) !== '' ? trim($v['categoria']) : null;

        return $v;
    }
}

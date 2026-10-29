<?php

namespace App\Http\Controllers;

use App\Models\Confeccao;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        // Total de pedidos por status
        $porStatus = Pedido::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        // Preencher statuses sem pedidos com 0
        $statusZerados = array_fill_keys(Pedido::STATUS, 0);
        $porStatus = array_merge($statusZerados, $porStatus);

        // Pedidos por confecção (top 10)
        $porConfeccao = Pedido::select('confeccao_id', DB::raw('count(*) as total'))
            ->with('confeccao:id,nome')
            ->groupBy('confeccao_id')
            ->orderByDesc('total')
            ->limit(10)
            ->get()
            ->map(fn($p) => [
                'confeccao' => $p->confeccao?->nome ?? 'N/A',
                'total'     => $p->total,
            ]);

        // Uso de plano por confecção
        $usoPorPlano = Confeccao::select('id', 'nome', 'plano', 'limite_mensal', 'artes_usadas_mes')
            ->where('ativo', true)
            ->orderBy('nome')
            ->get()
            ->map(fn($c) => [
                'id'             => $c->id,
                'nome'           => $c->nome,
                'plano'          => $c->plano,
                'limite_mensal'  => $c->limite_mensal,
                'artes_usadas'   => $c->artes_usadas_mes,
                'percentual_uso' => $c->limite_mensal > 0
                    ? round(($c->artes_usadas_mes / $c->limite_mensal) * 100)
                    : 0,
            ]);

        // Pedidos recentes (últimos 7 dias)
        $pedidosRecentes = Pedido::with('confeccao:id,nome')
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        // Pedidos atrasados (excluir cancelados e finalizados)
        $atrasados = Pedido::whereNotNull('prazo')
            ->where('prazo', '<', now()->toDateString())
            ->whereNotIn('status', ['aprovado', 'finalizado', 'cancelado'])
            ->count();

        // Total excluindo cancelados (pedidos "ativos")
        $totalAtivos = array_sum(array_diff_key($porStatus, ['cancelado' => 0]));

        return response()->json([
            'por_status'       => $porStatus,
            'por_confeccao'    => $porConfeccao,
            'uso_por_plano'    => $usoPorPlano,
            'pedidos_recentes' => $pedidosRecentes,
            'atrasados'        => $atrasados,
            'cancelados'       => $porStatus['cancelado'] ?? 0,
            'total_geral'      => array_sum($porStatus),
            'total_ativos'     => $totalAtivos,
        ]);
    }
}

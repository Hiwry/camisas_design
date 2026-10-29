<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && !$user->isAdmin()) {
            return $this->dashboardConfeccao($user);
        }

        return $this->dashboardAdmin();
    }

    private function dashboardAdmin(): JsonResponse
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
            'total_pedidos'    => array_sum($porStatus),
            'pedidos_hoje'     => Pedido::whereDate('created_at', today())->count(),
            'total_confeccoes' => Confeccao::where('ativo', true)->count(),
        ]);
    }

    private function dashboardConfeccao($user): JsonResponse
    {
        $confeccao = $user->confeccao;

        $porStatus = Pedido::where('confeccao_id', $confeccao?->id ?? 0)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $statusZerados = array_fill_keys(Pedido::STATUS, 0);
        $porStatus = array_merge($statusZerados, $porStatus);

        $totalGeral = array_sum($porStatus);
        $totalAtivos = array_sum(array_diff_key($porStatus, ['cancelado' => 0]));

        return response()->json([
            'por_status'       => $porStatus,
            'por_confeccao'    => $confeccao ? [['confeccao' => $confeccao->nome, 'total' => $totalGeral]] : [],
            'uso_por_plano'    => $confeccao ? [[
                'id'             => $confeccao->id,
                'nome'           => $confeccao->nome,
                'plano'          => $confeccao->plano,
                'limite_mensal'  => $confeccao->limite_mensal,
                'artes_usadas'   => $confeccao->artes_usadas_mes,
                'percentual_uso' => $confeccao->limite_mensal > 0
                    ? round(($confeccao->artes_usadas_mes / $confeccao->limite_mensal) * 100)
                    : 0,
            ]] : [],
            'pedidos_recentes' => Pedido::where('confeccao_id', $confeccao?->id ?? 0)
                ->where('created_at', '>=', now()->subDays(7))->count(),
            'atrasados'        => Pedido::where('confeccao_id', $confeccao?->id ?? 0)
                ->whereNotNull('prazo')
                ->where('prazo', '<', now()->toDateString())
                ->whereNotIn('status', ['aprovado', 'finalizado', 'cancelado'])
                ->count(),
            'cancelados'       => $porStatus['cancelado'] ?? 0,
            'total_geral'      => $totalGeral,
            'total_ativos'     => $totalAtivos,
            'confeccao'        => $confeccao?->nome,
            'plano'            => $confeccao?->plano,
            'artes_usadas'     => $confeccao?->artes_usadas_mes ?? 0,
            'limite_mensal'    => $confeccao?->limite_mensal ?? 0,
            'artes_disponiveis'=> $confeccao ? $confeccao->artesDisponiveis() : 0,
        ]);
    }
}

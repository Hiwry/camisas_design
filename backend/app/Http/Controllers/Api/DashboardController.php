<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\Pedido;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            return $this->dashboardAdmin();
        }

        return $this->dashboardConfeccao($user->confeccao);
    }

    private function dashboardAdmin(): \Illuminate\Http\JsonResponse
    {
        $porStatus = Pedido::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $porConfeccao = Confeccao::withCount([
            'pedidos',
            'pedidos as pedidos_aprovados_count' => fn($q) => $q->where('status', 'aprovado'),
            'pedidos as pedidos_aguardando_count' => fn($q) => $q->where('status', 'aguardando_aprovacao'),
        ])->get(['id', 'nome', 'plano', 'artes_usadas_mes', 'limite_mensal']);

        $totalPedidos = Pedido::count();
        $pedidosHoje  = Pedido::whereDate('created_at', today())->count();
        $totalConfeccoes = Confeccao::where('ativo', true)->count();

        return response()->json([
            'total_pedidos'    => $totalPedidos,
            'pedidos_hoje'     => $pedidosHoje,
            'total_confeccoes' => $totalConfeccoes,
            'por_status'       => $porStatus,
            'por_confeccao'    => $porConfeccao,
        ]);
    }

    private function dashboardConfeccao(Confeccao $confeccao): \Illuminate\Http\JsonResponse
    {
        $porStatus = Pedido::where('confeccao_id', $confeccao->id)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'confeccao'        => $confeccao->nome,
            'plano'            => $confeccao->plano,
            'artes_usadas'     => $confeccao->artes_usadas_mes,
            'limite_mensal'    => $confeccao->limite_mensal,
            'artes_disponiveis'=> $confeccao->artesDisponiveis(),
            'por_status'       => $porStatus,
        ]);
    }
}

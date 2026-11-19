<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\Saida;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dashboards financeiros separados:
 *  - origem=pedidos    -> pedidos normais (sem orcamento_id) + saídas cadastradas como "pedidos"
 *  - origem=orcamentos -> pedidos criados a partir de orçamento + saídas cadastradas como "orcamentos"
 *
 * Entrada (faturado) = valor do pedido (cancelados ficam de fora), contada na data de criação do pedido.
 * Recebido = pedidos com pagamento_status 'pago'. A receber = faturado - recebido.
 */
class FinanceiroController extends Controller
{
    private const CAMPOS = ['id', 'orcamento_id', 'titulo', 'status', 'valor', 'confeccao_id', 'pagamento_status', 'pago_em', 'created_at'];

    public function dashboard(Request $request): JsonResponse
    {
        $request->validate([
            'origem'  => 'required|in:pedidos,orcamentos',
            'periodo' => 'nullable|in:mes,3m,6m,ano,tudo',
        ]);

        $origem  = $request->origem;
        $periodo = $request->input('periodo', 'mes');
        $hoje    = Carbon::today();

        $inicio = match ($periodo) {
            'mes'  => $hoje->copy()->startOfMonth(),
            '3m'   => $hoje->copy()->startOfMonth()->subMonths(2),
            '6m'   => $hoje->copy()->startOfMonth()->subMonths(5),
            'ano'  => $hoje->copy()->startOfMonth()->subMonths(11),
            default => null,
        };

        $basePedidos = fn () => $origem === 'orcamentos'
            ? Pedido::whereNotNull('orcamento_id')
            : Pedido::whereNull('orcamento_id');

        $pedidosTodos = $basePedidos()->get(self::CAMPOS);
        $saidasTodas  = Saida::where('origem', $origem)->get();

        $naoCancelado = fn ($p) => $p->status !== 'cancelado';
        $noPeriodoPedido = fn ($p) => !$inicio || $p->created_at->greaterThanOrEqualTo($inicio);
        $noPeriodoSaida  = fn ($s) => !$inicio || $s->data->greaterThanOrEqualTo($inicio);

        $pedidos = $pedidosTodos->filter($noPeriodoPedido);
        $validos = $pedidos->filter($naoCancelado);
        $comValor = $validos->filter(fn ($p) => (float) $p->valor > 0);
        $saidas = $saidasTodas->filter($noPeriodoSaida);

        $entradas = round((float) $comValor->sum('valor'), 2);
        $pagos = $comValor->filter(fn ($p) => $p->pagamento_status === 'pago');
        $recebido = round((float) $pagos->sum('valor'), 2);
        $totalSaidas = round((float) $saidas->sum('valor'), 2);

        // Série mensal (6 meses; 12 para ano/tudo)
        $nMeses = in_array($periodo, ['ano', 'tudo'], true) ? 12 : 6;
        $meses = [];
        for ($i = $nMeses - 1; $i >= 0; $i--) {
            $ref = $hoje->copy()->startOfMonth()->subMonths($i);
            $chave = $ref->format('Y-m');
            $e = round((float) $pedidosTodos->filter($naoCancelado)
                ->filter(fn ($p) => $p->created_at->format('Y-m') === $chave && (float) $p->valor > 0)->sum('valor'), 2);
            $r = round((float) $pedidosTodos->filter($naoCancelado)
                ->filter(fn ($p) => $p->created_at->format('Y-m') === $chave && (float) $p->valor > 0 && $p->pagamento_status === 'pago')->sum('valor'), 2);
            $s = round((float) $saidasTodas->filter(fn ($x) => $x->data->format('Y-m') === $chave)->sum('valor'), 2);
            $meses[] = ['mes' => $chave, 'entradas' => $e, 'recebido' => $r, 'saidas' => $s, 'resultado' => round($e - $s, 2), 'resultado_caixa' => round($r - $s, 2)];
        }

        $porStatus = array_fill_keys(Pedido::STATUS, 0);
        foreach ($pedidos->groupBy('status') as $st => $g) {
            $porStatus[$st] = $g->count();
        }

        $porCategoria = $saidas->groupBy(fn ($s) => $s->categoria ?: 'Sem categoria')
            ->map(fn ($g, $cat) => ['categoria' => $cat, 'total' => round((float) $g->sum('valor'), 2), 'qtd' => $g->count()])
            ->sortByDesc('total')->values();

        $recentesPedidos = $pedidos->sortByDesc('created_at')->take(50)->values()->map(fn ($p) => [
            'id' => $p->id, 'titulo' => $p->titulo, 'status' => $p->status, 'valor' => (float) $p->valor,
            'pago' => $p->pagamento_status === 'pago', 'pago_em' => $p->pago_em, 'created_at' => $p->created_at,
        ]);

        return response()->json([
            'origem'  => $origem,
            'periodo' => $periodo,
            'resumo'  => [
                'entradas'       => $entradas,
                'recebido'       => $recebido,
                'a_receber'      => round($entradas - $recebido, 2),
                'pedidos_pagos'  => $pagos->count(),
                'pedidos_pendentes' => $comValor->count() - $pagos->count(),
                'saidas'         => $totalSaidas,
                'resultado'      => round($entradas - $totalSaidas, 2),
                'resultado_caixa' => round($recebido - $totalSaidas, 2),
                'pedidos'        => $validos->count(),
                'pedidos_com_valor' => $comValor->count(),
                'cancelados'     => $pedidos->count() - $validos->count(),
                'ticket_medio'   => $comValor->count() > 0 ? round($entradas / $comValor->count(), 2) : 0,
                'qtd_saidas'     => $saidas->count(),
            ],
            'meses'            => $meses,
            'pedidos_por_status' => $porStatus,
            'saidas_por_categoria' => $porCategoria,
            'recentes_pedidos' => $recentesPedidos,
            'recentes_saidas'  => $saidas->sortByDesc('data')->take(8)->values(),
        ]);
    }
}

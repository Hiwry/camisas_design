<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\Orcamento;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrcamentoController extends Controller
{
    private const PEDIDO_CAMPOS = ['id', 'orcamento_id', 'titulo', 'status', 'valor', 'prazo', 'confeccao_id', 'pagamento_status', 'created_at'];

    public function index(): JsonResponse
    {
        $lista = Orcamento::with(['pedidos' => fn ($q) => $q->select(self::PEDIDO_CAMPOS)])
            ->orderByDesc('numero')
            ->get();

        return response()->json($lista);
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $this->validar($request);

        $orcamento = DB::transaction(function () use ($dados) {
            $numero = ((int) Orcamento::lockForUpdate()->max('numero')) + 1;
            return Orcamento::create($dados + ['numero' => $numero, 'status' => 'aberto']);
        });

        return response()->json($orcamento->load('pedidos'), 201);
    }

    public function update(Request $request, Orcamento $orcamento): JsonResponse
    {
        if ($orcamento->status === 'convertido') {
            return response()->json(['message' => 'Orçamento já convertido em pedido não pode ser editado.'], 422);
        }

        $orcamento->update($this->validar($request));

        return response()->json($orcamento->fresh()->load('pedidos'));
    }

    public function destroy(Orcamento $orcamento): JsonResponse
    {
        if ($orcamento->status === 'convertido' || $orcamento->pedidos()->exists()) {
            return response()->json(['message' => 'Orçamento convertido em pedido não pode ser excluído.'], 422);
        }

        $orcamento->delete();

        return response()->json(['message' => 'Orçamento excluído.']);
    }

    /** Marca como perdido ou reabre (aberto <-> perdido). */
    public function status(Request $request, Orcamento $orcamento): JsonResponse
    {
        $request->validate(['status' => 'required|in:aberto,perdido']);

        if ($orcamento->status === 'convertido') {
            return response()->json(['message' => 'Orçamento já convertido em pedido.'], 422);
        }

        $orcamento->update(['status' => $request->status]);

        return response()->json($orcamento->fresh()->load('pedidos'));
    }

    /** Converte cada arte do orçamento em um pedido. */
    public function converter(Request $request, Orcamento $orcamento): JsonResponse
    {
        $request->validate([
            'confeccao_id'   => 'required|exists:confeccoes,id',
            'tipo_impressao' => 'required|in:sublimacao,bordado,serigrafia',
        ]);

        $confeccao = Confeccao::findOrFail($request->confeccao_id);

        $resultado = DB::transaction(function () use ($orcamento, $request, $confeccao) {
            // Trava a linha para evitar conversão dupla (duplo clique / duas abas)
            $o = Orcamento::lockForUpdate()->findOrFail($orcamento->id);

            if ($o->status === 'convertido') {
                return ['erro' => 'Este orçamento já foi convertido em pedido.'];
            }

            $itens = $o->itens ?? [];
            $criados = [];

            foreach ($itens as $idx => $item) {
                if (!empty($item['pedido_id'])) {
                    continue;
                }
                $obs = [];
                if (!empty($item['servico'])) {
                    $obs[] = 'Serviço: ' . $item['servico'];
                }
                $obs[] = 'Origem: Orçamento Nº ' . str_pad((string) $o->numero, 4, '0', STR_PAD_LEFT);
                if ($o->observacoes) {
                    $obs[] = $o->observacoes;
                }

                $pedido = Pedido::create([
                    'confeccao_id'     => $confeccao->id,
                    'titulo'           => mb_substr($item['arte'] ?: 'Arte', 0, 255),
                    'tipo_impressao'   => $request->tipo_impressao,
                    'observacoes'      => implode("\n", $obs),
                    'prazo'            => $item['data'] ?? null,
                    'valor'            => (float) ($item['valor'] ?? 0),
                    'cliente_nome'     => $o->cliente_nome,
                    'cliente_whatsapp' => $o->cliente_whatsapp,
                    'orcamento_id'     => $o->id,
                ]);

                $itens[$idx]['pedido_id'] = $pedido->id;
                $criados[] = $pedido->id;
            }

            if (empty($criados)) {
                return ['erro' => 'Nenhuma arte para converter neste orçamento.'];
            }

            $o->update(['itens' => $itens, 'status' => 'convertido', 'convertido_em' => now()]);

            return ['orcamento' => $o->fresh()->load(['pedidos' => fn ($q) => $q->select(self::PEDIDO_CAMPOS)]), 'criados' => $criados];
        });

        if (isset($resultado['erro'])) {
            return response()->json(['message' => $resultado['erro']], 422);
        }

        return response()->json($resultado);
    }

    public function dashboard(): JsonResponse
    {
        $todos = Orcamento::all();
        $abertos = $todos->where('status', 'aberto');
        $convertidos = $todos->where('status', 'convertido');
        $perdidos = $todos->where('status', 'perdido');

        $decididos = $convertidos->count() + $perdidos->count();

        $pedidos = Pedido::whereNotNull('orcamento_id')->get(self::PEDIDO_CAMPOS);
        $porStatus = array_fill_keys(Pedido::STATUS, 0);
        foreach ($pedidos->groupBy('status') as $st => $grupo) {
            $porStatus[$st] = $grupo->count();
        }

        // Últimos 6 meses (inclui o atual)
        $meses = [];
        for ($i = 5; $i >= 0; $i--) {
            $ref = now()->startOfMonth()->subMonths($i);
            $chave = $ref->format('Y-m');
            $doMes = $todos->filter(fn ($o) => $o->data && $o->data->format('Y-m') === $chave);
            $meses[] = [
                'mes'                => $chave,
                'qtd_orcamentos'     => $doMes->count(),
                'qtd_convertidos'    => $doMes->where('status', 'convertido')->count(),
                'valor_orcado'       => round($doMes->sum('total'), 2),
                'valor_convertido'   => round($doMes->where('status', 'convertido')->sum('total'), 2),
            ];
        }

        $recentes = Pedido::whereNotNull('orcamento_id')
            ->with('confeccao:id,nome')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(self::PEDIDO_CAMPOS)
            ->map(fn ($p) => [
                'id'        => $p->id,
                'titulo'    => $p->titulo,
                'status'    => $p->status,
                'valor'     => (float) $p->valor,
                'confeccao' => $p->confeccao?->nome,
                'orcamento_id' => $p->orcamento_id,
                'created_at'   => $p->created_at,
            ]);

        return response()->json([
            'orcamentos' => [
                'total'            => $todos->count(),
                'abertos'          => $abertos->count(),
                'convertidos'      => $convertidos->count(),
                'perdidos'         => $perdidos->count(),
                'valor_orcado'     => round($todos->sum('total'), 2),
                'valor_aberto'     => round($abertos->sum('total'), 2),
                'valor_convertido' => round($convertidos->sum('total'), 2),
                'valor_perdido'    => round($perdidos->sum('total'), 2),
                'taxa_conversao'   => $decididos > 0 ? round($convertidos->count() / $decididos * 100, 1) : null,
            ],
            'pedidos' => [
                'total'      => $pedidos->count(),
                'valor_total' => round((float) $pedidos->sum('valor'), 2),
                'por_status' => $porStatus,
                'recentes'   => $recentes,
            ],
            'meses' => $meses,
        ]);
    }

    private function validar(Request $request): array
    {
        $v = $request->validate([
            'cliente_nome'     => 'nullable|string|max:255',
            'cliente_whatsapp' => 'nullable|string|max:50',
            'data'             => 'required|date',
            'observacoes'      => 'nullable|string|max:2000',
            'itens'            => 'required|array|min:1|max:100',
            'itens.*.arte'     => 'required|string|max:255',
            'itens.*.servico'  => 'nullable|string|max:255',
            'itens.*.data'     => 'nullable|date',
            'itens.*.valor'    => 'required|numeric|min:0|max:9999999',
        ]);

        $itens = array_map(fn ($i) => [
            'arte'      => $i['arte'],
            'servico'   => $i['servico'] ?? '',
            'data'      => $i['data'] ?? null,
            'valor'     => round((float) $i['valor'], 2),
            'pedido_id' => null,
        ], $v['itens']);

        return [
            'cliente_nome'     => $v['cliente_nome'] ?? null,
            'cliente_whatsapp' => $v['cliente_whatsapp'] ?? null,
            'data'             => $v['data'],
            'observacoes'      => $v['observacoes'] ?? null,
            'itens'            => $itens,
            'total'            => round(array_sum(array_column($itens, 'valor')), 2),
        ];
    }
}

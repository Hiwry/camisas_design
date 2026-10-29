<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\TransacaoCredito;
use App\Services\PixService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreditoController extends Controller
{
    private PixService $pixService;

    public function __construct(PixService $pixService)
    {
        $this->pixService = $pixService;
    }

    /**
     * Retorna o saldo atual de créditos de IA e o valor por análise
     * GET /api/creditos/saldo
     */
    public function saldo(Request $request): JsonResponse
    {
        $user = $request->user();
        $precoCredito = (float) config('services.pix.valor_credito_ia', 5.00);

        if ($user->isAdmin()) {
            return response()->json([
                'is_admin'         => true,
                'creditos'         => 999999,
                'saldo_formatado'  => 'Ilimitado',
                'preco_por_analise'=> $precoCredito,
                'confeccao'        => null,
            ]);
        }

        $confeccao = $user->confeccao;
        $creditos = $confeccao ? (int) $confeccao->creditos_ia : (int) ($user->creditos_ia ?? 0);

        return response()->json([
            'is_admin'          => false,
            'creditos'          => $creditos,
            'saldo_formatado'   => (string) $creditos,
            'preco_por_analise' => $precoCredito,
            'confeccao_id'      => $confeccao?->id,
            'confeccao_nome'    => $confeccao?->nome,
        ]);
    }

    /**
     * Inicia a compra de créditos gerando o Pix Copia e Cola + QR Code
     * POST /api/creditos/comprar
     */
    public function comprar(Request $request): JsonResponse
    {
        $request->validate([
            'quantidade' => 'required|integer|min:1|max:500',
        ]);

        $user = $request->user();
        $confeccao = $user->confeccao;
        $quantidade = (int) $request->quantidade;
        $precoCredito = (float) config('services.pix.valor_credito_ia', 5.00);
        $valorTotal = round($quantidade * $precoCredito, 2);

        $txid = 'CR' . strtoupper(substr(uniqid(), -6)) . rand(10, 99);
        $pixPayload = $this->pixService->gerarPayload($valorTotal, $txid);
        $pixQrCode  = $this->pixService->gerarQrCodeUrl($pixPayload);

        $transacao = TransacaoCredito::create([
            'confeccao_id'        => $confeccao?->id,
            'user_id'             => $user->id,
            'quantidade_creditos' => $quantidade,
            'valor_total'         => $valorTotal,
            'tipo'                => 'recarga',
            'status'              => 'pendente',
            'descricao'           => "Recarga de {$quantidade} análise(s) com IA (R$ " . number_format($valorTotal, 2, ',', '.') . ")",
            'pix_codigo'          => $pixPayload,
            'pix_qrcode'          => $pixQrCode,
        ]);

        return response()->json([
            'transacao_id'        => $transacao->id,
            'quantidade_creditos' => $quantidade,
            'valor_total'         => $valorTotal,
            'valor_formatado'     => 'R$ ' . number_format($valorTotal, 2, ',', '.'),
            'pix_copia_cola'      => $pixPayload,
            'pix_qrcode_url'      => $pixQrCode,
            'chave_pix'           => config('services.pix.chave'),
            'beneficiario'        => config('services.pix.beneficiario'),
            'status'              => 'pendente',
        ]);
    }

    /**
     * Confirmação de pagamento do Pix
     * POST /api/creditos/confirmar-pagamento/{transacao}
     */
    public function confirmarPagamento(Request $request, TransacaoCredito $transacao): JsonResponse
    {
        $user = $request->user();

        // Apenas administrador pode confirmar o recebimento do Pix estático
        if (!$user->isAdmin()) {
            return response()->json([
                'message' => 'A confirmação manual de pagamento Pix é restrita ao administrador após a validação bancária.',
            ], 403);
        }

        if ($transacao->status === 'pago') {
            return response()->json([
                'message'  => 'Este pagamento já foi confirmado anteriormente.',
                'creditos' => $transacao->confeccao ? $transacao->confeccao->fresh()->creditos_ia : $user->creditos_ia,
            ]);
        }

        $transacao->update([
            'status'  => 'pago',
            'pago_em' => now(),
        ]);

        // Credita para a confecção e/ou usuário
        $novoSaldo = 0;
        if ($transacao->confeccao_id) {
            $confeccao = Confeccao::find($transacao->confeccao_id);
            if ($confeccao) {
                $confeccao->increment('creditos_ia', $transacao->quantidade_creditos);
                $novoSaldo = $confeccao->fresh()->creditos_ia;
            }
        } else {
            $transacaoUser = $transacao->user;
            if ($transacaoUser) {
                $transacaoUser->increment('creditos_ia', $transacao->quantidade_creditos);
                $novoSaldo = $transacaoUser->fresh()->creditos_ia;
            }
        }

        return response()->json([
            'message'             => "Pagamento confirmado com sucesso! {$transacao->quantidade_creditos} análises adicionadas.",
            'creditos_adicionados'=> $transacao->quantidade_creditos,
            'saldo_atual'         => $novoSaldo,
        ]);
    }

    /**
     * Histórico de transações de créditos
     * GET /api/creditos/historico
     */
    public function historico(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = TransacaoCredito::latest();

        if (!$user->isAdmin()) {
            if ($user->confeccao) {
                $query->where('confeccao_id', $user->confeccao->id);
            } else {
                $query->where('user_id', $user->id);
            }
        }

        $transacoes = $query->limit(30)->get();

        return response()->json($transacoes);
    }

    /**
     * Gestão manual de créditos pelo painel do Admin
     * POST /api/admin/confeccoes/{confeccao}/creditos
     */
    public function adminAjustarCreditos(Request $request, Confeccao $confeccao): JsonResponse
    {
        $request->validate([
            'quantidade' => 'required|integer',
            'operacao'   => 'required|in:adicionar,remover,definir',
            'motivo'     => 'nullable|string|max:255',
        ]);

        $operacao   = $request->operacao;
        $quantidade = abs((int) $request->quantidade);
        $saldoAntes = (int) $confeccao->creditos_ia;

        if ($operacao === 'adicionar') {
            $confeccao->increment('creditos_ia', $quantidade);
            $difCreditos = $quantidade;
        } elseif ($operacao === 'remover') {
            $removerQtd = min($saldoAntes, $quantidade);
            $confeccao->decrement('creditos_ia', $removerQtd);
            $difCreditos = -$removerQtd;
        } else { // definir
            $confeccao->update(['creditos_ia' => $quantidade]);
            $difCreditos = $quantidade - $saldoAntes;
        }

        $saldoDepois = $confeccao->fresh()->creditos_ia;

        TransacaoCredito::create([
            'confeccao_id'        => $confeccao->id,
            'user_id'             => auth()->id(),
            'quantidade_creditos' => $difCreditos,
            'valor_total'         => 0.00,
            'tipo'                => 'ajuste_manual',
            'status'              => 'pago',
            'descricao'           => $request->motivo ?: "Ajuste manual de créditos pelo Admin ({$operacao}: {$quantidade})",
            'pago_em'             => now(),
        ]);

        return response()->json([
            'message'      => "Créditos atualizados com sucesso para a confecção {$confeccao->nome}.",
            'saldo_anterior' => $saldoAntes,
            'saldo_atual'    => $saldoDepois,
            'confeccao'      => $confeccao->fresh('user'),
        ]);
    }
}

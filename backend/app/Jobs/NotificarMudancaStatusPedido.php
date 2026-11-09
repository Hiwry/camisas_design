<?php

namespace App\Jobs;

use App\Models\Pedido;
use App\Services\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NotificarMudancaStatusPedido
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public Pedido $pedido,
        public string $novoStatus
    ) {}

    public function handle(WhatsAppService $wa): array
    {
        try {
            return $wa->notificarMudancaStatus($this->pedido, $this->novoStatus);
        } catch (\Throwable $e) {
            Log::error("Erro no Job NotificarMudancaStatusPedido para Pedido #{$this->pedido->id}: " . $e->getMessage());
            return ['enviado' => false, 'motivo' => 'erro_excecao', 'erro' => $e->getMessage()];
        }
    }
}

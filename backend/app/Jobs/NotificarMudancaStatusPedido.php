<?php

namespace App\Jobs;

use App\Models\Pedido;
use App\Services\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NotificarMudancaStatusPedido implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public Pedido $pedido,
        public string $novoStatus
    ) {}

    public function handle(WhatsAppService $wa): void
    {
        try {
            $wa->notificarMudancaStatus($this->pedido, $this->novoStatus);
        } catch (\Throwable $e) {
            Log::error("Erro no Job NotificarMudancaStatusPedido para Pedido #{$this->pedido->id}: " . $e->getMessage());
        }
    }
}

<?php

namespace App\Jobs;

use App\Models\Aprovacao;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class NotificarAprovacao implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Aprovacao $aprovacao) {}

    public function handle(): void
    {
        $pedido    = $this->aprovacao->pedido->load('confeccao.user');
        $confeccao = $pedido->confeccao;
        $status    = $this->aprovacao->status;

        $emailDestino = $confeccao->user->email;
        $assunto = $status === 'aprovado'
            ? "✅ Arte aprovada: {$pedido->titulo}"
            : "🔄 Revisão solicitada: {$pedido->titulo}";

        $corpo = $status === 'aprovado'
            ? "A arte do pedido \"{$pedido->titulo}\" foi aprovada pelo cliente."
            : "O cliente solicitou revisão na arte do pedido \"{$pedido->titulo}\".\n\nComentário: {$this->aprovacao->comentario}";

        // Email simples via Laravel Mail
        try {
            Mail::raw($corpo, function ($message) use ($emailDestino, $assunto) {
                $message->to($emailDestino)->subject($assunto);
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Erro ao enviar email em NotificarAprovacao: " . $e->getMessage());
        }

        // WhatsApp para a confecção / usuário
        try {
            $wa = app(\App\Services\WhatsAppService::class);
            $whatsappDestino = $confeccao->user->whatsapp ?? $confeccao->telefone ?? null;
            if ($whatsappDestino && $wa->configurado()) {
                $wa->enviarTexto($whatsappDestino, "*{$assunto}*\n\n{$corpo}");
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Erro ao enviar WhatsApp em NotificarAprovacao: " . $e->getMessage());
        }
    }
}

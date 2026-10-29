<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RevisaoSolicitada extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Pedido $pedido,
        public readonly string $comentario
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("🔄 Revisão solicitada — {$this->pedido->titulo}")
            ->greeting("Olá, {$notifiable->name}!")
            ->line("O cliente solicitou uma revisão na arte do pedido **{$this->pedido->titulo}**.")
            ->line("**Comentário do cliente:**")
            ->line($this->comentario)
            ->action('Ver Pedido', config('app.frontend_url') . '/pedidos/' . $this->pedido->id)
            ->line('O pedido foi movido de volta para **Em Produção**.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'pedido_id'  => $this->pedido->id,
            'titulo'     => $this->pedido->titulo,
            'comentario' => $this->comentario,
            'tipo'       => 'revisao_solicitada',
        ];
    }
}

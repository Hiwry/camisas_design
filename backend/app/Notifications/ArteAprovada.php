<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ArteAprovada extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Pedido $pedido) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("✅ Arte aprovada — {$this->pedido->titulo}")
            ->greeting("Boa notícia, {$notifiable->name}!")
            ->line("O cliente aprovou a arte do pedido **{$this->pedido->titulo}**.")
            ->line('O pedido foi movido automaticamente para a coluna **Aprovado** no Kanban.')
            ->action('Ver Pedido', config('app.frontend_url') . '/pedidos/' . $this->pedido->id)
            ->line('Você pode finalizar o pedido quando estiver pronto.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'pedido_id' => $this->pedido->id,
            'titulo'    => $this->pedido->titulo,
            'tipo'      => 'arte_aprovada',
        ];
    }
}

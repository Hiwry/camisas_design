<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ArteEnviadaParaAprovacao extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Pedido $pedido) {}

    public function via(object $notifiable): array
    {
        $channels = ['mail'];
        if ($notifiable->whatsapp) {
            $channels[] = 'vonage'; // ou 'twilio'
        }
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("🎨 Sua arte está pronta para aprovação — {$this->pedido->titulo}")
            ->greeting("Olá{$this->pedido->nome_cliente ? ', ' . $this->pedido->nome_cliente : ''}!")
            ->line("A arte do pedido **{$this->pedido->titulo}** está pronta para sua aprovação.")
            ->action('Ver e Aprovar Arte', $this->pedido->linkAprovacao())
            ->line('Você pode aprovar ou solicitar revisão diretamente pelo link acima.')
            ->line('Obrigado por usar nosso sistema!');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'pedido_id' => $this->pedido->id,
            'titulo'    => $this->pedido->titulo,
            'link'      => $this->pedido->linkAprovacao(),
            'tipo'      => 'arte_enviada',
        ];
    }
}

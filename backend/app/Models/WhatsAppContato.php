<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsAppContato extends Model
{
    protected $table = 'whatsapp_contatos';

    protected $fillable = [
        'numero', 'numero_original', 'nome', 'perfil', 'status',
        'primeira_mensagem', 'ultima_mensagem', 'interesse',
        'total_mensagens', 'pedidos_criados',
        'primeiro_contato_em', 'ultimo_contato_em',
    ];

    protected $casts = [
        'total_mensagens'     => 'integer',
        'pedidos_criados'     => 'integer',
        'primeiro_contato_em' => 'datetime',
        'ultimo_contato_em'   => 'datetime',
    ];
}

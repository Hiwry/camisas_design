<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsAppSolicitacao extends Model
{
    protected $table = 'whatsapp_solicitacoes';

    protected $fillable = [
        'numero', 'numero_original', 'nome', 'titulo', 'tipo_impressao', 'quantidade',
        'observacoes', 'referencias', 'itens', 'valor', 'pix_txid', 'status',
        'comprovante_em', 'pago_em', 'pedido_id',
    ];

    protected $casts = [
        'referencias'    => 'array',
        'itens'          => 'array',
        'valor'          => 'float',
        'comprovante_em' => 'datetime',
        'pago_em'        => 'datetime',
    ];
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Orcamento extends Model
{
    protected $table = 'orcamentos';

    protected $fillable = [
        'numero',
        'cliente_nome',
        'cliente_whatsapp',
        'data',
        'observacoes',
        'itens',
        'total',
        'status',
        'convertido_em',
    ];

    protected $casts = [
        'itens'         => 'array',
        'total'         => 'float',
        'data'          => 'date:Y-m-d',
        'convertido_em' => 'datetime',
    ];

    const STATUS = ['aberto', 'convertido', 'perdido'];

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'orcamento_id');
    }
}

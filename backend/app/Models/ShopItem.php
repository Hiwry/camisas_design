<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShopItem extends Model
{
    use HasFactory;

    protected $table = 'shop_itens';

    protected $fillable = [
        'codigo',
        'nome',
        'categoria',
        'quantidade',
        'valor',
        'valor_original',
        'descricao',
        'entrega_sla',
        'badge',
        'destaque',
        'icone',
        'imagem',
        'itens_inclusos',
        'ativo',
        'ordem',
    ];

    protected $casts = [
        'quantidade'     => 'integer',
        'valor'          => 'float',
        'valor_original' => 'float',
        'destaque'       => 'boolean',
        'ativo'          => 'boolean',
        'ordem'          => 'integer',
        'itens_inclusos' => 'array',
    ];
}

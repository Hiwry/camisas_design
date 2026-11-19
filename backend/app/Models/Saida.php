<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Saida extends Model
{
    protected $table = 'saidas';

    protected $fillable = ['descricao', 'categoria', 'valor', 'data', 'origem', 'observacoes'];

    protected $casts = [
        'valor' => 'float',
        'data'  => 'date:Y-m-d',
    ];

    const ORIGENS = ['pedidos', 'orcamentos'];
}

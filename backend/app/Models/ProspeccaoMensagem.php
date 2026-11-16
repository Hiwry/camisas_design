<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProspeccaoMensagem extends Model
{
    protected $table = 'prospeccao_mensagens';

    public $timestamps = false;

    protected $fillable = [
        'prospecto_id', 'direcao', 'tipo', 'modelo_id', 'texto', 'ok', 'erro', 'created_at',
    ];

    protected $casts = [
        'ok'         => 'boolean',
        'created_at' => 'datetime',
    ];
}

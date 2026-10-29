<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RevisaoIa extends Model
{
    protected $table = 'revisoes_ia';

    protected $fillable = [
        'user_id',
        'pedido_id',
        'contexto',
        'resumo',
        'aprovada',
        'total_erros',
        'criticos',
        'atencoes',
        'informativos',
        'erros',
    ];

    protected $casts = [
        'aprovada' => 'boolean',
        'erros'    => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Aprovacao extends Model
{
    use HasFactory;

    protected $table = 'aprovacoes';

    protected $fillable = [
        'pedido_id',
        'arte_id',
        'status',
        'comentario',
        'aprovado_por_nome',
        'aprovado_por_ip',
        'aprovado_em',
    ];

    protected $casts = [
        'aprovado_em' => 'datetime',
    ];

    // Relacionamentos
    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    public function arte()
    {
        return $this->belongsTo(Arte::class);
    }

    // Helpers
    public function foiAprovado(): bool
    {
        return $this->status === 'aprovado';
    }

    public function pedidoRevisao(): bool
    {
        return $this->status === 'revisao';
    }
}

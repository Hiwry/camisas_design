<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GrupoPagamento extends Model
{
    use HasFactory;

    protected $table = 'grupo_pagamentos';

    protected $fillable = [
        'grupo_participante_id',
        'valor',
        'forma_pagamento',
        'data_pagamento',
        'observacao',
        'registrado_por',
    ];

    protected $casts = [
        'valor' => 'float',
        'data_pagamento' => 'date',
    ];

    public function participante()
    {
        return $this->belongsTo(GrupoParticipante::class, 'grupo_participante_id');
    }

    public function registradoPor()
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}


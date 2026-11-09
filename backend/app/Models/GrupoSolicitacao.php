<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GrupoSolicitacao extends Model
{
    use HasFactory;

    protected $table = 'grupo_solicitacoes';

    protected $fillable = [
        'grupo_id',
        'dados_participante',
        'motivo',
        'status',
        'resposta_admin',
        'avaliado_por',
        'avaliado_em',
    ];

    protected $casts = [
        'dados_participante' => 'array',
        'avaliado_em' => 'datetime',
    ];

    public function grupo()
    {
        return $this->belongsTo(Grupo::class);
    }

    public function avaliadoPor()
    {
        return $this->belongsTo(User::class, 'avaliado_por');
    }
}


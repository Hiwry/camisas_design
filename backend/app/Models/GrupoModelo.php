<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GrupoModelo extends Model
{
    use HasFactory;

    protected $table = 'grupo_modelos';

    protected $fillable = [
        'grupo_id',
        'nome',
        'foto',
        'valor_base',
        'cores',
        'ordem',
    ];

    protected $casts = [
        'valor_base' => 'float',
        'cores' => 'array',
        'ordem' => 'integer',
    ];

    public function grupo()
    {
        return $this->belongsTo(Grupo::class);
    }

    public function participantes()
    {
        return $this->hasMany(GrupoParticipante::class);
    }
}


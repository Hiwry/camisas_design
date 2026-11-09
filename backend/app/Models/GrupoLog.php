<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GrupoLog extends Model
{
    use HasFactory;

    protected $table = 'grupo_logs';

    public $timestamps = false;

    protected $fillable = [
        'grupo_id',
        'user_id',
        'tipo',
        'descricao',
        'dados_anteriores',
        'dados_novos',
        'ip',
        'created_at',
    ];

    protected $casts = [
        'dados_anteriores' => 'array',
        'dados_novos' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (GrupoLog $log) {
            if (empty($log->created_at)) {
                $log->created_at = now();
            }
        });
    }

    public function grupo()
    {
        return $this->belongsTo(Grupo::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}


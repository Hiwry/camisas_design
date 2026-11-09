<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class GrupoParticipante extends Model
{
    use HasFactory;

    protected $table = 'grupo_participantes';

    protected $fillable = [
        'grupo_id',
        'grupo_modelo_id',
        'token_edicao',
        'nome_completo',
        'whatsapp',
        'cor',
        'tamanho',
        'quantidade',
        'nome_camisa',
        'numero_camisa',
        'apelido',
        'frase_costas',
        'observacao',
        'valor_unitario',
        'valor_total',
        'status_pagamento',
    ];

    protected $casts = [
        'quantidade' => 'integer',
        'valor_unitario' => 'float',
        'valor_total' => 'float',
    ];

    protected static function booted(): void
    {
        static::creating(function (GrupoParticipante $participante) {
            if (empty($participante->token_edicao)) {
                $participante->token_edicao = Str::random(40);
            }
        });
    }

    public function grupo()
    {
        return $this->belongsTo(Grupo::class);
    }

    public function modelo()
    {
        return $this->belongsTo(GrupoModelo::class, 'grupo_modelo_id');
    }

    public function pagamentos()
    {
        return $this->hasMany(GrupoPagamento::class)->orderBy('data_pagamento', 'desc');
    }

    public function totalPago(): float
    {
        return (float) $this->pagamentos()->sum('valor');
    }

    public function saldoDevedor(): float
    {
        return max(0, (float) $this->valor_total - $this->totalPago());
    }

    public function recalcularStatusPagamento(): void
    {
        $pago = $this->totalPago();
        $total = (float) $this->valor_total;

        if ($pago <= 0) {
            $status = 'pendente';
        } elseif ($pago >= $total) {
            $status = 'pago';
        } else {
            $status = 'parcial';
        }

        $this->update(['status_pagamento' => $status]);
    }
}


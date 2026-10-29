<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransacaoCredito extends Model
{
    use HasFactory;

    protected $table = 'transacoes_credito';

    protected $fillable = [
        'confeccao_id',
        'user_id',
        'quantidade_creditos',
        'valor_total',
        'tipo',
        'status',
        'descricao',
        'pix_codigo',
        'pix_qrcode',
        'pago_em',
    ];

    protected $casts = [
        'quantidade_creditos' => 'integer',
        'valor_total'         => 'decimal:2',
        'pago_em'             => 'datetime',
    ];

    public function confeccao()
    {
        return $this->belongsTo(Confeccao::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

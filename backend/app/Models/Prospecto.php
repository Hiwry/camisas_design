<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Prospecto extends Model
{
    protected $table = 'prospectos';

    protected $fillable = [
        'cnpj', 'nome', 'cidade', 'uf', 'cnae', 'data_abertura', 'telefone',
        'email', 'instagram', 'origem', 'status', 'etapa', 'ultimo_envio_em',
        'respondeu_em', 'modelo_id', 'notas',
    ];

    protected $casts = [
        'data_abertura'   => 'date:Y-m-d',
        'ultimo_envio_em' => 'datetime',
        'respondeu_em'    => 'datetime',
        'etapa'           => 'integer',
    ];

    public const STATUS = [
        'pendente', 'novo', 'sem_whatsapp', 'em_sequencia', 'respondeu',
        'interessado', 'cliente', 'descartado', 'optout',
    ];

    public function mensagens(): HasMany
    {
        return $this->hasMany(ProspeccaoMensagem::class);
    }
}

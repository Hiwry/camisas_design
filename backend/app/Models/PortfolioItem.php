<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PortfolioItem extends Model
{
    use HasFactory;

    protected $table = 'portfolio_itens';

    protected $fillable = [
        'titulo',
        'categoria',
        'servico',
        'subtitulo',
        'descricao',
        'imagem_principal',
        'galeria',
        'cliente',
        'ano',
        'tecido',
        'tecnica',
        'cores',
        'tags',
        'destaque',
        'curtidas',
        'ordem',
        'ativo',
    ];

    protected $casts = [
        'galeria'  => 'array',
        'cores'    => 'array',
        'tags'     => 'array',
        'destaque' => 'boolean',
        'ativo'    => 'boolean',
        'curtidas' => 'integer',
        'ordem'    => 'integer',
    ];
}

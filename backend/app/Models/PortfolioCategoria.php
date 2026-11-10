<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PortfolioCategoria extends Model
{
    use HasFactory;

    protected $table = 'portfolio_categorias';

    protected $fillable = [
        'nome',
        'slug',
        'tipo',
        'ordem',
        'ativo',
    ];

    protected $casts = [
        'ordem' => 'integer',
        'ativo' => 'boolean',
    ];
}


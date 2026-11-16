<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProspeccaoModelo extends Model
{
    protected $table = 'prospeccao_modelos';

    protected $fillable = ['tipo', 'nome', 'texto', 'ativo'];

    protected $casts = ['ativo' => 'boolean'];
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Arte extends Model
{
    use HasFactory;

    protected $fillable = [
        'pedido_id',
        'versao',
        'arquivo_url',
        'arquivo_nome',
        'arquivo_tipo',
        'arquivo_tamanho',
        'preview_url',
        'preview_nome',
        'ativa',
        'enviada_em',
    ];

    protected $casts = [
        'ativa' => 'boolean',
        'enviada_em' => 'datetime',
        'arquivo_tamanho' => 'integer',
        'versao' => 'integer',
    ];

    // Relacionamentos
    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    public function aprovacoes()
    {
        return $this->hasMany(Aprovacao::class);
    }

    public function aprovacao()
    {
        return $this->hasOne(Aprovacao::class)->latestOfMany();
    }

    // Define esta arte como versão ativa e desativa as demais
    public function tornarAtiva(): void
    {
        Arte::where('pedido_id', $this->pedido_id)->update(['ativa' => false]);
        $this->update(['ativa' => true]);
    }

    // Próximo número de versão para o pedido
    public static function proximaVersao(int $pedidoId): int
    {
        return (static::where('pedido_id', $pedidoId)->max('versao') ?? 0) + 1;
    }

    public function tamanhoFormatado(): string
    {
        if (!$this->arquivo_tamanho) return '—';
        $kb = $this->arquivo_tamanho / 1024;
        return $kb >= 1024
            ? number_format($kb / 1024, 1) . ' MB'
            : number_format($kb, 0) . ' KB';
    }
}

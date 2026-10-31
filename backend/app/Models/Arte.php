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
        'arquivos',
        'ativa',
        'is_final',
        'notas',
        'enviada_em',
    ];

    protected $casts = [
        'ativa' => 'boolean',
        'is_final' => 'boolean',
        'arquivos' => 'array',
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

    // Marca esta versão como a Versão Final da produção
    public function marcarComoFinal(): void
    {
        Arte::where('pedido_id', $this->pedido_id)->update(['is_final' => false]);
        $this->update(['is_final' => true, 'ativa' => true]);
        if ($this->pedido && $this->pedido->status !== 'finalizado') {
            $this->pedido->update(['status' => 'aprovado']);
        }
    }

    public function desmarcarFinal(): void
    {
        $this->update(['is_final' => false]);
        if ($this->pedido && $this->pedido->status === 'aprovado') {
            $this->pedido->update(['status' => 'aguardando_aprovacao']);
        }
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

    public function getPreviewUrlAttribute($value): ?string
    {
        if (!$value) return null;
        if (str_contains($value, '/storage/')) {
            $storagePath = substr($value, strpos($value, '/storage/'));
            return request() ? url($storagePath) : $storagePath;
        }
        return $value;
    }

    public function getArquivoUrlAttribute($value): ?string
    {
        if (!$value) return null;
        if (str_contains($value, '/storage/')) {
            $storagePath = substr($value, strpos($value, '/storage/'));
            return request() ? url($storagePath) : $storagePath;
        }
        return $value;
    }

    public function getArquivosAttribute($value): ?array
    {
        if (!$value) return null;
        $data = is_array($value) ? $value : json_decode($value, true);
        if (!is_array($data)) return null;

        return array_values(array_filter(array_map(function ($item) {
            if (!is_array($item) || empty($item)) return null;
            if (!empty($item['url']) && is_string($item['url']) && str_contains($item['url'], '/storage/')) {
                $storagePath = substr($item['url'], strpos($item['url'], '/storage/'));
                $item['url'] = request() ? url($storagePath) : $storagePath;
            }
            return $item;
        }, $data)));
    }
}

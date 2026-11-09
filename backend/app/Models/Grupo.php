<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Grupo extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'grupos';

    protected $fillable = [
        'user_id',
        'confeccao_id',
        'nome',
        'descricao',
        'imagem_capa',
        'token',
        'senha_acesso',
        'total_esperado',
        'pedido_minimo',
        'prazo_limite',
        'status',
        'tabela_medidas_url',
        'foto_camisa_pronta',
        'observacoes_confeccao',
        'campo_nome_camisa',
        'campo_numero_camisa',
        'campo_apelido',
        'campo_frase_costas',
        'campo_observacao',
        'tamanhos_disponiveis',
        'datas_status',
    ];

    protected $casts = [
        'total_esperado' => 'integer',
        'pedido_minimo' => 'integer',
        'prazo_limite' => 'datetime',
        'campo_nome_camisa' => 'boolean',
        'campo_numero_camisa' => 'boolean',
        'campo_apelido' => 'boolean',
        'campo_frase_costas' => 'boolean',
        'campo_observacao' => 'boolean',
        'tamanhos_disponiveis' => 'array',
        'datas_status' => 'array',
    ];

    const STATUS = [
        'aberto',
        'prazo_encerrado',
        'confirmado',
        'em_producao',
        'pronto',
        'entregue',
    ];

    const STATUS_LABELS = [
        'aberto'          => 'Aberto',
        'prazo_encerrado' => 'Prazo Encerrado',
        'confirmado'      => 'Confirmado',
        'em_producao'     => 'Em Produção',
        'pronto'          => 'Pronto',
        'entregue'        => 'Entregue',
    ];

    protected static function booted(): void
    {
        static::creating(function (Grupo $grupo) {
            if (empty($grupo->token)) {
                $grupo->token = Str::random(40);
            }
            if (empty($grupo->senha_acesso)) {
                $grupo->senha_acesso = (string) mt_rand(100000, 999999);
            }
            if (empty($grupo->datas_status)) {
                $grupo->datas_status = [
                    'aberto' => now()->toIso8601String(),
                ];
            }
            if (empty($grupo->tamanhos_disponiveis)) {
                $grupo->tamanhos_disponiveis = [
                    ['tamanho' => 'PP', 'acrescimo' => 0],
                    ['tamanho' => 'P', 'acrescimo' => 0],
                    ['tamanho' => 'M', 'acrescimo' => 0],
                    ['tamanho' => 'G', 'acrescimo' => 0],
                    ['tamanho' => 'GG', 'acrescimo' => 0],
                    ['tamanho' => 'XG', 'acrescimo' => 0],
                    ['tamanho' => 'XXG', 'acrescimo' => 0],
                ];
            }
        });
    }

    // Acessores para URLs de storage
    public function getImagemCapaAttribute($val)
    {
        if (!$val) return null;
        if (str_starts_with($val, 'http://') || str_starts_with($val, 'https://') || str_starts_with($val, '/storage/')) {
            return $val;
        }
        return '/storage/' . ltrim($val, '/');
    }

    public function getTabelaMedidasUrlAttribute($val)
    {
        if (!$val) return null;
        if (str_starts_with($val, 'http://') || str_starts_with($val, 'https://') || str_starts_with($val, '/storage/')) {
            return $val;
        }
        return '/storage/' . ltrim($val, '/');
    }

    public function getFotoCamisaProntaAttribute($val)
    {
        if (!$val) return null;
        if (str_starts_with($val, 'http://') || str_starts_with($val, 'https://') || str_starts_with($val, '/storage/')) {
            return $val;
        }
        return '/storage/' . ltrim($val, '/');
    }

    // Relacionamentos
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function confeccao()
    {
        return $this->belongsTo(Confeccao::class);
    }

    public function modelos()
    {
        return $this->hasMany(GrupoModelo::class)->orderBy('ordem');
    }

    public function participantes()
    {
        return $this->hasMany(GrupoParticipante::class);
    }

    public function solicitacoes()
    {
        return $this->hasMany(GrupoSolicitacao::class)->latest();
    }

    public function logs()
    {
        return $this->hasMany(GrupoLog::class)->latest();
    }

    // Helpers
    public function estaAberto(): bool
    {
        if ($this->status !== 'aberto') {
            return false;
        }

        if ($this->prazo_limite && now()->isAfter($this->prazo_limite)) {
            return false;
        }

        return true;
    }

    public function atualizarStatus(string $novoStatus, ?int $userId = null, ?string $motivo = null): void
    {
        $statusAnterior = $this->status;
        $datas = $this->datas_status ?? [];
        $datas[$novoStatus] = now()->toIso8601String();

        $this->update([
            'status' => $novoStatus,
            'datas_status' => $datas,
        ]);

        GrupoLog::create([
            'grupo_id' => $this->id,
            'user_id' => $userId,
            'tipo' => 'status_mudou',
            'descricao' => "Status alterado de '{$statusAnterior}' para '{$novoStatus}'" . ($motivo ? ": {$motivo}" : ""),
            'dados_anteriores' => ['status' => $statusAnterior],
            'dados_novos' => ['status' => $novoStatus],
            'ip' => request()->ip(),
        ]);
    }
}


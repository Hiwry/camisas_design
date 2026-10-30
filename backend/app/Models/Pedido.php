<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Pedido extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'confeccao_id',
        'titulo',
        'tipo_impressao',
        'status',
        'observacoes',
        'referencias',
        'prazo',
        'valor',
        'token_aprovacao',
        'cliente_nome',
        'cliente_email',
        'cliente_whatsapp',
        'nome_cliente',
        'email_cliente',
        'whatsapp_cliente',
    ];

    protected $casts = [
        'prazo' => 'date',
        'referencias' => 'array',
        'valor' => 'float',
    ];

    // Status disponíveis
    const STATUS = [
        'aguardando_briefing',
        'em_producao',
        'aguardando_aprovacao',
        'aprovado',
        'finalizado',
        'cancelado',
    ];

    const STATUS_LABELS = [
        'aguardando_briefing'  => 'Aguardando Briefing',
        'em_producao'          => 'Em Produção',
        'aguardando_aprovacao' => 'Aguardando Aprovação',
        'aprovado'             => 'Aprovado',
        'finalizado'           => 'Finalizado',
        'cancelado'            => 'Cancelado',
    ];

    const STATUS_OCULTOS_KANBAN = ['finalizado', 'cancelado'];

    // Gera token único ao criar
    protected static function booted(): void
    {
        static::creating(function (Pedido $pedido) {
            if (empty($pedido->token_aprovacao)) {
                $pedido->token_aprovacao = Str::random(64);
            }
        });
    }

    // Relacionamentos
    public function confeccao()
    {
        return $this->belongsTo(Confeccao::class);
    }

    public function artes()
    {
        return $this->hasMany(Arte::class)->orderBy('versao', 'desc');
    }

    public function arteAtiva()
    {
        return $this->hasOne(Arte::class)->where('ativa', true)->latestOfMany('versao');
    }

    public function aprovacoes()
    {
        return $this->hasMany(Aprovacao::class)->latest();
    }

    public function ultimaAprovacao()
    {
        return $this->hasOne(Aprovacao::class)->latestOfMany();
    }

    // Acessores e Mutatores para compatibilidade de nomenclatura (colunas reais no banco: cliente_nome, cliente_email, cliente_whatsapp)
    public function getWhatsappClienteAttribute(): ?string
    {
        return $this->attributes['cliente_whatsapp'] ?? $this->attributes['whatsapp_cliente'] ?? null;
    }

    public function setWhatsappClienteAttribute(?string $value): void
    {
        $this->attributes['cliente_whatsapp'] = $value;
    }

    public function getClienteWhatsappAttribute(): ?string
    {
        return $this->attributes['cliente_whatsapp'] ?? $this->attributes['whatsapp_cliente'] ?? null;
    }

    public function setClienteWhatsappAttribute(?string $value): void
    {
        $this->attributes['cliente_whatsapp'] = $value;
    }

    public function getEmailClienteAttribute(): ?string
    {
        return $this->attributes['cliente_email'] ?? $this->attributes['email_cliente'] ?? null;
    }

    public function setEmailClienteAttribute(?string $value): void
    {
        $this->attributes['cliente_email'] = $value;
    }

    public function getClienteEmailAttribute(): ?string
    {
        return $this->attributes['cliente_email'] ?? $this->attributes['email_cliente'] ?? null;
    }

    public function setClienteEmailAttribute(?string $value): void
    {
        $this->attributes['cliente_email'] = $value;
    }

    public function getNomeClienteAttribute(): ?string
    {
        return $this->attributes['cliente_nome'] ?? $this->attributes['nome_cliente'] ?? null;
    }

    public function setNomeClienteAttribute(?string $value): void
    {
        $this->attributes['cliente_nome'] = $value;
    }

    public function getClienteNomeAttribute(): ?string
    {
        return $this->attributes['cliente_nome'] ?? $this->attributes['nome_cliente'] ?? null;
    }

    public function setClienteNomeAttribute(?string $value): void
    {
        $this->attributes['cliente_nome'] = $value;
    }

    // Helpers
    public function linkAprovacao(): string
    {
        $frontendUrl = rtrim(config('app.frontend_url') ?? env('FRONTEND_URL') ?? 'http://localhost:5173', '/');
        return "{$frontendUrl}/aprovar/{$this->token_aprovacao}";
    }

    public function estaAprovado(): bool
    {
        return $this->status === 'aprovado';
    }

    public function aguardandoAprovacao(): bool
    {
        return $this->status === 'aguardando_aprovacao';
    }

    public function estaAtrasado(): bool
    {
        if (!$this->prazo) {
            return false;
        }

        if (in_array($this->status, ['aprovado', 'finalizado', 'cancelado'])) {
            return false;
        }

        return now()->isAfter($this->prazo->endOfDay());
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Confeccao extends Model
{
    use HasFactory;

    protected $table = 'confeccoes';

    protected $fillable = [
        'user_id',
        'nome',
        'telefone',
        'whatsapp',
        'email',
        'plano',
        'limite_mensal',
        'artes_usadas_mes',
        'artes_extras',
        'creditos_ia',
        'reset_em',
        'ativo',
    ];

    protected $casts = [
        'ativo' => 'boolean',
        'reset_em' => 'date',
        'limite_mensal' => 'integer',
        'artes_usadas_mes' => 'integer',
        'artes_extras' => 'integer',
        'creditos_ia' => 'integer',
    ];

    // Config por plano: limite mensal + SLA padrão (horas) + SLA expresso (horas)
    const PLANOS = [
        'basico'       => ['limite' => 10, 'label' => 'START',  'sla_horas' => 48, 'sla_expresso' => 6],
        'profissional' => ['limite' => 20, 'label' => 'PRO',    'sla_horas' => 24, 'sla_expresso' => 6],
        'premium'      => ['limite' => 35, 'label' => 'VIP',    'sla_horas' => 12, 'sla_expresso' => 6],
    ];

    // Compat legada
    const LIMITES_PLANO = [
        'basico'       => 10,
        'profissional' => 20,
        'premium'      => 35,
    ];

    // Relacionamentos
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class);
    }

    // Helpers
    public function artesDisponiveis(): int
    {
        $disponivelPlano = max(0, $this->limite_mensal - $this->artes_usadas_mes);
        return $disponivelPlano + (int) ($this->artes_extras ?? 0);
    }

    public function podecriarPedido(): bool
    {
        return $this->artesDisponiveis() > 0;
    }

    public function incrementarArteUsada(): void
    {
        // Se ainda tem cota do plano mensal, consome do plano
        if ($this->artes_usadas_mes < $this->limite_mensal) {
            $this->increment('artes_usadas_mes');
        } elseif (($this->artes_extras ?? 0) > 0) {
            // Se o plano esgotou, consome das artes extras adquiridas no Shop
            $this->decrement('artes_extras');
        } else {
            $this->increment('artes_usadas_mes');
        }
    }

    public function resetarContadorMensal(): void
    {
        $this->update([
            'artes_usadas_mes' => 0,
            'reset_em' => now()->toDateString(),
        ]);
    }

    // SLA em horas do plano atual
    public function slaHoras(): int
    {
        return self::PLANOS[$this->plano]['sla_horas'] ?? 48;
    }

    public function slaExpressoHoras(): int
    {
        return self::PLANOS[$this->plano]['sla_expresso'] ?? 6;
    }

    // Atualiza limite ao mudar plano
    public function setPlanoAttribute(string $plano): void
    {
        $this->attributes['plano'] = $plano;
        $this->attributes['limite_mensal'] = self::PLANOS[$plano]['limite'] ?? 10;
    }
}

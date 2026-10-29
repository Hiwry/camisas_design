<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShopPedido extends Model
{
    use HasFactory;

    protected $table = 'shop_pedidos';

    protected $fillable = [
        'confeccao_id',
        'user_id',
        'item_id',
        'item_nome',
        'categoria',
        'quantidade',
        'valor_unitario',
        'valor_total',
        'status',
        'txid',
        'pix_codigo',
        'pix_qrcode',
        'detalhes',
        'pago_em',
        'concluido_em',
    ];

    protected $casts = [
        'quantidade'     => 'integer',
        'valor_unitario' => 'decimal:2',
        'valor_total'    => 'decimal:2',
        'pago_em'        => 'datetime',
        'concluido_em'   => 'datetime',
    ];

    public function confeccao()
    {
        return $this->belongsTo(Confeccao::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Confirma o pagamento e credita os benefícios automaticamente
     */
    public function marcarComoPago(): bool
    {
        if ($this->status === 'pago' || $this->status === 'concluido') {
            return false;
        }

        $this->update([
            'status'  => $this->categoria === 'artes' || $this->categoria === 'ia' ? 'concluido' : 'pago',
            'pago_em' => now(),
            'concluido_em' => $this->categoria === 'artes' || $this->categoria === 'ia' ? now() : null,
        ]);

        // Credita benefícios
        if ($this->confeccao_id) {
            $confeccao = Confeccao::find($this->confeccao_id);
            if ($confeccao) {
                if ($this->categoria === 'artes') {
                    // Adiciona as artes extras adquiridas
                    $confeccao->increment('artes_extras', $this->quantidade);
                } elseif ($this->categoria === 'ia') {
                    // Adiciona os créditos de IA adquiridos
                    $confeccao->increment('creditos_ia', $this->quantidade);
                }
            }
        } elseif ($this->user_id && $this->categoria === 'ia') {
            $user = User::find($this->user_id);
            if ($user) {
                $user->increment('creditos_ia', $this->quantidade);
            }
        }

        return true;
    }
}

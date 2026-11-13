<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            // nao_aplica (parceiras/plano) | aguardando_orcamento | aguardando_pagamento | pago
            $table->string('pagamento_status', 25)->default('nao_aplica')->after('valor');
            $table->string('pix_txid', 40)->nullable()->after('pagamento_status');
            $table->timestamp('orcamento_enviado_em')->nullable()->after('pix_txid');
            $table->timestamp('pago_em')->nullable()->after('orcamento_enviado_em');
            $table->index('pagamento_status');
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropIndex(['pagamento_status']);
            $table->dropColumn(['pagamento_status', 'pix_txid', 'orcamento_enviado_em', 'pago_em']);
        });
    }
};

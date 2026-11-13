<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Solicitações feitas pelo WhatsApp que AINDA NÃO viraram pedido:
        // o pedido só é criado depois que o pagamento (Pix) é confirmado.
        Schema::create('whatsapp_solicitacoes', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 30)->index();            // normalizado (DDD + 8 dígitos)
            $table->string('numero_original', 30)->nullable(); // como chegou (com DDI)
            $table->string('nome', 120)->nullable();
            $table->string('titulo', 255);
            $table->string('tipo_impressao', 30)->default('sublimacao');
            $table->string('quantidade', 30)->nullable();
            $table->text('observacoes')->nullable();
            $table->json('referencias')->nullable();
            $table->json('itens')->nullable();                 // [{nome, valor}] vindos do Shop
            $table->decimal('valor', 10, 2)->default(0);
            $table->string('pix_txid', 40)->nullable();
            $table->string('status', 25)->default('aguardando_pagamento'); // aguardando_pagamento | pago | cancelado
            $table->timestamp('comprovante_em')->nullable();
            $table->timestamp('pago_em')->nullable();
            $table->unsignedBigInteger('pedido_id')->nullable(); // preenchido quando o pagamento é confirmado
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_solicitacoes');
    }
};

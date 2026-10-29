<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Adiciona artes_extras na tabela confeccoes
        if (!Schema::hasColumn('confeccoes', 'artes_extras')) {
            Schema::table('confeccoes', function (Blueprint $table) {
                $table->unsignedInteger('artes_extras')->default(0)->after('artes_usadas_mes');
            });
        }

        // Tabela de pedidos/compras do shop de itens avulsos
        if (!Schema::hasTable('shop_pedidos')) {
            Schema::create('shop_pedidos', function (Blueprint $table) {
                $table->id();
                $table->foreignId('confeccao_id')->nullable()->constrained('confeccoes')->nullOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('item_id', 60); // ex: arte_avulsa_1, creditos_ia_10, etc.
                $table->string('item_nome', 120);
                $table->string('categoria', 50)->default('servicos'); // artes, ia, servicos, urgencia
                $table->integer('quantidade')->default(1);
                $table->decimal('valor_unitario', 10, 2)->default(0.00);
                $table->decimal('valor_total', 10, 2)->default(0.00);
                $table->enum('status', ['pendente', 'pago', 'concluido', 'cancelado'])->default('pendente');
                $table->string('txid', 50)->nullable();
                $table->text('pix_codigo')->nullable();
                $table->text('pix_qrcode')->nullable();
                $table->text('detalhes')->nullable();
                $table->timestamp('pago_em')->nullable();
                $table->timestamp('concluido_em')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_pedidos');

        if (Schema::hasColumn('confeccoes', 'artes_extras')) {
            Schema::table('confeccoes', function (Blueprint $table) {
                $table->dropColumn('artes_extras');
            });
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orcamentos')) {
            Schema::create('orcamentos', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('numero')->unique();
                $table->string('cliente_nome')->nullable();
                $table->string('cliente_whatsapp', 50)->nullable();
                $table->date('data');
                $table->text('observacoes')->nullable();
                // [{arte, servico, data, valor, pedido_id}]
                $table->json('itens');
                $table->decimal('total', 12, 2)->default(0);
                // aberto | convertido | perdido
                $table->string('status', 20)->default('aberto')->index();
                $table->timestamp('convertido_em')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('pedidos') && !Schema::hasColumn('pedidos', 'orcamento_id')) {
            Schema::table('pedidos', function (Blueprint $table) {
                $table->unsignedBigInteger('orcamento_id')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('pedidos', 'orcamento_id')) {
            Schema::table('pedidos', function (Blueprint $table) {
                $table->dropColumn('orcamento_id');
            });
        }
        Schema::dropIfExists('orcamentos');
    }
};

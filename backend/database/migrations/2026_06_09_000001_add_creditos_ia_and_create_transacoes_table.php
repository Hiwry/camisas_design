<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Adiciona creditos_ia na tabela confeccoes
        if (!Schema::hasColumn('confeccoes', 'creditos_ia')) {
            Schema::table('confeccoes', function (Blueprint $table) {
                $table->unsignedInteger('creditos_ia')->default(0)->after('artes_usadas_mes');
            });
        }

        // Adiciona creditos_ia na tabela users (para fallback ou uso individual)
        if (!Schema::hasColumn('users', 'creditos_ia')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedInteger('creditos_ia')->default(0)->after('ativo');
            });
        }

        // Tabela de transações de crédito (recargas, consumos e ajustes manuais)
        if (!Schema::hasTable('transacoes_credito')) {
            Schema::create('transacoes_credito', function (Blueprint $table) {
                $table->id();
                $table->foreignId('confeccao_id')->nullable()->constrained('confeccoes')->nullOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->integer('quantidade_creditos'); // ex: 1, 5, 10
                $table->decimal('valor_total', 10, 2)->default(0.00); // ex: 5.00, 25.00
                $table->enum('tipo', ['recarga', 'consumo', 'ajuste_manual'])->default('recarga');
                $table->enum('status', ['pendente', 'pago', 'cancelado'])->default('pendente');
                $table->string('descricao')->nullable();
                $table->text('pix_codigo')->nullable();
                $table->text('pix_qrcode')->nullable();
                $table->timestamp('pago_em')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transacoes_credito');

        if (Schema::hasColumn('confeccoes', 'creditos_ia')) {
            Schema::table('confeccoes', function (Blueprint $table) {
                $table->dropColumn('creditos_ia');
            });
        }

        if (Schema::hasColumn('users', 'creditos_ia')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('creditos_ia');
            });
        }
    }
};

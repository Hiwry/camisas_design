<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Controle de respostas e conversão: quem respondeu, quem fechou, quanto e por que perdeu. */
    public function up(): void
    {
        Schema::table('prospectos', function (Blueprint $table) {
            $table->boolean('nao_lida')->default(false)->after('respondeu_em');
            $table->timestamp('convertido_em')->nullable()->after('nao_lida');
            $table->decimal('valor_fechado', 10, 2)->nullable()->after('convertido_em');
            $table->string('motivo_perda', 120)->nullable()->after('valor_fechado');
            $table->date('proximo_contato_em')->nullable()->after('motivo_perda');
            $table->index('nao_lida');
        });
    }

    public function down(): void
    {
        Schema::table('prospectos', function (Blueprint $table) {
            $table->dropIndex(['nao_lida']);
            $table->dropColumn(['nao_lida', 'convertido_em', 'valor_fechado', 'motivo_perda', 'proximo_contato_em']);
        });
    }
};

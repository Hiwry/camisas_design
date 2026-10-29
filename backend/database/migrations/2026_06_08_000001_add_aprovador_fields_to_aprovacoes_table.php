<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('aprovacoes', function (Blueprint $table) {
            if (!Schema::hasColumn('aprovacoes', 'aprovado_por_nome')) {
                $table->string('aprovado_por_nome')->nullable()->after('comentario');
            }
            if (!Schema::hasColumn('aprovacoes', 'aprovado_por_ip')) {
                $table->string('aprovado_por_ip', 45)->nullable()->after('aprovado_por_nome');
            }
            if (!Schema::hasColumn('aprovacoes', 'aprovado_em')) {
                $table->timestamp('aprovado_em')->nullable()->after('aprovado_por_ip');
            }
        });
    }

    public function down(): void
    {
        Schema::table('aprovacoes', function (Blueprint $table) {
            $table->dropColumn(['aprovado_por_nome', 'aprovado_por_ip', 'aprovado_em']);
        });
    }
};

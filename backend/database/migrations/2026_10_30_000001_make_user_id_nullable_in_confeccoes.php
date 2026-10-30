<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Torna user_id nullable e permite confecções sem conta de usuário (login/senha)
        Schema::table('confeccoes', function (Blueprint $table) {
            // Tenta remover a chave estrangeira existente se houver
            try {
                $table->dropForeign(['user_id']);
            } catch (\Throwable $e) {
                // Em alguns drivers/MySQL o nome pode ser confeccoes_user_id_foreign
                try {
                    $table->dropForeign('confeccoes_user_id_foreign');
                } catch (\Throwable $e2) {}
            }
        });

        Schema::table('confeccoes', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->change();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();

            if (!Schema::hasColumn('confeccoes', 'whatsapp')) {
                $table->string('whatsapp', 20)->nullable()->after('telefone');
            }
        });

        // 2. Altera plano para string para suportar 'avulso', 'basico', 'profissional', 'premium' sem limitação de enum
        try {
            DB::statement("ALTER TABLE confeccoes MODIFY plano VARCHAR(50) NOT NULL DEFAULT 'avulso'");
        } catch (\Throwable $e) {
            try {
                Schema::table('confeccoes', function (Blueprint $table) {
                    $table->string('plano', 50)->default('avulso')->change();
                });
            } catch (\Throwable $e2) {}
        }
    }

    public function down(): void
    {
        Schema::table('confeccoes', function (Blueprint $table) {
            try {
                $table->dropForeign(['user_id']);
            } catch (\Throwable $e) {}

            $table->unsignedBigInteger('user_id')->nullable(false)->change();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();

            if (Schema::hasColumn('confeccoes', 'whatsapp')) {
                $table->dropColumn('whatsapp');
            }
        });
    }
};


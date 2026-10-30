<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Remove restrição de chave estrangeira antiga se existir
        try {
            DB::statement("ALTER TABLE confeccoes DROP FOREIGN KEY confeccoes_user_id_foreign");
        } catch (\Throwable $e) {}

        // 2. Torna user_id nullable no MySQL
        try {
            DB::statement("ALTER TABLE confeccoes MODIFY user_id BIGINT UNSIGNED NULL");
        } catch (\Throwable $e) {
            try {
                Schema::table('confeccoes', function (Blueprint $table) {
                    $table->unsignedBigInteger('user_id')->nullable()->change();
                });
            } catch (\Throwable $e2) {}
        }

        // 3. Re-adiciona a chave com ON DELETE SET NULL
        try {
            DB::statement("ALTER TABLE confeccoes ADD CONSTRAINT confeccoes_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
        } catch (\Throwable $e) {}

        // 4. Adiciona coluna whatsapp se não existir
        if (!Schema::hasColumn('confeccoes', 'whatsapp')) {
            try {
                Schema::table('confeccoes', function (Blueprint $table) {
                    $table->string('whatsapp', 20)->nullable()->after('telefone');
                });
            } catch (\Throwable $e) {}
        }

        // 5. Altera plano para string para suportar 'avulso', 'basico', 'profissional', 'premium' sem limitação de enum
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
        try {
            DB::statement("ALTER TABLE confeccoes DROP FOREIGN KEY confeccoes_user_id_foreign");
        } catch (\Throwable $e) {}

        try {
            DB::statement("ALTER TABLE confeccoes MODIFY user_id BIGINT UNSIGNED NOT NULL");
        } catch (\Throwable $e) {}

        try {
            DB::statement("ALTER TABLE confeccoes ADD CONSTRAINT confeccoes_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
        } catch (\Throwable $e) {}
    }
};

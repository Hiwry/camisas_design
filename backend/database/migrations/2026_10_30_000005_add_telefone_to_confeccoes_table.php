<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('confeccoes', 'telefone')) {
            Schema::table('confeccoes', function (Blueprint $table) {
                $table->string('telefone', 30)->nullable()->after('whatsapp');
            });

            // Se whatsapp tiver valor e telefone estiver nulo, copia
            try {
                DB::statement("UPDATE confeccoes SET telefone = whatsapp WHERE telefone IS NULL AND whatsapp IS NOT NULL");
            } catch (\Throwable $e) {}
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('confeccoes', 'telefone')) {
            Schema::table('confeccoes', function (Blueprint $table) {
                $table->dropColumn('telefone');
            });
        }
    }
};


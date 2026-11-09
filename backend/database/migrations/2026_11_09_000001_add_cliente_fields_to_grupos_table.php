<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('grupos', function (Blueprint $table) {
            if (!Schema::hasColumn('grupos', 'cliente_nome')) {
                $table->string('cliente_nome', 150)->nullable()->after('confeccao_id');
            }
            if (!Schema::hasColumn('grupos', 'cliente_whatsapp')) {
                $table->string('cliente_whatsapp', 50)->nullable()->after('cliente_nome');
            }
        });
    }

    public function down(): void
    {
        Schema::table('grupos', function (Blueprint $table) {
            if (Schema::hasColumn('grupos', 'cliente_nome')) {
                $table->dropColumn('cliente_nome');
            }
            if (Schema::hasColumn('grupos', 'cliente_whatsapp')) {
                $table->dropColumn('cliente_whatsapp');
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artes', function (Blueprint $table) {
            // Preview = imagem JPG/PNG para visualização no sistema e pelo cliente
            $table->string('preview_url')->nullable()->after('arquivo_url');
            $table->string('preview_nome')->nullable()->after('preview_url');
            // arquivo_url passa a ser o arquivo fonte (PDF, CDR, AI, etc.) — opcional
            // Tornamos arquivo_url nullable para novos registros que só têm preview
            $table->string('arquivo_url')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('artes', function (Blueprint $table) {
            $table->dropColumn(['preview_url', 'preview_nome']);
            $table->string('arquivo_url')->nullable(false)->change();
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artes', function (Blueprint $table) {
            if (!Schema::hasColumn('artes', 'arquivos')) {
                $table->json('arquivos')->nullable()->after('preview_nome');
            }
            if (!Schema::hasColumn('artes', 'is_final')) {
                $table->boolean('is_final')->default(false)->after('ativa');
            }
            if (!Schema::hasColumn('artes', 'notas')) {
                $table->text('notas')->nullable()->after('is_final');
            }
        });
    }

    public function down(): void
    {
        Schema::table('artes', function (Blueprint $table) {
            $columnsToDrop = [];
            if (Schema::hasColumn('artes', 'arquivos')) {
                $columnsToDrop[] = 'arquivos';
            }
            if (Schema::hasColumn('artes', 'is_final')) {
                $columnsToDrop[] = 'is_final';
            }
            if (Schema::hasColumn('artes', 'notas')) {
                $columnsToDrop[] = 'notas';
            }
            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};


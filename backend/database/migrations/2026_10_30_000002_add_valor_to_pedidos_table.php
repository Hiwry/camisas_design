<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('pedidos', 'valor')) {
            Schema::table('pedidos', function (Blueprint $table) {
                $table->decimal('valor', 10, 2)->nullable()->default(0.00)->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('pedidos', 'valor')) {
            Schema::table('pedidos', function (Blueprint $table) {
                $table->dropColumn('valor');
            });
        }
    }
};


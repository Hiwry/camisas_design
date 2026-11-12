<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE confeccoes MODIFY COLUMN plano VARCHAR(50) NOT NULL DEFAULT 'avulso'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE confeccoes MODIFY COLUMN plano ENUM('basico', 'intermediario', 'profissional', 'premium', 'avulso') NOT NULL DEFAULT 'basico'");
    }
};

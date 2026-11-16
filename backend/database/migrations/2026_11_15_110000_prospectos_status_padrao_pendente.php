<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Todo contato novo nasce "pendente": nada é enviado sem aprovação manual. */
    public function up(): void
    {
        DB::statement("ALTER TABLE prospectos ALTER COLUMN status SET DEFAULT 'pendente'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE prospectos ALTER COLUMN status SET DEFAULT 'novo'");
    }
};

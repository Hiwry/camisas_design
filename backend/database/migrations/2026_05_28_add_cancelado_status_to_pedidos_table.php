<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Modifica o ENUM diretamente via SQL — Blueprint::enum()->change()
        // não altera ENUMs em todas as versões do Doctrine DBAL
        if (DB::getDriverName() === 'mysql') {
            DB::statement("
                ALTER TABLE pedidos
                MODIFY COLUMN status ENUM(
                    'aguardando_briefing',
                    'em_producao',
                    'aguardando_aprovacao',
                    'aprovado',
                    'finalizado',
                    'cancelado'
                ) NOT NULL DEFAULT 'aguardando_briefing'
            ");
        }
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE pedidos
            MODIFY COLUMN status ENUM(
                'aguardando_briefing',
                'em_producao',
                'aguardando_aprovacao',
                'aprovado',
                'finalizado'
            ) NOT NULL DEFAULT 'aguardando_briefing'
        ");
    }
};

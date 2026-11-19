<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('saidas')) {
            Schema::create('saidas', function (Blueprint $table) {
                $table->id();
                $table->string('descricao');
                $table->string('categoria', 60)->nullable();
                $table->decimal('valor', 12, 2);
                $table->date('data');
                // pedidos | orcamentos (a qual fluxo a saída pertence)
                $table->string('origem', 20)->default('pedidos')->index();
                $table->text('observacoes')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('saidas');
    }
};

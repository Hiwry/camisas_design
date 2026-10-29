<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pedidos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('confeccao_id')->constrained('confeccoes')->onDelete('cascade');
            $table->string('titulo');
            $table->enum('tipo_impressao', ['sublimacao', 'bordado', 'serigrafia']);
            $table->enum('status', [
                'aguardando_briefing',
                'em_producao',
                'aguardando_aprovacao',
                'aprovado',
                'finalizado'
            ])->default('aguardando_briefing');
            $table->text('observacoes')->nullable();
            $table->date('prazo')->nullable();
            $table->string('token_aprovacao', 64)->unique();
            // nome e email do cliente final (sem login)
            $table->string('cliente_nome')->nullable();
            $table->string('cliente_email')->nullable();
            $table->string('cliente_whatsapp', 20)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedidos');
    }
};

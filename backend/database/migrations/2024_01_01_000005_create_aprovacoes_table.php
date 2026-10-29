<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aprovacoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->onDelete('cascade');
            $table->foreignId('arte_id')->constrained('artes')->onDelete('cascade');
            $table->enum('status', ['aprovado', 'revisao']);
            $table->text('comentario')->nullable();
            $table->string('aprovado_por_nome')->nullable(); // nome do cliente final
            $table->string('aprovado_por_ip', 45)->nullable();
            $table->timestamp('aprovado_em')->nullable();
            $table->timestamps();

            $table->index(['pedido_id', 'arte_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aprovacoes');
    }
};

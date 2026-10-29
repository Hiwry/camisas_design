<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revisoes_ia', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pedido_id')->nullable()->constrained()->nullOnDelete();
            $table->text('contexto')->nullable();
            $table->text('resumo');
            $table->boolean('aprovada')->default(false);
            $table->unsignedSmallInteger('total_erros')->default(0);
            $table->unsignedSmallInteger('criticos')->default(0);
            $table->unsignedSmallInteger('atencoes')->default(0);
            $table->unsignedSmallInteger('informativos')->default(0);
            $table->json('erros')->nullable(); // Array completo de erros
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revisoes_ia');
    }
};

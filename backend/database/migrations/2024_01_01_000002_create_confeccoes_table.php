<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('confeccoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('nome');
            $table->string('telefone', 20)->nullable();
            $table->string('email')->nullable();
            $table->enum('plano', ['basico', 'intermediario', 'profissional'])->default('basico');
            // basico=8, intermediario=15, profissional=25
            $table->unsignedTinyInteger('limite_mensal')->default(8);
            $table->unsignedTinyInteger('artes_usadas_mes')->default(0);
            $table->date('reset_em')->nullable(); // data do último reset mensal
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('confeccoes');
    }
};

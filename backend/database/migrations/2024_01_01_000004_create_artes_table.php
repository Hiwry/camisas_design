<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('artes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->onDelete('cascade');
            $table->unsignedSmallInteger('versao')->default(1);
            $table->string('arquivo_url'); // URL no S3/R2
            $table->string('arquivo_nome')->nullable(); // nome original do arquivo
            $table->enum('arquivo_tipo', ['pdf', 'imagem'])->default('imagem');
            $table->unsignedBigInteger('arquivo_tamanho')->nullable(); // em bytes
            $table->boolean('ativa')->default(true); // versão atual do pedido
            $table->timestamp('enviada_em')->useCurrent();
            $table->timestamps();

            $table->index(['pedido_id', 'versao']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('artes');
    }
};

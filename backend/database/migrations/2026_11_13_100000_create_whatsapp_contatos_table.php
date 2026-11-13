<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_contatos', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 30)->unique();          // somente dígitos, formato normalizado (DDD + 8 dígitos)
            $table->string('numero_original', 30)->nullable(); // como chegou no webhook (com DDI)
            $table->string('nome', 120)->nullable();
            $table->string('perfil', 20)->default('lead');   // lead | cliente | confeccao | admin
            $table->string('status', 20)->default('novo');   // novo | em_atendimento | convertido | humano | descartado
            $table->text('primeira_mensagem')->nullable();
            $table->text('ultima_mensagem')->nullable();
            $table->string('interesse', 60)->nullable();     // orcamento, portfolio, novo_pedido...
            $table->unsignedInteger('total_mensagens')->default(0);
            $table->unsignedInteger('pedidos_criados')->default(0);
            $table->timestamp('primeiro_contato_em')->nullable();
            $table->timestamp('ultimo_contato_em')->nullable();
            $table->timestamps();

            $table->index(['perfil', 'status']);
            $table->index('ultimo_contato_em');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_contatos');
    }
};

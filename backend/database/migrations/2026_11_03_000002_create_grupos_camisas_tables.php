<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grupos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->foreignId('confeccao_id')->nullable()->constrained('confeccoes')->nullOnDelete();
            $table->string('nome', 150);
            $table->text('descricao')->nullable();
            $table->string('imagem_capa')->nullable();
            $table->string('token', 64)->unique()->index();
            $table->unsignedInteger('total_esperado')->default(1);
            $table->unsignedInteger('pedido_minimo')->default(0);
            $table->dateTime('prazo_limite');
            $table->enum('status', [
                'aberto',
                'prazo_encerrado',
                'confirmado',
                'em_producao',
                'pronto',
                'entregue'
            ])->default('aberto')->index();
            $table->string('tabela_medidas_url')->nullable();
            $table->string('foto_camisa_pronta')->nullable();
            $table->text('observacoes_confeccao')->nullable();

            // Flags de campos ativáveis no formulário
            $table->boolean('campo_nome_camisa')->default(true);
            $table->boolean('campo_numero_camisa')->default(true);
            $table->boolean('campo_apelido')->default(false);
            $table->boolean('campo_frase_costas')->default(false);
            $table->boolean('campo_observacao')->default(true);

            // Tamanhos disponíveis e acréscimos [{tamanho: "P", acrescimo: 0}, {tamanho: "XG", acrescimo: 5.00}]
            $table->json('tamanhos_disponiveis')->nullable();

            // Histórico de datas dos status para a linha do tempo
            $table->json('datas_status')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('grupo_modelos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grupo_id')->constrained('grupos')->onDelete('cascade');
            $table->string('nome', 100);
            $table->string('foto')->nullable();
            $table->decimal('valor_base', 10, 2)->default(0.00);
            $table->json('cores')->nullable();
            $table->integer('ordem')->default(0);
            $table->timestamps();
        });

        Schema::create('grupo_participantes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grupo_id')->constrained('grupos')->onDelete('cascade');
            $table->foreignId('grupo_modelo_id')->nullable()->constrained('grupo_modelos')->nullOnDelete();
            $table->string('token_edicao', 64)->unique()->index();
            $table->string('nome_completo', 150);
            $table->string('whatsapp', 25)->nullable();
            $table->string('cor', 50)->nullable();
            $table->string('tamanho', 20)->nullable();
            $table->unsignedInteger('quantidade')->default(1);
            $table->string('nome_camisa', 50)->nullable();
            $table->string('numero_camisa', 10)->nullable();
            $table->string('apelido', 50)->nullable();
            $table->string('frase_costas', 120)->nullable();
            $table->text('observacao')->nullable();
            $table->decimal('valor_unitario', 10, 2)->default(0.00);
            $table->decimal('valor_total', 10, 2)->default(0.00);
            $table->enum('status_pagamento', ['pendente', 'parcial', 'pago'])->default('pendente')->index();
            $table->timestamps();
        });

        Schema::create('grupo_pagamentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grupo_participante_id')->constrained('grupo_participantes')->onDelete('cascade');
            $table->decimal('valor', 10, 2);
            $table->string('forma_pagamento', 50)->default('Dinheiro');
            $table->date('data_pagamento');
            $table->string('observacao')->nullable();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('grupo_solicitacoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grupo_id')->constrained('grupos')->onDelete('cascade');
            $table->json('dados_participante');
            $table->text('motivo')->nullable();
            $table->enum('status', ['pendente', 'aprovado', 'recusado'])->default('pendente')->index();
            $table->text('resposta_admin')->nullable();
            $table->foreignId('avaliado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('avaliado_em')->nullable();
            $table->timestamps();
        });

        Schema::create('grupo_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grupo_id')->constrained('grupos')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tipo', 50);
            $table->text('descricao');
            $table->json('dados_anteriores')->nullable();
            $table->json('dados_novos')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grupo_logs');
        Schema::dropIfExists('grupo_solicitacoes');
        Schema::dropIfExists('grupo_pagamentos');
        Schema::dropIfExists('grupo_participantes');
        Schema::dropIfExists('grupo_modelos');
        Schema::dropIfExists('grupos');
    }
};


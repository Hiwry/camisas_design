<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prospectos', function (Blueprint $table) {
            $table->id();
            $table->string('cnpj', 14)->nullable()->unique();
            $table->string('nome', 160)->nullable();               // nome fantasia (ou razão social)
            $table->string('cidade', 80)->nullable();
            $table->string('uf', 2)->nullable();
            $table->string('cnae', 10)->nullable();
            $table->date('data_abertura')->nullable();
            $table->string('telefone', 20)->nullable()->unique();   // 55 + DDD + número (somente dígitos)
            $table->string('email', 160)->nullable();
            $table->string('instagram', 80)->nullable();
            $table->string('origem', 20)->default('manual');        // receita | manual | lista
            // novo | sem_whatsapp | em_sequencia | respondeu | interessado | cliente | descartado | optout
            $table->string('status', 20)->default('novo');
            $table->unsignedTinyInteger('etapa')->default(0);       // 0 nada | 1 inicial | 2 follow-up 1 | 3 follow-up 2
            $table->timestamp('ultimo_envio_em')->nullable();
            $table->timestamp('respondeu_em')->nullable();
            $table->unsignedBigInteger('modelo_id')->nullable();    // modelo da mensagem inicial (A/B)
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->index(['status', 'etapa']);
            $table->index('uf');
            $table->index('data_abertura');
        });

        Schema::create('prospeccao_mensagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prospecto_id')->constrained('prospectos')->cascadeOnDelete();
            $table->string('direcao', 10);                          // saida | entrada
            $table->string('tipo', 20)->default('inicial');         // inicial | followup1 | followup2 | resposta
            $table->unsignedBigInteger('modelo_id')->nullable();
            $table->text('texto');
            $table->boolean('ok')->default(true);
            $table->string('erro', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['prospecto_id', 'created_at']);
            $table->index(['direcao', 'created_at']);
        });

        Schema::create('prospeccao_modelos', function (Blueprint $table) {
            $table->id();
            $table->string('tipo', 20);                             // inicial | followup1 | followup2
            $table->string('nome', 60);
            $table->text('texto');
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        // Modelos padrão. Variáveis: {a_marca} {da_marca} {meu_nome} {cidade}
        // Sorteio de variação: [opção A|opção B|opção C]
        $agora = now();
        $modelos = [
            ['inicial', 'Direto',
                "[Opa|Oi|Olá], tudo bem? Vi que {a_marca} está começando e sei como o prazo do design aperta nessa fase.\n\nSe estiver apertado, eu posso ajudar com arte finalista: a arte já chega finalizada, no tamanho e formato certos, pra você só mandar imprimir.\n\nQuer que eu te mostre como funciona? (Se não for o momento, é só me avisar que eu não te chamo mais.)"],
            ['inicial', 'História',
                "[Opa|Oi|Olá], tudo bem? Sou {meu_nome}, designer aqui do Nordeste.\n\nSabe aquela cena: coleção pronta, tecido cortado e a arte ainda sem fechar? Ou o arquivo vai pra gráfica e volta \"cor errada, sem sangria, resolução baixa\"?\n\nEu trabalho justamente nessa parte. Faço a arte finalista: você me manda a ideia e eu devolvo o arquivo pronto, só pra imprimir.\n\nSe {a_marca} tiver algo com prazo apertado agora, me manda que eu dou uma olhada. (Se não for o momento, me avisa e eu não chamo mais.)"],
            ['inicial', 'Antes e depois',
                "[Opa|Oi|Olá]! A maioria das marcas pequenas perde mais tempo ajustando arquivo pra impressão do que criando a peça.\n\nEu resolvo isso: você manda o rascunho e a logo, e eu entrego a arte finalizada, com cor, medida e formato certos pra gráfica ou estamparia. Sem retrabalho.\n\nPosso te mandar uns exemplos? (Se preferir que eu não chame mais, é só avisar.)"],
            ['inicial', 'Pergunta',
                "[Oi|Olá|Opa], tudo bem? Uma pergunta rápida: hoje quem cuida das artes e estampas {da_marca}?\n\nPergunto porque faço arte finalista pra confecções e, se estiver corrido, posso tirar essa parte das suas costas. (Se não fizer sentido, me avisa que eu paro de chamar.)"],
            ['inicial', 'Teste',
                "[Opa|Oi|Olá], sou {meu_nome}, designer. Estou ajudando confecções novas com arte finalista, aquela arte pronta pra imprimir.\n\nPra você conhecer meu trabalho, posso finalizar UMA arte {da_marca} como teste. Se gostar, a gente continua. Se não, sem compromisso.\n\nTem alguma estampa ou etiqueta parada aí? (Se não for o momento, me avisa e eu não chamo mais.)"],
            ['followup1', 'Follow-up 1',
                "[Opa|Oi|Olá], só voltando aqui. Se o prazo das artes estiver apertado, é só me chamar que eu resolvo. Se não for o momento, tudo bem também 🙂"],
            ['followup2', 'Follow-up 2',
                "Última mensagem pra não incomodar. Quando surgir uma estampa, etiqueta ou catálogo pra fechar, pode me chamar. Fico à disposição."],
        ];
        foreach ($modelos as [$tipo, $nome, $texto]) {
            DB::table('prospeccao_modelos')->insert([
                'tipo' => $tipo, 'nome' => $nome, 'texto' => $texto,
                'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('prospeccao_mensagens');
        Schema::dropIfExists('prospeccao_modelos');
        Schema::dropIfExists('prospectos');
    }
};

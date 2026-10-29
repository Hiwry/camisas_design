<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('shop_itens')) {
            Schema::create('shop_itens', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 60)->unique();
                $table->string('nome', 150);
                $table->string('categoria', 50)->default('artes'); // artes, ia, servicos, urgencia, combos
                $table->integer('quantidade')->default(1);
                $table->decimal('valor', 10, 2)->default(0.00);
                $table->decimal('valor_original', 10, 2)->nullable();
                $table->text('descricao')->nullable();
                $table->string('entrega_sla', 80)->default('Liberação imediata');
                $table->string('badge', 60)->nullable();
                $table->boolean('destaque')->default(false);
                $table->string('icone', 50)->default('palette');
                $table->string('imagem')->nullable();
                $table->json('itens_inclusos')->nullable();
                $table->boolean('ativo')->default(true);
                $table->integer('ordem')->default(0);
                $table->timestamps();
            });

            // Insere os 8 itens iniciais do catálogo
            $itensIniciais = [
                [
                    'codigo'         => 'arte_avulsa_1',
                    'nome'           => '1 Arte Avulsa Extra',
                    'categoria'      => 'artes',
                    'quantidade'     => 1,
                    'valor'          => 35.00,
                    'valor_original' => 35.00,
                    'descricao'      => 'Adicione 1 arte extra à sua conta para criar um novo pedido imediatamente.',
                    'entrega_sla'    => 'Liberação imediata',
                    'badge'          => 'Essencial',
                    'destaque'       => false,
                    'icone'          => 'palette',
                    'imagem'         => '/shop/arte_avulsa_1.jpg',
                    'itens_inclusos' => json_encode([
                        '+1 crédito de pedido no Kanban',
                        'Sem necessidade de mudar de plano',
                        'SLA de entrega padrão do seu plano',
                        'Saldo cumulativo sem prazo de validade',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 1,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
                [
                    'codigo'         => 'arte_avulsa_3',
                    'nome'           => 'Combo 3 Artes Avulsas',
                    'categoria'      => 'artes',
                    'quantidade'     => 3,
                    'valor'          => 89.00,
                    'valor_original' => 105.00,
                    'descricao'      => 'Pacote com 3 artes adicionais com desconto de R$ 16,00.',
                    'entrega_sla'    => 'Liberação imediata',
                    'badge'          => 'Mais Escolhido',
                    'destaque'       => true,
                    'icone'          => 'sparkles',
                    'imagem'         => '/shop/arte_avulsa_3.jpg',
                    'itens_inclusos' => json_encode([
                        '+3 créditos de pedidos liberados na hora',
                        'Economia de R$ 16,00 no combo',
                        'Use no seu ritmo em qualquer mês',
                        'Ideal para semanas de alta demanda',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 2,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
                [
                    'codigo'         => 'arte_avulsa_5',
                    'nome'           => 'Pack 5 Artes Avulsas',
                    'categoria'      => 'artes',
                    'quantidade'     => 5,
                    'valor'          => 139.00,
                    'valor_original' => 175.00,
                    'descricao'      => 'Maior economia para confecções com grande volume de encomendas.',
                    'entrega_sla'    => 'Liberação imediata',
                    'badge'          => 'Super Desconto',
                    'destaque'       => false,
                    'icone'          => 'zap',
                    'imagem'         => '/shop/arte_avulsa_5.jpg',
                    'itens_inclusos' => json_encode([
                        '+5 créditos de pedidos no sistema',
                        'Apenas R$ 27,80 por arte avulsa',
                        'Mais de 20% de desconto',
                        'Foco total em fechar novos clientes',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 3,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
                [
                    'codigo'         => 'creditos_ia_5',
                    'nome'           => '5 Análises de IA',
                    'categoria'      => 'ia',
                    'quantidade'     => 5,
                    'valor'          => 25.00,
                    'valor_original' => 25.00,
                    'descricao'      => 'Créditos para revisão automática e minuciosa de arte com inteligência artificial.',
                    'entrega_sla'    => 'Liberação imediata',
                    'badge'          => 'Instantâneo',
                    'destaque'       => false,
                    'icone'          => 'bot',
                    'imagem'         => '/shop/creditos_ia_5.svg',
                    'itens_inclusos' => json_encode([
                        '5 análises detalhadas com Gemini 2.5 Pro',
                        'Comparação automática da referência com a arte',
                        'Detecção de erros ortográficos e nomes',
                        'Validação de cores, logos e proporções',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 4,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
                [
                    'codigo'         => 'creditos_ia_15',
                    'nome'           => '15 Análises de IA',
                    'categoria'      => 'ia',
                    'quantidade'     => 15,
                    'valor'          => 65.00,
                    'valor_original' => 75.00,
                    'descricao'      => 'Pacote intermediário de créditos de IA com valor promocional por análise.',
                    'entrega_sla'    => 'Liberação imediata',
                    'badge'          => 'Melhor Valor IA',
                    'destaque'       => true,
                    'icone'          => 'cpu',
                    'imagem'         => '/shop/creditos_ia_15.svg',
                    'itens_inclusos' => json_encode([
                        '15 análises completas liberadas',
                        'Apenas R$ 4,33 por análise (desconto)',
                        'Histórico e relatório comparativo',
                        'Zero erros na produção final',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 5,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
                [
                    'codigo'         => 'vetorizacao_logo',
                    'nome'           => 'Vetorização Profissional de Logo',
                    'categoria'      => 'servicos',
                    'quantidade'     => 1,
                    'valor'          => 45.00,
                    'valor_original' => 45.00,
                    'descricao'      => 'Conversão de foto, print ou imagem de baixa resolução em vetor escalável de alta definição.',
                    'entrega_sla'    => 'Entrega em até 12h úteis',
                    'badge'          => 'Serviço Técnico',
                    'destaque'       => false,
                    'icone'          => 'pen-tool',
                    'imagem'         => '/shop/vetorizacao_logo.svg',
                    'itens_inclusos' => json_encode([
                        'Arquivos em AI, CDR, PDF e PNG 300 DPI',
                        'Separação de cores e curvas limpas',
                        'Pronto para sublimação, serigrafia e bordado',
                        'Revisão inclusa até aprovação',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 6,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
                [
                    'codigo'         => 'mockup_3d',
                    'nome'           => 'Mockup 3D Realista Ultra-HD',
                    'categoria'      => 'servicos',
                    'quantidade'     => 1,
                    'valor'          => 29.90,
                    'valor_original' => 29.90,
                    'descricao'      => 'Render fotorrealista da peça vestida no corpo com iluminação de estúdio para catálogo e vendas.',
                    'entrega_sla'    => 'Entrega em até 8h úteis',
                    'badge'          => 'Apresentação VIP',
                    'destaque'       => false,
                    'icone'          => 'box',
                    'imagem'         => '/shop/mockup_3d.svg',
                    'itens_inclusos' => json_encode([
                        'Vistas frente, costas e detalhe de perto',
                        'Resolução 4K para Instagram e WhatsApp',
                        'Textura realista do tecido e costura',
                        'Aumenta conversão de vendas em até 40%',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 7,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
                [
                    'codigo'         => 'taxa_expressa',
                    'nome'           => 'Taxa de Entrega Expressa (Fast-Track 6h)',
                    'categoria'      => 'urgencia',
                    'quantidade'     => 1,
                    'valor'          => 30.00,
                    'valor_original' => 30.00,
                    'descricao'      => 'Passe o seu pedido para o topo da fila prioritária com entrega garantida em até 6 horas.',
                    'entrega_sla'    => 'Prioridade Máxima (6h)',
                    'badge'          => 'Fast-Track',
                    'destaque'       => false,
                    'icone'          => 'clock',
                    'imagem'         => '/shop/taxa_expressa.svg',
                    'itens_inclusos' => json_encode([
                        'Salto imediato para o topo da esteira Kanban',
                        'Designer dedicado à sua entrega em até 6h úteis',
                        'Ideal para pedidos de última hora do cliente',
                        'Notificação prioritária no WhatsApp',
                    ]),
                    'ativo'          => true,
                    'ordem'          => 8,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
            ];

            DB::table('shop_itens')->insert($itensIniciais);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_itens');
    }
};

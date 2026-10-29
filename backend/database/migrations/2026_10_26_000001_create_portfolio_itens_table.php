<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('portfolio_itens')) {
            Schema::create('portfolio_itens', function (Blueprint $table) {
                $table->id();
                $table->string('titulo', 150);
                $table->string('categoria', 60)->default('futebol');
                $table->string('subtitulo', 180)->nullable();
                $table->text('descricao')->nullable();
                $table->string('imagem_principal', 500);
                $table->json('galeria')->nullable();
                $table->string('cliente', 100)->nullable();
                $table->string('ano', 10)->default('2026');
                $table->string('tecido', 100)->default('Dry-Fit UV50+');
                $table->string('tecnica', 100)->default('Sublimação Total');
                $table->json('cores')->nullable();
                $table->json('tags')->nullable();
                $table->boolean('destaque')->default(false);
                $table->integer('curtidas')->default(0);
                $table->integer('ordem')->default(0);
                $table->boolean('ativo')->default(true);
                $table->timestamps();
            });

            // Inserir trabalhos iniciais de exemplo de alto nível
            $itensIniciais = [
                [
                    'titulo'           => 'Fênix All-Black Gold Edition',
                    'categoria'        => 'futebol',
                    'subtitulo'        => 'Uniforme titular com textura geométrica dourada e selo 3D',
                    'descricao'        => 'Desenvolvimento de fardamento de futebol completo com padrão geométrico em microfavo, detalhes em dourado metálico refletivo, numeração estilizada nas costas e gola transpassada moderna.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Atlética Fênix Imperatriz',
                    'ano'              => '2026',
                    'tecido'           => 'Dry-Fit Colmeia 100% Poliéster',
                    'tecnica'          => 'Sublimação Digital Total',
                    'cores'            => json_encode(['#0f0f0f', '#d4a020', '#ffffff', '#2a2a2a']),
                    'tags'             => json_encode(['Futebol', 'Black & Gold', 'Gola Transpassada', 'Numeração 3D', 'Interclasses']),
                    'destaque'         => true,
                    'curtidas'         => 42,
                    'ordem'            => 1,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Abadá Sunset Folia VIP',
                    'categoria'        => 'abada',
                    'subtitulo'        => 'Design tropical vibrante em degradê neon com folhas de palmeira',
                    'descricao'        => 'Criação especial para micareta e bloco de carnaval com recorte anatômico cavado, cores CMYK hiper saturadas com proteção anti-desbotamento e espaço padronizado para patrocinadores.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Camarote Ilha Sunset',
                    'ano'              => '2026',
                    'tecido'           => 'Helanca Light 120g / Dry Elastic',
                    'tecnica'          => 'Sublimação Total Contínua',
                    'cores'            => json_encode(['#ff007f', '#00f0ff', '#f59e0b', '#7c3aed']),
                    'tags'             => json_encode(['Carnaval', 'Abadá', 'Cores Neon', 'Micareta', 'Camarote VIP']),
                    'destaque'         => true,
                    'curtidas'         => 38,
                    'ordem'            => 2,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Jersey Brooklyn Streetball',
                    'categoria'        => 'basquete',
                    'subtitulo'        => 'Regata de basquete urbana em mesh furadinho com estampa frontal clássica',
                    'descricao'        => 'Kit de basquete profissional inspirado na cultura streetball nova-iorquina. Malha furadinha respirável nas laterais, gola e cavas caneladas bicolores e tipografia arqueada estilo NBA.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Liga Urbana de Basquete 3x3',
                    'ano'              => '2026',
                    'tecido'           => 'Dry Mesh Furadinho 160g',
                    'tecnica'          => 'Sublimação + Silk Relevo',
                    'cores'            => json_encode(['#1e1b4b', '#f59e0b', '#ffffff']),
                    'tags'             => json_encode(['Basquete', 'Streetwear', 'NBA Style', 'Mesh Respirável', 'Regata']),
                    'destaque'         => true,
                    'curtidas'         => 29,
                    'ordem'            => 3,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Aero Race Pro Cycling Kit',
                    'categoria'        => 'ciclismo',
                    'subtitulo'        => 'Camisa de ciclismo aero com zíper frontal total e 3 bolsos traseiros',
                    'descricao'        => 'Modelagem aero de competição colada ao corpo com mangas cortadas a laser, tecido com tratamento antibacteriano e proteção UV 50+. Padrão de velocidade em degradê ciano e grafite.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Equipe Pedal da Serra MTB',
                    'ano'              => '2026',
                    'tecido'           => 'Poliamida com Elastano + Dry UV50+',
                    'tecnica'          => 'Sublimação Calandrada HD',
                    'cores'            => json_encode(['#06b6d4', '#0f172a', '#10b981', '#f8fafc']),
                    'tags'             => json_encode(['Ciclismo', 'Aero Fit', 'Zíper Total', 'UV50+', 'MTB & Speed']),
                    'destaque'         => false,
                    'curtidas'         => 33,
                    'ordem'            => 4,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Tigres Interclasses Colegial 2026',
                    'categoria'        => 'interclasses',
                    'subtitulo'        => 'Camisa de torcida e jogos escolares com textura camuflada e mascote em vetor',
                    'descricao'        => 'Arte desenvolvida para o 3º ano do ensino médio em jogos interclasses escolares. Mascote em vetor hiper estilizado, padrão camuflado geométrico e espaço frontal para nome individual dos alunos.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1515523110800-9415d13b84a8?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1515523110800-9415d13b84a8?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Turma Terceirão Colégio Elite',
                    'ano'              => '2026',
                    'tecido'           => 'Cacharrel Microfibra / Dry Sport',
                    'tecnica'          => 'Sublimação Total',
                    'cores'            => json_encode(['#ea580c', '#18181b', '#ffffff']),
                    'tags'             => json_encode(['Interclasses', 'Mascote', 'Terceirão', 'Camisa Personalizada', 'Torcida']),
                    'destaque'         => true,
                    'curtidas'         => 51,
                    'ordem'            => 5,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Dragonfire Cyber eSports Jersey',
                    'categoria'        => 'esports',
                    'subtitulo'        => 'Fardamento gamer com textura de fibra de carbono e iluminação neon',
                    'descricao'        => 'Fardamento para time de CS2 e Valorant profissional. Detalhes inspirados em armadura cibernética, gola mandarim estilizada e aplicação de patrocinadores em degradê vermelho vulcânico.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Organização Dragonfire Gaming',
                    'ano'              => '2026',
                    'tecido'           => 'Dry Pro Gamer Ultra Light',
                    'tecnica'          => 'Sublimação Digital 4K',
                    'cores'            => json_encode(['#dc2626', '#111827', '#f97316', '#374151']),
                    'tags'             => json_encode(['eSports', 'Gaming', 'Fibra de Carbono', 'CS2', 'Valorant']),
                    'destaque'         => false,
                    'curtidas'         => 47,
                    'ordem'            => 6,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Polo Corporativa TechSummit 2026',
                    'categoria'        => 'corporativo',
                    'subtitulo'        => 'Camisa polo dry piquet com friso duplo na gola e bordado fino',
                    'descricao'        => 'Desenvolvimento de linha executiva esportiva para staff e palestrantes de evento de inovação. Modelagem slim elegante, abotoamento contrastante e estampa discreta sublimada nas costas.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
                        'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'TechSummit Brasil & Startups',
                    'ano'              => '2026',
                    'tecido'           => 'Piquet Poliéster Confort',
                    'tecnica'          => 'Bordado + Sublimação Localizada',
                    'cores'            => json_encode(['#1e293b', '#3b82f6', '#ffffff']),
                    'tags'             => json_encode(['Corporativo', 'Polo', 'Executivo', 'Eventos', 'Bordado']),
                    'destaque'         => false,
                    'curtidas'         => 22,
                    'ordem'            => 7,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Águias de Ouro Futsal Feminino',
                    'categoria'        => 'futebol',
                    'subtitulo'        => 'Uniforme feminino com modelagem babylook e grafismo de asas',
                    'descricao'        => 'Conjunto completo de jogo com calção e meiões coordenados. Modelagem especial anatômica feminina, detalhes em degradê de asas nas mangas e numeração em fonte esportiva arrojada.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Associação Desportiva Águias',
                    'ano'              => '2026',
                    'tecido'           => 'Dry Fit Antimicrobiano',
                    'tecnica'          => 'Sublimação Total',
                    'cores'            => json_encode(['#f59e0b', '#18181b', '#ffffff']),
                    'tags'             => json_encode(['Futsal Feminino', 'Babylook', 'Futebol', 'Degradê']),
                    'destaque'         => false,
                    'curtidas'         => 35,
                    'ordem'            => 8,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
            ];

            DB::table('portfolio_itens')->insert($itensIniciais);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('portfolio_itens');
    }
};

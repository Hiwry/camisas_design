<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('portfolio_itens') && !Schema::hasColumn('portfolio_itens', 'servico')) {
            Schema::table('portfolio_itens', function (Blueprint $table) {
                $table->string('servico', 60)->default('sublimacao')->after('categoria');
            });
        }

        // Atualizar itens existentes com os serviços corretos
        DB::table('portfolio_itens')->where('id', 1)->update(['servico' => 'sublimacao']);
        DB::table('portfolio_itens')->where('id', 2)->update(['servico' => 'sublimacao']);
        DB::table('portfolio_itens')->where('id', 3)->update(['servico' => 'serigrafia']);
        DB::table('portfolio_itens')->where('id', 4)->update(['servico' => 'sublimacao']);
        DB::table('portfolio_itens')->where('id', 5)->update(['servico' => 'sublimacao']);
        DB::table('portfolio_itens')->where('id', 6)->update(['servico' => 'sublimacao']);
        DB::table('portfolio_itens')->where('id', 7)->update(['servico' => 'bordado']);
        DB::table('portfolio_itens')->where('id', 8)->update(['servico' => 'sublimacao']);

        // Adicionar itens específicos para enriquecer Serigrafia, Bordado e Logos se não existirem
        $existeLogo = DB::table('portfolio_itens')->where('servico', 'logos')->exists();
        if (!$existeLogo) {
            DB::table('portfolio_itens')->insert([
                [
                    'titulo'           => 'Mascote & Escudo Fênix Imperatriz',
                    'categoria'        => 'esportivos',
                    'servico'          => 'logos',
                    'subtitulo'        => 'Identidade visual de equipe & Mascote vetorial 3D',
                    'descricao'        => 'Desenvolvimento de identidade visual completa para equipe esportiva: escudo heráldico, mascote vetorial estilizado em alta definição e manual de aplicação de marca.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Fênix Atlética Universitária',
                    'ano'              => '2026',
                    'tecido'           => 'Vetor Digital / Curvas AI & CDR',
                    'tecnica'          => 'Criação de Logos & Mascotes',
                    'cores'            => json_encode(['#0f0f0f', '#eab308', '#ffffff']),
                    'tags'             => json_encode(['Logo', 'Mascote', 'Identidade Visual', 'Vetor']),
                    'destaque'         => false,
                    'curtidas'         => 64,
                    'ordem'            => 9,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Camiseta Streetwear Silk Relevo 3D',
                    'categoria'        => 'empresas',
                    'servico'          => 'serigrafia',
                    'subtitulo'        => 'Estampa em serigrafia de alta definição com tinta relevo',
                    'descricao'        => 'Linha streetwear personalizada em meia malha penteada 100% algodão 30.1. Estampa em serigrafia (silk-screen) com 4 cores simuladas e efeito puff emborrachado.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'Overload Brand Co.',
                    'ano'              => '2026',
                    'tecido'           => '100% Algodão Menegotti 30.1 Penteado',
                    'tecnica'          => 'Serigrafia / Silk-screen Relevo',
                    'cores'            => json_encode(['#18181b', '#eab308', '#ffffff']),
                    'tags'             => json_encode(['Serigrafia', 'Silk-Screen', 'Streetwear', 'Algodão']),
                    'destaque'         => false,
                    'curtidas'         => 45,
                    'ordem'            => 10,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'titulo'           => 'Boné Trucker & Jaleco com Bordado Computadorizado',
                    'categoria'        => 'empresas',
                    'servico'          => 'bordado',
                    'subtitulo'        => 'Bordado frontal em relevo 3D de alta precisão de pontos',
                    'descricao'        => 'Programação de matriz de bordado computadorizado com alta densidade de pontos, acabamento sem fios soltos e precisão nas linhas finas da tipografia corporativa.',
                    'imagem_principal' => 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1000&q=80',
                    'galeria'          => json_encode([
                        'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1000&q=80',
                    ]),
                    'cliente'          => 'AgroTech Premium Uniformes',
                    'ano'              => '2026',
                    'tecido'           => 'Brim Pesado & Sarja Peletizada',
                    'tecnica'          => 'Bordado Computadorizado Relevo',
                    'cores'            => json_encode(['#1e293b', '#eab308', '#ffffff']),
                    'tags'             => json_encode(['Bordado', 'Boné', 'Corporativo', 'Matriz de Bordado']),
                    'destaque'         => false,
                    'curtidas'         => 37,
                    'ordem'            => 11,
                    'ativo'            => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ]
            ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('portfolio_itens') && Schema::hasColumn('portfolio_itens', 'servico')) {
            Schema::table('portfolio_itens', function (Blueprint $table) {
                $table->dropColumn('servico');
            });
        }
    }
};

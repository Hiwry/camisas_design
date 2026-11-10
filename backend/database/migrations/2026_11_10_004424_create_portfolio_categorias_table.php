<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('portfolio_categorias', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 100);
            $table->string('slug', 100)->unique();
            $table->enum('tipo', ['segmento', 'servico'])->default('segmento');
            $table->integer('ordem')->default(0);
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        // Seed inicial das categorias padrão existentes
        $agora = now();
        $categoriasIniciais = [
            // Segmentos
            ['nome' => 'Esportivos', 'slug' => 'esportivos', 'tipo' => 'segmento', 'ordem' => 1, 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['nome' => 'Empresas', 'slug' => 'empresas', 'tipo' => 'segmento', 'ordem' => 2, 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['nome' => 'Eventos', 'slug' => 'eventos', 'tipo' => 'segmento', 'ordem' => 3, 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
            
            // Serviços
            ['nome' => 'Sublimação Total', 'slug' => 'sublimacao', 'tipo' => 'servico', 'ordem' => 1, 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['nome' => 'Serigrafia (Silk)', 'slug' => 'serigrafia', 'tipo' => 'servico', 'ordem' => 2, 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['nome' => 'Bordado', 'slug' => 'bordado', 'tipo' => 'servico', 'ordem' => 3, 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['nome' => 'Logos & Mascotes', 'slug' => 'logos', 'tipo' => 'servico', 'ordem' => 4, 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
        ];

        DB::table('portfolio_categorias')->insert($categoriasIniciais);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('portfolio_categorias');
    }
};

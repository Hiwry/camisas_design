<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('portfolio_itens')) {
            return;
        }

        $itens = DB::table('portfolio_itens')->get();

        foreach ($itens as $item) {
            $capa = $item->imagem_principal;
            $rawGaleria = $item->galeria ? json_decode($item->galeria, true) : [];
            if (!is_array($rawGaleria)) {
                $rawGaleria = [];
            }

            // Se a capa é personalizada (não é unsplash) e a galeria só tinha fotos de exemplo do Unsplash:
            $capaIsCustom = !empty($capa) && !str_contains($capa, 'images.unsplash.com');
            $galeriaSoUnsplash = count($rawGaleria) > 0 && collect($rawGaleria)->every(fn($u) => is_string($u) && str_contains($u, 'images.unsplash.com'));

            if ($capaIsCustom && $galeriaSoUnsplash && !in_array($capa, $rawGaleria)) {
                DB::table('portfolio_itens')
                    ->where('id', $item->id)
                    ->update(['galeria' => json_encode([$capa])]);
                continue;
            }

            // Garante que se tem capa, ela esteja em primeiro na galeria
            if (!empty($capa) && !in_array($capa, $rawGaleria)) {
                array_unshift($rawGaleria, $capa);
                DB::table('portfolio_itens')
                    ->where('id', $item->id)
                    ->update(['galeria' => json_encode(array_values(array_unique($rawGaleria)))]);
            }
        }
    }

    public function down(): void
    {
        // Sem rollback destrutivo
    }
};


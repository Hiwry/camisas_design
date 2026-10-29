<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('confeccoes:reset-mensal', function () {
    $total = \App\Models\Confeccao::where('ativo', true)->update([
        'artes_usadas_mes' => 0,
        'reset_em' => now()->toDateString(),
    ]);
    $this->info("Contador mensal de artes resetado para {$total} confecções ativas.");
})->purpose('Reseta o contador de artes usadas no mês das confecções');

// Reset mensal de artes das confecções — rodar via cron todo dia 1 às 00:00
Schedule::command('confeccoes:reset-mensal')->monthlyOn(1, '00:00');

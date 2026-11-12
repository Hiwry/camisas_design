<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class LimparPedidosCommand extends Command
{
    protected $signature = 'pedidos:limpar {--force : Executa sem pedir confirmação}';
    protected $description = 'Limpa todos os pedidos, clientes e confecções, preservando o catálogo de portfólio e o usuário admin';

    public function handle(): int
    {
        $this->info('Iniciando limpeza de pedidos, clientes e confecções...');

        DB::statement('SET FOREIGN_KEY_CHECKS = 0;');

        // 1. Limpar tabelas de pedidos e aprovações
        DB::table('aprovacoes')->truncate();
        DB::table('revisoes_ia')->truncate();
        DB::table('artes')->truncate();
        DB::table('pedidos')->truncate();

        // 2. Limpar tabelas de grupos de camisas
        DB::table('grupo_logs')->truncate();
        DB::table('grupo_solicitacoes')->truncate();
        DB::table('grupo_pagamentos')->truncate();
        DB::table('grupo_participantes')->truncate();
        DB::table('grupo_modelos')->truncate();
        DB::table('grupos')->truncate();

        // 3. Limpar shop_pedidos e transações de crédito
        DB::table('shop_pedidos')->truncate();
        DB::table('transacoes_credito')->truncate();

        // 4. Limpar confecções
        DB::table('confeccoes')->truncate();

        // 5. Excluir usuários clientes e confecções, mantendo apenas admin
        $adminIds = DB::table('users')->where('role', 'admin')->pluck('id')->toArray();
        DB::table('users')->whereNotIn('id', $adminIds)->delete();

        // 6. Limpar tokens de usuários excluídos
        DB::table('personal_access_tokens')->whereNotIn('tokenable_id', $adminIds)->delete();

        DB::statement('SET FOREIGN_KEY_CHECKS = 1;');

        // 7. Limpar arquivos de pedidos e artes no storage local
        $pastasLimpar = [
            storage_path('app/public/pedidos'),
            storage_path('app/public/artes'),
            storage_path('app/public/previews'),
            storage_path('app/public/grupos'),
        ];

        foreach ($pastasLimpar as $pasta) {
            if (File::isDirectory($pasta)) {
                File::cleanDirectory($pasta);
                $this->line("Pasta limpa: {$pasta}");
            }
        }

        $this->info('Limpeza concluída com sucesso!');
        $this->info('Catálogo (portfolio_itens e portfolio_categorias) mantido intacto.');
        $this->info('Usuário Administrador preservado.');

        return Command::SUCCESS;
    }
}


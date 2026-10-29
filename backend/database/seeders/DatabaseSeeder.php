<?php

namespace Database\Seeders;

use App\Models\Confeccao;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $adminPassword = env('ADMIN_DEFAULT_PASSWORD', 'password');

        // Admin padrão
        $admin = User::firstOrCreate(
            ['email' => 'admin@camisasdesign.com'],
            [
                'name'     => 'Administrador',
                'password' => Hash::make($adminPassword),
                'role'     => 'admin',
                'ativo'    => true,
            ]
        );
        // Garante ativo mesmo se o registro já existia
        $admin->update(['ativo' => true]);

        // Confecção de exemplo
        $userConfeccao = User::firstOrCreate(
            ['email' => 'confeccao@exemplo.com'],
            [
                'name'     => 'Confecção Exemplo',
                'password' => Hash::make('password'),
                'role'     => 'confeccao',
                'ativo'    => true,
            ]
        );
        $userConfeccao->update(['ativo' => true]);

        Confeccao::firstOrCreate(
            ['user_id' => $userConfeccao->id],
            [
                'nome'          => 'Confecção Exemplo',
                'email'         => 'confeccao@exemplo.com',
                'plano'         => 'profissional',
                'limite_mensal' => 15,
                'artes_usadas_mes' => 0,
                'reset_em'      => now()->toDateString(),
                'ativo'         => true,
            ]
        );

        $this->command->info('Seed concluído!');
        $this->command->info('Admin: admin@camisasdesign.com / password');
        $this->command->info('Confecção: confeccao@exemplo.com / password');
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Confeccao;
use App\Models\Grupo;
use App\Models\GrupoModelo;
use App\Models\GrupoParticipante;
use Illuminate\Support\Str;

class GrupoTesteSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('role', 'admin')->first() ?? User::first();
        $confeccao = Confeccao::first();

        $grupo = Grupo::create([
            'user_id' => $admin ? $admin->id : 1,
            'confeccao_id' => $confeccao ? $confeccao->id : null,
            'cliente_nome' => 'Carlos Eduardo (Comissão Terceirão)',
            'cliente_whatsapp' => '5581987654321',
            'nome' => 'Terceirão 2026 - Teste Produção',
            'descricao' => 'Grupo de teste para validação de grade, corte, repetição de números e download de PDF.',
            'token' => Str::random(12),
            'senha_acesso' => '123456',
            'total_esperado' => 25,
            'pedido_minimo' => 10,
            'prazo_limite' => now()->addDays(12),
            'status' => 'aberto',
            'campo_nome_camisa' => true,
            'campo_numero_camisa' => true,
            'campo_apelido' => true,
            'campo_frase_costas' => true,
            'campo_observacao' => true,
            'tamanhos_disponiveis' => json_encode(['PP', 'P', 'M', 'G', 'GG', 'XG', '12', '14', '16']),
        ]);

        $mod1 = GrupoModelo::create([
            'grupo_id' => $grupo->id,
            'nome' => 'Camisa Tradicional',
            'valor_base' => 45.00,
            'cores' => ['Preto', 'Branco', 'Azul Marinho'],
            'ordem' => 1,
        ]);

        $mod2 = GrupoModelo::create([
            'grupo_id' => $grupo->id,
            'nome' => 'Babylook Feminina',
            'valor_base' => 45.00,
            'cores' => ['Preto', 'Branco', 'Rosa'],
            'ordem' => 2,
        ]);

        $mod3 = GrupoModelo::create([
            'grupo_id' => $grupo->id,
            'nome' => 'Regata Cavada',
            'valor_base' => 40.00,
            'cores' => ['Preto', 'Cinza Mescla'],
            'ordem' => 3,
        ]);

        $participantes = [
            ['Lucas Gabriel Silva', '5581991110001', $mod1->id, 'Preto', 'M', 1, 'LUCAS G.', '10', 'Lukinha', 'Rumo à facul', 'Costura reforçada', 45, 'pago'],
            ['Mariana Souza Lima', '5581991110002', $mod2->id, 'Branco', 'P', 1, 'MARI', '7', 'Mariquinha', 'Deus no comando', null, 45, 'pago'],
            ['Gabriel Ferreira Costa', '5581991110003', $mod1->id, 'Azul Marinho', 'G', 2, 'GABRIEL', '10', 'Biel', null, 'Duas camisas iguais', 90, 'pendente'],
            ['Beatriz Mendes Rocha', '5581991110004', $mod2->id, 'Preto', 'M', 1, 'BIA', '22', 'Biinha', 'Formada!', null, 45, 'pago'],
            ['Matheus Oliveira Santos', '5581991110005', $mod3->id, 'Preto', 'GG', 1, 'THEUS', '9', 'Theus', 'Nunca duvide', null, 40, 'pago'],
            ['Ana Clara Ribeiro', '5581991110006', $mod2->id, 'Rosa', 'PP', 1, 'CLARINHA', '11', 'Clara', null, null, 45, 'pago'],
            ['Pedro Henrique Alves', '5581991110007', $mod1->id, 'Preto', 'XG', 1, 'PEDRÃO', '99', 'Pedrão', 'O gigante acordou', 'Tamanho especial', 45, 'pago'],
            ['Larissa Cristina Martins', '5581991110008', $mod2->id, 'Branco', 'M', 1, 'LARI', '8', 'Lari', null, null, 45, 'pago'],
            ['Rodrigo Barbosa Lima', '5581991110009', $mod1->id, 'Azul Marinho', 'G', 1, 'BARBOSA', '5', 'Barba', null, null, 45, 'pendente'],
            ['Juliana Duarte Vieira', '5581991110010', $mod2->id, 'Preto', 'G', 1, 'JU VIEIRA', '13', 'Ju', null, null, 45, 'pago'],
            ['Enzo Gabriel Rodrigues', '5581991110011', $mod3->id, 'Cinza Mescla', 'M', 1, 'ENZO', '7', 'Enzo', null, 'Regata sem gola apertada', 40, 'pendente'],
            ['Camila Nogueira Cruz', '5581991110012', $mod2->id, 'Branco', 'P', 1, 'MILA', '17', 'Mila', 'Vencedores não desistem', null, 45, 'pago'],
            ['Felipe Cardoso Ramos', '5581991110013', $mod1->id, 'Branco', 'P', 1, 'FELIPINHO', '2', 'Lipe', null, null, 45, 'pago'],
            ['Isabela Fernandes Gomes', '5581991110014', $mod2->id, 'Rosa', 'M', 1, 'ISA', '3', 'Isa', null, null, 45, 'pago'],
            ['Thiago Silva Pereira', '5581991110015', $mod1->id, 'Preto', 'GG', 1, 'THIAGO', '1', 'Thiagão', null, 'Manga mais folgada', 45, 'pago'],
            ['Vinicius Castro Carvalho', '5581991110016', $mod3->id, 'Preto', 'G', 1, 'VINI', '20', 'Vini', 'Agora vai!', null, 40, 'pendente'],
            ['Amanda Freitas Moreira', '5581991110017', $mod2->id, 'Preto', '14', 1, 'AMANDINHA', '12', 'Amandinha', null, 'Infantil 14 anos', 45, 'pago'],
            ['Guilherme Santos Prado', '5581991110018', $mod1->id, 'Azul Marinho', '16', 1, 'GUI', '4', 'Gui', null, 'Juvenil 16 anos', 45, 'pago'],
            ['Rafaela Pires Dias', '5581991110019', $mod2->id, 'Branco', 'PP', 1, 'RAFA', '27', 'Rafa', null, null, 45, 'pago'],
            ['Bruno Monteiro Xavier', '5581991110020', $mod1->id, 'Preto', 'M', 2, 'MONTEIRO', '18', 'Monteiro', 'História feita', '2 camisas M', 90, 'pago'],
        ];

        foreach ($participantes as $p) {
            GrupoParticipante::create([
                'grupo_id' => $grupo->id,
                'grupo_modelo_id' => $p[2],
                'nome_completo' => $p[0],
                'whatsapp' => $p[1],
                'cor' => $p[3],
                'tamanho' => $p[4],
                'quantidade' => $p[5],
                'nome_camisa' => $p[6],
                'numero_camisa' => $p[7],
                'apelido' => $p[8],
                'frase_costas' => $p[9],
                'observacao' => $p[10],
                'valor_unitario' => $p[11] / $p[5],
                'valor_total' => $p[11],
                'status_pagamento' => $p[12],
            ]);
        }

        if ($this->command) {
            $this->command->info("Grupo de teste criado com sucesso! ID: {$grupo->id} | Nome: {$grupo->nome} | Total Peças: " . $grupo->participantes()->sum('quantidade'));
        }
    }
}

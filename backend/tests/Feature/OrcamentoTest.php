<?php

namespace Tests\Feature;

use App\Models\Confeccao;
use App\Models\Orcamento;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Requer MySQL (as migrations antigas do projeto usam MODIFY, que o SQLite não aceita).
 * Rodar com: DB_CONNECTION=mysql DB_DATABASE=<banco de teste já migrado> php artisan test --filter=OrcamentoTest
 */
class OrcamentoTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        return User::create([
            'name' => 'Admin', 'email' => 'adm_orc_' . uniqid() . '@ex.com',
            'password' => bcrypt('x'), 'role' => 'admin', 'ativo' => true,
        ]);
    }

    private function confeccao(): Confeccao
    {
        $u = User::create([
            'name' => 'Conf', 'email' => 'conf_orc_' . uniqid() . '@ex.com',
            'password' => bcrypt('x'), 'role' => 'confeccao', 'ativo' => true,
        ]);
        return Confeccao::create([
            'user_id' => $u->id, 'nome' => 'Confecção Teste', 'plano' => 'avulso',
            'limite_mensal' => 0, 'artes_usadas_mes' => 0, 'ativo' => true,
        ]);
    }

    private function payload(): array
    {
        return [
            'cliente_nome' => 'Brasiliense F.C.',
            'cliente_whatsapp' => '(61) 99999-0000',
            'data' => now()->toDateString(),
            'observacoes' => 'Pix na entrega',
            'itens' => [
                ['arte' => 'Costas goleiro', 'servico' => 'Criação de arte', 'data' => now()->addDays(3)->toDateString(), 'valor' => 150],
                ['arte' => 'Frente goleiro', 'servico' => 'Ajuste de arte', 'data' => now()->addDays(5)->toDateString(), 'valor' => 1250.5],
            ],
        ];
    }

    public function test_confeccao_nao_acessa_orcamentos(): void
    {
        $c = $this->confeccao();
        Sanctum::actingAs(User::find($c->user_id));
        $this->getJson('/api/orcamentos')->assertStatus(403);
    }

    public function test_fluxo_completo_criar_converter_e_dashboard(): void
    {
        Sanctum::actingAs($this->admin());
        $conf = $this->confeccao();

        $r = $this->postJson('/api/orcamentos', $this->payload())->assertCreated();
        $id = $r->json('id');
        $numero = $r->json('numero');
        $this->assertEquals(1400.5, $r->json('total'));
        $this->assertSame('aberto', $r->json('status'));

        // segundo orçamento recebe número seguinte
        $r2 = $this->postJson('/api/orcamentos', $this->payload())->assertCreated();
        $this->assertSame($numero + 1, $r2->json('numero'));

        // converte o primeiro: 1 pedido por arte
        $conv = $this->postJson("/api/orcamentos/{$id}/converter", [
            'confeccao_id' => $conf->id, 'tipo_impressao' => 'sublimacao',
        ])->assertOk();
        $this->assertCount(2, $conv->json('criados'));
        $this->assertSame('convertido', $conv->json('orcamento.status'));

        $pedidos = Pedido::where('orcamento_id', $id)->get();
        $this->assertCount(2, $pedidos);
        $p = $pedidos->firstWhere('titulo', 'Frente goleiro');
        $this->assertEquals(1250.5, $p->valor);
        $this->assertSame('Brasiliense F.C.', $p->cliente_nome);
        $this->assertSame($conf->id, $p->confeccao_id);
        $this->assertStringContainsString('Serviço: Ajuste de arte', $p->observacoes);

        // conversão dupla é barrada e não cria pedidos extras
        $this->postJson("/api/orcamentos/{$id}/converter", [
            'confeccao_id' => $conf->id, 'tipo_impressao' => 'sublimacao',
        ])->assertStatus(422);
        $this->assertSame(2, Pedido::where('orcamento_id', $id)->count());

        // convertido não edita nem exclui
        $this->putJson("/api/orcamentos/{$id}", $this->payload())->assertStatus(422);
        $this->deleteJson("/api/orcamentos/{$id}")->assertStatus(422);

        // segundo vira perdido e pode reabrir
        $this->patchJson("/api/orcamentos/{$r2->json('id')}/status", ['status' => 'perdido'])->assertOk();

        $d = $this->getJson('/api/orcamentos/dashboard')->assertOk()->json();
        $o = $d['orcamentos'];
        $this->assertSame(1, $o['convertidos']);
        $this->assertSame(1, $o['perdidos']);
        $this->assertEquals(50.0, $o['taxa_conversao']);
        $this->assertEquals(1400.5, $o['valor_convertido']);
        $this->assertSame(2, $d['pedidos']['total']);
        $this->assertEquals(1400.5, $d['pedidos']['valor_total']);
        $this->assertCount(6, $d['meses']);
    }

    public function test_validacao_e_exclusao_de_orcamento_aberto(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/orcamentos', ['data' => now()->toDateString(), 'itens' => []])->assertStatus(422);

        $id = $this->postJson('/api/orcamentos', $this->payload())->json('id');
        $this->putJson("/api/orcamentos/{$id}", array_merge($this->payload(), ['cliente_nome' => 'Outro']))
            ->assertOk()->assertJsonPath('cliente_nome', 'Outro');
        $this->deleteJson("/api/orcamentos/{$id}")->assertOk();
        $this->assertNull(Orcamento::find($id));
    }
}

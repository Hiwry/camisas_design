<?php

namespace Tests\Feature;

use App\Models\Confeccao;
use App\Models\Pedido;
use App\Models\Saida;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Requer MySQL já migrado (ver OrcamentoTest):
 * DB_CONNECTION=mysql DB_DATABASE=<banco de teste> php artisan test --filter=FinanceiroTest
 */
class FinanceiroTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        return User::create([
            'name' => 'Admin', 'email' => 'adm_fin_' . uniqid() . '@ex.com',
            'password' => bcrypt('x'), 'role' => 'admin', 'ativo' => true,
        ]);
    }

    private function confeccao(): Confeccao
    {
        $u = User::create([
            'name' => 'Conf', 'email' => 'conf_fin_' . uniqid() . '@ex.com',
            'password' => bcrypt('x'), 'role' => 'confeccao', 'ativo' => true,
        ]);
        return Confeccao::create([
            'user_id' => $u->id, 'nome' => 'Confecção Fin', 'plano' => 'avulso',
            'limite_mensal' => 0, 'artes_usadas_mes' => 0, 'ativo' => true,
        ]);
    }

    private function pedido(int $confId, float $valor, ?int $orcId = null, string $status = 'aguardando_briefing'): Pedido
    {
        return Pedido::create([
            'confeccao_id' => $confId, 'titulo' => 'Arte ' . uniqid(), 'tipo_impressao' => 'sublimacao',
            'valor' => $valor, 'status' => $status, 'orcamento_id' => $orcId,
        ]);
    }

    public function test_confeccao_nao_acessa_financeiro(): void
    {
        $c = $this->confeccao();
        Sanctum::actingAs(User::find($c->user_id));
        $this->getJson('/api/financeiro/dashboard?origem=pedidos')->assertStatus(403);
        $this->getJson('/api/saidas')->assertStatus(403);
        $p = $this->pedido($c->id, 10);
        $this->patchJson("/api/pedidos/{$p->id}/pagamento", ['pago' => true])->assertStatus(403);
    }

    public function test_dashboards_separados_por_origem(): void
    {
        Sanctum::actingAs($this->admin());
        $c = $this->confeccao();

        // pedidos normais: 100 + 200 (50 cancelado fica de fora)
        $pago = $this->pedido($c->id, 100);
        $this->pedido($c->id, 200);
        $this->pedido($c->id, 50, null, 'cancelado');
        // pedidos vindos de orçamento: 300 e 700
        $this->pedido($c->id, 300, 9991);
        $this->pedido($c->id, 700, 9991);

        $this->postJson('/api/saidas', ['descricao' => 'Papel sublimático', 'categoria' => 'Material', 'valor' => 40, 'data' => now()->toDateString(), 'origem' => 'pedidos'])->assertCreated();
        $this->postJson('/api/saidas', ['descricao' => 'Freelancer', 'categoria' => 'Terceiros', 'valor' => '70.5', 'data' => now()->toDateString(), 'origem' => 'orcamentos'])->assertCreated();

        // marca o de 100 como pago
        $this->patchJson("/api/pedidos/{$pago->id}/pagamento", ['pago' => true])->assertOk()->assertJsonPath('pago', true);

        $p = $this->getJson('/api/financeiro/dashboard?origem=pedidos&periodo=mes')->assertOk()->json();
        $this->assertEquals(100, $p['resumo']['recebido']);
        $this->assertEquals(200, $p['resumo']['a_receber']);
        $this->assertSame(1, $p['resumo']['pedidos_pagos']);
        $this->assertSame(1, $p['resumo']['pedidos_pendentes']);
        $this->assertEquals(60, $p['resumo']['resultado_caixa']); // recebido 100 - saídas 40
        $this->assertTrue(collect($p['recentes_pedidos'])->firstWhere('id', $pago->id)['pago']);
        $this->assertEquals(300, $p['resumo']['entradas']);
        $this->assertEquals(40, $p['resumo']['saidas']);
        $this->assertEquals(260, $p['resumo']['resultado']);
        $this->assertSame(2, $p['resumo']['pedidos']);
        $this->assertSame(1, $p['resumo']['cancelados']);
        $this->assertEquals(150, $p['resumo']['ticket_medio']);
        $this->assertSame('Material', $p['saidas_por_categoria'][0]['categoria']);

        $o = $this->getJson('/api/financeiro/dashboard?origem=orcamentos&periodo=mes')->assertOk()->json();
        $this->assertEquals(1000, $o['resumo']['entradas']);
        $this->assertEquals(70.5, $o['resumo']['saidas']);
        $this->assertEquals(929.5, $o['resumo']['resultado']);
        $this->assertSame(2, $o['resumo']['pedidos']);
        $this->assertEquals(0, $o['resumo']['recebido']);   // pago em "pedidos" não vaza para "orçamentos"
        $this->assertEquals(1000, $o['resumo']['a_receber']);

        // desfazer o pagamento
        $this->patchJson("/api/pedidos/{$pago->id}/pagamento", ['pago' => false])->assertOk()->assertJsonPath('pago', false);
        $this->assertEquals(0, $this->getJson('/api/financeiro/dashboard?origem=pedidos')->json('resumo.recebido'));

        $this->assertCount(6, $p['meses']);
        $this->assertCount(12, $this->getJson('/api/financeiro/dashboard?origem=pedidos&periodo=ano')->json('meses'));
        $this->getJson('/api/financeiro/dashboard?origem=outra')->assertStatus(422);
    }

    public function test_crud_de_saidas_e_validacao(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/saidas', ['descricao' => '', 'valor' => 0, 'data' => 'x', 'origem' => 'geral'])->assertStatus(422);

        $id = $this->postJson('/api/saidas', ['descricao' => 'Tinta', 'valor' => 120, 'data' => '2026-11-10', 'origem' => 'pedidos'])->assertCreated()->json('id');
        $this->putJson("/api/saidas/{$id}", ['descricao' => 'Tinta preta', 'valor' => 130, 'data' => '2026-11-10', 'origem' => 'orcamentos'])
            ->assertOk()->assertJsonPath('origem', 'orcamentos');

        $this->getJson('/api/saidas?origem=orcamentos&mes=2026-11')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/saidas?origem=pedidos')->assertOk()->assertJsonCount(0);

        $this->deleteJson("/api/saidas/{$id}")->assertOk();
        $this->assertNull(Saida::find($id));
    }
}

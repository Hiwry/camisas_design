<?php

namespace Tests\Feature;

use App\Models\Confeccao;
use App\Models\ShopPedido;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShopTest extends TestCase
{
    use RefreshDatabase;
    public function test_catalogo_retorna_itens_e_saldos(): void
    {
        $user = User::create([
            'name' => 'Teste Confeccao',
            'email' => 'confeccao_teste@exemplo.com',
            'password' => bcrypt('password'),
            'role' => 'confeccao',
            'ativo' => true,
        ]);

        $response = $this->actingAs($user)->getJson('/api/shop/itens');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'itens' => [
                    '*' => [
                        'id',
                        'nome',
                        'categoria',
                        'quantidade',
                        'valor',
                        'descricao',
                        'entrega_sla',
                        'itens_inclusos',
                    ]
                ],
                'saldo',
            ]);
    }

    public function test_comprar_item_gera_pix_e_marcar_pago_credita_saldo(): void
    {
        $user = User::create([
            'name' => 'Teste Confeccao 2',
            'email' => 'confeccao_teste2@exemplo.com',
            'password' => bcrypt('password'),
            'role' => 'confeccao',
            'ativo' => true,
        ]);
        $confeccao = $user->confeccao;

        if (!$confeccao) {
            $confeccao = Confeccao::create([
                'user_id' => $user->id,
                'nome' => 'Confecção Teste Shop',
                'plano' => 'basico',
                'limite_mensal' => 10,
                'artes_usadas_mes' => 0,
                'artes_extras' => 0,
                'creditos_ia' => 0,
            ]);
            $user->refresh();
        }

        $artesExtrasAntes = (int) $confeccao->artes_extras;

        // Comprar 1 arte avulsa
        $compraResponse = $this->actingAs($user)->postJson('/api/shop/comprar', [
            'item_id' => 'arte_avulsa_1',
            'detalhes' => 'Teste automatizado de compra de arte avulsa',
        ]);

        $compraResponse->assertStatus(201)
            ->assertJsonStructure([
                'pedido' => ['id', 'status', 'pix_codigo'],
                'pix_copia_cola',
                'pix_qrcode_url',
            ]);

        $pedidoId = $compraResponse->json('pedido.id');

        // Confirmar pagamento
        $confirmResponse = $this->actingAs($user)->postJson("/api/shop/pedidos/{$pedidoId}/confirmar-pagamento");

        $confirmResponse->assertStatus(200);

        $confeccao->refresh();
        $this->assertEquals($artesExtrasAntes + 1, (int) $confeccao->artes_extras);
    }

    public function test_confeccao_pode_criar_pedido_usando_artes_extras_quando_limite_mensal_esgotado(): void
    {
        $user = User::create([
            'name' => 'Teste Confeccao 3',
            'email' => 'confeccao_teste3@exemplo.com',
            'password' => bcrypt('password'),
            'role' => 'confeccao',
            'ativo' => true,
        ]);

        $confeccao = Confeccao::create([
            'user_id' => $user->id,
            'nome' => 'Confecção Cota Esgotada',
            'plano' => 'basico',
            'limite_mensal' => 10,
            'artes_usadas_mes' => 10, // cota mensal esgotada
            'artes_extras' => 1,     // 1 arte adquirida no shop
            'creditos_ia' => 0,
        ]);
        $user->refresh();

        $this->assertTrue($confeccao->podeCriarPedido());
        $this->assertEquals(1, $confeccao->artesDisponiveis());

        // Criar pedido
        $response = $this->actingAs($user)->postJson('/api/pedidos', [
            'titulo' => 'Pedido com Arte Avulsa',
            'tipo_impressao' => 'sublimacao',
            'prazo' => now()->addDays(2)->format('Y-m-d'),
        ]);

        $response->assertStatus(201);

        $confeccao->refresh();
        $this->assertEquals(0, (int) $confeccao->artes_extras);
        $this->assertEquals(10, (int) $confeccao->artes_usadas_mes);
        $this->assertFalse($confeccao->podeCriarPedido());

        // Próximo pedido deve ser bloqueado
        $responseBloqueado = $this->actingAs($user)->postJson('/api/pedidos', [
            'titulo' => 'Pedido Bloqueado Sem Cota',
            'tipo_impressao' => 'sublimacao',
            'prazo' => now()->addDays(2)->format('Y-m-d'),
        ]);

        $responseBloqueado->assertStatus(422)
            ->assertJson([
                'message' => 'Limite mensal de artes atingido para este plano.',
                'disponivel' => 0,
            ]);
    }

    public function test_admin_pode_gerenciar_itens_do_shop(): void
    {
        $admin = User::create([
            'name' => 'Admin Shop',
            'email' => 'admin_shop_test@exemplo.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'ativo' => true,
        ]);

        // 1. Criar novo item/combo
        $createResponse = $this->actingAs($admin)->postJson('/api/admin/shop/itens', [
            'codigo' => 'combo_super_teste',
            'nome' => 'Combo Super Teste 10 Artes',
            'categoria' => 'combos',
            'tipo_saldo' => 'artes_extras',
            'quantidade' => 10,
            'valor' => 199.90,
            'valor_de' => 299.90,
            'descricao' => 'Pacote especial com 10 artes extras.',
            'badge' => 'Oferta Especial',
            'entrega_sla' => 'Imediato',
            'itens_inclusos' => ['10 artes completas', 'Gabarito em alta', 'Suporte prioritário'],
            'ativo' => true,
        ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('item.codigo', 'combo_super_teste')
            ->assertJsonPath('item.valor', 199.90);

        $itemId = $createResponse->json('item.id');

        // 2. Listar itens no admin
        $listResponse = $this->actingAs($admin)->getJson('/api/admin/shop/itens');
        $listResponse->assertStatus(200)
            ->assertJsonFragment(['codigo' => 'combo_super_teste']);

        // 3. Atualizar item
        $updateResponse = $this->actingAs($admin)->putJson("/api/admin/shop/itens/{$itemId}", [
            'nome' => 'Combo Super Teste Atualizado',
            'valor' => 179.90,
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('item.nome', 'Combo Super Teste Atualizado')
            ->assertJsonPath('item.valor', 179.90);

        // 4. Alternar ativo/desativado
        $toggleResponse = $this->actingAs($admin)->patchJson("/api/admin/shop/itens/{$itemId}/toggle-ativo");
        $toggleResponse->assertStatus(200)
            ->assertJsonPath('item.ativo', false);

        // 5. Excluir item
        $deleteResponse = $this->actingAs($admin)->deleteJson("/api/admin/shop/itens/{$itemId}");
        $deleteResponse->assertStatus(200);

        $this->assertDatabaseMissing('shop_itens', ['id' => $itemId]);
    }

    public function test_usuario_comum_nao_pode_acessar_rotas_admin_do_shop(): void
    {
        $confeccaoUser = User::create([
            'name' => 'Confeccao Nao Admin',
            'email' => 'confeccao_nao_admin@exemplo.com',
            'password' => bcrypt('password'),
            'role' => 'confeccao',
            'ativo' => true,
        ]);

        $response = $this->actingAs($confeccaoUser)->getJson('/api/admin/shop/itens');
        $response->assertStatus(403);

        $responseCreate = $this->actingAs($confeccaoUser)->postJson('/api/admin/shop/itens', [
            'nome' => 'Hack Item',
            'valor' => 1.00,
        ]);
        $responseCreate->assertStatus(403);
    }
}


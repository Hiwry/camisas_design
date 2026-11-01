<?php

namespace Tests\Feature;

use App\Models\Confeccao;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KanbanTest extends TestCase
{
    use RefreshDatabase;

    private function criarAdmin(): User
    {
        return User::create([
            'name' => 'Admin Teste',
            'email' => 'admin_kanban@exemplo.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'ativo' => true,
        ]);
    }

    private function criarConfeccao(): array
    {
        $user = User::create([
            'name' => 'Confecção Teste',
            'email' => 'confeccao_kanban@exemplo.com',
            'password' => bcrypt('password'),
            'role' => 'confeccao',
            'ativo' => true,
        ]);

        $confeccao = Confeccao::create([
            'user_id' => $user->id,
            'nome' => 'Confecção Alfa',
            'plano' => 'profissional',
            'limite_mensal' => 20,
            'artes_usadas_mes' => 0,
            'ativo' => true,
        ]);

        return [$user, $confeccao];
    }

    public function test_admin_pode_visualizar_kanban(): void
    {
        $admin = $this->criarAdmin();
        [$_, $confeccao] = $this->criarConfeccao();

        $pedido = Pedido::create([
            'confeccao_id' => $confeccao->id,
            'titulo' => 'Camisa Teste 1',
            'status' => 'em_producao',
            'tipo_impressao' => 'sublimacao',
            'prazo' => now()->addDays(2)->format('Y-m-d'),
        ]);

        $response = $this->actingAs($admin)->getJson('/api/kanban');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'aguardando_briefing' => ['id', 'titulo', 'cards'],
            'em_producao' => ['id', 'titulo', 'cards'],
            'aguardando_aprovacao' => ['id', 'titulo', 'cards'],
            'aprovado' => ['id', 'titulo', 'cards'],
            'finalizado' => ['id', 'titulo', 'cards'],
        ]);

        $response->assertJsonFragment([
            'titulo' => 'Camisa Teste 1',
            'status' => 'em_producao',
        ]);
    }

    public function test_usuario_comum_nao_pode_acessar_kanban(): void
    {
        [$user] = $this->criarConfeccao();

        $response = $this->actingAs($user)->getJson('/api/kanban');

        $response->assertStatus(403);
    }

    public function test_admin_pode_mover_card_de_status(): void
    {
        $admin = $this->criarAdmin();
        [$_, $confeccao] = $this->criarConfeccao();

        $pedido = Pedido::create([
            'confeccao_id' => $confeccao->id,
            'titulo' => 'Camisa Mover Teste',
            'status' => 'aguardando_briefing',
            'tipo_impressao' => 'sublimacao',
        ]);

        $response = $this->actingAs($admin)->postJson('/api/kanban/mover', [
            'pedido_id' => $pedido->id,
            'novo_status' => 'em_producao',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('pedidos', [
            'id' => $pedido->id,
            'status' => 'em_producao',
        ]);
    }

    public function test_mover_para_status_invalido_falha(): void
    {
        $admin = $this->criarAdmin();
        [$_, $confeccao] = $this->criarConfeccao();

        $pedido = Pedido::create([
            'confeccao_id' => $confeccao->id,
            'titulo' => 'Camisa Teste',
            'status' => 'em_producao',
            'tipo_impressao' => 'sublimacao',
        ]);

        $response = $this->actingAs($admin)->postJson('/api/kanban/mover', [
            'pedido_id' => $pedido->id,
            'novo_status' => 'status_inexistente',
        ]);

        $response->assertStatus(422);
    }

    public function test_pedido_cancelado_nao_pode_ser_movido(): void
    {
        $admin = $this->criarAdmin();
        [$_, $confeccao] = $this->criarConfeccao();

        $pedido = Pedido::create([
            'confeccao_id' => $confeccao->id,
            'titulo' => 'Camisa Cancelada',
            'status' => 'cancelado',
            'tipo_impressao' => 'sublimacao',
        ]);

        $response = $this->actingAs($admin)->postJson('/api/kanban/mover', [
            'pedido_id' => $pedido->id,
            'novo_status' => 'em_producao',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'message' => 'Pedido cancelado não pode ser movido.',
        ]);
    }
}

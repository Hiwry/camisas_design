<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConfeccaoController;
use App\Http\Controllers\Api\PedidoController;
use App\Http\Controllers\Api\ArteController;
use App\Http\Controllers\Api\AprovacaoController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\KanbanController;
use App\Http\Controllers\Api\CreditoController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\PortfolioController;
use App\Http\Controllers\RevisaoArteController;
use App\Http\Controllers\RevisaoImagemController;
use App\Http\Controllers\WhatsAppController;
use App\Http\Controllers\Api\Publico\RastreioController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rotas públicas (sem autenticação)
|--------------------------------------------------------------------------
*/

// Rate limit: 10 tentativas por minuto por IP
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
});

// Aprovação pública via token único
// Rate limit: 30 req/min para visualização, 5/min para responder (evita spam de aprovações)
Route::middleware('throttle:30,1')->get('/aprovacao/{token}', [AprovacaoController::class, 'showPublico']);
Route::middleware('throttle:5,1')->group(function () {
    Route::post('/aprovacao/{token}/responder', [AprovacaoController::class, 'responder']);
    Route::post('/aprovacao/{token}/aprovar',   [AprovacaoController::class, 'aprovar']);
    Route::post('/aprovacao/{token}/revisao',   [AprovacaoController::class, 'pedirRevisao']);
});

// Webhook público da Evolution API
Route::post('/whatsapp/webhook', [WhatsAppController::class, 'webhook']);

// Portfólio / Catálogo público de trabalhos
Route::get('/portfolio', [PortfolioController::class, 'index']);
Route::get('/portfolio/{portfolio}', [PortfolioController::class, 'show']);
Route::middleware('throttle:30,1')->post('/portfolio/{portfolio}/curtir', [PortfolioController::class, 'curtir']);

// Rastreio público de pedidos pelo WhatsApp / Telefone
Route::middleware('throttle:30,1')->post('/publico/rastreio', [RastreioController::class, 'rastrear']);

/*
|--------------------------------------------------------------------------
| Rotas protegidas (Sanctum)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Kanban (somente admin)
    Route::middleware('admin')->group(function () {
        Route::get('/kanban',        [KanbanController::class, 'index']);
        Route::post('/kanban/mover', [KanbanController::class, 'mover']);
    });

    // Confecções (admin: CRUD completo | confeccao: só visualiza/atualiza própria)
    Route::get('/confeccoes',              [ConfeccaoController::class, 'index']);
    Route::get('/confeccoes/{confeccao}',  [ConfeccaoController::class, 'show']);
    Route::put('/confeccoes/{confeccao}',  [ConfeccaoController::class, 'update']);

    // Pedidos
    Route::get('/pedidos',               [PedidoController::class, 'index']);
    Route::post('/pedidos',              [PedidoController::class, 'store']);
    Route::get('/pedidos/{pedido}',      [PedidoController::class, 'show']);
    Route::put('/pedidos/{pedido}',      [PedidoController::class, 'update']);
    Route::delete('/pedidos/{pedido}',   [PedidoController::class, 'destroy']);

    // Mover status no kanban (somente admin)
    Route::patch('/pedidos/{pedido}/status', [PedidoController::class, 'moverStatus'])
        ->middleware('admin');

    // Link público de aprovação
    Route::get('/pedidos/{pedido}/link-aprovacao', [PedidoController::class, 'linkAprovacao']);

    // Artes (histórico de versões por pedido)
    Route::get('/pedidos/{pedido}/artes',   [ArteController::class, 'index']);
    Route::post('/pedidos/{pedido}/artes',  [ArteController::class, 'store']);
    Route::delete('/artes/{arte}',          [ArteController::class, 'destroy']);
    Route::patch('/artes/{arte}/marcar-final',   [ArteController::class, 'marcarFinal']);
    Route::patch('/artes/{arte}/desmarcar-final', [ArteController::class, 'desmarcarFinal']);
    Route::patch('/artes/{arte}/ativar',          [ArteController::class, 'tornarAtiva']);

    // Histórico de aprovações (autenticado)
    Route::get('/pedidos/{pedido}/aprovacoes', [AprovacaoController::class, 'historico']);

    // Revisão de arte com IA
    Route::post('/revisao/comparar',   [RevisaoImagemController::class, 'comparar']);
    Route::get('/revisao/historico',   [RevisaoImagemController::class, 'historico']);
    Route::post('/pedidos/{pedido}/revisar-arte', [RevisaoArteController::class, 'revisar']);

    // Gestão de Créditos de IA (R$ 5,00 por análise)
    Route::get('/creditos/saldo',                          [CreditoController::class, 'saldo']);
    Route::post('/creditos/comprar',                       [CreditoController::class, 'comprar']);
    Route::post('/creditos/confirmar-pagamento/{transacao}', [CreditoController::class, 'confirmarPagamento']);
    Route::get('/creditos/historico',                      [CreditoController::class, 'historico']);

    // Gestão de créditos pelo Admin
    Route::post('/admin/confeccoes/{confeccao}/creditos',  [CreditoController::class, 'adminAjustarCreditos'])
        ->middleware('admin');

    // Shop de Itens Avulsos & Serviços
    Route::get('/shop/itens',                              [ShopController::class, 'itens']);
    Route::post('/shop/comprar',                           [ShopController::class, 'comprar']);
    Route::post('/shop/pedidos/{pedido}/confirmar-pagamento', [ShopController::class, 'confirmarPagamento']);
    Route::get('/shop/pedidos',                            [ShopController::class, 'meusPedidos']);

    // Gestão do Shop pelo Admin e Operações Administrativas
    Route::middleware('admin')->group(function () {
        // Confecções (criação e exclusão restritas ao Admin)
        Route::post('/confeccoes',             [ConfeccaoController::class, 'store']);
        Route::delete('/confeccoes/{confeccao}', [ConfeccaoController::class, 'destroy']);

        Route::get('/admin/shop/pedidos',                  [ShopController::class, 'adminPedidos']);
        Route::patch('/admin/shop/pedidos/{pedido}',       [ShopController::class, 'adminAtualizarStatus']);

        // Gestão de Itens, Produtos e Combos do Shop
        Route::get('/admin/shop/itens',                    [ShopController::class, 'adminListarItens']);
        Route::post('/admin/shop/itens',                   [ShopController::class, 'adminCriarItem']);
        Route::post('/admin/shop/itens/{item}',            [ShopController::class, 'adminAtualizarItem']);
        Route::put('/admin/shop/itens/{item}',             [ShopController::class, 'adminAtualizarItem']);
        Route::patch('/admin/shop/itens/{item}/toggle-ativo',[ShopController::class, 'adminToggleAtivo']);
        Route::delete('/admin/shop/itens/{item}',          [ShopController::class, 'adminExcluirItem']);

        // Gestão do Portfólio / Catálogo de Trabalhos
        Route::post('/admin/portfolio',                       [PortfolioController::class, 'store']);
        Route::post('/admin/portfolio/{portfolio}',          [PortfolioController::class, 'update']);
        Route::put('/admin/portfolio/{portfolio}',           [PortfolioController::class, 'update']);
        Route::patch('/admin/portfolio/{portfolio}/toggle-destaque', [PortfolioController::class, 'toggleDestaque']);
        Route::patch('/admin/portfolio/{portfolio}/toggle-ativo',    [PortfolioController::class, 'toggleAtivo']);
        Route::delete('/admin/portfolio/{portfolio}',         [PortfolioController::class, 'destroy']);

        // WhatsApp (Evolution API — exclusivo Admin)
        Route::get('/whatsapp/status',                 [WhatsAppController::class, 'status']);
        Route::get('/whatsapp/qrcode',                 [WhatsAppController::class, 'qrcode']);
        Route::post('/whatsapp/desconectar',           [WhatsAppController::class, 'desconectar']);
        Route::post('/whatsapp/enviar-teste',          [WhatsAppController::class, 'enviarTeste']);
        Route::post('/whatsapp/configurar-webhook',    [WhatsAppController::class, 'configurarWebhook']);
        Route::get('/whatsapp/webhook-status',         [WhatsAppController::class, 'webhookStatus']);
    });
});

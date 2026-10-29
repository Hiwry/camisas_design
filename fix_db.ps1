# ============================================================
# fix_db.ps1  —  Reseta o banco e recria os dados de teste
# Execute em: C:\xampp\htdocs\camisas_design\
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Reset do Banco — Camiseta Design" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backend = Join-Path $PSScriptRoot "backend"
Set-Location $backend

# ── Verifica se o artisan existe ──────────────────────────────
if (-not (Test-Path "artisan")) {
    Write-Host "ERRO: artisan não encontrado em $backend" -ForegroundColor Red
    Write-Host "  Execute primeiro o setup_backend.ps1" -ForegroundColor Yellow
    exit 1
}

# ── Verifica se o .env existe ─────────────────────────────────
if (-not (Test-Path ".env")) {
    Write-Host "ERRO: .env não encontrado. Copie .env.example para .env e configure o banco." -ForegroundColor Red
    exit 1
}

# ── Limpa caches do Laravel ───────────────────────────────────
Write-Host "[1/5] Limpando cache..." -ForegroundColor Yellow
php artisan config:clear 2>&1 | Out-Null
php artisan cache:clear  2>&1 | Out-Null
Write-Host "  Cache limpo." -ForegroundColor Green

# ── Publica migrations do Sanctum (se necessário) ────────────
Write-Host "[2/5] Publicando Sanctum..." -ForegroundColor Yellow
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider" --force --quiet
Write-Host "  Sanctum publicado." -ForegroundColor Green

# ── Recria todas as tabelas e roda o seed ─────────────────────
Write-Host "[3/5] Rodando migrate:fresh --seed..." -ForegroundColor Yellow
php artisan migrate:fresh --seed --force
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: Falha na migration." -ForegroundColor Red
    Write-Host "  Verifique se o MySQL está rodando no XAMPP" -ForegroundColor Yellow
    Write-Host "  e se o banco 'camisas_design' existe no phpMyAdmin." -ForegroundColor Yellow
    exit 1
}

# ── Cria link simbólico para storage público (uploads de arte) ─
Write-Host "[4/5] Criando storage:link..." -ForegroundColor Yellow
php artisan storage:link --force 2>&1 | Out-Null
Write-Host "  storage:link criado (public/storage -> storage/app/public)" -ForegroundColor Green

# ── Testa a conexão com o banco ───────────────────────────────
Write-Host "[5/5] Verificando usuários criados..." -ForegroundColor Yellow
$result = php artisan tinker --execute="echo json_encode(App\Models\User::select('email','role')->get()->toArray());" 2>&1
Write-Host "  Usuários: $result" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Banco resetado com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Credenciais de acesso:" -ForegroundColor Cyan
Write-Host "  Admin........: admin@camisasdesign.com  /  password" -ForegroundColor White
Write-Host "  Confeccao....: confeccao@exemplo.com    /  password" -ForegroundColor White
Write-Host ""
Write-Host "Agora rode:  .\iniciar.ps1" -ForegroundColor Yellow
Write-Host ""

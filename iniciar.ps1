# ============================================================
# iniciar.ps1  —  Inicia backend + frontend em janelas separadas
# Execute em: C:\xampp\htdocs\camisas_design\
# ============================================================

$root    = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando Camiseta Design" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Verifica pré-requisitos ───────────────────────────────────
if (-not (Test-Path (Join-Path $backend "artisan"))) {
    Write-Host "ERRO: backend/artisan não encontrado." -ForegroundColor Red
    Write-Host "  Execute primeiro: .\setup_backend.ps1" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $backend "vendor"))) {
    Write-Host "ERRO: vendor/ não encontrado. Instalando dependências..." -ForegroundColor Yellow
    Set-Location $backend
    composer install --no-interaction --prefer-dist
}

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Instalando dependências do frontend..." -ForegroundColor Yellow
    Set-Location $frontend
    npm install
}

# ── Inicia o backend Laravel em nova janela ───────────────────
Write-Host "[1/2] Iniciando backend (porta 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$backend'; Write-Host 'Backend - Camiseta Design' -ForegroundColor Cyan; php artisan serve"

Start-Sleep -Seconds 2

# ── Inicia o frontend Vite em nova janela ─────────────────────
Write-Host "[2/2] Iniciando frontend (porta 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$frontend'; Write-Host 'Frontend - Camiseta Design' -ForegroundColor Cyan; npm run dev"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Projeto iniciado!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend : http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "  Admin     : admin@camisasdesign.com / password" -ForegroundColor Gray
Write-Host "  Confeccao : confeccao@exemplo.com   / password" -ForegroundColor Gray
Write-Host ""

# Abre o navegador automaticamente
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

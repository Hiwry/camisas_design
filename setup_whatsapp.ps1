# ============================================================
# setup_whatsapp.ps1  —  Instala e inicia a Evolution API
# Execute em: C:\xampp\htdocs\camisas_design\
# ============================================================

$ErrorActionPreference = "Stop"
$pasta = "C:\evolution-api"
$apiKey = "camiseta-design-2024"
$porta  = "8080"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Evolution API — Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# ── Verifica Node.js ──────────────────────────────────────
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Gray
} catch {
    Write-Host "ERRO: Node.js não encontrado." -ForegroundColor Red
    Write-Host "  Baixe em: https://nodejs.org (LTS)" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ── Verifica Git ──────────────────────────────────────────
Write-Host "Verificando Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>&1
    Write-Host "  Git: $gitVersion" -ForegroundColor Gray
} catch {
    Write-Host "ERRO: Git não encontrado." -ForegroundColor Red
    Write-Host "  Baixe em: https://git-scm.com" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ── Clona ou atualiza o repositório ──────────────────────
if (Test-Path $pasta) {
    Write-Host ""
    Write-Host "Pasta $pasta já existe." -ForegroundColor Yellow
    $resposta = Read-Host "Reinstalar do zero? (s/N)"
    if ($resposta -eq "s") {
        Remove-Item $pasta -Recurse -Force
    }
}

if (-not (Test-Path $pasta)) {
    Write-Host ""
    Write-Host "Clonando Evolution API do GitHub..." -ForegroundColor Yellow
    git clone https://github.com/EvolutionAPI/evolution-api.git $pasta
    Write-Host "  Clone concluído!" -ForegroundColor Green
}

Set-Location $pasta

# ── Cria o arquivo .env ──────────────────────────────────
Write-Host ""
Write-Host "Configurando .env..." -ForegroundColor Yellow

$envContent = @"
# ── Servidor ──────────────────────────────────────────────
SERVER_TYPE=http
SERVER_PORT=$porta
SERVER_URL=http://localhost:$porta

# ── Autenticação ──────────────────────────────────────────
AUTHENTICATION_TYPE=apikey
AUTHENTICATION_API_KEY=$apiKey

# ── Banco de dados (SQLite — sem necessidade de MySQL) ─────
DATABASE_PROVIDER=sqlite
DATABASE_CONNECTION_URI=file:./dev.db

# ── Storage ───────────────────────────────────────────────
STORE_MESSAGES=false
STORE_MESSAGE_UP=false
STORE_CONTACTS=true
STORE_CHATS=false

# ── QRCode ────────────────────────────────────────────────
QRCODE_LIMIT=30
QRCODE_COLOR=#25d366

# ── Instância padrão ──────────────────────────────────────
DEL_INSTANCE=false
"@

$envContent | Out-File -FilePath "$pasta\.env" -Encoding UTF8 -Force
Write-Host "  .env criado!" -ForegroundColor Green

# ── Instala dependências ──────────────────────────────────
Write-Host ""
Write-Host "Instalando dependências (pode demorar 1-2 min)..." -ForegroundColor Yellow
npm install --legacy-peer-deps
Write-Host "  Dependências instaladas!" -ForegroundColor Green

# ── Build ─────────────────────────────────────────────────
Write-Host ""
Write-Host "Fazendo build..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    # Tenta sem build (alguns projetos rodam direto)
    Write-Host "  Build opcional não necessário, continuando..." -ForegroundColor Gray
}

# ── Atualiza o .env do backend do Camiseta Design ─────────
$backendEnv = "C:\xampp\htdocs\camisas_design\backend\.env"
if (Test-Path $backendEnv) {
    Write-Host ""
    Write-Host "Atualizando backend/.env..." -ForegroundColor Yellow
    $conteudo = Get-Content $backendEnv -Raw

    if ($conteudo -match "EVOLUTION_API_KEY=\s*$") {
        $conteudo = $conteudo -replace "EVOLUTION_API_KEY=", "EVOLUTION_API_KEY=$apiKey"
        $conteudo | Out-File $backendEnv -Encoding UTF8 -NoNewline
        Write-Host "  EVOLUTION_API_KEY preenchida automaticamente!" -ForegroundColor Green
    } elseif ($conteudo -notmatch "EVOLUTION_API_KEY=.+") {
        Add-Content $backendEnv "`nEVOLUTION_API_KEY=$apiKey"
        Write-Host "  EVOLUTION_API_KEY adicionada!" -ForegroundColor Green
    } else {
        Write-Host "  EVOLUTION_API_KEY já configurada." -ForegroundColor Gray
    }
}

# ── Cria script de inicialização ─────────────────────────
$iniciarEvolution = "C:\xampp\htdocs\camisas_design\iniciar_whatsapp.ps1"
@"
# Inicia a Evolution API
Set-Location C:\evolution-api
Write-Host 'Iniciando Evolution API na porta $porta...' -ForegroundColor Green
node dist/main.js
"@ | Out-File $iniciarEvolution -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Instalação concluída!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  API Key definida: $apiKey" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:$porta" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para iniciar a Evolution API, rode:" -ForegroundColor Yellow
Write-Host "  .\iniciar_whatsapp.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Ou inicie direto agora? (s/N)" -ForegroundColor Yellow
$iniciar = Read-Host
if ($iniciar -eq "s") {
    Write-Host ""
    Write-Host "Iniciando Evolution API..." -ForegroundColor Green
    Write-Host "Deixe esta janela aberta. Acesse http://localhost:$porta" -ForegroundColor Cyan
    Write-Host ""
    node dist/main.js
}

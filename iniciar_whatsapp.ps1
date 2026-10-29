# ============================================================
# iniciar_whatsapp.ps1  —  Build + Inicia a Evolution API
# ============================================================

$pasta = "C:\evolution-api"

if (-not (Test-Path $pasta)) {
    Write-Host "Evolution API nao instalada. Rode primeiro: .\setup_whatsapp.ps1" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Set-Location $pasta

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Evolution API" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  URL:     http://localhost:8080" -ForegroundColor Cyan
Write-Host "  API Key: camiseta-design-2024" -ForegroundColor Cyan
Write-Host ""

# ── Lê DATABASE_URL / DATABASE_CONNECTION_URI do .env ────
$envPath = "$pasta\.env"
$dbUrl = ""
if (Test-Path $envPath) {
    $envLinhas = Get-Content $envPath
    foreach ($linha in $envLinhas) {
        if ($linha -match "^\s*(DATABASE_URL|DATABASE_CONNECTION_URI)\s*=\s*[`"']?(.+?)[`"']?\s*$") {
            $dbUrl = $matches[2].Trim('"').Trim("'")
            break
        }
    }
}

# ── Escolhe schema com base no banco detectado ────────────
Write-Host "Procurando schema do Prisma..." -ForegroundColor Yellow

$schemaRelativo = $null

if ($dbUrl -match "^mysql://") {
    if (Test-Path "$pasta\prisma\mysql-schema.prisma") {
        $schemaRelativo = "prisma\mysql-schema.prisma"
        Write-Host "  Banco: MySQL  ->  $schemaRelativo" -ForegroundColor Green
    }
} elseif ($dbUrl -match "^postgresql://|^postgres://") {
    if (Test-Path "$pasta\prisma\postgresql-schema.prisma") {
        $schemaRelativo = "prisma\postgresql-schema.prisma"
        Write-Host "  Banco: PostgreSQL  ->  $schemaRelativo" -ForegroundColor Green
    }
}

# Fallback: tenta candidatos em ordem
if (-not $schemaRelativo) {
    $candidatos = @(
        "prisma\schema.prisma",
        "prisma\postgresql-schema.prisma",
        "prisma\mysql-schema.prisma",
        "prisma\sqlite-schema.prisma",
        "schema.prisma"
    )
    foreach ($c in $candidatos) {
        if (Test-Path "$pasta\$c") {
            $schemaRelativo = $c
            Write-Host "  Schema encontrado (fallback): $c" -ForegroundColor Yellow
            break
        }
    }
    # Busca recursiva como ultimo recurso
    if (-not $schemaRelativo -and (Test-Path "$pasta\prisma")) {
        $encontrados = Get-ChildItem "$pasta\prisma" -Filter "*.prisma" | Where-Object { $_.Name -ne "schema.prisma" }
        if ($encontrados) {
            $schemaRelativo = "prisma\" + $encontrados[0].Name
            Write-Host "  Schema encontrado (busca): $schemaRelativo" -ForegroundColor Yellow
        }
    }
}

if (-not $schemaRelativo) {
    Write-Host ""
    Write-Host "ERRO: Nenhum schema .prisma encontrado em $pasta\prisma" -ForegroundColor Red
    Get-ChildItem $pasta -Depth 1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ── Copia schema para prisma\schema.prisma (evita bugs de path no Prisma) ──
$schemaDestino = "$pasta\prisma\schema.prisma"
Copy-Item "$pasta\$schemaRelativo" $schemaDestino -Force
Write-Host "  Schema copiado para prisma\schema.prisma" -ForegroundColor Green

# ── Garante DATABASE_CONNECTION_URI / DATABASE_URL no .env ─
$envConteudo = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
if (-not $envConteudo) { $envConteudo = "" }

$temConexao = ($envConteudo -match "DATABASE_CONNECTION_URI") -or ($envConteudo -match "DATABASE_URL")
if (-not $temConexao) {
    if ($schemaRelativo -match "mysql") {
        $envConteudo += "`nDATABASE_CONNECTION_URI=`"mysql://root:@localhost:3306/evolution`""
    } else {
        $envConteudo += "`nDATABASE_CONNECTION_URI=`"postgresql://postgres:password@localhost:5432/evolution`""
    }
    $envConteudo | Out-File $envPath -Encoding UTF8 -NoNewline
    Write-Host "  DATABASE_CONNECTION_URI adicionada ao .env" -ForegroundColor Yellow
    Write-Host "  ATENCAO: Edite o .env com suas credenciais reais!" -ForegroundColor Red
} elseif ($dbUrl -match "^file:") {
    Write-Host ""
    Write-Host "  ATENCAO: DATABASE_CONNECTION_URI esta configurada para SQLite ($dbUrl)" -ForegroundColor Red
    Write-Host "  O schema MySQL requer: mysql://root:@localhost:3306/evolution" -ForegroundColor Yellow
    Write-Host "  Edite o .env em $envPath e troque o valor." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ── Gera o Prisma Client ──────────────────────────────────
Write-Host "Gerando Prisma Client..." -ForegroundColor Yellow
# Usa prisma\schema.prisma (caminho relativo, sem aspas no argumento)
npx prisma generate --schema prisma/schema.prisma

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO no Prisma generate. Verifique o DATABASE_URL no .env" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "  Prisma Client gerado!" -ForegroundColor Green

# ── Cria/sincroniza o banco ───────────────────────────────
Write-Host "Sincronizando banco de dados..." -ForegroundColor Yellow
npx prisma db push --schema prisma/schema.prisma --accept-data-loss 2>&1
Write-Host "  Banco configurado!" -ForegroundColor Green

# ── Detecta script de start disponivel ───────────────────
$pkgJson = Get-Content "$pasta\package.json" -Raw | ConvertFrom-Json
$scripts = $pkgJson.scripts.PSObject.Properties.Name

Write-Host "Scripts disponiveis: $($scripts -join ', ')" -ForegroundColor Gray

# ── Build (se existir) ────────────────────────────────────
if ($scripts -contains "build") {
    Write-Host "Fazendo build..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build com erros (pode ser apenas avisos). Continuando..." -ForegroundColor Yellow
    } else {
        Write-Host "  Build concluido!" -ForegroundColor Green
    }
}

# ── Inicia a API ──────────────────────────────────────────
Write-Host ""
Write-Host "Iniciando Evolution API..." -ForegroundColor Green
Write-Host "Deixe esta janela aberta enquanto usar o WhatsApp." -ForegroundColor Yellow
Write-Host ""

# Tenta scripts de start em ordem de preferencia
$startScripts = @("start", "start:prod", "dev", "start:dev")
$iniciou = $false

foreach ($s in $startScripts) {
    if ($scripts -contains $s) {
        Write-Host "  Usando: npm run $s" -ForegroundColor Cyan
        npm run $s
        $iniciou = $true
        break
    }
}

# Ultimo recurso: node direto
if (-not $iniciou) {
    if (Test-Path "$pasta\dist\main.js") {
        Write-Host "  Iniciando via: node dist/main.js" -ForegroundColor Cyan
        node dist/main.js
    } elseif (Test-Path "$pasta\src\main.ts") {
        Write-Host "  Iniciando via: npx tsx src/main.ts" -ForegroundColor Cyan
        npx tsx src/main.ts
    } else {
        Write-Host "ERRO: Nao foi possivel encontrar ponto de entrada." -ForegroundColor Red
        Write-Host "Scripts disponiveis:" -ForegroundColor Yellow
        npm run
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}

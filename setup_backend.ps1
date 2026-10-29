# ============================================================
# setup_backend.ps1
# Instala o Laravel completo e aplica os arquivos do projeto
# Execute em: C:\xampp\htdocs\camisas_design\
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup do Backend - [NOME]" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$temp = Join-Path $root "_laravel_fresh"

# ── Passo 1: Criar projeto Laravel limpo em pasta temporária ──
Write-Host "[1/5] Criando projeto Laravel fresco..." -ForegroundColor Yellow
if (Test-Path $temp) {
    Remove-Item $temp -Recurse -Force
}
Set-Location $root
composer create-project laravel/laravel _laravel_fresh --prefer-dist --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao criar projeto Laravel. Verifique se o Composer está instalado." -ForegroundColor Red
    exit 1
}
Write-Host "  Laravel base criado." -ForegroundColor Green

# ── Passo 2: Copiar estrutura base do Laravel para /backend ──
Write-Host "[2/5] Copiando estrutura base do Laravel para /backend..." -ForegroundColor Yellow

$filesToCopy = @(
    "artisan",
    "phpunit.xml",
    "server.php"
)
$dirsToCopy = @(
    "bootstrap",
    "public",
    "resources",
    "storage",
    "tests",
    "config"
)

foreach ($file in $filesToCopy) {
    $src = Join-Path $temp $file
    $dst = Join-Path $backend $file
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
    }
}

# Arquivos customizados que NUNCA devem ser sobrescritos pelo Laravel base
$protectedFiles = @(
    "bootstrap\app.php",
    "routes\api.php",
    "routes\web.php",
    "routes\console.php",
    "config\filesystems.php",
    ".env.example",
    "composer.json"
)

foreach ($dir in $dirsToCopy) {
    $src = Join-Path $temp $dir
    $dst = Join-Path $backend $dir
    if (Test-Path $src) {
        if (-not (Test-Path $dst)) {
            Copy-Item $src $dst -Recurse -Force
        } else {
            # Copiar arquivo por arquivo, pulando os protegidos
            Get-ChildItem $src -Recurse -File | ForEach-Object {
                $relativePath = $_.FullName.Substring($src.Length + 1)
                $dstFile = Join-Path $dst $relativePath
                $relativeFromBackend = (Join-Path $dir $relativePath)

                # Pular arquivos protegidos (nossos arquivos customizados)
                $isProtected = $false
                foreach ($pf in $protectedFiles) {
                    if ($relativeFromBackend -like "*$pf*") {
                        $isProtected = $true
                        break
                    }
                }

                if (-not $isProtected) {
                    $dstDir = Split-Path $dstFile -Parent
                    if (-not (Test-Path $dstDir)) {
                        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
                    }
                    Copy-Item $_.FullName $dstFile -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}

# Copiar .env.example do Laravel como base (não sobrescreve o nosso)
$envExample = Join-Path $temp ".env.example"
$ourEnvExample = Join-Path $backend ".env.example"
# Mantemos o nosso .env.example — já está configurado para R2

Write-Host "  Estrutura base copiada." -ForegroundColor Green

# ── Passo 3: Mesclar composer.json (adicionar flysystem-aws-s3-v3) ──
Write-Host "[3/5] Configurando composer.json..." -ForegroundColor Yellow

# Reescrever composer.json com a dependência extra já incluída
$composerContent = @'
{
    "name": "camisas-design/backend",
    "type": "project",
    "description": "Backend Laravel 11 - Sistema SaaS de Gestão de Artes",
    "require": {
        "php": "^8.2",
        "guzzlehttp/guzzle": "^7.2",
        "laravel/framework": "^11.0",
        "laravel/sanctum": "^4.0",
        "laravel/tinker": "^2.9",
        "league/flysystem-aws-s3-v3": "^3.0"
    },
    "require-dev": {
        "fakerphp/faker": "^1.23",
        "laravel/pint": "^1.13",
        "laravel/sail": "^1.26",
        "mockery/mockery": "^1.6",
        "nunomaduro/collision": "^8.0",
        "phpunit/phpunit": "^11.0",
        "spatie/laravel-ignition": "^2.4"
    },
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Factories\\": "database/factories/",
            "Database\\Seeders\\": "database/seeders/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\": "tests/"
        }
    },
    "scripts": {
        "post-autoload-dump": [
            "Illuminate\\Foundation\\ComposerScripts::postAutoloadDump",
            "@php artisan package:discover --ansi"
        ],
        "post-update-cmd": [
            "@php artisan vendor:publish --tag=laravel-assets --ansi --force"
        ],
        "post-root-package-install": [
            "@php -r \"file_exists('.env') || copy('.env.example', '.env');\""
        ],
        "post-create-project-cmd": [
            "@php artisan key:generate --ansi"
        ]
    },
    "extra": {
        "laravel": {
            "dont-discover": []
        }
    },
    "config": {
        "optimize-autoloader": true,
        "preferred-install": "dist",
        "sort-packages": true,
        "allow-plugins": {
            "pestphp/pest-plugin": true,
            "php-http/discovery": true
        }
    },
    "minimum-stability": "stable",
    "prefer-stable": true
}
'@
# Usar UTF8 SEM BOM (evita erro "does not contain valid JSON / BOM detected")
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $backend "composer.json"), $composerContent, $utf8NoBom)
Write-Host "  composer.json atualizado." -ForegroundColor Green

# ── Passo 4: Instalar dependências no backend ──
Write-Host "[4/5] Instalando dependências do Composer no /backend..." -ForegroundColor Yellow
Set-Location $backend
if (Test-Path "vendor") {
    Remove-Item "vendor" -Recurse -Force
}
if (Test-Path "composer.lock") {
    Remove-Item "composer.lock" -Force
}
composer install --no-interaction --prefer-dist
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha no composer install." -ForegroundColor Red
    exit 1
}
Write-Host "  Dependências instaladas." -ForegroundColor Green

# ── Passo 5: Gerar chave e publicar Sanctum ──
Write-Host "[5/5] Configurando Laravel..." -ForegroundColor Yellow

# Criar .env a partir do nosso .env.example
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  .env criado a partir do .env.example" -ForegroundColor Gray
}

php artisan key:generate
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider" --quiet

Write-Host "  Laravel configurado." -ForegroundColor Green

# ── Limpeza ──
Write-Host ""
Write-Host "Removendo pasta temporária..." -ForegroundColor Gray
Set-Location $root
Remove-Item $temp -Recurse -Force

# ── Resumo ──
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup concluído!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Edite backend\.env e configure:" -ForegroundColor White
Write-Host "       DB_DATABASE, DB_USERNAME, DB_PASSWORD" -ForegroundColor Gray
Write-Host "       R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, R2_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Crie o banco de dados MySQL:" -ForegroundColor White
Write-Host "       CREATE DATABASE camisas_design;" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Rode as migrations:" -ForegroundColor White
Write-Host "       cd backend" -ForegroundColor Gray
Write-Host "       php artisan migrate --seed" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Inicie o servidor:" -ForegroundColor White
Write-Host "       php artisan serve" -ForegroundColor Gray
Write-Host ""

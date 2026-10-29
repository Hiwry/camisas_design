#!/bin/bash
# ==============================================================================
# Script de Deploy para Produção - Camiseta Design
# Execute este script no servidor Linux após clonar o repositório.
# Exemplo de uso: chmod +x deploy.sh && ./deploy.sh
# ==============================================================================

set -e

echo "🚀 Iniciando processo de Deploy de Produção..."

# 1. Verifica se o .env do backend existe
if [ ! -f "backend/.env" ]; then
    echo "⚠️ Arquivo backend/.env não encontrado!"
    echo "Criando backend/.env a partir do .env.example..."
    cp backend/.env.example backend/.env
    echo "❗ Por favor, configure suas credenciais de banco e chaves em backend/.env antes de continuar."
    exit 1
fi

# 2. Instalação e otimização do Backend Laravel
echo "📦 Instalando dependências do Composer (Backend)..."
cd backend
composer install --no-dev --optimize-autoloader --no-interaction

# Gera chave de criptografia se vazia
php artisan key:generate --force --no-interaction

echo "🗄️ Executando migrações do banco de dados..."
php artisan migrate --force

echo "🔗 Criando link simbólico para storage..."
php artisan storage:link || true

echo "⚡ Limpando e gerando caches de produção do Laravel..."
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Ajuste de permissões para o servidor web (www-data)
echo "🔒 Ajustando permissões de storage e cache..."
chmod -R 775 storage bootstrap/cache || true
if id "www-data" &>/dev/null; then
    chown -R www-data:www-data storage bootstrap/cache || true
fi

cd ..

# 3. Compilação do Frontend SPA (React + Vite)
echo "🎨 Compilando o Frontend SPA..."
cd frontend

# Se não houver .env.production, cria baseado no exemplo
if [ ! -f ".env.production" ] && [ ! -f ".env.local" ]; then
    echo "Criando frontend/.env.production padrão..."
    cp .env.production.example .env.production
fi

npm ci || npm install
npm run build

cd ..

# 4. Inicia ou recarrega a Evolution API com Docker se docker-compose estiver instalado
if command -v docker &> /dev/null && [ -f "docker-compose.yml" ]; then
    echo "📱 Inicializando serviço WhatsApp (Evolution API)..."
    docker compose up -d || true
fi

echo "✅ Deploy concluído com sucesso!"
echo "Lembre-se de configurar o cron no servidor com:"
echo "* * * * * cd $(pwd)/backend && php artisan schedule:run >> /dev/null 2>&1"


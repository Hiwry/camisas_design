# 🚀 Guia de Deploy para Produção — Camiseta Design

Este documento contém todo o passo a passo para colocar a aplicação no ar de forma segura e otimizada.

---

## 📋 Requisitos do Servidor

* **Sistema Operacional:** Linux Ubuntu 22.04 / 24.04 LTS (ou Debian 12)
* **PHP:** Versão 8.2 ou 8.3 com as extensões:
  `php-fpm php-mysql php-mbstring php-xml php-curl php-gd php-zip php-bcmath php-intl`
* **Banco de Dados:** MySQL 8.0+ ou MariaDB 10.6+
* **Gerenciador de Pacotes:** Composer 2.x e Node.js 18+ (com npm)
* **Servidor Web:** Nginx (recomendado) ou Apache 2.4 com `mod_rewrite`
* **Docker & Docker Compose:** Opcional (apenas se for rodar o WhatsApp via Evolution API local)

---

## ⚡ Método 1: Deploy Automatizado (Recomendado no Linux / VPS)

1. Clone o repositório no servidor:
   ```bash
   cd /var/www
   git clone <URL_DO_SEU_REPOSITORIO> camisas_design
   cd camisas_design
   ```

2. Crie e configure o arquivo `.env` do backend:
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```
   *Preencha com o nome do banco, usuário, senha, chaves de API e URLs reais.*

3. Dê permissão e execute o script de deploy:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

---

## 🛠️ Método 2: Deploy Manual Passo a Passo

### 1. Backend (Laravel)
```bash
cd backend

# Copiar variáveis de ambiente e preencher
cp .env.example .env
nano .env

# Instalar dependências sem ferramentas de desenvolvimento
composer install --no-dev --optimize-autoloader

# Gerar chave da aplicação (se ainda vazia)
php artisan key:generate

# Rodar as migrações no banco de dados de produção
php artisan migrate --force

# Criar link para as imagens e arquivos
php artisan storage:link

# Criar usuário administrador inicial (se necessário)
php artisan db:seed --force

# Ativar caches de rota, configuração e visualização
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Permissões de escrita
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### 2. Frontend (React / Vite)
```bash
cd ../frontend

# Configurar apontamento da API
cp .env.production.example .env.production
nano .env.production

# Instalar dependências e gerar build de produção
npm ci
npm run build
```
*Os arquivos compilados e otimizados ficarão na pasta `frontend/dist`.*

---

## 🌐 Configuração do Servidor Web (Nginx)

1. Copie o arquivo de exemplo disponibilizado na raiz do projeto:
   ```bash
   sudo cp nginx.conf.example /etc/nginx/sites-available/camisasdesign.com.br
   sudo nano /etc/nginx/sites-available/camisasdesign.com.br
   ```
2. Altere `seudominio.com.br` para o seu domínio real.
3. Crie o link simbólico e teste a configuração:
   ```bash
   sudo ln -s /etc/nginx/sites-available/camisasdesign.com.br /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```
4. Gere o certificado SSL gratuito com Let's Encrypt:
   ```bash
   sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
   ```

---

## ⏰ Agendador de Tarefas (Cron Job)

O Laravel possui tarefas automáticas agendadas (como o reset mensal de contadores no dia 1):

1. Abra o crontab do servidor:
   ```bash
   crontab -e
   ```
2. Adicione a linha abaixo:
   ```bash
   * * * * * cd /var/www/camisas_design/backend && php artisan schedule:run >> /dev/null 2>&1
   ```

---

## 📬 Fila de Processamento em Background (Queue Worker com Supervisor)

Para envio de notificações e e-mails sem travar a navegação do usuário:

1. Instale o Supervisor:
   ```bash
   sudo apt install supervisor -y
   ```
2. Crie o arquivo `/etc/supervisor/conf.d/camisas-worker.conf`:
   ```ini
   [program:camisas-worker]
   process_name=%(program_name)s_%(process_num)02d
   command=php /var/www/camisas_design/backend/artisan queue:work --sleep=3 --tries=3 --max-time=3600
   autostart=true
   autorestart=true
   user=www-data
   numprocs=2
   redirect_stderr=true
   stdout_logfile=/var/www/camisas_design/backend/storage/logs/worker.log
   stopwaitsecs=3600
   ```
3. Inicie o processo:
   ```bash
   sudo supervisorctl reread
   sudo supervisorctl update
   sudo supervisorctl start all
   ```

---

## 📱 WhatsApp (Evolution API via Docker)

Se for rodar a Evolution API no próprio servidor:
```bash
docker compose up -d
```
A Evolution API responderá internamente em `127.0.0.1:8080` de forma segura.

---

## 🔐 Primeiro Commit para Subir ao Git

Para enviar o código para o seu GitHub/GitLab:

```bash
git add .
git commit -m "feat: código revisado e preparado para produção"
git branch -M main
git remote add origin <URL_DO_SEU_REPOSITORIO_GIT>
git push -u origin main
```
*Fique tranquilo: as chaves secretas do `.env`, as pastas `vendor/`, `node_modules/` e logs já estão protegidas e não serão enviadas.*


# DesignFlow — Guia de Setup

## Backend (Laravel 11)

```bash
cd backend

# 1. Instalar dependências
composer install

# 2. Configurar .env
cp .env.example .env
php artisan key:generate

# 3. Configurar banco no .env:
# DB_DATABASE=camisas_design
# DB_USERNAME=seu_usuario
# DB_PASSWORD=sua_senha

# 4. Rodar migrations + seeder
php artisan migrate --seed

# 5. (Produção) Configurar R2 no .env:
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_BUCKET=camisas-design
# R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
# R2_URL=https://pub-<hash>.r2.dev
# FILESYSTEM_DISK=r2

# 6. Configurar email no .env (ex: Resend)
# MAIL_MAILER=smtp
# MAIL_HOST=smtp.resend.com
# MAIL_PORT=465
# MAIL_USERNAME=resend
# MAIL_PASSWORD=re_xxxxx
# MAIL_ENCRYPTION=ssl

# 7. Rodar filas (notificações assíncronas)
php artisan queue:work

# 8. Iniciar servidor
php artisan serve
```

**Usuários do seeder:**
- Admin: `admin@camisasdesign.com` / `password`
- Confecção: `confeccao@exemplo.com` / `password`

---

## Frontend (React + Vite)

```bash
cd frontend

# 1. Instalar dependências
npm install

# 2. Configurar API (opcional, padrão usa proxy Vite)
cp .env.example .env
# VITE_API_URL=http://localhost:8000/api

# 3. Iniciar dev server
npm run dev

# 4. Build para produção
npm run build
# Arquivos gerados em dist/ — copiar para VPS ou hosting
```

---

## Deploy na VPS

```bash
# Backend — nginx apontando para /public
# Configurar no nginx:
# root /var/www/camisas_design/backend/public;

# Frontend — build estático
npm run build
# copiar dist/ para /var/www/camisas_design/frontend/

# Filas em produção (supervisor)
# [program:camisas_queue]
# command=php /var/www/camisas_design/backend/artisan queue:work --sleep=3 --tries=3
```

---

## Fluxo principal

1. Admin cria confecção → confecção recebe login
2. Admin/Confecção cria pedido → sistema decrementa cota mensal
3. Designer faz upload da arte → pedido vai para "Aguardando Aprovação"
4. Admin copia link e envia para o cliente final
5. Cliente acessa `/aprovar/{token}` → aprova ou pede revisão
6. Ao aprovar → status muda no Kanban + notificação por email

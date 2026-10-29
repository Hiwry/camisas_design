# [NOME] — Sistema SaaS de Gestão de Artes para Camisetas

Sistema completo para gestão e aprovação de artes de camisetas, com Kanban, histórico de versões e aprovação pública sem login.

---

## Estrutura do Projeto

```
camisas_design/
├── backend/    # Laravel 11 — API REST
└── frontend/   # React + Vite + TailwindCSS
```

---

## Backend (Laravel 11)

### Requisitos
- PHP 8.2+
- MySQL 8+
- Composer

### Instalação (PowerShell — recomendado)

O projeto usa um script de setup que instala o Laravel completo e aplica todos os arquivos customizados automaticamente.

```powershell
# Na pasta camisas_design\:
cd C:\xampp\htdocs\camisas_design
.\setup_backend.ps1
```

O script irá:
1. Criar um projeto Laravel limpo
2. Copiar a estrutura base (artisan, bootstrap/, public/, etc.)
3. Instalar todas as dependências incluindo o driver R2
4. Gerar a APP_KEY automaticamente

### Após o setup

```powershell
# 1. Editar o .env com suas credenciais
notepad backend\.env

# 2. Criar o banco MySQL (via phpMyAdmin ou terminal):
#    CREATE DATABASE camisas_design;

# 3. Rodar migrations e seed
cd backend
php artisan migrate --seed

# 4. Iniciar o servidor
php artisan serve

# 5. (Opcional) Worker de filas para notificações por email
php artisan queue:work
```

> **Nota:** O `bootstrap\app.php` já está configurado com o middleware `CheckRole` registrado.

### Usuários padrão (após seed)
| Usuário | Email | Senha | Role |
|---------|-------|-------|------|
| Administrador | admin@camisasdesign.com | password | admin |
| Confecção Exemplo | confeccao@exemplo.com | password | confeccao |

---

## Frontend (React + Vite)

### Requisitos
- Node.js 18+
- npm ou pnpm

### Instalação

```bash
cd frontend

# 1. Instalar dependências
npm install

# 2. Criar .env.local
echo "VITE_API_URL=http://localhost:8000/api" > .env.local

# 3. Iniciar em desenvolvimento
npm run dev

# 4. Build para produção
npm run build
```

O app estará em `http://localhost:5173`

---

## Funcionalidades

### Perfis de usuário
- **Admin (designer)**: acessa tudo — dashboard, kanban, pedidos, confecções
- **Confecção**: vê apenas seus próprios pedidos, faz upload de artes
- **Cliente final**: acessa via link único `/aprovar/{token}` sem criar conta

### Fluxo principal
1. Admin cria confecção → confecção recebe login
2. Confecção (ou admin) cria pedido
3. Confecção faz upload da arte → pedido vai para "Aguardando Aprovação"
4. Cliente acessa o link único e aprova ou pede revisão
5. Aprovação muda o status automaticamente no Kanban

### Kanban (Admin)
Colunas: `Aguardando Briefing → Em Produção → Aguardando Aprovação → Aprovado → Finalizado`

Drag and drop entre colunas. Apenas admin pode mover cards.

### Planos de artes
| Plano | Artes/mês |
|-------|-----------|
| Básico | 8 |
| Profissional | 15 |
| Premium | 25 |

---

## Stack
- **Backend**: Laravel 11, Sanctum, MySQL, Cloudflare R2 (S3-compatible), Laravel Queues
- **Frontend**: React 18, Vite, TailwindCSS, dnd-kit, React Query, Zustand, React Router

---

## API Endpoints principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Usuário logado |
| GET | `/api/kanban` | Board completo |
| POST | `/api/kanban/mover` | Mover card |
| GET | `/api/pedidos` | Listar pedidos |
| POST | `/api/pedidos` | Criar pedido |
| GET | `/api/pedidos/{id}` | Detalhe do pedido |
| POST | `/api/pedidos/{id}/artes` | Upload de arte |
| GET | `/api/aprovacao/{token}` | Página pública (sem auth) |
| POST | `/api/aprovacao/{token}/aprovar` | Aprovar arte |
| POST | `/api/aprovacao/{token}/revisao` | Solicitar revisão |
| GET | `/api/dashboard` | Métricas (admin) |
| GET | `/api/confeccoes` | Listar confecções (admin) |

---

## Próximos passos sugeridos
- [ ] Definir o nome do sistema (substituir `[NOME]`)
- [ ] Configurar envio de email (SMTP) no `.env`
- [ ] Integrar WhatsApp (Twilio ou Z-API)
- [ ] Adicionar reset mensal automático via `php artisan schedule:run`
- [ ] Configurar deploy (Laravel Forge / Render + Vercel/Netlify)
- [ ] Adicionar testes automatizados

# TechFix Pro - Sistema de Gestão para Assistência Técnica

## Tecnologias
- **Backend**: Python + FastAPI + MongoDB
- **Frontend**: React + Tailwind CSS + Shadcn UI

## Instalação

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
# Configurar .env com MONGO_URL e DB_NAME
uvicorn server:app --host 0.0.0.0 --port 8001
```

### 2. Frontend
```bash
# Instalar dependências
yarn install

# Configurar .env com REACT_APP_BACKEND_URL
yarn start
```

## Funcionalidades
- Login/Registro com JWT
- Multi-tenancy (cada empresa tem seus próprios dados)
- Dashboard com métricas
- Gestão de Clientes
- Gestão de Aparelhos
- Ordens de Serviço com workflow
- Controle de Estoque
- Módulo Financeiro
- Gestão de Usuários
- Relatórios
- Geração de PDF
- QR Code para acompanhamento
- Link direto WhatsApp
- Tema claro/escuro

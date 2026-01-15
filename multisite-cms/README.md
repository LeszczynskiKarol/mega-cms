# MultiSite CMS

Multi-tenant CMS do zarządzania wieloma statycznymi stronami Astro.

## Features

- 🏢 **Multi-tenant** - jeden CMS dla wielu klientów
- 📝 **Rich Text Editor** - TipTap z formatowaniem
- 🔐 **Autentykacja** - JWT z rolami (Super Admin, Admin, Editor, Viewer)
- 🚀 **Deploy z jednego kliknięcia** - webhook do CI/CD
- 📡 **REST API** - dla stron Astro
- 🐳 **Docker Ready** - łatwy deploy

## Quick Start

### Opcja 1: Docker (zalecane)

```bash
# Uruchom PostgreSQL i CMS
docker compose up

# W osobnym terminalu - seed bazy danych
docker compose exec cms npx prisma db seed
```

CMS dostępny na http://localhost:3000

### Opcja 2: Lokalna instalacja

```bash
# Instalacja zależności
npm install

# Konfiguracja
cp .env.example .env
# Edytuj .env - ustaw DATABASE_URL

# Baza danych
npm run db:push
npm run db:seed

# Start
npm run dev
```

## Domyślne dane logowania

- **Email:** admin@example.com
- **Hasło:** admin123

⚠️ Zmień hasło po pierwszym logowaniu!

## Struktura projektu

```
multisite-cms/
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── dashboard/     # Panel administracyjny
│   │   └── page.tsx       # Strona logowania
│   ├── components/        # Komponenty UI
│   └── lib/
│       ├── auth.ts        # Autentykacja
│       ├── deploy.ts      # Funkcje deployu
│       ├── prisma.ts      # Klient Prisma
│       └── utils.ts       # Utility functions
├── prisma/
│   ├── schema.prisma      # Schema bazy danych
│   └── seed.ts            # Seed data
└── docker-compose.yml     # Docker setup
```

## API Endpoints

### Public API (dla Astro)

```
GET /api/public/pages
Headers: x-api-key: sk_xxxxx
Query: ?slug=about (opcjonalnie)

GET /api/public/menu
Headers: x-api-key: sk_xxxxx
```

### Internal API (wymaga autentykacji)

```
POST /api/auth/login
POST /api/auth/logout

GET/POST /api/tenants
GET/POST /api/pages
PUT/DELETE /api/pages/[id]

POST /api/deploy
POST /api/deploy/callback
```

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/multisite_cms"

# Auth
JWT_SECRET="super-secret-key"

# AWS (dla deployów)
AWS_REGION="eu-central-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET="multisite-sites-xxx"
CLOUDFRONT_DISTRIBUTION_ID="EXXX"

# CI/CD Webhook
BUILD_WEBHOOK_URL="https://api.github.com/repos/xxx/dispatches"
BUILD_WEBHOOK_SECRET="webhook-secret"
```

## Role użytkowników

| Rola | Uprawnienia |
|------|-------------|
| SUPER_ADMIN | Wszystko - zarządzanie tenantami, użytkownikami |
| ADMIN | Zarządzanie swoim tenantem i użytkownikami |
| EDITOR | Edycja stron swojego tenanta |
| VIEWER | Tylko podgląd |

## Deploy do produkcji

### Docker

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### AWS ECS / Fargate

1. Zbuduj obraz: `docker build -t multisite-cms .`
2. Push do ECR
3. Deploy jako ECS Service

### Vercel / Railway

1. Podłącz repo
2. Ustaw environment variables
3. Deploy

## Troubleshooting

### Błąd połączenia z bazą danych

```bash
# Sprawdź czy PostgreSQL działa
docker compose ps

# Sprawdź logi
docker compose logs db
```

### Prisma nie generuje typów

```bash
npm run db:generate
```

### Reset bazy danych

```bash
npx prisma db push --force-reset
npm run db:seed
```

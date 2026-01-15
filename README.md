# MultiSite System

Kompletny system do hostowania wielu statycznych stron Astro z jednym CMS-em dla wszystkich klientów.

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MULTISITE CMS                                   │
│                         (Next.js + Prisma + PostgreSQL)                      │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │  Klient A   │  │  Klient B   │  │  Klient C   │  ... (multi-tenant)      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                          │
└─────────┼────────────────┼────────────────┼─────────────────────────────────┘
          │                │                │
          │ API + Webhook  │ API + Webhook  │ API + Webhook
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GITHUB ACTIONS (CI/CD)                               │
│                                                                              │
│   1. Pobiera dane z CMS API                                                 │
│   2. Buduje stronę Astro                                                    │
│   3. Deployuje na S3                                                        │
│   4. Invaliduje CloudFront cache                                            │
└─────────────────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AWS INFRASTRUCTURE                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        CloudFront Distribution                        │  │
│  │                     (jedna dla wszystkich domen)                      │  │
│  └───────────────────────────────┬──────────────────────────────────────┘  │
│                                  │                                          │
│  ┌───────────────────────────────▼──────────────────────────────────────┐  │
│  │                         Lambda@Edge                                   │  │
│  │                   (routing na podstawie Host header)                  │  │
│  └───────────────────────────────┬──────────────────────────────────────┘  │
│                                  │                                          │
│  ┌───────────────────────────────▼──────────────────────────────────────┐  │
│  │                           S3 Bucket                                   │  │
│  │                                                                       │  │
│  │   /klient-a.pl/          /klient-b.pl/          /klient-c.pl/        │  │
│  │   ├── index.html         ├── index.html         ├── index.html       │  │
│  │   ├── about/             ├── o-nas/             ├── kontakt/         │  │
│  │   └── _astro/            └── _astro/            └── _astro/          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📦 Komponenty

### 1. AWS Infrastructure (`aws-multisite-infra/`)
Terraform do zarządzania infrastrukturą AWS:
- S3 bucket (storage dla wszystkich stron)
- CloudFront (CDN + HTTPS)
- Lambda@Edge (routing)
- ACM (certyfikaty SSL)

### 2. MultiSite CMS (`multisite-cms/`)
Next.js aplikacja do zarządzania treścią:
- Multi-tenant (wielu klientów, jedna instancja)
- Autentykacja (JWT)
- Rich text editor (TipTap)
- API dla stron Astro
- Triggery deployów

### 3. Astro Template (`astro-client-template/`)
Template strony klienta:
- Pobiera dane z CMS
- Generuje statyczne strony
- Zoptymalizowany pod SEO

### 4. CI/CD (`.github/workflows/`)
GitHub Actions workflow:
- Buduje strony Astro
- Deployuje na S3
- Invaliduje cache

## 🚀 Quick Start

### Krok 1: Deploy infrastruktury AWS

```bash
cd aws-multisite-infra/terraform

# Konfiguracja
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars

# Deploy
terraform init
terraform apply
```

### Krok 2: Uruchom CMS

```bash
cd multisite-cms

# Instalacja
npm install

# Konfiguracja
cp .env.example .env
nano .env  # ustaw DATABASE_URL, JWT_SECRET, AWS_*

# Baza danych
npm run db:push
npm run db:seed

# Start
npm run dev
```

### Krok 3: Dodaj pierwszego klienta

1. Zaloguj się do CMS (admin@example.com / admin123)
2. Dodaj nowego tenanta
3. Skopiuj API Key
4. Skonfiguruj DNS (CNAME → CloudFront)

### Krok 4: Deploy strony

```bash
cd astro-client-template

# Konfiguracja
cp .env.example .env
nano .env  # ustaw CMS_URL, CMS_API_KEY, SITE_URL

# Build
npm install
npm run build

# Deploy (ręcznie lub przez CMS)
aws s3 sync ./dist s3://BUCKET/domena.pl/ --delete
```

## 💰 Koszty

| Usługa | Szacunkowy koszt/mies. |
|--------|------------------------|
| S3 | ~$1-5 |
| CloudFront | ~$1-10 |
| Lambda@Edge | ~$0.50-2 |
| RDS PostgreSQL (CMS) | ~$15-30 |
| EC2/Fargate (CMS) | ~$15-50 |
| **Łącznie** | **~$30-100** |

Dla 10-50 małych stron. Koszty skalują się z ruchem.

## 📋 Workflow dodawania klienta

1. **W CMS**: Dodaj nowego tenanta, skopiuj API Key
2. **W Terraform**: Dodaj domenę do `client_domains`, uruchom `terraform apply`
3. **DNS**: Dodaj CNAME wskazujący na CloudFront
4. **Certyfikat**: Poczekaj na walidację (~5-30 min)
5. **Deploy**: Kliknij "Deploy" w CMS lub uruchom workflow

## 🔒 Bezpieczeństwo

- S3 bucket prywatny (dostęp tylko przez CloudFront OAC)
- HTTPS wymuszony (redirect z HTTP)
- Security headers (Lambda@Edge)
- JWT autentykacja w CMS
- API Keys per tenant

## 📚 Dokumentacja

- [Infrastruktura AWS](./aws-multisite-infra/docs/README.md)
- [CMS](./multisite-cms/README.md)
- [Astro Template](./astro-client-template/README.md)

## 🛠️ Troubleshooting

### Strona zwraca 403/404
- Sprawdź czy folder klienta istnieje w S3
- Sprawdź logi Lambda@Edge w CloudWatch

### SSL nie działa
- Sprawdź status certyfikatu w ACM (us-east-1)
- Upewnij się, że rekordy DNS walidacji są dodane

### Deploy nie działa
- Sprawdź GitHub Actions logs
- Sprawdź czy webhook secret jest poprawny

---

Stworzony z 💙 dla efektywnego zarządzania wieloma stronami.

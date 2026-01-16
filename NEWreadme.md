# Mega CMS - Multi-tenant System do zarządzania stronami statycznymi

## Spis treści

1. [Przegląd systemu](#przegląd-systemu)
2. [Architektura](#architektura)
3. [Wymagania](#wymagania)
4. [Instalacja lokalna](#instalacja-lokalna)
5. [Wdrożenie na EC2](#wdrożenie-na-ec2)
6. [Konfiguracja domen](#konfiguracja-domen)
7. [Zarządzanie tenantami](#zarządzanie-tenantami)
8. [Dodawanie nowych sekcji (np. Aktualności)](#dodawanie-nowych-sekcji)
9. [Workflow deployu](#workflow-deployu)
10. [Rozwiązywanie problemów](#rozwiązywanie-problemów)

---

## Przegląd systemu

Mega CMS to wielodostępny (multi-tenant) system zarządzania treścią dla statycznych stron Astro. Pozwala zarządzać wieloma stronami klientów z jednego panelu administracyjnego.

### Główne funkcje

- **Jeden CMS, wielu klientów** - każdy klient (tenant) ma własną domenę i treści
- **Statyczne strony Astro** - szybkie, bezpieczne, tanie w hostingu
- **Automatyczny deploy** - zmiany w CMS automatycznie budują i publikują stronę
- **Hosting na AWS** - S3 + CloudFront dla niskich kosztów i wysokiej wydajności

---

## Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MEGA CMS (Next.js)                           │
│                   https://cms.twojadomena.pl                        │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │   Klient A   │  │   Klient B   │  │   Klient C   │   ...       │
│   │ uniatorun.pl │  │ firma-xyz.pl │  │ sklep-abc.pl │             │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└──────────┼─────────────────┼─────────────────┼──────────────────────┘
           │                 │                 │
           │ GitHub Actions  │ GitHub Actions  │ GitHub Actions
           │ (workflow_dispatch)               │
           ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GitHub Repository                              │
│              (repo per klient lub monorepo)                         │
│                                                                     │
│   1. Pobierz dane z CMS API                                         │
│   2. npm run build (Astro)                                          │
│   3. aws s3 sync → S3                                               │
│   4. aws cloudfront create-invalidation                             │
└─────────────────────────────────────────────────────────────────────┘
           │                 │                 │
           ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Infrastructure                          │
│                                                                     │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│   │     S3      │    │  CloudFront │    │   Route 53  │            │
│   │   Bucket    │───▶│   (CDN)     │◀───│    (DNS)    │            │
│   │  (pliki)    │    │  (HTTPS)    │    │  (domeny)   │            │
│   └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                     │
│   Koszt: ~$1-5/miesiąc per strona                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Przepływ danych

1. **Edytor** dodaje/edytuje treść w CMS
2. Kliknięcie "Zapisz i opublikuj" → CMS wywołuje GitHub Actions
3. GitHub Actions:
   - Pobiera dane z CMS API (aktualności, strony)
   - Buduje stronę Astro (`npm run build`)
   - Synchronizuje pliki do S3
   - Invaliduje cache CloudFront
4. Strona jest dostępna pod domeną klienta

---

## Wymagania

### Lokalne środowisko

- Node.js 18+
- npm lub yarn
- Git
- AWS CLI (skonfigurowany)

### AWS

- Konto AWS z dostępem do:
  - S3
  - CloudFront
  - Route 53 (opcjonalnie)
  - ACM (certyfikaty SSL)
  - EC2 (dla CMS)

### GitHub

- Repozytorium dla każdej strony klienta
- Personal Access Token z uprawnieniami `repo` i `workflow`

---

## Instalacja lokalna

### 1. Klonowanie repozytorium

```bash
git clone https://github.com/TwojeRepo/mega-cms.git
cd mega-cms
```

### 2. Instalacja zależności CMS

```bash
cd multisite-cms
npm install
```

### 3. Konfiguracja środowiska

Utwórz plik `.env` w `multisite-cms/`:

```env
# Baza danych
DATABASE_URL="file:./prisma/dev.db"

# Autentykacja
JWT_SECRET="twoj-tajny-klucz-min-32-znaki"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="silne-haslo-123"

# GitHub (do automatycznego deployu)
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
GITHUB_REPO="TwojeKonto/nazwa-repo"

# AWS (opcjonalnie, do uploadu mediów)
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="eu-central-1"

# Publiczny URL CMS (dla stron Astro)
CMS_PUBLIC_URL="https://cms.twojadomena.pl"
```

### 4. Inicjalizacja bazy danych

```bash
npx prisma generate
npx prisma db push
```

### 5. Uruchomienie CMS

```bash
npm run dev
```

CMS dostępny pod: http://localhost:3000

### 6. Konfiguracja ngrok (dla testów z GitHub Actions)

```bash
# Instalacja ngrok
# https://ngrok.com/download

# Uruchomienie tunelu
ngrok http 3000
```

---

## Wdrożenie na EC2

### 1. Sprawdzenie istniejących instancji

```bash
# Lista instancji EU-CENTRAL-1
aws ec2 describe-instances \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name,Tags[?Key==`Name`].Value|[0],PublicIpAddress]' \
  --output table \
  --region eu-central-1

# Sprawdź wykorzystanie CPU
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=INSTANCE_ID \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Average \
  --region eu-central-1
```

### 2. Połączenie z instancją

```bash
ssh -i ~/.ssh/maturapolski-key.pem ec2-user@3.68.187.152
```

### 3. Instalacja zależności na EC2

```bash
# Aktualizacja systemu
sudo yum update -y

# Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# PM2 (process manager)
sudo npm install -g pm2

# Git
sudo yum install -y git
```

### 4. Klonowanie i konfiguracja

```bash
cd /home/ec2-user
git clone https://github.com/TwojeRepo/mega-cms.git
cd mega-cms/multisite-cms

npm install
cp .env.example .env
nano .env  # edytuj konfigurację
```

### 5. Build i uruchomienie

```bash
# Build produkcyjny
npm run build

# Uruchomienie przez PM2
pm2 start npm --name "mega-cms" -- start
pm2 save
pm2 startup  # auto-start po restarcie
```

### 6. Konfiguracja Nginx (reverse proxy)

```bash
sudo yum install -y nginx
sudo nano /etc/nginx/conf.d/mega-cms.conf
```

```nginx
server {
    listen 80;
    server_name cms.twojadomena.pl;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 7. SSL z Let's Encrypt

```bash
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cms.twojadomena.pl
```

---

## Konfiguracja domen

### Dla strony klienta (S3 + CloudFront)

#### 1. Utwórz bucket S3

```bash
aws s3 mb s3://www.klient-domain.pl --region eu-central-1

# Włącz hosting statyczny
aws s3 website s3://www.klient-domain.pl \
  --index-document index.html \
  --error-document 404.html
```

#### 2. Utwórz certyfikat SSL (ACM) - MUSI być w us-east-1!

```bash
aws acm request-certificate \
  --domain-name "klient-domain.pl" \
  --subject-alternative-names "www.klient-domain.pl" \
  --validation-method DNS \
  --region us-east-1
```

#### 3. Utwórz dystrybucję CloudFront

```bash
aws cloudfront create-distribution \
  --origin-domain-name www.klient-domain.pl.s3.eu-central-1.amazonaws.com \
  --default-root-object index.html
```

#### 4. Skonfiguruj DNS (Route 53 lub zewnętrzny)

```
# Dla www
CNAME  www.klient-domain.pl  →  dxxxxxx.cloudfront.net

# Dla apex (klient-domain.pl bez www)
# Użyj Route 53 Alias lub przekierowania
```

### Dla CMS (EC2)

```
# A record lub CNAME
A      cms.twojadomena.pl  →  3.68.187.152
# lub
CNAME  cms.twojadomena.pl  →  ec2-3-68-187-152.eu-central-1.compute.amazonaws.com
```

---

## Zarządzanie tenantami

### Dodawanie nowego klienta w CMS

1. Zaloguj się do CMS jako admin
2. Dashboard → "Dodaj nowego klienta"
3. Wypełnij:
   - **Nazwa**: Unia Toruń
   - **Domena**: uniatorun.pl
   - **Kolor główny**: #3b82f6
4. Zapisz - system automatycznie:
   - Wygeneruje API key
   - Utworzy stronę główną

### Konfiguracja repozytorium GitHub dla nowego klienta

#### 1. Utwórz nowe repo lub skopiuj template

```bash
# Opcja A: Nowe repo z template
gh repo create klient-xyz --template TwojeKonto/astro-client-template

# Opcja B: Sklonuj i zmodyfikuj
git clone https://github.com/TwojeKonto/uniatorun.pl.git klient-xyz
cd klient-xyz
rm -rf .git
git init
git remote add origin https://github.com/TwojeKonto/klient-xyz.git
```

#### 2. Skonfiguruj zmienne środowiskowe

W `.env` strony Astro:

```env
CMS_URL=https://cms.twojadomena.pl
CMS_API_KEY=sk_xxxxxxxxxxxxxxxxxx
SITE_URL=https://www.klient-xyz.pl
```

#### 3. Dodaj GitHub Secrets

```bash
# W ustawieniach repo → Secrets → Actions
CMS_URL=https://cms.twojadomena.pl
CMS_API_KEY=sk_xxxxxxxxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

#### 4. Skonfiguruj workflow `.github/workflows/deploy.yml`

```yaml
name: Deploy Site

on:
  workflow_dispatch:
    inputs:
      reason:
        description: "Powód deployu"
        required: false
        default: "Manual deploy"

env:
  S3_BUCKET: www.klient-xyz.pl
  CLOUDFRONT_DISTRIBUTION_ID: EXXXXXXXXX
  AWS_REGION: eu-central-1

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm install

      - name: Create .env
        run: |
          echo "CMS_URL=${{ secrets.CMS_URL }}" >> .env
          echo "CMS_API_KEY=${{ secrets.CMS_API_KEY }}" >> .env
          echo "SITE_URL=https://www.klient-xyz.pl" >> .env

      - run: npm run build

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to S3
        run: aws s3 sync ./dist s3://${{ env.S3_BUCKET }} --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## Dodawanie nowych sekcji

Przykład: dodanie sekcji "Aktualności" do istniejącej strony.

### 1. Rozszerzenie CMS (już zrobione w Mega CMS)

Aktualności są przechowywane jako strony z `template: "news"`.

### 2. Dodanie API w CMS

Plik: `src/app/api/public/news/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");

  const tenant = await prisma.tenant.findUnique({
    where: { apiKey },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const news = await prisma.page.findMany({
    where: {
      tenantId: tenant.id,
      template: "news",
      status: "PUBLISHED",
    },
    orderBy: { publishedAt: "desc" },
  });

  return NextResponse.json({ news });
}
```

### 3. Dodanie klienta API w Astro

Plik: `src/lib/cms.ts`

```typescript
const CMS_URL = import.meta.env.CMS_URL;
const CMS_API_KEY = import.meta.env.CMS_API_KEY;

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  content: string;
  author: string;
  publishedAt: string;
}

export async function getNews(limit = 20): Promise<NewsItem[]> {
  try {
    const response = await fetch(`${CMS_URL}/api/public/news?limit=${limit}`, {
      headers: { "x-api-key": CMS_API_KEY },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.news) ? data.news : [];
  } catch {
    return [];
  }
}

export async function getNewsBySlug(slug: string): Promise<NewsItem | null> {
  try {
    const response = await fetch(`${CMS_URL}/api/public/news?slug=${slug}`, {
      headers: { "x-api-key": CMS_API_KEY },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.news;
  } catch {
    return null;
  }
}
```

### 4. Dodanie stron w Astro

#### Lista aktualności: `src/pages/aktualnosci/index.astro`

```astro
---
import Layout from '@/layouts/Layout.astro';
import { getNews } from '@/lib/cms';

const news = await getNews(20);
---

<Layout title="Aktualności">
  <h1>Aktualności</h1>

  <div class="news-grid">
    {news.map((item) => (
      <article>
        {item.image && <img src={item.image} alt={item.title} />}
        <h2><a href={`/aktualnosci/${item.slug}`}>{item.title}</a></h2>
        <p>{item.excerpt}</p>
        <time>{new Date(item.publishedAt).toLocaleDateString('pl-PL')}</time>
      </article>
    ))}
  </div>
</Layout>
```

#### Pojedyncza aktualność: `src/pages/aktualnosci/[slug].astro`

```astro
---
import Layout from '@/layouts/Layout.astro';
import { getNews, getNewsBySlug } from '@/lib/cms';

export async function getStaticPaths() {
  const news = await getNews(100);

  if (!news || news.length === 0) {
    return [];
  }

  return news.map((item) => ({
    params: { slug: item.slug },
    props: { news: item },
  }));
}

const { news } = Astro.props;
const article = news || await getNewsBySlug(Astro.params.slug);

if (!article) {
  return Astro.redirect('/aktualnosci');
}
---

<Layout title={article.title}>
  <article>
    {article.image && <img src={article.image} alt={article.title} />}
    <h1>{article.title}</h1>
    <time>{new Date(article.publishedAt).toLocaleDateString('pl-PL')}</time>
    <div set:html={article.content} />
  </article>
</Layout>
```

### 5. Konfiguracja Astro dla zmiennych środowiskowych

Plik: `astro.config.mjs`

```javascript
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.klient-domain.pl",
  output: "static",
  vite: {
    define: {
      "import.meta.env.CMS_URL": JSON.stringify(
        process.env.CMS_URL || "http://localhost:3000"
      ),
      "import.meta.env.CMS_API_KEY": JSON.stringify(
        process.env.CMS_API_KEY || ""
      ),
    },
  },
});
```

---

## Workflow deployu

### Automatyczny deploy z CMS

1. Edytor dodaje/edytuje aktualność w CMS
2. Klika "Zapisz i opublikuj"
3. CMS wywołuje GitHub Actions API:
   ```
   POST https://api.github.com/repos/OWNER/REPO/actions/workflows/deploy.yml/dispatches
   ```
4. GitHub Actions buduje stronę i wrzuca na S3
5. CloudFront invaliduje cache
6. Strona jest aktualna

### Ręczny deploy

```bash
# Z GitHub Actions UI
# Idź do: Actions → Deploy Site → Run workflow

# Lub przez API
curl -X POST \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/deploy.yml/dispatches \
  -d '{"ref":"main"}'
```

### Lokalny deploy (development)

```bash
cd strona-klienta

# Ustaw zmienne
export CMS_URL=https://cms.twojadomena.pl
export CMS_API_KEY=sk_xxxxxxxxxx

# Build
npm run build

# Podgląd lokalny
npm run preview

# Ręczny upload do S3
aws s3 sync ./dist s3://www.klient-domain.pl --delete
aws cloudfront create-invalidation --distribution-id EXXXXXXXXX --paths "/*"
```

---

## Rozwiązywanie problemów

### CMS nie uruchamia GitHub Actions

**Sprawdź logi CMS:**

```
GitHub config: { hasToken: true, repo: 'Owner/Repo' }
Calling GitHub API: https://api.github.com/repos/...
GitHub API response: 204
```

**Jeśli `hasToken: false`:**

- Sprawdź `.env` - czy `GITHUB_TOKEN` jest ustawiony
- Restart CMS: `pm2 restart mega-cms`

**Jeśli response ≠ 204:**

- Sprawdź czy token ma uprawnienia `repo` i `workflow`
- Sprawdź czy nazwa repo jest poprawna (Owner/Repo)

### Build strony Astro zawodzi

**Błąd: CMS API error 502**

- CMS nie jest dostępny (sprawdź czy działa)
- ngrok nie działa (dla lokalnego testowania)
- Zły URL w GitHub Secrets

**Błąd: Cannot find module @rollup/rollup-linux-x64-gnu**

- Usuń `package-lock.json` z repo
- Użyj `npm install` zamiast `npm ci` w workflow

**Błąd sitemap reduce**

- Usuń konfigurację i18n z sitemap lub cały plugin sitemap

### CloudFront nie pokazuje nowej wersji

```bash
# Ręczna invalidacja
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXX \
  --paths "/*"

# Sprawdź status invalidacji
aws cloudfront list-invalidations --distribution-id EXXXXXXXXX
```

### Problemy z SSL/HTTPS

**Certyfikat nie działa:**

- Certyfikat ACM dla CloudFront MUSI być w `us-east-1`
- Sprawdź czy domena jest zwalidowana w ACM

```bash
aws acm list-certificates --region us-east-1
```

### Debugowanie połączenia CMS ↔ Astro

```bash
# Test API z curl
curl -H "x-api-key: sk_xxxxxxxxxx" \
  https://cms.twojadomena.pl/api/public/news

# Powinno zwrócić JSON z aktualnościami
```

---

## Koszty AWS (szacunkowe)

| Usługa                     | Koszt/miesiąc |
| -------------------------- | ------------- |
| S3 (1 strona, <1GB)        | ~$0.03        |
| CloudFront (10k req/dzień) | ~$1-3         |
| Route 53 (hosted zone)     | $0.50         |
| EC2 t3.small (CMS)         | ~$15-20       |
| **Razem (1 strona)**       | **~$2-5**     |
| **Razem (10 stron + CMS)** | **~$35-50**   |

---

## Wsparcie

- **Repozytorium**: https://github.com/TwojeKonto/mega-cms
- **Dokumentacja Astro**: https://docs.astro.build
- **AWS CLI Reference**: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/index.html

---

_Ostatnia aktualizacja: Styczeń 2026_

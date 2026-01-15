# AWS Multi-Site Static Hosting Infrastructure

System do hostowania wielu statycznych stron (Astro) na jednej infrastrukturze AWS.

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KONFIGURACJA DNS                                 │
│                                                                          │
│   klient-a.pl  ──┐                                                       │
│   klient-b.pl  ──┼──►  CNAME  ──►  d123abc.cloudfront.net               │
│   firma-xyz.com ─┘                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CloudFront Distribution                           │
│                                                                          │
│   • Jeden endpoint dla wszystkich domen                                  │
│   • SSL/TLS (ACM Certificate)                                           │
│   • Edge caching (PriceClass_100: EU + NA)                              │
│   • Kompresja Gzip/Brotli                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Lambda@Edge (Origin Request)                      │
│                                                                          │
│   Request: GET https://klient-a.pl/about                                │
│   Host header: klient-a.pl                                              │
│                      │                                                   │
│                      ▼                                                   │
│   Rewritten: GET s3://bucket/klient-a.pl/about/index.html               │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           S3 Bucket                                      │
│                                                                          │
│   multisite-sites-123456789/                                            │
│   ├── klient-a.pl/                                                      │
│   │   ├── index.html                                                    │
│   │   ├── about/index.html                                              │
│   │   ├── _astro/                                                       │
│   │   └── ...                                                           │
│   ├── klient-b.pl/                                                      │
│   │   └── ...                                                           │
│   └── firma-xyz.com/                                                    │
│       └── ...                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📋 Wymagania

- **AWS CLI** skonfigurowane z odpowiednimi uprawnieniami
- **Terraform** >= 1.0.0
- **jq** (do skryptów pomocniczych)

## 🚀 Quick Start

### 1. Konfiguracja początkowa

```bash
cd terraform

# Skopiuj przykładowy plik konfiguracji
cp terraform.tfvars.example terraform.tfvars

# Edytuj konfigurację
nano terraform.tfvars
```

### 2. Inicjalizacja i deploy

```bash
# Inicjalizacja Terraform
terraform init

# Sprawdź plan
terraform plan

# Zastosuj zmiany
terraform apply
```

### 3. Konfiguracja DNS

Po `terraform apply` otrzymasz:
- Domenę CloudFront (np. `d123abc.cloudfront.net`)
- Rekordy DNS do walidacji certyfikatu SSL

Dodaj u rejestratora domeny:
1. **Rekordy walidacji certyfikatu** (CNAME) - jednorazowo
2. **CNAME dla każdej domeny klienta** → `dXXX.cloudfront.net`

### 4. Deploy pierwszej strony

```bash
# Zbuduj stronę Astro
cd /path/to/astro-site
npm run build

# Deploy
../scripts/deploy-site.sh klient-a.pl ./dist
```

## 📁 Struktura projektu

```
aws-multisite-infra/
├── terraform/
│   ├── main.tf                 # Provider i konfiguracja
│   ├── variables.tf            # Zmienne (w tym lista klientów)
│   ├── outputs.tf              # Outputy (DNS, instrukcje)
│   ├── s3.tf                   # Bucket S3
│   ├── cloudfront.tf           # Dystrybucja CloudFront
│   ├── lambda-edge.tf          # Lambda@Edge do routingu
│   └── terraform.tfvars.example
├── scripts/
│   ├── add-client.sh           # Pomocnik dodawania klienta
│   └── deploy-site.sh          # Deploy strony na S3
└── docs/
    └── README.md
```

## 👥 Dodawanie nowego klienta

### Metoda 1: Ręczna edycja

1. Edytuj `terraform/terraform.tfvars`:

```hcl
client_domains = {
  # ... istniejący klienci ...
  
  nowy-klient = {
    domain         = "nowy-klient.pl"
    aliases        = ["www.nowy-klient.pl"]
    enabled        = true
    index_document = "index.html"
    error_document = "404.html"
  }
}
```

2. Zastosuj zmiany:

```bash
terraform plan
terraform apply
```

3. Skonfiguruj DNS (CNAME)

4. Poczekaj na walidację SSL (~5-30 min)

5. Upload strony:

```bash
./scripts/deploy-site.sh nowy-klient.pl /path/to/dist
```

### Metoda 2: Skrypt pomocniczy

```bash
./scripts/add-client.sh nowy-klient.pl www.nowy-klient.pl
# Postępuj zgodnie z instrukcjami
```

## 🔄 Workflow deployu strony

```bash
# 1. Zbuduj stronę Astro
cd /path/to/klient-site
npm run build

# 2. Deploy (sync + invalidacja cache)
/path/to/scripts/deploy-site.sh klient-a.pl ./dist

# Opcjonalnie: bez invalidacji (szybciej, ale cache stary przez 24h)
/path/to/scripts/deploy-site.sh klient-a.pl ./dist --no-invalidate
```

## 💰 Szacunkowe koszty (miesięcznie)

| Usługa | Koszt | Uwagi |
|--------|-------|-------|
| S3 | ~$0.50-2 | Zależy od rozmiaru stron |
| CloudFront | ~$1-5 | 1TB transfer w free tier |
| Lambda@Edge | ~$0.50-1 | Pay per request |
| ACM | $0 | Certyfikaty są darmowe |
| **Razem** | **~$2-10** | Dla 10-20 małych stron |

## 🔧 Troubleshooting

### Strona zwraca 403

- Sprawdź czy folder klienta istnieje w S3: `aws s3 ls s3://bucket-name/domena.pl/`
- Sprawdź policy S3 (CloudFront OAC)
- Sprawdź logi Lambda@Edge w CloudWatch (region edge)

### SSL nie działa

- Sprawdź status certyfikatu w AWS Console → ACM (us-east-1!)
- Upewnij się, że rekordy walidacji DNS są dodane
- Certyfikat musi być ISSUED, nie PENDING_VALIDATION

### Stare pliki po deployu

```bash
# Wymuś invalidację cache
aws cloudfront create-invalidation \
  --distribution-id XXXXX \
  --paths "/*"
```

### Strona nie aktualizuje się

- Sprawdź czy `terraform apply` zakończone
- Sprawdź czy deploy zakończony
- Wyczyść cache przeglądarki lub sprawdź w trybie incognito

## 🔒 Bezpieczeństwo

- S3 bucket jest prywatny (dostęp tylko przez CloudFront OAC)
- Wszystkie połączenia HTTPS (redirect z HTTP)
- Security headers dodawane przez Lambda@Edge:
  - Strict-Transport-Security
  - X-Content-Type-Options
  - X-Frame-Options
  - X-XSS-Protection
  - Referrer-Policy

## 📚 Następne kroki

Po wdrożeniu podstawowej infrastruktury, możesz dodać:

1. **CMS** - Panel do zarządzania treścią (osobny projekt)
2. **CI/CD** - Automatyczny deploy po pushu do repo
3. **Monitoring** - CloudWatch alerty, uptime monitoring
4. **Backup** - Replikacja S3 do innego regionu

---

*Infrastruktura stworzona z pomocą Claude AI*

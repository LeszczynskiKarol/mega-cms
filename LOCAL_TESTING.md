# Lokalne Testowanie - Bez Dockera

Jeśli nie chcesz używać Dockera, możesz uruchomić wszystko bezpośrednio na systemie.

## Opcja 1: Z SQLite (najprościej)

Zmień provider w `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

Potem:

```bash
cd multisite-cms

# Instalacja
npm install

# Konfiguracja
cat > .env << 'EOF'
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="local-dev-secret"
ADMIN_EMAIL="admin@localhost"
ADMIN_PASSWORD="admin123"
EOF

# Baza + seed
npx prisma db push
npm run db:seed

# Start
npm run dev
```

CMS będzie na http://localhost:3000

## Opcja 2: Z lokalnym PostgreSQL

```bash
# Jeśli masz PostgreSQL zainstalowany:
createdb multisite_cms

cd multisite-cms

# Instalacja
npm install

# Konfiguracja
cat > .env << 'EOF'
DATABASE_URL="postgresql://localhost:5432/multisite_cms"
JWT_SECRET="local-dev-secret"
ADMIN_EMAIL="admin@localhost"
ADMIN_PASSWORD="admin123"
EOF

# Baza + seed
npx prisma db push
npm run db:seed

# Start
npm run dev
```

## Testowanie Astro

Po uruchomieniu CMS:

```bash
cd astro-client-template

# Konfiguracja
cat > .env << 'EOF'
CMS_URL="http://localhost:3000"
CMS_API_KEY="SKOPIUJ_Z_PANELU_CMS"
SITE_URL="http://localhost:4321"
EOF

# Instalacja i start
npm install
npm run dev
```

Astro będzie na http://localhost:4321

## Pełny flow testowy

1. **Uruchom CMS** (port 3000)
2. **Zaloguj się**: admin@localhost / admin123
3. **Wejdź w Demo Site** - zobaczysz 3 przykładowe strony
4. **Skopiuj API Key** z panelu tenanta
5. **Wklej do Astro** `.env` jako `CMS_API_KEY`
6. **Uruchom Astro** (port 4321)
7. **Otwórz http://localhost:4321** - zobaczysz stronę z treścią z CMS
8. **Edytuj stronę w CMS** → odśwież Astro → zobaczysz zmiany

## Symulacja deployu

Lokalnie nie masz AWS, ale możesz zasymulować build:

```bash
cd astro-client-template
npm run build

# Sprawdź output
ls -la dist/
```

Folder `dist/` to jest dokładnie to co poszłoby na S3.

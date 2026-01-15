#!/bin/bash
# =============================================================================
# add-client.sh - Skrypt do dodawania nowego klienta
# =============================================================================
# Użycie: ./add-client.sh domena.pl [www.domena.pl]
# =============================================================================

set -e

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ścieżki
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"
VARIABLES_FILE="$TERRAFORM_DIR/variables.tf"

# Walidacja argumentów
if [ -z "$1" ]; then
    echo -e "${RED}Błąd: Podaj domenę klienta${NC}"
    echo "Użycie: $0 domena.pl [alias1.pl alias2.pl ...]"
    exit 1
fi

DOMAIN="$1"
shift
ALIASES=("$@")

# Generuj identyfikator (slug)
SLUG=$(echo "$DOMAIN" | sed 's/\./-/g' | tr '[:upper:]' '[:lower:]')

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Dodawanie nowego klienta: ${GREEN}$DOMAIN${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Sprawdź czy klient już istnieje
if grep -q "\"$SLUG\"" "$VARIABLES_FILE" 2>/dev/null; then
    echo -e "${YELLOW}Uwaga: Klient '$SLUG' może już istnieć w konfiguracji${NC}"
    read -p "Kontynuować? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Przygotuj listę aliasów
ALIASES_JSON="[]"
if [ ${#ALIASES[@]} -gt 0 ]; then
    ALIASES_JSON=$(printf '%s\n' "${ALIASES[@]}" | jq -R . | jq -s .)
fi

# Wyświetl konfigurację
echo -e "${YELLOW}Konfiguracja do dodania:${NC}"
echo ""
cat << EOF
    $SLUG = {
      domain         = "$DOMAIN"
      aliases        = $ALIASES_JSON
      enabled        = true
      index_document = "index.html"
      error_document = "404.html"
    }
EOF
echo ""

# Potwierdź
read -p "Dodać tę konfigurację? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Anulowano."
    exit 0
fi

# Utwórz backup
cp "$VARIABLES_FILE" "$VARIABLES_FILE.bak"
echo -e "${GREEN}✓ Utworzono backup: $VARIABLES_FILE.bak${NC}"

# Dodaj konfigurację klienta do variables.tf
# Szukamy ostatniego "}" przed zamknięciem default = { ... }
# To jest uproszczone - w produkcji lepiej użyć narzędzia do edycji HCL

echo ""
echo -e "${YELLOW}UWAGA: Automatyczna edycja variables.tf może nie działać poprawnie.${NC}"
echo -e "${YELLOW}Ręcznie dodaj poniższą konfigurację do sekcji 'client_domains' w variables.tf:${NC}"
echo ""
cat << EOF
    $SLUG = {
      domain         = "$DOMAIN"
      aliases        = $ALIASES_JSON
      enabled        = true
      index_document = "index.html"
      error_document = "404.html"
    }
EOF
echo ""

# Następne kroki
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}Następne kroki:${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "1. Edytuj $VARIABLES_FILE i dodaj konfigurację powyżej"
echo ""
echo "2. Uruchom Terraform:"
echo -e "   ${YELLOW}cd $TERRAFORM_DIR${NC}"
echo -e "   ${YELLOW}terraform plan${NC}"
echo -e "   ${YELLOW}terraform apply${NC}"
echo ""
echo "3. Skonfiguruj DNS u rejestratora domeny (CNAME):"
echo "   Po terraform apply zobaczysz domenę CloudFront do użycia"
echo ""
echo "4. Poczekaj na walidację certyfikatu SSL (~5-30 min)"
echo ""
echo "5. Upload strony (po zbudowaniu Astro):"
echo -e "   ${YELLOW}./deploy-site.sh $DOMAIN ./dist${NC}"
echo ""

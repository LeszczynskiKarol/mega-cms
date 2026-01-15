#!/bin/bash
# =============================================================================
# deploy-site.sh - Skrypt do deployu strony klienta na S3 + CloudFront
# =============================================================================
# Użycie: ./deploy-site.sh domena.pl /sciezka/do/dist [--no-invalidate]
# =============================================================================

set -e

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ścieżki
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

# Argumenty
DOMAIN="$1"
DIST_PATH="$2"
NO_INVALIDATE="$3"

# Walidacja
if [ -z "$DOMAIN" ] || [ -z "$DIST_PATH" ]; then
    echo -e "${RED}Błąd: Podaj domenę i ścieżkę do plików${NC}"
    echo "Użycie: $0 domena.pl /sciezka/do/dist [--no-invalidate]"
    echo ""
    echo "Przykład:"
    echo "  $0 klient-a.pl ./dist"
    echo "  $0 klient-a.pl ./dist --no-invalidate"
    exit 1
fi

if [ ! -d "$DIST_PATH" ]; then
    echo -e "${RED}Błąd: Katalog '$DIST_PATH' nie istnieje${NC}"
    exit 1
fi

# Pobierz konfigurację z Terraform
echo -e "${BLUE}Pobieranie konfiguracji z Terraform...${NC}"
cd "$TERRAFORM_DIR"

S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
CF_DISTRIBUTION=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")

if [ -z "$S3_BUCKET" ] || [ -z "$CF_DISTRIBUTION" ]; then
    echo -e "${RED}Błąd: Nie można pobrać konfiguracji z Terraform${NC}"
    echo "Upewnij się, że uruchomiono 'terraform apply'"
    exit 1
fi

echo -e "${GREEN}✓ S3 Bucket: $S3_BUCKET${NC}"
echo -e "${GREEN}✓ CloudFront Distribution: $CF_DISTRIBUTION${NC}"
echo ""

# Potwierdzenie
echo -e "${YELLOW}Deploy strony:${NC}"
echo "  Domena:  $DOMAIN"
echo "  Źródło:  $DIST_PATH"
echo "  Cel:     s3://$S3_BUCKET/$DOMAIN/"
echo ""
read -p "Kontynuować? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Anulowano."
    exit 0
fi

# Sync do S3
echo ""
echo -e "${BLUE}Uploading files to S3...${NC}"
aws s3 sync "$DIST_PATH" "s3://$S3_BUCKET/$DOMAIN/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "*.xml" \
    --exclude "*.json"

# HTML i inne dynamiczne pliki z krótszym cache
aws s3 sync "$DIST_PATH" "s3://$S3_BUCKET/$DOMAIN/" \
    --cache-control "public, max-age=0, must-revalidate" \
    --exclude "*" \
    --include "*.html" \
    --include "*.xml" \
    --include "*.json"

echo -e "${GREEN}✓ Pliki przesłane do S3${NC}"

# Invalidacja CloudFront
if [ "$NO_INVALIDATE" != "--no-invalidate" ]; then
    echo ""
    echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
    
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$CF_DISTRIBUTION" \
        --paths "/$DOMAIN/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    echo -e "${GREEN}✓ Invalidacja utworzona: $INVALIDATION_ID${NC}"
    
    # Opcjonalnie czekaj na zakończenie
    echo -e "${YELLOW}Czekanie na zakończenie invalidacji (może potrwać 1-5 min)...${NC}"
    aws cloudfront wait invalidation-completed \
        --distribution-id "$CF_DISTRIBUTION" \
        --id "$INVALIDATION_ID"
    
    echo -e "${GREEN}✓ Invalidacja zakończona${NC}"
else
    echo -e "${YELLOW}Pominięto invalidację cache (--no-invalidate)${NC}"
fi

# Podsumowanie
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}✓ Deploy zakończony pomyślnie!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "Strona dostępna pod: ${GREEN}https://$DOMAIN${NC}"
echo ""
echo "Jeśli strona nie działa, sprawdź:"
echo "  1. Czy DNS (CNAME) wskazuje na CloudFront"
echo "  2. Czy certyfikat SSL jest zwalidowany"
echo "  3. Logi Lambda@Edge w CloudWatch (region edge, np. us-east-1)"
echo ""

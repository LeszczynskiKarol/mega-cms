#!/bin/bash
# =============================================================================
# status.sh - Sprawdź status infrastruktury
# =============================================================================

set -e

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Status infrastruktury Multi-Site${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

cd "$TERRAFORM_DIR"

# Sprawdź Terraform state
if [ ! -f "terraform.tfstate" ] && [ ! -d ".terraform" ]; then
    echo -e "${YELLOW}⚠ Terraform nie został zainicjalizowany${NC}"
    echo "  Uruchom: terraform init"
    exit 1
fi

# Pobierz outputy
echo -e "${BLUE}Pobieranie konfiguracji...${NC}"
echo ""

S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
CF_DISTRIBUTION=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
CF_DOMAIN=$(terraform output -raw cloudfront_domain_name 2>/dev/null || echo "")

if [ -z "$S3_BUCKET" ]; then
    echo -e "${YELLOW}⚠ Infrastruktura nie została wdrożona${NC}"
    echo "  Uruchom: terraform apply"
    exit 1
fi

echo -e "${GREEN}✓ S3 Bucket:${NC} $S3_BUCKET"
echo -e "${GREEN}✓ CloudFront ID:${NC} $CF_DISTRIBUTION"
echo -e "${GREEN}✓ CloudFront Domain:${NC} $CF_DOMAIN"
echo ""

# Lista klientów
echo -e "${BLUE}Aktywne domeny:${NC}"
terraform output -json active_domains 2>/dev/null | jq -r '.[]' | while read domain; do
    # Sprawdź czy folder istnieje w S3
    if aws s3 ls "s3://$S3_BUCKET/$domain/" &>/dev/null; then
        FILE_COUNT=$(aws s3 ls "s3://$S3_BUCKET/$domain/" --recursive | wc -l)
        echo -e "  ${GREEN}✓${NC} $domain (${FILE_COUNT} plików)"
    else
        echo -e "  ${YELLOW}○${NC} $domain (pusty)"
    fi
done

echo ""

# Status CloudFront
echo -e "${BLUE}Status CloudFront:${NC}"
CF_STATUS=$(aws cloudfront get-distribution --id "$CF_DISTRIBUTION" --query 'Distribution.Status' --output text 2>/dev/null || echo "Unknown")
if [ "$CF_STATUS" == "Deployed" ]; then
    echo -e "  ${GREEN}✓${NC} Distribution: $CF_STATUS"
else
    echo -e "  ${YELLOW}○${NC} Distribution: $CF_STATUS"
fi

# Status certyfikatu
echo ""
echo -e "${BLUE}Certyfikat SSL:${NC}"
CERT_ARN=$(aws cloudfront get-distribution --id "$CF_DISTRIBUTION" --query 'Distribution.DistributionConfig.ViewerCertificate.ACMCertificateArn' --output text 2>/dev/null || echo "")
if [ -n "$CERT_ARN" ] && [ "$CERT_ARN" != "None" ]; then
    CERT_STATUS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region us-east-1 --query 'Certificate.Status' --output text 2>/dev/null || echo "Unknown")
    if [ "$CERT_STATUS" == "ISSUED" ]; then
        echo -e "  ${GREEN}✓${NC} Status: $CERT_STATUS"
    else
        echo -e "  ${YELLOW}○${NC} Status: $CERT_STATUS"
    fi
    
    # Domeny w certyfikacie
    echo -e "  ${GREEN}✓${NC} Domeny:"
    aws acm describe-certificate --certificate-arn "$CERT_ARN" --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[].DomainName' --output text 2>/dev/null | tr '\t' '\n' | while read d; do
        echo "      - $d"
    done
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}Wszystko gotowe!${NC}"
echo ""
echo "Deploy strony: ./deploy-site.sh domena.pl /path/to/dist"
echo ""

#!/bin/bash
# =============================================================================
# local-test.sh - Uruchom cały system lokalnie
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}MultiSite System - Local Development${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Sprawdź wymagania
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker nie jest zainstalowany${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js nie jest zainstalowany${NC}"; exit 1; }

case "${1:-start}" in
  start)
    echo -e "${YELLOW}Uruchamiam PostgreSQL + CMS...${NC}"
    echo ""
    
    # Sprawdź czy docker-compose istnieje
    if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ]; then
      echo -e "${RED}Brak docker-compose.yml${NC}"
      exit 1
    fi
    
    # Start services
    cd "$SCRIPT_DIR"
    docker compose up -d
    
    echo ""
    echo -e "${GREEN}✓ Usługi uruchomione!${NC}"
    echo ""
    echo -e "CMS:       ${BLUE}http://localhost:3000${NC}"
    echo -e "Login:     admin@localhost / admin123"
    echo ""
    echo -e "${YELLOW}Czekam na gotowość CMS (może potrwać ~30s)...${NC}"
    
    # Czekaj na CMS
    for i in {1..60}; do
      if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ CMS gotowy!${NC}"
        break
      fi
      sleep 1
      echo -n "."
    done
    echo ""
    
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${GREEN}System gotowy do testowania!${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    echo "Następne kroki:"
    echo "  1. Otwórz http://localhost:3000"
    echo "  2. Zaloguj się (admin@localhost / admin123)"
    echo "  3. Sprawdź demo tenanta i jego strony"
    echo ""
    echo "Aby uruchomić Astro lokalnie:"
    echo "  cd astro-client-template"
    echo "  cp .env.example .env"
    echo "  # Ustaw CMS_API_KEY z panelu CMS"
    echo "  npm install && npm run dev"
    echo ""
    echo "Zatrzymanie: $0 stop"
    echo "Logi:        $0 logs"
    ;;
    
  stop)
    echo -e "${YELLOW}Zatrzymuję usługi...${NC}"
    cd "$SCRIPT_DIR"
    docker compose down
    echo -e "${GREEN}✓ Zatrzymano${NC}"
    ;;
    
  logs)
    cd "$SCRIPT_DIR"
    docker compose logs -f
    ;;
    
  reset)
    echo -e "${YELLOW}Resetuję bazę danych...${NC}"
    cd "$SCRIPT_DIR"
    docker compose down -v
    echo -e "${GREEN}✓ Baza usunięta. Uruchom '$0 start' aby zacząć od nowa.${NC}"
    ;;
    
  status)
    cd "$SCRIPT_DIR"
    docker compose ps
    ;;
    
  *)
    echo "Użycie: $0 {start|stop|logs|reset|status}"
    exit 1
    ;;
esac

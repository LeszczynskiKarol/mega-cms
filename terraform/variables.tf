# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  description = "Główny region AWS"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Środowisko (dev/staging/prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Nazwa projektu (używana w nazwach zasobów)"
  type        = string
  default     = "multisite"
}

# =============================================================================
# Domeny klientów - dodawaj tutaj nowe domeny
# =============================================================================

variable "client_domains" {
  description = "Mapa domen klientów: klucz = identyfikator, wartość = konfiguracja"
  type = map(object({
    domain           = string       # główna domena (np. "klient.pl")
    aliases          = list(string) # dodatkowe aliasy (np. ["www.klient.pl"])
    enabled          = bool         # czy strona aktywna
    index_document   = string       # dokument główny
    error_document   = string       # strona błędu 404
  }))
  
  default = {
    # Przykładowy klient - podmień na rzeczywiste dane
    demo = {
      domain         = "demo.example.com"
      aliases        = []
      enabled        = true
      index_document = "index.html"
      error_document = "404.html"
    }
  }
}

# =============================================================================
# Ustawienia S3
# =============================================================================

variable "sites_bucket_name" {
  description = "Nazwa bucketa S3 na strony (musi być globalnie unikalna)"
  type        = string
  default     = "" # zostanie wygenerowana automatycznie jeśli pusta
}

variable "force_destroy_bucket" {
  description = "Czy usuwać bucket nawet jeśli zawiera pliki (OSTROŻNIE w produkcji!)"
  type        = bool
  default     = false
}

# =============================================================================
# Ustawienia CloudFront
# =============================================================================

variable "cloudfront_price_class" {
  description = "Klasa cenowa CloudFront"
  type        = string
  default     = "PriceClass_100" # Tylko Europa i Ameryka Północna (najtaniej)
  # Opcje: PriceClass_100, PriceClass_200, PriceClass_All
}

variable "cloudfront_default_ttl" {
  description = "Domyślny TTL cache (sekundy)"
  type        = number
  default     = 86400 # 24h
}

variable "cloudfront_max_ttl" {
  description = "Maksymalny TTL cache (sekundy)"
  type        = number
  default     = 604800 # 7 dni
}

# =============================================================================
# Ustawienia certyfikatu SSL
# =============================================================================

variable "acm_certificate_arn" {
  description = "ARN istniejącego certyfikatu ACM (opcjonalnie - jeśli pusty, zostanie utworzony nowy)"
  type        = string
  default     = ""
}

variable "create_certificate" {
  description = "Czy tworzyć nowy certyfikat ACM"
  type        = bool
  default     = true
}

# =============================================================================
# Lokalne wartości
# =============================================================================

locals {
  # Generuj nazwę bucketa jeśli nie podana
  sites_bucket_name = var.sites_bucket_name != "" ? var.sites_bucket_name : "${var.project_name}-sites-${data.aws_caller_identity.current.account_id}"
  
  # Wszystkie domeny (główne + aliasy) do certyfikatu
  all_domains = flatten([
    for key, client in var.client_domains : concat([client.domain], client.aliases) if client.enabled
  ])
  
  # Tylko aktywni klienci
  active_clients = {
    for key, client in var.client_domains : key => client if client.enabled
  }
}

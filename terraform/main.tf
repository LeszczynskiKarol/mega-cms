# =============================================================================
# AWS Multi-Site Static Hosting Infrastructure
# =============================================================================
# Ten projekt tworzy infrastrukturę do hostowania wielu statycznych stron Astro
# na jednej infrastrukturze AWS z routingiem per domena.
# =============================================================================

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Odkomentuj i skonfiguruj dla remote state (zalecane w produkcji)
  # backend "s3" {
  #   bucket         = "twoj-terraform-state-bucket"
  #   key            = "multisite-infra/terraform.tfstate"
  #   region         = "eu-central-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

# Provider dla głównego regionu (EU Frankfurt)
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "multisite-hosting"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

# Provider dla us-east-1 (wymagany dla Lambda@Edge i ACM dla CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  
  default_tags {
    tags = {
      Project     = "multisite-hosting"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

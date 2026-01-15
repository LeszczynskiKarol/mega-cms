# =============================================================================
# S3 Bucket - Główny storage dla wszystkich stron
# =============================================================================

resource "aws_s3_bucket" "sites" {
  bucket        = local.sites_bucket_name
  force_destroy = var.force_destroy_bucket

  tags = {
    Name = "Static Sites Storage"
  }
}

# Blokada publicznego dostępu (dostęp tylko przez CloudFront)
resource "aws_s3_bucket_public_access_block" "sites" {
  bucket = aws_s3_bucket.sites.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Wersjonowanie (opcjonalne, ale przydatne do rollbacków)
resource "aws_s3_bucket_versioning" "sites" {
  bucket = aws_s3_bucket.sites.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# Szyfrowanie server-side
resource "aws_s3_bucket_server_side_encryption_configuration" "sites" {
  bucket = aws_s3_bucket.sites.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rules - czyść stare wersje po 30 dniach
resource "aws_s3_bucket_lifecycle_configuration" "sites" {
  bucket = aws_s3_bucket.sites.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    # Usuń incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CORS (potrzebne jeśli strony będą ładować zasoby cross-origin)
resource "aws_s3_bucket_cors_configuration" "sites" {
  bucket = aws_s3_bucket.sites.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# =============================================================================
# Origin Access Control (OAC) dla CloudFront
# =============================================================================

resource "aws_cloudfront_origin_access_control" "sites" {
  name                              = "${var.project_name}-sites-oac"
  description                       = "OAC for static sites S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Policy pozwalająca CloudFront na dostęp do S3
resource "aws_s3_bucket_policy" "sites" {
  bucket = aws_s3_bucket.sites.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.sites.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.sites.arn
          }
        }
      }
    ]
  })
  
  depends_on = [aws_cloudfront_distribution.sites]
}

# =============================================================================
# Tworzenie folderów dla każdego klienta
# =============================================================================

resource "aws_s3_object" "client_folders" {
  for_each = local.active_clients
  
  bucket  = aws_s3_bucket.sites.id
  key     = "${each.value.domain}/"
  content = ""
  
  # Pusta "folder" - S3 nie ma folderów, ale to tworzy prefix
}

# Placeholder index.html dla nowych klientów
resource "aws_s3_object" "client_placeholder" {
  for_each = local.active_clients
  
  bucket       = aws_s3_bucket.sites.id
  key          = "${each.value.domain}/index.html"
  content_type = "text/html"
  
  content = <<-HTML
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${each.value.domain} - Strona w budowie</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 ${each.value.domain}</h1>
        <p>Strona w przygotowaniu. Wróć wkrótce!</p>
      </div>
    </body>
    </html>
  HTML

  # Nie nadpisuj jeśli plik już istnieje (zachowaj rzeczywistą stronę)
  lifecycle {
    ignore_changes = [content, etag]
  }
}

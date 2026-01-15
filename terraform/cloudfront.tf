# =============================================================================
# CloudFront Distribution
# =============================================================================
# Jedna dystrybucja obsługująca wszystkie domeny klientów.
# Lambda@Edge routuje requesty do odpowiednich folderów w S3.
# =============================================================================

resource "aws_cloudfront_distribution" "sites" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Multi-site static hosting distribution"
  default_root_object = "index.html"
  price_class         = var.cloudfront_price_class
  
  # Wszystkie domeny klientów jako aliasy
  aliases = local.all_domains

  # Origin - S3 bucket
  origin {
    domain_name              = aws_s3_bucket.sites.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.sites.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.sites.id
  }

  # Domyślne zachowanie cache
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.sites.id}"

    # Forwarding
    forwarding_values {
      query_string = false
      headers      = ["Origin", "Host"]
      
      cookies {
        forward = "none"
      }
    }

    # Cache settings
    min_ttl                = 0
    default_ttl            = var.cloudfront_default_ttl
    max_ttl                = var.cloudfront_max_ttl
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Lambda@Edge
    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.edge_origin_request.qualified_arn
      include_body = false
    }
    
    lambda_function_association {
      event_type   = "viewer-response"
      lambda_arn   = aws_lambda_function.edge_viewer_response.qualified_arn
      include_body = false
    }
  }

  # Cache behavior dla assets (dłuższy cache)
  ordered_cache_behavior {
    path_pattern     = "/_astro/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.sites.id}"

    forwarding_values {
      query_string = false
      headers      = ["Origin", "Host"]
      
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 31536000 # 1 rok
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    lambda_function_association {
      event_type = "origin-request"
      lambda_arn = aws_lambda_function.edge_origin_request.qualified_arn
    }
  }

  # Cache dla obrazków i statycznych plików
  ordered_cache_behavior {
    path_pattern     = "*.{jpg,jpeg,png,gif,webp,svg,ico,woff,woff2,ttf,eot}"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.sites.id}"

    forwarding_values {
      query_string = false
      headers      = ["Origin", "Host"]
      
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 604800 # 7 dni
    default_ttl            = 604800
    max_ttl                = 2592000 # 30 dni
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    lambda_function_association {
      event_type = "origin-request"
      lambda_arn = aws_lambda_function.edge_origin_request.qualified_arn
    }
  }

  # Custom error responses
  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 300
  }

  # Certyfikat SSL
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn != "" ? var.acm_certificate_arn : aws_acm_certificate.sites[0].arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Geo restrictions (brak)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Logging (opcjonalne)
  # logging_config {
  #   include_cookies = false
  #   bucket          = aws_s3_bucket.logs.bucket_domain_name
  #   prefix          = "cloudfront/"
  # }

  tags = {
    Name = "Multi-site Distribution"
  }

  depends_on = [
    aws_lambda_function.edge_origin_request,
    aws_lambda_function.edge_viewer_response
  ]
}

# =============================================================================
# ACM Certificate (tworzony tylko jeśli nie podano istniejącego)
# =============================================================================

resource "aws_acm_certificate" "sites" {
  count    = var.create_certificate && var.acm_certificate_arn == "" ? 1 : 0
  provider = aws.us_east_1 # Musi być us-east-1 dla CloudFront
  
  domain_name               = local.all_domains[0]
  subject_alternative_names = length(local.all_domains) > 1 ? slice(local.all_domains, 1, length(local.all_domains)) : []
  validation_method         = "DNS"

  tags = {
    Name = "Multi-site SSL Certificate"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# Outputs dla DNS validation (do ręcznej konfiguracji)
# =============================================================================

output "certificate_validation_options" {
  description = "Rekordy DNS do walidacji certyfikatu (dodaj je u rejestratora domeny)"
  value = var.create_certificate && var.acm_certificate_arn == "" ? {
    for dvo in aws_acm_certificate.sites[0].domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  } : {}
}

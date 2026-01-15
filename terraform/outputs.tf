# =============================================================================
# Outputs
# =============================================================================

output "s3_bucket_name" {
  description = "Nazwa bucketa S3 na strony"
  value       = aws_s3_bucket.sites.id
}

output "s3_bucket_arn" {
  description = "ARN bucketa S3"
  value       = aws_s3_bucket.sites.arn
}

output "cloudfront_distribution_id" {
  description = "ID dystrybucji CloudFront"
  value       = aws_cloudfront_distribution.sites.id
}

output "cloudfront_distribution_arn" {
  description = "ARN dystrybucji CloudFront"
  value       = aws_cloudfront_distribution.sites.arn
}

output "cloudfront_domain_name" {
  description = "Domena CloudFront (do konfiguracji CNAME)"
  value       = aws_cloudfront_distribution.sites.domain_name
}

output "active_domains" {
  description = "Lista aktywnych domen klientów"
  value       = local.all_domains
}

output "dns_configuration" {
  description = "Instrukcje konfiguracji DNS dla każdej domeny"
  value = {
    for domain in local.all_domains : domain => {
      type  = "CNAME"
      name  = domain
      value = aws_cloudfront_distribution.sites.domain_name
      note  = "Dodaj ten rekord CNAME u rejestratora domeny"
    }
  }
}

output "lambda_edge_origin_request_arn" {
  description = "ARN Lambda@Edge Origin Request"
  value       = aws_lambda_function.edge_origin_request.qualified_arn
}

output "upload_instructions" {
  description = "Jak uploadować stronę klienta"
  value       = <<-EOT
    
    ============================================================
    INSTRUKCJE UPLOADU STRONY KLIENTA
    ============================================================
    
    1. Zbuduj stronę Astro:
       cd twoja-strona-astro
       npm run build
    
    2. Upload do S3 (zamień DOMENA na domenę klienta):
       aws s3 sync ./dist s3://${aws_s3_bucket.sites.id}/DOMENA/ --delete
    
    3. Invalidacja cache CloudFront:
       aws cloudfront create-invalidation \
         --distribution-id ${aws_cloudfront_distribution.sites.id} \
         --paths "/DOMENA/*"
    
    Przykład dla klient-a.pl:
       aws s3 sync ./dist s3://${aws_s3_bucket.sites.id}/klient-a.pl/ --delete
       aws cloudfront create-invalidation \
         --distribution-id ${aws_cloudfront_distribution.sites.id} \
         --paths "/klient-a.pl/*"
    
    ============================================================
  EOT
}

output "new_client_checklist" {
  description = "Checklist dodawania nowego klienta"
  value       = <<-EOT
    
    ============================================================
    CHECKLIST: DODAWANIE NOWEGO KLIENTA
    ============================================================
    
    1. [ ] Dodaj wpis w variables.tf -> client_domains:
    
           nowy_klient = {
             domain         = "nowy-klient.pl"
             aliases        = ["www.nowy-klient.pl"]
             enabled        = true
             index_document = "index.html"
             error_document = "404.html"
           }
    
    2. [ ] Uruchom: terraform plan
    
    3. [ ] Uruchom: terraform apply
    
    4. [ ] Dodaj rekordy DNS walidacji certyfikatu
           (wyświetlone w certificate_validation_options)
    
    5. [ ] Poczekaj na walidację certyfikatu (~5-30 min)
    
    6. [ ] Dodaj CNAME u rejestratora domeny klienta:
           nowy-klient.pl -> ${aws_cloudfront_distribution.sites.domain_name}
           www.nowy-klient.pl -> ${aws_cloudfront_distribution.sites.domain_name}
    
    7. [ ] Upload strony:
           aws s3 sync ./dist s3://${aws_s3_bucket.sites.id}/nowy-klient.pl/ --delete
    
    8. [ ] Invalidacja cache (opcjonalnie):
           aws cloudfront create-invalidation \
             --distribution-id ${aws_cloudfront_distribution.sites.id} \
             --paths "/nowy-klient.pl/*"
    
    ============================================================
  EOT
}

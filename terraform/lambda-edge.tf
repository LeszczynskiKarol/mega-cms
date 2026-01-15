# =============================================================================
# Lambda@Edge - Routing na podstawie Host header
# =============================================================================
# Ta funkcja przechwytuje requesty do CloudFront i przepisuje ścieżkę
# na podstawie domeny, kierując request do odpowiedniego folderu w S3.
#
# Przykład:
#   Request: GET https://klient-a.pl/about
#   Przepisane na: GET s3://bucket/klient-a.pl/about/index.html
# =============================================================================

# IAM Role dla Lambda@Edge
resource "aws_iam_role" "lambda_edge" {
  provider = aws.us_east_1
  name     = "${var.project_name}-lambda-edge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
}

# Polityka dla logów CloudWatch
resource "aws_iam_role_policy_attachment" "lambda_edge_logs" {
  provider   = aws.us_east_1
  role       = aws_iam_role.lambda_edge.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Kod Lambda@Edge (Origin Request)
data "archive_file" "lambda_edge_origin_request" {
  type        = "zip"
  output_path = "${path.module}/lambda-edge-origin-request.zip"
  
  source {
    content  = <<-JS
      'use strict';

      /**
       * Lambda@Edge - Origin Request
       * 
       * Przepisuje ścieżkę requestu na podstawie Host header.
       * Obsługuje:
       * - Routing do folderu klienta w S3 na podstawie domeny
       * - Dodawanie index.html dla ścieżek katalogowych
       * - Obsługę trailing slashes
       */
      exports.handler = async (event) => {
        const request = event.Records[0].cf.request;
        const headers = request.headers;
        
        // Pobierz Host header
        const host = headers.host && headers.host[0] ? headers.host[0].value : '';
        
        // Wyczyść domenę (usuń www. jeśli jest, lowercase)
        let domain = host.toLowerCase().replace(/^www\./, '');
        
        // Pobierz oryginalną ścieżkę
        let uri = request.uri;
        
        // Logowanie (widoczne w CloudWatch Logs w regionie edge)
        console.log('Original request:', JSON.stringify({
          host: host,
          domain: domain,
          uri: uri
        }));
        
        // Jeśli ścieżka kończy się na / lub nie ma rozszerzenia, dodaj index.html
        if (uri.endsWith('/')) {
          uri = uri + 'index.html';
        } else if (!uri.includes('.')) {
          // Ścieżka bez rozszerzenia - traktuj jako katalog
          uri = uri + '/index.html';
        }
        
        // Przepisz URI: /{domain}{original_path}
        request.uri = '/' + domain + uri;
        
        console.log('Rewritten URI:', request.uri);
        
        return request;
      };
    JS
    filename = "index.js"
  }
}

# Lambda Function (musi być w us-east-1 dla Lambda@Edge)
resource "aws_lambda_function" "edge_origin_request" {
  provider         = aws.us_east_1
  filename         = data.archive_file.lambda_edge_origin_request.output_path
  function_name    = "${var.project_name}-edge-origin-request"
  role             = aws_iam_role.lambda_edge.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_edge_origin_request.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 5
  memory_size      = 128
  publish          = true # Wymagane dla Lambda@Edge

  tags = {
    Name = "Edge Origin Request Router"
  }
}

# =============================================================================
# Lambda@Edge - Viewer Response (opcjonalne - security headers)
# =============================================================================

data "archive_file" "lambda_edge_viewer_response" {
  type        = "zip"
  output_path = "${path.module}/lambda-edge-viewer-response.zip"
  
  source {
    content  = <<-JS
      'use strict';

      /**
       * Lambda@Edge - Viewer Response
       * 
       * Dodaje security headers do każdej odpowiedzi.
       */
      exports.handler = async (event) => {
        const response = event.Records[0].cf.response;
        const headers = response.headers;
        
        // Security headers
        headers['strict-transport-security'] = [{
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        }];
        
        headers['x-content-type-options'] = [{
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        }];
        
        headers['x-frame-options'] = [{
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN'
        }];
        
        headers['x-xss-protection'] = [{
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        }];
        
        headers['referrer-policy'] = [{
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        }];
        
        return response;
      };
    JS
    filename = "index.js"
  }
}

resource "aws_lambda_function" "edge_viewer_response" {
  provider         = aws.us_east_1
  filename         = data.archive_file.lambda_edge_viewer_response.output_path
  function_name    = "${var.project_name}-edge-viewer-response"
  role             = aws_iam_role.lambda_edge.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_edge_viewer_response.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 5
  memory_size      = 128
  publish          = true

  tags = {
    Name = "Edge Viewer Response Security Headers"
  }
}

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { prisma } from './prisma';

// =============================================================================
// AWS CLIENTS
// =============================================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const cfClient = new CloudFrontClient({
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// =============================================================================
// DEPLOYMENT
// =============================================================================

export interface DeployResult {
  success: boolean;
  deploymentId?: string;
  error?: string;
}

/**
 * Triggeruje build i deploy strony klienta.
 * W produkcji to wywoła webhook do CI/CD (GitHub Actions, CodeBuild, itp.)
 */
export async function triggerDeploy(tenantId: string, triggeredBy?: string): Promise<DeployResult> {
  try {
    // Pobierz tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }
    
    // Utwórz rekord deploymentu
    const deployment = await prisma.deployment.create({
      data: {
        tenantId,
        status: 'PENDING',
        triggeredBy,
      },
    });
    
    // Wywołaj webhook do buildu (w tle)
    triggerBuildWebhook(tenant.domain, deployment.id).catch(console.error);
    
    return { success: true, deploymentId: deployment.id };
  } catch (error) {
    console.error('Deploy error:', error);
    return { success: false, error: 'Failed to trigger deploy' };
  }
}

/**
 * Wywołuje webhook do CI/CD systemu.
 */
async function triggerBuildWebhook(domain: string, deploymentId: string): Promise<void> {
  const webhookUrl = process.env.BUILD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('No BUILD_WEBHOOK_URL configured, skipping webhook');
    // W dev mode, symulujemy sukces
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        duration: 0,
        buildLog: 'Development mode - no actual build triggered',
      },
    });
    return;
  }
  
  try {
    // Zaktualizuj status na BUILDING
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'BUILDING' },
    });
    
    // Wywołaj webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.BUILD_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        domain,
        deploymentId,
        action: 'build',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
    
    // Webhook powinien zaktualizować status przez callback
  } catch (error) {
    console.error('Webhook error:', error);
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        buildLog: `Webhook error: ${error}`,
      },
    });
  }
}

/**
 * Invaliduje cache CloudFront dla danej domeny.
 */
export async function invalidateCache(domain: string): Promise<boolean> {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  
  if (!distributionId) {
    console.log('No CLOUDFRONT_DISTRIBUTION_ID configured');
    return false;
  }
  
  try {
    await cfClient.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `${domain}-${Date.now()}`,
          Paths: {
            Quantity: 1,
            Items: [`/${domain}/*`],
          },
        },
      })
    );
    return true;
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return false;
  }
}

/**
 * Callback z CI/CD systemu po zakończeniu buildu.
 */
export async function handleBuildCallback(
  deploymentId: string,
  status: 'SUCCESS' | 'FAILED',
  buildLog?: string,
  duration?: number
): Promise<void> {
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: {
      status,
      finishedAt: new Date(),
      buildLog,
      duration,
    },
  });
  
  // Jeśli sukces, invaliduj cache
  if (status === 'SUCCESS') {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { tenant: true },
    });
    
    if (deployment?.tenant) {
      await invalidateCache(deployment.tenant.domain);
    }
  }
}

// =============================================================================
// MEDIA UPLOAD
// =============================================================================

export async function uploadMedia(
  tenantId: string,
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const bucket = process.env.MEDIA_S3_BUCKET || process.env.S3_BUCKET;
  
  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  
  const key = `media/${tenant.domain}/${Date.now()}-${filename}`;
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000',
    })
  );
  
  return `https://${bucket}.s3.${process.env.AWS_REGION || 'eu-central-1'}.amazonaws.com/${key}`;
}

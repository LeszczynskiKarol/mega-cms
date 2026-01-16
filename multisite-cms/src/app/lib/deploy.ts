import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { prisma } from "./prisma";

// =============================================================================
// AWS CLIENTS
// =============================================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const cfClient = new CloudFrontClient({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
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
 * Wywołuje GitHub Actions przez repository_dispatch event.
 */
export async function triggerDeploy(
  tenantId: string,
  triggeredBy?: string
): Promise<DeployResult> {
  try {
    // Pobierz tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Utwórz rekord deploymentu
    const deployment = await prisma.deployment.create({
      data: {
        tenantId,
        status: "PENDING",
        triggeredBy,
      },
    });

    // Wywołaj GitHub Actions webhook (w tle)
    triggerGitHubActions(tenant.domain, deployment.id, triggeredBy).catch(
      console.error
    );

    return { success: true, deploymentId: deployment.id };
  } catch (error) {
    console.error("Deploy error:", error);
    return { success: false, error: "Failed to trigger deploy" };
  }
}

/**
 * Wywołuje GitHub Actions przez repository_dispatch.
 */
async function triggerGitHubActions(
  domain: string,
  deploymentId: string,
  triggeredBy?: string
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO; // format: "owner/repo"

  if (!githubToken || !githubRepo) {
    console.log("GitHub not configured, falling back to dev mode");
    await simulateDevDeploy(deploymentId);
    return;
  }

  try {
    // Zaktualizuj status na BUILDING
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "BUILDING" },
    });

    // Wywołaj GitHub Actions - workflow_dispatch
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/actions/workflows/deploy.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            reason: `Deploy triggered by ${triggeredBy || "CMS"} for ${domain}`,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${text}`);
    }

    console.log(`GitHub Actions triggered for ${domain}`);

    // Zaktualizuj status (workflow_dispatch nie ma callbacka, więc zakładamy sukces)
    setTimeout(async () => {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          buildLog: "GitHub Actions workflow triggered successfully",
        },
      });
    }, 5000);
  } catch (error) {
    console.error("GitHub Actions error:", error);
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        buildLog: `GitHub Actions error: ${error}`,
      },
    });
  }
}

/**
 * Symuluje deploy w trybie deweloperskim.
 */
async function simulateDevDeploy(deploymentId: string): Promise<void> {
  console.log("DEV MODE: Simulating deployment...");

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: "BUILDING" },
  });

  // Symulujemy czas budowania (2 sekundy)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      duration: 2,
      buildLog:
        "Development mode - simulated build success.\n\nTo enable real deployments, configure:\n- GITHUB_TOKEN\n- GITHUB_REPO",
    },
  });

  console.log("DEV MODE: Deployment simulated successfully");
}

/**
 * Invaliduje cache CloudFront dla danej domeny.
 */
export async function invalidateCache(domain: string): Promise<boolean> {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;

  if (!distributionId) {
    console.log("No CLOUDFRONT_DISTRIBUTION_ID configured");
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
    console.error("Cache invalidation error:", error);
    return false;
  }
}

/**
 * Callback z CI/CD systemu po zakończeniu buildu.
 */
export async function handleBuildCallback(
  deploymentId: string,
  status: "SUCCESS" | "FAILED",
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
    throw new Error("S3 bucket not configured");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const key = `media/${tenant.domain}/${Date.now()}-${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000",
    })
  );

  return `https://${bucket}.s3.${
    process.env.AWS_REGION || "eu-central-1"
  }.amazonaws.com/${key}`;
}

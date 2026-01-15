import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@localhost";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Super admin
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administrator",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log(`✅ Super admin created: ${admin.email}`);

  // Demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { domain: "demo.localhost" },
    update: {},
    create: {
      name: "Demo Site",
      slug: "demo",
      domain: "demo.localhost",
      domains: "[]",
      settings:
        '{"logo":null,"primaryColor":"#3b82f6","description":"Przykładowa strona demo"}',
      isActive: true,
    },
  });

  console.log(`✅ Demo tenant created: ${demoTenant.domain}`);
  console.log(`   API Key: ${demoTenant.apiKey}`);

  // Strony demo
  await prisma.page.upsert({
    where: { tenantId_slug: { tenantId: demoTenant.id, slug: "index" } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      slug: "index",
      title: "Strona główna",
      description: "Witamy na naszej stronie",
      content:
        '{"html":"<h1>Witamy na Demo Site!</h1><p>To jest przykładowa strona główna.</p>"}',
      seo: "{}",
      status: "PUBLISHED",
      template: "home",
      authorId: admin.id,
      publishedAt: new Date(),
    },
  });

  await prisma.page.upsert({
    where: { tenantId_slug: { tenantId: demoTenant.id, slug: "o-nas" } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      slug: "o-nas",
      title: "O nas",
      description: "Dowiedz się więcej",
      content:
        '{"html":"<h1>O nas</h1><p>Jesteśmy firmą zajmującą się tworzeniem stron.</p>"}',
      seo: "{}",
      status: "PUBLISHED",
      template: "default",
      authorId: admin.id,
      publishedAt: new Date(),
    },
  });

  console.log("✅ Demo pages created");

  await prisma.globalSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", awsRegion: "eu-central-1" },
  });

  console.log("");
  console.log("🎉 Seeding completed!");
  console.log(`   Login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

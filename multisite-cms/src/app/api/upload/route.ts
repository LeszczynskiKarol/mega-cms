// =============================================================================
// API: Upload images to S3
// POST /api/upload
// =============================================================================

import { getSession, requireTenant } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.S3_MEDIA_REGION || "eu-central-1",
});

const BUCKET_NAME = process.env.S3_MEDIA_BUCKET || "torweb-cms-media";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    // 1. Sprawdź sesję
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Pobierz dane z formularza
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const tenantId = formData.get("tenantId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenantId provided" },
        { status: 400 }
      );
    }

    // 3. Sprawdź uprawnienia do tenanta
    try {
      await requireTenant(tenantId);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 4. Walidacja pliku
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 10MB" },
        { status: 400 }
      );
    }

    // 5. Generuj unikalną nazwę pliku
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const uniqueId = uuidv4().slice(0, 8);
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, "") // usuń rozszerzenie
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    const fileName = `${timestamp}-${uniqueId}-${sanitizedName}.${extension}`;
    const key = `${tenantId}/${fileName}`;

    // 6. Konwertuj plik do Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Upload do S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000", // 1 rok cache
    });

    await s3Client.send(command);

    // 8. Zwróć URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.S3_MEDIA_REGION || "eu-central-1"}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      url,
      fileName,
      originalName: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}

// Opcjonalnie: DELETE endpoint do usuwania obrazków
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Wyciągnij key z URL
    const urlObj = new URL(url);
    const key = urlObj.pathname.slice(1); // usuń początkowy slash

    // Sprawdź czy użytkownik ma dostęp do tego tenanta
    const tenantId = key.split("/")[0];
    try {
      await requireTenant(tenantId);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Import DeleteObjectCommand tylko gdy potrzebny
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

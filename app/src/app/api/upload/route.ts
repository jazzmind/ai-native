import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { v4 as uuidv4 } from "uuid";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const result = await pdfParse(buffer);
      return result.text;
    } catch {
      return "[PDF text extraction failed]";
    }
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch {
      return "[DOCX text extraction failed]";
    }
  }

  if (mimeType.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  // Images — no text extraction, will be referenced by URL
  return "";
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json(
        { error: `File type ${file.type} not supported. Allowed: PDF, DOCX, TXT, CSV, MD, PNG, JPEG, GIF, WebP` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return Response.json(
        { error: `File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const fileId = uuidv4();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Vercel Blob
    const blob = await put(`uploads/${user.id}/${fileId}/${file.name}`, buffer, {
      access: "public",
      contentType: file.type,
    });

    // Extract text for non-image files
    const extractedText = await extractText(buffer, file.type);

    return Response.json({
      fileId,
      url: blob.url,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      extractedText,
    });
  } catch (err: any) {
    console.error("Upload failed:", err);
    return Response.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}

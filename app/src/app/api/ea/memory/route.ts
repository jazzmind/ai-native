import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { listEaMemory, upsertEaMemory, deleteEaMemory, type EaMemoryType } from "@/lib/db";

export async function GET(req: NextRequest) {
  let user;
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const memoryType = searchParams.get("type") as EaMemoryType | null;

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const entries = await listEaMemory(user.id, projectId, memoryType ?? undefined);
  return Response.json({ entries });
}

export async function POST(req: NextRequest) {
  let user;
  let orgId = '';
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
    orgId = result.org.id;
  } catch (err) {
    return handleAuthError(err);
  }

  const body = await req.json();
  const { projectId, memoryType, key, title, content, metadata } = body as {
    projectId: string;
    memoryType: EaMemoryType;
    key: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  };

  if (!projectId || !memoryType || !key || !title || content === undefined) {
    return Response.json({ error: "projectId, memoryType, key, title, and content are required" }, { status: 400 });
  }

  const entry = await upsertEaMemory({ orgId, userId: user.id, projectId, memoryType, key, title, content, metadata });
  return Response.json({ entry });
}

export async function DELETE(req: NextRequest) {
  let user;
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const key = searchParams.get("key");

  if (!projectId || !key) {
    return Response.json({ error: "projectId and key are required" }, { status: 400 });
  }

  await deleteEaMemory(user.id, projectId, key);
  return Response.json({ ok: true });
}

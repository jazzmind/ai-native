import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getEaMemory, upsertEaMemory } from "@/lib/db";
import type { EaMemoryType } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await getRequiredUserAndOrg();
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const projectId = searchParams.get("projectId");

    if (!key || !projectId) {
      return Response.json({ error: "key and projectId are required" }, { status: 400 });
    }

    const entry = await getEaMemory(user.id, projectId, key);
    return Response.json({ entry: entry ?? null });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    const { key, projectId, content, title, memoryType } = await req.json();

    if (!key || !projectId || content === undefined) {
      return Response.json({ error: "key, projectId, and content are required" }, { status: 400 });
    }

    await upsertEaMemory({
      orgId: org.id,
      userId: user.id,
      projectId,
      memoryType: (memoryType || "preference") as EaMemoryType,
      key,
      title: title || key,
      content,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

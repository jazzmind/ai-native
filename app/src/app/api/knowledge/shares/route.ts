import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { listKnowledgeShares, createKnowledgeShare, deleteKnowledgeShare } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });
    const shares = listKnowledgeShares(projectId);
    return Response.json({ shares });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();
    const { action } = body;

    if (action === "delete") {
      if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
      deleteKnowledgeShare(body.id, user.id);
      return Response.json({ ok: true });
    }

    if (!body.sourceProjectId || !body.targetProjectId) {
      return Response.json({ error: "sourceProjectId and targetProjectId required" }, { status: 400 });
    }

    const share = createKnowledgeShare(body.sourceProjectId, body.targetProjectId, user.id, body.collectionId);
    return Response.json({ ok: true, share });
  } catch (err) {
    return handleAuthError(err);
  }
}

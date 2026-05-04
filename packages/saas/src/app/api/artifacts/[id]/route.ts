import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getArtifactForUser } from "@/lib/db/queries/task-artifacts";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getRequiredUser();
    const artifact = await getArtifactForUser(id, user.id);

    if (!artifact) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(artifact);
  } catch (err) {
    return handleAuthError(err);
  }
}

import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import {
  createBehavior,
  listBehaviors,
  updateBehavior,
  deleteBehavior,
  listRevisions,
  updateRevisionStatus,
  createBehavior as createBehaviorFromRevision,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const coachKey = searchParams.get("coachKey");
  const type = searchParams.get("type"); // "behaviors" | "revisions"

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  if (type === "revisions") {
    const status = searchParams.get("status");
    const revisions = listRevisions(user.id, projectId, status || undefined);
    return Response.json({ revisions });
  }

  const behaviors = listBehaviors(user.id, projectId, coachKey || undefined);
  return Response.json({ behaviors });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "create": {
      const { coachKey, projectId, directive } = body;
      if (!coachKey || !projectId || !directive) {
        return Response.json({ error: "coachKey, projectId, and directive are required" }, { status: 400 });
      }
      const behavior = createBehavior(coachKey, projectId, user.id, directive, "manual");
      return Response.json(behavior);
    }

    case "update": {
      const { id, directive, is_active } = body;
      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      updateBehavior(id, user.id, {
        directive: directive !== undefined ? directive : undefined,
        is_active: is_active !== undefined ? is_active : undefined,
      });
      return Response.json({ ok: true });
    }

    case "delete": {
      const { id } = body;
      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      deleteBehavior(id, user.id);
      return Response.json({ ok: true });
    }

    case "approve_revision": {
      const { revisionId, projectId: revProjectId, coachKey: revCoachKey, directive } = body;
      if (!revisionId) {
        return Response.json({ error: "revisionId is required" }, { status: 400 });
      }
      updateRevisionStatus(revisionId, user.id, "approved");
      if (directive && revProjectId && revCoachKey) {
        createBehaviorFromRevision(revCoachKey, revProjectId, user.id, directive, "ai-revision");
      }
      return Response.json({ ok: true });
    }

    case "reject_revision": {
      const { revisionId } = body;
      if (!revisionId) {
        return Response.json({ error: "revisionId is required" }, { status: 400 });
      }
      updateRevisionStatus(revisionId, user.id, "rejected");
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

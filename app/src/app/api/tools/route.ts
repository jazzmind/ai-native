import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { listToolTrust, setToolTrust, deleteToolTrust } from "@/lib/db";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const trustSettings = listToolTrust(user.id, projectId);
  return Response.json({ tools: trustSettings });
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
    case "set": {
      const { projectId, toolPattern, trustLevel } = body;
      if (!projectId || !toolPattern || !trustLevel) {
        return Response.json({ error: "projectId, toolPattern, and trustLevel are required" }, { status: 400 });
      }
      if (!["auto", "confirm", "blocked"].includes(trustLevel)) {
        return Response.json({ error: "trustLevel must be auto, confirm, or blocked" }, { status: 400 });
      }
      setToolTrust(user.id, projectId, toolPattern, trustLevel);
      return Response.json({ ok: true });
    }

    case "delete": {
      const { id } = body;
      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      deleteToolTrust(id, user.id);
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

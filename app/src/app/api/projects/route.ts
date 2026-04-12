import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError, AuthError } from "@/lib/auth";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getOrCreateDefaultProject,
} from "@/lib/db";

export async function GET() {
  try {
    const user = await getRequiredUser();
    getOrCreateDefaultProject(user.id);
    const projects = listProjects(user.id);
    return Response.json({ projects });
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
      deleteProject(body.id, user.id);
      return Response.json({ ok: true });
    }

    if (action === "update") {
      if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
      updateProject(body.id, user.id, { name: body.name, description: body.description });
      return Response.json({ ok: true });
    }

    // Create
    if (!body.name?.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const project = createProject(user.id, body.name, body.description);
    return Response.json({ ok: true, project });
  } catch (err) {
    return handleAuthError(err);
  }
}

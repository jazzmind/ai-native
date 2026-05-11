import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError, AuthError } from "@/lib/auth";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getOrCreateDefaultProject,
  getProjectStats,
} from "@/lib/db";
import { trackEvent, Events } from "@/lib/usage-tracking";

export async function GET() {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    await getOrCreateDefaultProject(user.id, org.id);
    const [projectList, stats] = await Promise.all([
      listProjects(user.id),
      getProjectStats(user.id),
    ]);
    const statsMap = new Map(stats.map(s => [s.projectId, s]));
    const projects = projectList.map(p => ({
      ...p,
      conversationCount: statsMap.get(p.id)?.conversationCount || 0,
      messageCount: statsMap.get(p.id)?.messageCount || 0,
    }));
    return Response.json({ projects });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    const body = await req.json();
    const { action } = body;

    if (action === "delete") {
      if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
      await deleteProject(body.id, user.id);
      return Response.json({ ok: true });
    }

    if (action === "update") {
      if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
      await updateProject(body.id, user.id, { name: body.name, description: body.description });
      return Response.json({ ok: true });
    }

    // Create
    if (!body.name?.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const project = await createProject(user.id, body.name, body.description, org.id);
    try {
      trackEvent(org.id, user.id, Events.PROJECT_CREATED, { projectName: body.name });
    } catch { /* tracking non-critical */ }
    return Response.json({ ok: true, project });
  } catch (err) {
    return handleAuthError(err);
  }
}

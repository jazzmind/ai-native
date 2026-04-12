import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { listTargets, upsertTarget, deleteTarget } from "@/lib/config-store";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getRequiredUser();
    return Response.json(listTargets(user.id));
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
      deleteTarget(body.id, user.id);
      return Response.json({ ok: true });
    }

    const target = {
      id: body.id || uuidv4(),
      userId: user.id,
      type: body.type,
      name: body.name,
      config: body.config || {},
      status: "unconfigured" as const,
      lastDeployedAt: null,
      agentState: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    upsertTarget(target);
    return Response.json({ ok: true, target });
  } catch (err) {
    return handleAuthError(err);
  }
}

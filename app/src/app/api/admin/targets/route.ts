import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { listTargets, upsertTarget, deleteTarget } from "@/lib/config-store";

export async function GET() {
  return Response.json(listTargets());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "delete") {
    deleteTarget(body.id);
    return Response.json({ ok: true });
  }

  const target = {
    id: body.id || uuidv4(),
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
}

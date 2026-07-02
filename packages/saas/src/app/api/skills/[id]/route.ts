import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { resolveAnthropicKey, BYOKeyRequiredError } from "@/lib/api-key-resolver";
import { getSkill, deleteSkill } from "@/lib/skills-service";

export const runtime = "nodejs";

/** GET /api/skills/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try {
    const result = await getRequiredUserAndOrg();
    orgId = result.org.id;
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const skill = await getSkill(id);
  if (!skill || skill.orgId !== orgId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(skill);
}

/** DELETE /api/skills/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: { id: string };
  let orgId: string;
  let orgPlan: "free" | "pro" | "team";
  let anthropicKey: string;
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
    orgId = result.org.id;
    orgPlan = (result.org.plan as "free" | "pro" | "team") || "free";
    anthropicKey = await resolveAnthropicKey(orgId, user.id, orgPlan);
  } catch (err) {
    if (err instanceof BYOKeyRequiredError) {
      return Response.json({ error: err.message, code: "BYO_KEY_REQUIRED" }, { status: 402 });
    }
    return handleAuthError(err);
  }

  const { id } = await params;
  try {
    await deleteSkill({ id, orgId, apiKey: anthropicKey });
    return new Response(null, { status: 204 });
  } catch (err: any) {
    if (err.message === "Skill not found") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}

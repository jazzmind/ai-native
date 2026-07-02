import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { resolveAnthropicKey, BYOKeyRequiredError } from "@/lib/api-key-resolver";
import { replaceSkill } from "@/lib/skills-service";

export const runtime = "nodejs";

/** POST /api/skills/[id]/replace — upload a new version of an existing skill */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return Response.json({ error: "file is required" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(arrayBuffer);

    const skill = await replaceSkill({
      id,
      orgId,
      userId: user.id,
      fileContent,
      filename: file.name,
      apiKey: anthropicKey,
    });

    return Response.json(skill);
  } catch (err: any) {
    if (err.message === "Skill not found") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}

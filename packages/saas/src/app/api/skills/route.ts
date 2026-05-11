import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { resolveAnthropicKey, BYOKeyRequiredError } from "@/lib/api-key-resolver";
import { uploadSkill, listSkills } from "@/lib/skills-service";

export const runtime = "nodejs";

/** GET /api/skills — list all custom skills for the org */
export async function GET() {
  let orgId: string;
  try {
    const result = await getRequiredUserAndOrg();
    orgId = result.org.id;
  } catch (err) {
    return handleAuthError(err);
  }

  const skills = await listSkills(orgId);
  return Response.json(skills);
}

/** POST /api/skills — upload a new custom skill (multipart/form-data) */
export async function POST(req: NextRequest) {
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

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const description = (formData.get("description") as string | null) ?? "";

    if (!file) return Response.json({ error: "file is required" }, { status: 400 });
    if (!name) return Response.json({ error: "name is required" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(arrayBuffer);

    const skill = await uploadSkill({
      orgId,
      userId: user.id,
      name,
      description,
      fileContent,
      filename: file.name,
      apiKey: anthropicKey,
    });

    return Response.json(skill, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

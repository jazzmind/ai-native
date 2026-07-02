import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { assignSkill } from "@/lib/skills-service";

export const runtime = "nodejs";

/** POST /api/skills/[id]/assign — set assigned coaches for a skill */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try {
    const result = await getRequiredUserAndOrg();
    orgId = result.org.id;
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  try {
    const { coachKeys } = await req.json() as { coachKeys: string[] };
    if (!Array.isArray(coachKeys)) {
      return Response.json({ error: "coachKeys must be an array" }, { status: 400 });
    }
    const skill = await assignSkill({ id, orgId, coachKeys });
    return Response.json(skill);
  } catch (err: any) {
    if (err.message === "Skill not found") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}

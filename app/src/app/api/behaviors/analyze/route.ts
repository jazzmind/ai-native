import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { checkAndProposeBehaviorRevisions } from "@/lib/behavior-analysis";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const body = await req.json();
  const { projectId } = body;

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const results = await checkAndProposeBehaviorRevisions(user.id, projectId);
  const proposals = results.filter((r) => r.shouldPropose);

  return Response.json({
    analyzed: results.length,
    proposed: proposals.length,
    proposals: proposals.map((p) => ({
      coachKey: p.coachKey,
      analysis: p.analysis,
      proposedDirective: p.proposedDirective,
    })),
  });
}

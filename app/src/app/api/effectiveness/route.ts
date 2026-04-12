import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import {
  getFeedbackByCoach,
  getFeedbackTimeline,
  getModeUsageDistribution,
  listRevisions,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const days = parseInt(searchParams.get("days") || "30");

  const byCoach = getFeedbackByCoach(user.id, projectId || undefined);
  const timeline = getFeedbackTimeline(user.id, projectId || undefined, days);
  const modeUsage = getModeUsageDistribution(user.id, projectId || undefined);

  // Get behavioral adaptation history
  const allRevisions = projectId
    ? listRevisions(user.id, projectId)
    : [];

  return Response.json({
    byCoach,
    timeline,
    modeUsage,
    revisions: allRevisions.map((r) => ({
      id: r.id,
      coach_key: r.coach_key,
      status: r.status,
      analysis: r.analysis,
      proposed_directive: r.proposed_directive,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    })),
  });
}

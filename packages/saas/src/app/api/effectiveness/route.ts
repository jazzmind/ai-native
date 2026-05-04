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

  const byCoach = await getFeedbackByCoach(user.id, projectId || undefined);
  const timeline = await getFeedbackTimeline(user.id, projectId || undefined, days);
  const modeUsage = await getModeUsageDistribution(user.id, projectId || undefined);

  const allRevisions = projectId
    ? await listRevisions(user.id, projectId)
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

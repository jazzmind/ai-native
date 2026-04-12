import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const body = await req.json().catch(() => ({}));

    // Profile data from onboarding step 2 can be saved here
    // For now, the existing onboarding flow handles completion via deployment status
    // This endpoint is a placeholder for the commercial onboarding additions

    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

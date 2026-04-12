import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getExpertProfileByUserId } from "@/lib/db";
import { awardRequest } from "@/lib/marketplace-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { requestId } = await params;

  const expert = await getExpertProfileByUserId(user.id);
  if (!expert) {
    return Response.json({ error: "Expert profile not found" }, { status: 403 });
  }

  try {
    const { accessToken, deliveryDeadline } = await awardRequest(requestId, expert.id);
    return Response.json({ success: true, accessToken, deliveryDeadline });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to award request" },
      { status: 400 }
    );
  }
}

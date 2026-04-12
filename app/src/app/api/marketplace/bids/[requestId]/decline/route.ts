import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getExpertProfileByUserId, getBidByExpertAndRequest, updateBidStatus, updateExpertProfile } from "@/lib/db";

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

  const bid = await getBidByExpertAndRequest(expert.id, requestId);
  if (!bid) {
    return Response.json({ error: "Bid not found" }, { status: 404 });
  }

  await updateBidStatus(bid.id, 'rejected');

  // Update acceptance rate
  const totalReviews = (expert.totalReviews || 0);
  if (totalReviews > 0) {
    const currentRate = expert.acceptanceRate || 1;
    const newRate = (currentRate * totalReviews) / (totalReviews + 1);
    await updateExpertProfile(expert.id, { acceptanceRate: newRate });
  }

  return Response.json({ ok: true });
}

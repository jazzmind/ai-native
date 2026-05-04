import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/billing";

export async function POST(req: NextRequest) {
  try {
    const { org } = await getRequiredUserAndOrg();
    const body = await req.json();
    const { plan } = body as { plan: 'pro' | 'team' };

    if (!plan || !['pro', 'team'].includes(plan)) {
      return Response.json({ error: "plan must be 'pro' or 'team'" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { url } = await createCheckoutSession({
      orgId: org.id,
      plan,
      successUrl: `${appUrl}/settings/billing?success=true`,
      cancelUrl: `${appUrl}/settings/billing?canceled=true`,
    });

    return Response.json({ url });
  } catch (err) {
    return handleAuthError(err);
  }
}

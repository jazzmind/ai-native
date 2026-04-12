import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { createPortalSession } from "@/lib/billing";

export async function POST() {
  try {
    const { org } = await getRequiredUserAndOrg();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { url } = await createPortalSession(org.id, `${appUrl}/settings/billing`);
    return Response.json({ url });
  } catch (err) {
    return handleAuthError(err);
  }
}

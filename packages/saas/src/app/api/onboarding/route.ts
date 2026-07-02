import { listTargets } from "@/lib/config-store";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getApiKey } from "@/lib/db/queries/api-keys";

export async function GET() {
  try {
    const { user, org } = await getRequiredUserAndOrg();

    // Step 1: must have an API key before anything else
    const keyInfo = await getApiKey(org.id, user.id);
    const hasApiKey = keyInfo.hasKey || !!process.env.ANTHROPIC_API_KEY;

    if (!hasApiKey) {
      return Response.json({ complete: false, hasApiKey: false, hasDeployed: false });
    }

    // Step 2: must have deployed agents
    const targets = await listTargets(user.id);
    const hasDeployed = targets.some((t) => t.status === "deployed");

    return Response.json({
      complete: hasDeployed,
      hasApiKey,
      hasDeployed,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

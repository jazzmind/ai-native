import { listTargets } from "@/lib/config-store";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getRequiredUser();
    const targets = listTargets(user.id);
    const hasDeployed = targets.some((t) => t.status === "deployed");
    const hasConfigured = targets.some(
      (t) => t.status === "configured" || t.status === "deployed"
    );
    return Response.json({
      complete: hasDeployed,
      hasTargets: targets.length > 0,
      hasConfigured,
      hasDeployed,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

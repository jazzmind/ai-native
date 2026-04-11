import { listTargets } from "@/lib/config-store";

export async function GET() {
  try {
    const targets = listTargets();
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
  } catch {
    return Response.json({
      complete: false,
      hasTargets: false,
      hasConfigured: false,
      hasDeployed: false,
    });
  }
}

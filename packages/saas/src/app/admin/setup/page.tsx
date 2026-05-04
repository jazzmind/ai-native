import { redirect } from "next/navigation";

// Deployment setup has moved to Settings → Deploy Agents
export default function AdminSetupRedirect() {
  redirect("/settings/deploy");
}

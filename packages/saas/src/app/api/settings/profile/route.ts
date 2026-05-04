import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getOrganization, updateOrganization, getUserOrganization } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getRequiredUser();
    const org = await getUserOrganization(user.id);
    return Response.json({ user, org });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const { orgName } = await req.json();

    if (orgName) {
      const org = await getUserOrganization(user.id);
      if (org) {
        await updateOrganization(org.id, { name: orgName });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

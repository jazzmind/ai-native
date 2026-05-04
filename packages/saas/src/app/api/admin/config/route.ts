import { NextRequest } from "next/server";
import { getAllConfig, setConfig } from "@/lib/config-store";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getRequiredUser();
    return Response.json(await getAllConfig(user.id));
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const { key, value } = await req.json();
    if (!key) return Response.json({ error: "key required" }, { status: 400 });
    await setConfig(key, value, user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

import { NextRequest } from "next/server";
import { getProfileProvider } from "@/lib/profile";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { user } = await getRequiredUserAndOrg();
    const category = req.nextUrl.searchParams.get("category") || undefined;
    const provider = getProfileProvider();
    const entries = await provider.list(user.id, category);
    return Response.json({ entries });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    const body = await req.json();
    const { category, key, value, sourceConversation } = body;

    if (!category || !key || !value) {
      return Response.json(
        { error: "category, key, and value are required" },
        { status: 400 }
      );
    }

    const provider = getProfileProvider();
    await provider.upsert(user.id, category, key, value, sourceConversation, org.id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await getRequiredUserAndOrg();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const provider = getProfileProvider();
    await provider.delete(user.id, id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

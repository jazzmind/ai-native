import { NextRequest } from "next/server";
import { getAllConfig, setConfig } from "@/lib/config-store";

export async function GET() {
  return Response.json(getAllConfig());
}

export async function POST(req: NextRequest) {
  const { key, value } = await req.json();
  if (!key) return Response.json({ error: "key required" }, { status: 400 });
  setConfig(key, value);
  return Response.json({ ok: true });
}

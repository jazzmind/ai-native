import { NextRequest } from "next/server";
import { getAdapter } from "@/lib/deploy";

export async function POST(req: NextRequest) {
  const { type, config } = await req.json();

  const adapter = getAdapter(type);
  if (!adapter) return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });

  const result = await adapter.validate(config);
  return Response.json(result);
}

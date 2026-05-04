/**
 * Setup endpoint — ensures data documents exist and syncs advisor definitions.
 * Called on first load by the app and can be triggered manually.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@lib/auth-middleware";
import { ensureDataDocuments } from "@lib/data-api-client";
import { syncAdvisorsOnce } from "@lib/sync";

export async function GET(request: NextRequest) {
  return handleSetup(request);
}

export async function POST(request: NextRequest) {
  return handleSetup(request);
}

async function handleSetup(request: NextRequest) {
  const dataAuth = await requireAuthWithTokenExchange(request, "data-api");
  if (dataAuth instanceof NextResponse) return dataAuth;

  const agentAuth = await requireAuthWithTokenExchange(request, "agent-api");
  if (agentAuth instanceof NextResponse) return agentAuth;

  try {
    const documentIds = await ensureDataDocuments(dataAuth.apiToken);

    await syncAdvisorsOnce(agentAuth.apiToken, {
      conversations: documentIds.conversations,
      messages: documentIds.messages,
      eaMemory: documentIds.eaMemory,
    });

    return NextResponse.json({
      ok: true,
      documentIds,
    });
  } catch (err) {
    console.error("[SETUP] Failed:", err);
    return NextResponse.json({ error: "Setup failed", details: String(err) }, { status: 500 });
  }
}

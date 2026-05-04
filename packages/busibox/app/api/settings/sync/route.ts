import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@lib/auth-middleware";
import { ensureDataDocuments } from "@lib/data-api-client";
import { syncAdvisors, getAdvisorSyncStatus } from "@lib/sync";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "agent-api");
  if (auth instanceof NextResponse) return auth;

  const status = await getAdvisorSyncStatus(auth.apiToken);
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const agentAuth = await requireAuthWithTokenExchange(request, "agent-api");
  if (agentAuth instanceof NextResponse) return agentAuth;

  const dataAuth = await requireAuthWithTokenExchange(request, "data-api");
  if (dataAuth instanceof NextResponse) return dataAuth;

  const documentIds = await ensureDataDocuments(dataAuth.apiToken);
  const result = await syncAdvisors(agentAuth.apiToken, {
    conversations: documentIds.conversations,
    messages: documentIds.messages,
    eaMemory: documentIds.eaMemory,
  });

  return NextResponse.json(result);
}

/**
 * Advisor definition sync to busibox agent-api.
 * Called once on app startup and on-demand via /api/settings/sync.
 */

import { syncAgentDefinitions, getAgentSyncStatus } from "@jazzmind/busibox-app/lib/agent/sync";
import type { AgentSyncResult, SyncStatus } from "@jazzmind/busibox-app/lib/agent";
import { buildAdvisorDefinitions } from "./advisors";

interface DocumentIds {
  conversations: string;
  messages: string;
  eaMemory: string;
}

export async function syncAdvisors(
  agentApiToken: string,
  documentIds: DocumentIds,
): Promise<AgentSyncResult> {
  const definitions = buildAdvisorDefinitions(documentIds);
  return syncAgentDefinitions(
    agentApiToken,
    definitions,
    process.env.AGENT_API_URL || "http://localhost:8000",
  );
}

export async function getAdvisorSyncStatus(agentApiToken: string): Promise<SyncStatus> {
  const definitions = buildAdvisorDefinitions({
    conversations: "",
    messages: "",
    eaMemory: "",
  });
  return getAgentSyncStatus(
    agentApiToken,
    definitions,
    process.env.AGENT_API_URL || "http://localhost:8000",
  );
}

let syncedOnce = false;

export async function syncAdvisorsOnce(
  agentApiToken: string,
  documentIds: DocumentIds,
): Promise<void> {
  if (syncedOnce) return;
  syncedOnce = true;
  try {
    await syncAdvisors(agentApiToken, documentIds);
  } catch (err) {
    console.error("[SYNC] Failed to sync advisors:", err);
    syncedOnce = false; // allow retry
  }
}

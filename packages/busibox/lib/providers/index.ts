/**
 * Provider factories — Busibox implementations of the shared @ai-native/core
 * provider interfaces.
 */

export { BusiboxAuthProvider, exchangeForAuthzToken, type AuthzTokenResponse } from "./auth-provider";
export { BusiboxStorageProvider } from "./storage-provider";
export { BusiboxAgentProvider } from "./agent-provider";
export { BusiboxKnowledgeProvider, searchKnowledgeForContext } from "../knowledge";

import { BusiboxAuthProvider } from "./auth-provider";
import { BusiboxStorageProvider } from "./storage-provider";
import { BusiboxAgentProvider } from "./agent-provider";
import { BusiboxKnowledgeProvider } from "../knowledge";

export function getAuthProvider(): BusiboxAuthProvider {
  return new BusiboxAuthProvider();
}

export function getStorageProvider(token: string): BusiboxStorageProvider {
  return new BusiboxStorageProvider(token);
}

export function getAgentProvider(token: string, agentApiUrl?: string): BusiboxAgentProvider {
  return new BusiboxAgentProvider(token, agentApiUrl);
}

export function getKnowledgeProvider(getToken: () => Promise<string>): BusiboxKnowledgeProvider {
  return new BusiboxKnowledgeProvider(getToken);
}

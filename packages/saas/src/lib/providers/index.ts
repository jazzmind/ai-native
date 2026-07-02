import { SaasAuthProvider } from "./auth-provider";
import { PostgresStorageProvider } from "./storage-provider";
import { SaasAgentProvider } from "./agent-provider";

export type { SaasAuthProvider } from "./auth-provider";
export type { PostgresStorageProvider } from "./storage-provider";
export type { SaasAgentProvider } from "./agent-provider";

// SaaS always uses NextAuth + Postgres/Neon — no Busibox-target detection needed,
// matching the pattern in lib/{knowledge,activity,profile}/index.ts.

const _authProvider = new SaasAuthProvider();
const _storageProvider = new PostgresStorageProvider();

export function getAuthProvider(): SaasAuthProvider {
  return _authProvider;
}

export function getStorageProvider(): PostgresStorageProvider {
  return _storageProvider;
}

/**
 * Unlike the other providers, AgentProvider is not a stateless singleton:
 * lib/router.ts and lib/session-manager.ts need the caller's authenticated
 * userId and resolved Anthropic API key, neither of which are part of the
 * per-call AgentProvider method signatures (see agent-provider.ts). Callers
 * resolve both via getAuthProvider() first, then construct a per-request
 * instance here.
 */
export function getAgentProvider(apiKey: string, userId: string): SaasAgentProvider {
  return new SaasAgentProvider(apiKey, userId);
}

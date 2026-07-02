import { PostgresKnowledgeProvider } from "./postgres-knowledge-provider";

export type { KnowledgeProvider, ProviderContext, SearchResult, Collection, DocumentInput, KnowledgeDocument } from "@ai-native/core";
export { knowledgeToolPrompt } from "@ai-native/core";

// SaaS always uses Postgres/Neon — no Busibox-target detection needed.
const _provider = new PostgresKnowledgeProvider();

export function getKnowledgeProvider() {
  return _provider;
}

export function resetKnowledgeProvider(): void {
  // No-op — singleton Postgres provider needs no reset.
}

import { PostgresKnowledgeProvider } from "./postgres-knowledge-provider";

export type { KnowledgeProvider, ProviderContext, SearchResult, Collection, DocumentInput, KnowledgeDocument } from "./knowledge-provider";
export { knowledgeToolPrompt } from "./knowledge-provider";

// SaaS always uses Postgres/Neon — no Busibox-target detection needed.
const _provider = new PostgresKnowledgeProvider();

export function getKnowledgeProvider() {
  return _provider;
}

export function resetKnowledgeProvider(): void {
  // No-op — singleton Postgres provider needs no reset.
}

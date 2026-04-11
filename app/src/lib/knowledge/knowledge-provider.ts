export interface SearchResult {
  id: string;
  content: string;
  title?: string;
  source?: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface Collection {
  id: string;
  name: string;
  documentCount: number;
  description?: string;
}

export interface DocumentInput {
  content: string;
  title?: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeProvider {
  readonly type: string;

  search(query: string, options?: { limit?: number; collection?: string }): Promise<SearchResult[]>;

  ingest(doc: DocumentInput, collection?: string): Promise<{ id: string }>;

  listCollections(): Promise<Collection[]>;

  isAvailable(): Promise<boolean>;
}

/**
 * Generates a system prompt augmentation that gives a coach access to knowledge search.
 * When a knowledge provider is configured, this describes the tool the coach can use.
 */
export function knowledgeToolPrompt(providerType: string): string {
  return (
    "\n\n## Knowledge Base Access\n\n" +
    `You have access to the organization's knowledge base (via ${providerType}). ` +
    "When a user asks about company-specific information — contracts, financials, strategy documents, " +
    "technical architecture, team structure, or any internal data — use the knowledge_search tool " +
    "to find relevant documents before answering. Always cite the source documents in your response.\n" +
    "If the knowledge search returns no results, let the user know and offer to help them add the information.\n"
  );
}

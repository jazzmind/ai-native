export interface ProviderContext {
  userId: string;
  projectId?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  title?: string;
  source?: string;
  score: number;
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocument {
  id: string;
  collection_id: string;
  title: string;
  content: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface KnowledgeProvider {
  readonly type: string;

  search(ctx: ProviderContext, query: string, options?: { limit?: number; collection?: string }): Promise<SearchResult[]>;

  ingest(ctx: ProviderContext, doc: DocumentInput, collection?: string): Promise<{ id: string }>;

  listCollections(ctx: ProviderContext): Promise<Collection[]>;

  listDocuments(ctx: ProviderContext, collection?: string): Promise<KnowledgeDocument[]>;

  getDocument(ctx: ProviderContext, id: string): Promise<KnowledgeDocument | null>;

  updateDocument(ctx: ProviderContext, id: string, doc: Partial<DocumentInput>): Promise<void>;

  deleteDocument(ctx: ProviderContext, id: string): Promise<void>;

  isAvailable(): Promise<boolean>;
}

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

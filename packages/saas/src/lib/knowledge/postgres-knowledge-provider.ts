import { eq, and, asc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db/client";
import { knowledgeCollections, knowledgeDocuments } from "@/lib/db/schema";
import type { KnowledgeProvider, ProviderContext, SearchResult, Collection, DocumentInput, KnowledgeDocument } from "./knowledge-provider";

export class PostgresKnowledgeProvider implements KnowledgeProvider {
  readonly type = "postgres";

  async search(ctx: ProviderContext, query: string, options?: { limit?: number; collection?: string }): Promise<SearchResult[]> {
    const db = getDb();
    const limit = options?.limit ?? 10;

    try {
      // Use plainto_tsquery for safe user-input FTS
      let whereClause = sql`kd.user_id = ${ctx.userId} AND kd.tsv @@ plainto_tsquery('english', ${query})`;
      if (ctx.projectId) {
        whereClause = sql`(kd.user_id = ${ctx.userId} AND (kd.project_id = ${ctx.projectId} OR kd.project_id IS NULL)) AND kd.tsv @@ plainto_tsquery('english', ${query})`;
      }
      if (options?.collection) {
        whereClause = sql`${whereClause} AND kd.collection_id = ${options.collection}`;
      }

      const result = await db.execute<{
        id: string; title: string; content: string; source: string; metadata: unknown;
        rank: number;
      }>(sql`
        SELECT kd.id, kd.title, kd.content, kd.source, kd.metadata,
               ts_rank(kd.tsv, plainto_tsquery('english', ${query})) AS rank
        FROM knowledge_documents kd
        WHERE ${whereClause}
        ORDER BY rank DESC
        LIMIT ${limit}
      `);

      const rows = (result as any).rows ?? result;
      return (rows as any[]).map(r => ({
        id: r.id,
        content: r.content,
        title: r.title || "",
        source: r.source || "",
        score: typeof r.rank === "number" ? r.rank : 0,
        metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) : {},
      }));
    } catch {
      return [];
    }
  }

  async ingest(ctx: ProviderContext, doc: DocumentInput, collection?: string): Promise<{ id: string }> {
    const db = getDb();
    const id = uuidv4();
    const collectionId = collection || "default";

    // Ensure collection exists
    const [existingCollection] = await db
      .select({ id: knowledgeCollections.id })
      .from(knowledgeCollections)
      .where(eq(knowledgeCollections.id, collectionId));

    if (!existingCollection) {
      await db.insert(knowledgeCollections).values({
        id: collectionId,
        orgId: "unknown",
        userId: ctx.userId,
        projectId: ctx.projectId ?? null,
        name: collectionId,
        description: "",
      });
    }

    // Insert document with tsvector computed inline
    await db.execute(sql`
      INSERT INTO knowledge_documents (id, collection_id, org_id, user_id, project_id, title, content, source, metadata, tsv)
      VALUES (
        ${id}, ${collectionId}, ${"unknown"}, ${ctx.userId}, ${ctx.projectId ?? null},
        ${doc.title ?? ""}, ${doc.content}, ${doc.source ?? ""}, ${JSON.stringify(doc.metadata ?? {})},
        to_tsvector('english', coalesce(${doc.title ?? ""}, '') || ' ' || ${doc.content})
      )
    `);

    return { id };
  }

  async listCollections(ctx: ProviderContext): Promise<Collection[]> {
    const db = getDb();
    const condition = ctx.projectId
      ? and(eq(knowledgeCollections.userId, ctx.userId), sql`(${knowledgeCollections.projectId} = ${ctx.projectId} OR ${knowledgeCollections.projectId} IS NULL)`)
      : eq(knowledgeCollections.userId, ctx.userId);

    const rows = await db
      .select()
      .from(knowledgeCollections)
      .where(condition)
      .orderBy(asc(knowledgeCollections.name));

    return await Promise.all(rows.map(async r => {
      const countResult = await db.execute<{ cnt: string }>(
        sql`SELECT COUNT(*) as cnt FROM knowledge_documents WHERE collection_id = ${r.id}`
      );
      const countRows = (countResult as any).rows ?? countResult;
      const [countRow] = countRows as { cnt: string }[];
      return {
        id: r.id,
        name: r.name,
        documentCount: parseInt(countRow?.cnt ?? "0", 10),
        description: r.description || "",
      };
    }));
  }

  async listDocuments(ctx: ProviderContext, collection?: string): Promise<KnowledgeDocument[]> {
    const db = getDb();
    const userCondition = ctx.projectId
      ? sql`(kd.user_id = ${ctx.userId} AND (kd.project_id = ${ctx.projectId} OR kd.project_id IS NULL))`
      : sql`kd.user_id = ${ctx.userId}`;

    const collectionClause = collection ? sql` AND kd.collection_id = ${collection}` : sql``;

    const listResult = await db.execute<{
      id: string; collection_id: string; title: string; content: string; source: string; metadata: unknown;
    }>(sql`
      SELECT kd.id, kd.collection_id, kd.title, kd.content, kd.source, kd.metadata
      FROM knowledge_documents kd
      WHERE ${userCondition}${collectionClause}
      ORDER BY kd.title ASC
    `);

    const listRows = ((listResult as any).rows ?? listResult) as any[];
    return listRows.map(r => ({
      id: r.id,
      collection_id: r.collection_id,
      title: r.title || "",
      content: r.content || "",
      source: r.source || "",
      metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata as Record<string, unknown>) : {},
    }));
  }

  async getDocument(ctx: ProviderContext, id: string): Promise<KnowledgeDocument | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.id, id), eq(knowledgeDocuments.userId, ctx.userId)));

    if (!row) return null;
    return {
      id: row.id,
      collection_id: row.collectionId,
      title: row.title || "",
      content: row.content || "",
      source: row.source || "",
      metadata: row.metadata ? (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata as Record<string, unknown>) : {},
    };
  }

  async updateDocument(ctx: ProviderContext, id: string, doc: Partial<DocumentInput>): Promise<void> {
    const existing = await this.getDocument(ctx, id);
    if (!existing) throw new Error("Document not found");

    const newTitle = doc.title ?? existing.title;
    const newContent = doc.content ?? existing.content;
    const newSource = doc.source ?? existing.source;
    const newMetadata = doc.metadata ?? existing.metadata;

    // Update including tsv regeneration
    await getDb().execute(sql`
      UPDATE knowledge_documents
      SET title = ${newTitle},
          content = ${newContent},
          source = ${newSource},
          metadata = ${JSON.stringify(newMetadata)},
          tsv = to_tsvector('english', coalesce(${newTitle}, '') || ' ' || ${newContent}),
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${ctx.userId}
    `);
  }

  async deleteDocument(ctx: ProviderContext, id: string): Promise<void> {
    const db = getDb();
    await db
      .delete(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.id, id), eq(knowledgeDocuments.userId, ctx.userId)));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

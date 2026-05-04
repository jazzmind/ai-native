import { NextRequest } from "next/server";
import { getKnowledgeProvider } from "@/lib/knowledge";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import type { ProviderContext } from "@/lib/knowledge";

export async function GET(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const projectId = searchParams.get("projectId") || undefined;
    const provider = getKnowledgeProvider();
    const ctx: ProviderContext = { userId: user.id, projectId };

    if (action === "collections") {
      const collections = await provider.listCollections(ctx);
      return Response.json({ type: provider.type, collections });
    }

    if (action === "documents") {
      const collection = searchParams.get("collection") || undefined;
      const documents = await provider.listDocuments(ctx, collection);
      return Response.json({ type: provider.type, documents });
    }

    if (action === "document") {
      const id = searchParams.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const doc = await provider.getDocument(ctx, id);
      if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ type: provider.type, document: doc });
    }

    if (action === "status") {
      const available = await provider.isAvailable();
      return Response.json({ type: provider.type, available });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();
    const { action, projectId } = body;
    const provider = getKnowledgeProvider();
    const ctx: ProviderContext = { userId: user.id, projectId };

    if (action === "search") {
      const results = await provider.search(ctx, body.query, {
        limit: body.limit,
        collection: body.collection,
      });
      return Response.json({ type: provider.type, results });
    }

    if (action === "ingest") {
      const result = await provider.ingest(
        ctx,
        { content: body.content, title: body.title, source: body.source, metadata: body.metadata },
        body.collection
      );
      return Response.json({ ok: true, ...result });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();
    const { id, projectId, ...updates } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const provider = getKnowledgeProvider();
    const ctx: ProviderContext = { userId: user.id, projectId };
    await provider.updateDocument(ctx, id, updates);
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const projectId = searchParams.get("projectId") || undefined;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const provider = getKnowledgeProvider();
    const ctx: ProviderContext = { userId: user.id, projectId };
    await provider.deleteDocument(ctx, id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

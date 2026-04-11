import { NextRequest } from "next/server";
import { getKnowledgeProvider } from "@/lib/knowledge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  const provider = getKnowledgeProvider();

  if (action === "collections") {
    const collections = await provider.listCollections();
    return Response.json({ type: provider.type, collections });
  }

  if (action === "status") {
    const available = await provider.isAvailable();
    return Response.json({ type: provider.type, available });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;
  const provider = getKnowledgeProvider();

  if (action === "search") {
    const results = await provider.search(body.query, {
      limit: body.limit,
      collection: body.collection,
    });
    return Response.json({ type: provider.type, results });
  }

  if (action === "ingest") {
    const result = await provider.ingest(
      { content: body.content, title: body.title, source: body.source, metadata: body.metadata },
      body.collection
    );
    return Response.json({ ok: true, ...result });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

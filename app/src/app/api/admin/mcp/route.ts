import { NextRequest } from "next/server";
import { listMcpConnections, upsertMcpConnection } from "@/lib/config-store";
import { v4 as uuidv4 } from "uuid";

const MCP_SERVERS = [
  { name: "notion", label: "Notion", oauthUrl: "https://mcp.notion.com/mcp", description: "Connect to Notion workspaces for document management." },
  { name: "slack", label: "Slack", oauthUrl: "https://mcp.slack.com/mcp", description: "Connect to Slack for team communication." },
  { name: "google-workspace", label: "Google Workspace", oauthUrl: null, description: "Gmail, Drive, Calendar, Sheets integration. Requires Claude connector." },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("targetId");

  if (targetId) {
    const connections = listMcpConnections(targetId);
    const result = MCP_SERVERS.map(server => {
      const conn = connections.find(c => c.mcpName === server.name);
      return {
        ...server,
        status: conn?.status || "disconnected",
        vaultId: conn?.vaultId || null,
        connectionId: conn?.id || null,
      };
    });
    return Response.json(result);
  }

  return Response.json(MCP_SERVERS);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, targetId, mcpName, vaultId } = body;

  if (action === "connect") {
    const conn = {
      id: uuidv4(),
      targetId,
      mcpName,
      status: "connected" as const,
      vaultId: vaultId || null,
    };
    upsertMcpConnection(conn);
    return Response.json({ ok: true, connection: conn });
  }

  if (action === "disconnect") {
    const conn = {
      id: body.connectionId || uuidv4(),
      targetId,
      mcpName,
      status: "disconnected" as const,
      vaultId: null,
    };
    upsertMcpConnection(conn);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Loader2, RefreshCw, Trash2, Link2, Unlink, Key, Eye, EyeOff, Save } from "lucide-react";
import { useRouter } from "next/navigation";

interface Target {
  id: string;
  type: string;
  name: string;
  status: string;
  lastDeployedAt: string | null;
  agentState: Record<string, any>;
  config: Record<string, any>;
}

interface AgentStatus {
  key: string;
  agentId: string;
  name: string;
  healthy: boolean;
  version: number;
  error?: string;
}

interface McpServer {
  name: string;
  label: string;
  oauthUrl: string | null;
  description: string;
  status: string;
  vaultId: string | null;
  connectionId: string | null;
}

export default function TargetDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [editingKey, setEditingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keySaveMsg, setKeySaveMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/targets")
      .then(r => r.json())
      .then((targets: Target[]) => {
        const t = targets.find(t => t.id === id);
        setTarget(t || null);
      })
      .finally(() => setLoading(false));
    fetch(`/api/admin/mcp?targetId=${id}`)
      .then(r => r.json())
      .then(setMcpServers)
      .catch(() => {});
  }, [id]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/admin/targets/${id}/status`);
      const data = await res.json();
      setAgentStatuses(data.agents || []);
    } catch { /* ignore */ }
    setChecking(false);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await fetch(`/api/admin/targets/${id}/deploy`, { method: "POST" });
      const res = await fetch("/api/admin/targets");
      const targets = await res.json();
      setTarget(targets.find((t: Target) => t.id === id) || null);
    } catch { /* ignore */ }
    setDeploying(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this deployment target? This will not remove deployed agents.")) return;
    await fetch("/api/admin/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    router.push("/admin");
  };

  const handleUpdateApiKey = async () => {
    if (!newApiKey.trim()) return;
    setSavingKey(true);
    setKeySaveMsg(null);
    try {
      const res = await fetch("/api/admin/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_config", id, config: { apiKey: newApiKey.trim() } }),
      });
      if (res.ok) {
        setKeySaveMsg("API key updated");
        setEditingKey(false);
        setNewApiKey("");
        const targetsRes = await fetch("/api/admin/targets");
        const targets = await targetsRes.json();
        setTarget(targets.find((t: Target) => t.id === id) || null);
      } else {
        setKeySaveMsg("Failed to update");
      }
    } catch {
      setKeySaveMsg("Failed to update");
    }
    setSavingKey(false);
    setTimeout(() => setKeySaveMsg(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!target) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-[var(--text-muted)]">Target not found.</p>
        <Link href="/admin" className="text-[var(--accent)] text-sm mt-2 inline-block">Back to Admin</Link>
      </div>
    );
  }

  const agents = Object.entries(target.agentState?.agents || {}) as [string, { id: string; version: number; name: string }][];

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-4xl mx-auto p-8">
      <Link href="/admin" className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] mb-6">
        <ArrowLeft size={14} /> Back to Admin
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{target.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">Claude Managed Agents</p>
        </div>
        <div className="flex gap-2">
          <button onClick={checkStatus} disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]">
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} /> Check Status
          </button>
          <button onClick={handleDeploy} disabled={deploying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">
            {deploying ? <><Loader2 size={14} className="animate-spin" /> Deploying...</> : "Redeploy All"}
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Status</div>
          <div className={`text-sm font-bold ${target.status === "deployed" ? "text-emerald-400" : target.status === "error" ? "text-red-400" : "text-yellow-400"}`}>
            {target.status}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Agents</div>
          <div className="text-sm font-bold text-[var(--text)]">{agents.length}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Last Deployed</div>
          <div className="text-sm font-bold text-[var(--text)]">
            {target.lastDeployedAt ? new Date(target.lastDeployedAt).toLocaleString() : "Never"}
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold text-[var(--text)] mb-4">Configuration</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] rounded-lg">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-[var(--text-muted)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">API Key</div>
                <div className="text-[10px] text-[var(--text-muted)]">Anthropic API key</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingKey ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="Enter new API key"
                      className="w-64 bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--accent)] pr-8"
                      autoFocus
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <button
                    onClick={handleUpdateApiKey}
                    disabled={savingKey || !newApiKey.trim()}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded bg-[var(--accent)] text-white disabled:opacity-40"
                  >
                    {savingKey ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingKey(false); setNewApiKey(""); }}
                    className="px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {target.config?.apiKey
                      ? `${target.config.apiKey.slice(0, 12)}...${target.config.apiKey.slice(-4)}`
                      : "Not set"}
                  </span>
                  <button
                    onClick={() => setEditingKey(true)}
                    className="px-2.5 py-1 text-xs font-semibold rounded border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                  >
                    Change
                  </button>
                </div>
              )}
              {keySaveMsg && (
                <span className={`text-xs font-semibold ${keySaveMsg.includes("Failed") ? "text-red-400" : "text-emerald-400"}`}>
                  {keySaveMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MCP Connections */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold text-[var(--text)] mb-4">MCP Server Connections</h2>
        <div className="space-y-2">
          {mcpServers.map(server => (
            <div key={server.name} className="flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] rounded-lg">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{server.label}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{server.description}</div>
              </div>
              <div className="flex items-center gap-3">
                {server.status === "connected" ? (
                  <>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={12} /> Connected
                    </span>
                    <button onClick={async () => {
                      await fetch("/api/admin/mcp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "disconnect", targetId: id, mcpName: server.name, connectionId: server.connectionId }),
                      });
                      const res = await fetch(`/api/admin/mcp?targetId=${id}`);
                      setMcpServers(await res.json());
                    }} className="text-xs text-red-400 hover:underline flex items-center gap-1">
                      <Unlink size={12} /> Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-[var(--text-muted)]">Not connected</span>
                    {server.oauthUrl ? (
                      <button onClick={async () => {
                        window.open(server.oauthUrl!, "_blank");
                        await fetch("/api/admin/mcp", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "connect", targetId: id, mcpName: server.name }),
                        });
                        const res = await fetch(`/api/admin/mcp?targetId=${id}`);
                        setMcpServers(await res.json());
                      }} className="px-2 py-1 text-xs font-semibold rounded bg-[var(--accent)] text-white flex items-center gap-1">
                        <Link2 size={12} /> Connect
                      </button>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] italic">Requires Claude connector</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-sm font-bold text-[var(--text)] mb-4">Deployed Agents</h2>
        {agents.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">No agents deployed yet. Click "Redeploy All" to deploy.</p>
        ) : (
          <div className="space-y-2">
            {agents.map(([key, info]) => {
              const liveStatus = agentStatuses.find(s => s.key === key);
              return (
                <div key={key} className="flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{info.name}</div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)]">{info.id} (v{info.version})</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {liveStatus ? (
                      <>
                        {liveStatus.healthy
                          ? <CheckCircle size={14} className="text-emerald-400" />
                          : <XCircle size={14} className="text-red-400" />}
                        <span className={`text-xs font-semibold ${liveStatus.healthy ? "text-emerald-400" : "text-red-400"}`}>
                          {liveStatus.healthy ? "Healthy" : liveStatus.error || "Unhealthy"}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Click "Check Status"</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

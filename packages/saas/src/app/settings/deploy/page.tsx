"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, CheckCircle, XCircle, Loader2, Key, AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { COACH_META } from "@/lib/coaches";
import { CoachIcon } from "@/components/CoachIcon";

type Step = "idle" | "deploying" | "done";

interface DeployedAgent {
  id: string;
  name: string;
  version: number;
}

interface Target {
  id: string;
  type: string;
  name: string;
  status: string;
  agentState?: { agents?: Record<string, DeployedAgent>; environment_id?: string };
  createdAt: string;
}

interface AnthropicAgent {
  id: string;
  name: string;
  model: string;
  version: number;
  createdAt: string;
  tracked: boolean;
}

export default function DeployPage() {
  const router = useRouter();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [redeploying, setRedeploying] = useState<string | null>(null);
  const [cleanupAgents, setCleanupAgents] = useState<AnthropicAgent[] | null>(null);
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);

  useEffect(() => {
    fetch("/api/settings/api-key")
      .then((r) => r.json())
      .then((data) => setHasApiKey(!!data.hasKey))
      .catch(() => setHasApiKey(false))
      .finally(() => setLoadingKey(false));

    loadTargets();
  }, []);

  async function loadTargets() {
    setLoadingTargets(true);
    try {
      const res = await fetch("/api/admin/targets");
      if (res.ok) {
        const data = await res.json();
        // Route returns array or { targets: [] } depending on version
        setTargets(Array.isArray(data) ? data : (data.targets || []));
      }
    } finally {
      setLoadingTargets(false);
    }
  }

  async function handleDeploy() {
    setStep("deploying");
    setDeployError(null);
    try {
      const validateRes = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cma", config: { useStoredKey: true } }),
      });
      const validateResult = await validateRes.json();
      if (!validateResult.valid) {
        setDeployError(validateResult.error || "Validation failed");
        setStep("idle");
        return;
      }

      // Reuse an existing CMA target if one already exists — do not create a new one,
      // otherwise agentState is wiped and the deploy creates brand-new agents each time.
      const existingCma = targets.find((t) => t.type === "cma");
      let targetId: string;

      if (existingCma) {
        targetId = existingCma.id;
      } else {
        const createRes = await fetch("/api/admin/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "cma",
            name: "Claude Managed Agents",
            config: { useStoredKey: true },
          }),
        });
        const { target } = await createRes.json();
        targetId = target.id;
      }

      const deployRes = await fetch(`/api/admin/targets/${targetId}/deploy`, { method: "POST" });
      const deployResult = await deployRes.json();
      if (!deployResult.ok) {
        setDeployError(deployResult.error || "Deployment failed");
        setStep("idle");
        return;
      }
      if (deployResult.result?.error) {
        setDeployError(`Partial deployment: ${deployResult.result.error}`);
      }
      setStep("done");
      await loadTargets();
    } catch (e: any) {
      setDeployError(e.message || "Deployment failed");
      setStep("idle");
    }
  }

  async function handleRedeploy(targetId: string) {
    setRedeploying(targetId);
    setDeployError(null);
    try {
      const res = await fetch(`/api/admin/targets/${targetId}/deploy`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setDeployError(data.error || "Redeployment failed");
      } else if (data.result?.error) {
        setDeployError(`Partial deployment: ${data.result.error}`);
      }
      await loadTargets();
    } catch (e: any) {
      setDeployError(e.message || "Redeployment failed");
    } finally {
      setRedeploying(null);
    }
  }

  async function loadCleanup() {
    setLoadingCleanup(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/admin/cleanup");
      if (res.ok) {
        const data = await res.json();
        setCleanupAgents(data.agents || []);
      } else {
        setCleanupResult("Failed to load agents from Anthropic");
      }
    } catch {
      setCleanupResult("Failed to connect to Anthropic API");
    } finally {
      setLoadingCleanup(false);
    }
  }

  async function handleArchiveOrphans() {
    setArchiving(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveOrphans: true }),
      });
      const data = await res.json();
      setCleanupResult(`Archived ${data.archived} agent(s).${data.failed > 0 ? ` ${data.failed} failed.` : ""}`);
      await loadCleanup();
    } catch {
      setCleanupResult("Archive failed");
    } finally {
      setArchiving(false);
    }
  }

  const deployedTargets = targets.filter((t) => t.status === "deployed");
  const agentCount = COACH_META.length + 1; // coaches + QA Judge
  const advisorCount = COACH_META.length;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Rocket className="w-6 h-6 text-[var(--accent)]" />
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Deploy Agents</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Deploy your AI advisory team to Claude Managed Agents.
          </p>
        </div>
      </div>

      {/* API key status */}
      {!loadingKey && !hasApiKey && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400">
            No API key found.{" "}
            <a href="/settings/api-keys" className="underline hover:no-underline">Add one first</a>.
          </span>
        </div>
      )}

      {deployError && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <XCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-400">{deployError}</span>
        </div>
      )}

      {/* Agent preview */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <p className="text-xs text-[var(--text-muted)] mb-4">
          This will deploy {agentCount} agents ({advisorCount} advisors + QA Judge) to Claude Managed Agents.
        </p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {COACH_META.map((coach) => (
            <div
              key={coach.key}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]"
            >
              <CoachIcon name={coach.icon} size={13} className="text-[var(--accent)] shrink-0" />
              <span className="text-[11px] font-medium text-[var(--text)] truncate">
                {coach.name.replace(/ (Advisor|Coach)$/, "")}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
            <CoachIcon name="Target" size={13} className="text-[var(--text-muted)] shrink-0" />
            <span className="text-[11px] font-medium text-[var(--text-muted)]">QA Judge</span>
          </div>
        </div>

        {step === "idle" && (
          <button
            onClick={handleDeploy}
            disabled={!hasApiKey || loadingKey}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 transition-opacity"
          >
            <Rocket size={14} /> Deploy All Agents
          </button>
        )}

        {step === "deploying" && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 size={16} className="animate-spin" />
            Deploying agents... this may take a minute.
          </div>
        )}

        {step === "done" && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle size={16} />
            Deployment complete.
            <button
              onClick={() => { setStep("idle"); router.push("/dashboard"); }}
              className="ml-2 text-[var(--accent)] underline text-xs"
            >
              Start chatting →
            </button>
          </div>
        )}
      </div>

      {/* Agent Cleanup */}
      <div className="mt-6 border border-[var(--border)] rounded-xl overflow-hidden">
        <button
          onClick={() => { setShowCleanup(!showCleanup); if (!showCleanup && !cleanupAgents) loadCleanup(); }}
          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
        >
          <div className="flex items-center gap-2">
            <Trash2 size={14} className="text-[var(--text-muted)]" />
            <span className="font-medium text-[var(--text)]">Agent Cleanup</span>
            <span className="text-xs text-[var(--text-muted)]">Remove orphaned Anthropic agents</span>
          </div>
          {showCleanup ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
        </button>

        {showCleanup && (
          <div className="px-4 py-4 bg-[var(--bg)]">
            {cleanupResult && (
              <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]">
                {cleanupResult}
              </div>
            )}

            {loadingCleanup ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-2">
                <Loader2 size={14} className="animate-spin" /> Loading agents from Anthropic…
              </div>
            ) : cleanupAgents === null ? (
              <button
                onClick={loadCleanup}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Load agents
              </button>
            ) : (
              <>
                <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
                  {cleanupAgents.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">No agents found.</p>
                  ) : (
                    cleanupAgents.map((a) => (
                      <div key={a.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${
                        a.tracked
                          ? "bg-green-500/5 border-green-500/20 text-[var(--text-muted)]"
                          : "bg-red-500/5 border-red-500/20 text-red-400"
                      }`}>
                        <div>
                          <span className="font-medium">{a.name}</span>
                          <span className="ml-2 opacity-60">v{a.version} · {a.id.slice(0, 12)}…</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                          a.tracked
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}>
                          {a.tracked ? "tracked" : "orphan"}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={loadCleanup}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1"
                  >
                    <RefreshCw size={11} /> Refresh
                  </button>
                  {cleanupAgents.some((a) => !a.tracked) && (
                    <button
                      onClick={handleArchiveOrphans}
                      disabled={archiving}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {archiving ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Archive {cleanupAgents.filter((a) => !a.tracked).length} orphan{cleanupAgents.filter((a) => !a.tracked).length !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Existing deployments */}
      {!loadingTargets && deployedTargets.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Active Deployments</h3>
          <div className="space-y-3">
            {deployedTargets.map((target) => {
              const agents = target.agentState?.agents || {};
              const agentEntries = Object.entries(agents);
              const isRedeploying = redeploying === target.id;

              return (
                <div key={target.id} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text)]">{target.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                          deployed
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        {agentEntries.length} agents · Deployed {new Date(target.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRedeploy(target.id)}
                      disabled={isRedeploying}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/40 disabled:opacity-40 transition-colors"
                    >
                      {isRedeploying ? (
                        <><Loader2 size={11} className="animate-spin" /> Redeploying...</>
                      ) : (
                        <><RefreshCw size={11} /> Redeploy</>
                      )}
                    </button>
                  </div>
                  {agentEntries.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {agentEntries.map(([key, agent]) => {
                        const meta = COACH_META.find((c) => c.key === key);
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-tertiary)] rounded border border-[var(--border)]"
                          >
                            {meta && <CoachIcon name={meta.icon} size={11} className="text-[var(--accent)] shrink-0" />}
                            <span className="text-[10px] text-[var(--text)] truncate">
                              {meta?.name.replace(/ (Advisor|Coach)$/, "") || agent.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

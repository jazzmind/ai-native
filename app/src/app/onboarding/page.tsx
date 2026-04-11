"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Cloud,
  Server,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Link2,
  Unlink,
  Rocket,
} from "lucide-react";
import { COACH_META } from "@/lib/coaches";
import { CoachIcon } from "@/components/CoachIcon";

type Step = "welcome" | "choose-type" | "credentials" | "validate" | "integrations" | "deploy" | "done";

const TARGET_TYPES = [
  {
    type: "cma",
    label: "Claude Managed Agents",
    description: "Deploy to Anthropic's managed cloud agent platform. Requires an Anthropic API key.",
    Icon: Cloud,
  },
  {
    type: "busibox",
    label: "Busibox",
    description: "Deploy to a self-hosted Busibox instance with RAG, search, and bridge.",
    Icon: Server,
  },
];

interface McpServer {
  name: string;
  label: string;
  oauthUrl: string | null;
  description: string;
  status: string;
  connectionId: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [targetType, setTargetType] = useState<string>("");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  useEffect(() => {
    if (targetId) {
      fetch(`/api/admin/mcp?targetId=${targetId}`)
        .then((r) => r.json())
        .then(setMcpServers)
        .catch(() => {});
    }
  }, [targetId]);

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const config = targetType === "cma" ? { apiKey } : { apiKey, hostUrl };
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: targetType, config }),
      });
      const result = await res.json();
      setValidationResult(result);
      if (result.valid) setStep("validate");
    } catch (e: any) {
      setValidationResult({ valid: false, error: e.message });
    }
    setValidating(false);
  };

  const handleCreateTarget = async () => {
    try {
      const config = targetType === "cma" ? { apiKey } : { apiKey, hostUrl };
      const createRes = await fetch("/api/admin/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: targetType,
          name: name || (targetType === "cma" ? "Claude Managed Agents" : "Busibox"),
          config,
        }),
      });
      const { target } = await createRes.json();
      setTargetId(target.id);
      setStep("integrations");
    } catch (e: any) {
      setValidationResult({ valid: false, error: `Failed to save: ${e.message}` });
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployError(null);
    try {
      const res = await fetch(`/api/admin/targets/${targetId}/deploy`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeployError(data.error || "Deployment failed");
      } else {
        setStep("done");
      }
    } catch (e: any) {
      setDeployError(`Deploy failed: ${e.message}`);
    }
    setDeploying(false);
  };

  const refreshMcp = async () => {
    if (!targetId) return;
    const res = await fetch(`/api/admin/mcp?targetId=${targetId}`);
    setMcpServers(await res.json());
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">

          {/* Step indicators */}
          {step !== "welcome" && (
            <div className="flex items-center gap-1.5 mb-8 text-[10px] font-semibold">
              {[
                { key: "choose-type", label: "Target" },
                { key: "credentials", label: "Credentials" },
                { key: "validate", label: "Validate" },
                { key: "integrations", label: "Integrations" },
                { key: "deploy", label: "Deploy" },
                { key: "done", label: "Done" },
              ].map(({ key, label }, i) => {
                const steps: Step[] = ["choose-type", "credentials", "validate", "integrations", "deploy", "done"];
                const currentIdx = steps.indexOf(step);
                const thisIdx = i;
                const isActive = step === key;
                const isDone = thisIdx < currentIdx;
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <div className={`w-6 h-px ${isDone ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
                    )}
                    <span
                      className={
                        isActive
                          ? "text-[var(--accent)]"
                          : isDone
                          ? "text-emerald-400"
                          : "text-[var(--text-muted)]"
                      }
                    >
                      {isDone ? <CheckCircle size={10} className="inline mr-0.5" /> : null}
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Welcome */}
          {step === "welcome" && (
            <div className="text-center py-12">
              <Rocket size={48} className="mx-auto mb-6 text-[var(--accent)]" />
              <h1 className="text-3xl font-bold text-[var(--text)] mb-3">
                Welcome to Coach Platform
              </h1>
              <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-8 leading-relaxed">
                Your AI-powered executive team. Get coaching on strategy, technology,
                funding, finance, legal, and growth -- all powered by intelligent agents.
              </p>

              <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto mb-10">
                {COACH_META.slice(0, 4).map((coach) => (
                  <div
                    key={coach.key}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]"
                  >
                    <CoachIcon name={coach.icon} size={20} className="text-[var(--accent)]" />
                    <span className="text-[11px] font-semibold text-[var(--text)]">
                      {coach.name.replace(" Coach", "")}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[var(--text-muted)] mb-6">
                To get started, you need to connect a deployment backend for your agents.
              </p>
              <button
                onClick={() => setStep("choose-type")}
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Choose Target Type */}
          {step === "choose-type" && (
            <div>
              <h2 className="text-xl font-bold text-[var(--text)] mb-2">
                Choose Deployment Target
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Where should your coach agents run?
              </p>
              <div className="space-y-3">
                {TARGET_TYPES.map(({ type, label, description, Icon }) => (
                  <button
                    key={type}
                    onClick={() => {
                      setTargetType(type);
                      setStep("credentials");
                    }}
                    className="w-full text-left bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Icon size={24} className="text-[var(--accent)]" />
                      <div>
                        <div className="text-sm font-bold text-[var(--text)]">{label}</div>
                        <div className="text-xs text-[var(--text-muted)]">{description}</div>
                      </div>
                      <ArrowRight size={16} className="ml-auto text-[var(--text-muted)]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Credentials */}
          {step === "credentials" && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-lg font-bold text-[var(--text)] mb-4">
                {targetType === "cma" ? "Claude Managed Agents" : "Busibox"} Credentials
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Name (optional)
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      targetType === "cma" ? "My Claude Agents" : "My Busibox Instance"
                    }
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {targetType === "busibox" && (
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Host URL
                    </label>
                    <input
                      value={hostUrl}
                      onChange={(e) => setHostUrl(e.target.value)}
                      placeholder="https://busibox.example.com"
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    API Key
                  </label>
                  <input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                    placeholder="sk-..."
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {validationResult && !validationResult.valid && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <XCircle size={16} className="text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">{validationResult.error}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("choose-type")}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={validating || !apiKey}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 flex items-center gap-2"
                  >
                    {validating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Validating...
                      </>
                    ) : (
                      "Validate Credentials"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Validate */}
          {step === "validate" && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle size={24} className="text-emerald-400" />
                <div>
                  <div className="text-sm font-bold text-[var(--text)]">
                    Credentials validated
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Your API key is valid. Next, configure integrations.
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("credentials")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={handleCreateTarget}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white flex items-center gap-2"
                >
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Integrations */}
          {step === "integrations" && (
            <div>
              <h2 className="text-xl font-bold text-[var(--text)] mb-2">
                Configure Integrations
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Connect external services to give your coaches access to your tools.
                These are optional and can be configured later from Admin.
              </p>

              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 mb-6">
                <div className="space-y-2">
                  {mcpServers.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-4">
                      No integrations available for this target type, or MCP servers
                      are not yet enabled.
                    </p>
                  ) : (
                    mcpServers.map((server) => (
                      <div
                        key={server.name}
                        className="flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] rounded-lg"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">
                            {server.label}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {server.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {server.status === "connected" ? (
                            <>
                              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                                <CheckCircle size={12} /> Connected
                              </span>
                              <button
                                onClick={async () => {
                                  await fetch("/api/admin/mcp", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "disconnect",
                                      targetId,
                                      mcpName: server.name,
                                      connectionId: server.connectionId,
                                    }),
                                  });
                                  refreshMcp();
                                }}
                                className="text-xs text-red-400 hover:underline flex items-center gap-1"
                              >
                                <Unlink size={12} /> Disconnect
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-[var(--text-muted)]">
                                Not connected
                              </span>
                              {server.oauthUrl ? (
                                <button
                                  onClick={async () => {
                                    window.open(server.oauthUrl!, "_blank");
                                    await fetch("/api/admin/mcp", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        action: "connect",
                                        targetId,
                                        mcpName: server.name,
                                      }),
                                    });
                                    refreshMcp();
                                  }}
                                  className="px-2 py-1 text-xs font-semibold rounded bg-[var(--accent)] text-white flex items-center gap-1"
                                >
                                  <Link2 size={12} /> Connect
                                </button>
                              ) : (
                                <span className="text-[10px] text-[var(--text-muted)] italic">
                                  Configure in Claude Console
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("validate")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={() => setStep("deploy")}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white flex items-center gap-2"
                >
                  Continue to Deploy <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Deploy */}
          {step === "deploy" && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-lg font-bold text-[var(--text)] mb-2">
                Deploy Your Coaches
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                This will deploy 8 agents (7 coaches + QA Judge) to your{" "}
                {targetType === "cma" ? "Claude Managed Agents" : "Busibox"} instance.
              </p>

              <div className="grid grid-cols-4 gap-2 mb-6">
                {COACH_META.map((coach) => (
                  <div
                    key={coach.key}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]"
                  >
                    <CoachIcon name={coach.icon} size={14} className="text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text)]">
                      {coach.name.replace(" Coach", "")}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
                  <CoachIcon name="Target" size={14} className="text-[var(--text-muted)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    QA Judge
                  </span>
                </div>
              </div>

              {deployError && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <XCircle size={16} className="text-red-400 shrink-0" />
                  <span className="text-xs text-red-400">{deployError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("integrations")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={deploying}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 flex items-center gap-2"
                >
                  {deploying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Deploying...
                    </>
                  ) : (
                    <>
                      <Rocket size={14} /> Deploy All Agents
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="bg-[var(--bg-secondary)] border border-emerald-500/30 rounded-xl p-8 text-center">
              <CheckCircle size={48} className="mx-auto mb-4 text-emerald-400" />
              <h2 className="text-xl font-bold text-[var(--text)] mb-2">
                You're All Set
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-8 max-w-md mx-auto">
                Your coach agents have been deployed and are ready to help. Start
                a conversation and ask anything about your business.
              </p>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Start Chatting
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

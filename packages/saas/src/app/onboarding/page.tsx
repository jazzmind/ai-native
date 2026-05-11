"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  CheckCircle,
  XCircle,
  Loader2,
  Key,
} from "lucide-react";
import { COACH_META } from "@/lib/coaches";
import { CoachIcon } from "@/components/CoachIcon";

type Step = "welcome" | "api-key" | "deploy" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<{ found: number; agents: { key: string; name: string }[] } | null>(null);

  // On mount, check current onboarding state and jump to the right step
  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.complete) {
          router.replace("/dashboard");
        } else if (data.hasApiKey) {
          // Have a key — go to deploy step and immediately try to discover existing agents
          setStep("deploy");
          discoverExistingAgents();
        }
        // else: no key — show welcome → api-key flow (default)
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const discoverExistingAgents = async () => {
    setDiscovering(true);
    try {
      const res = await fetch("/api/admin/targets/discover", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.found > 0) {
        setDiscoverResult({ found: data.found, agents: data.agents });
        setTargetId(data.targetId);
        // Agents already deployed — mark onboarding done and redirect
        setStep("done");
      }
    } catch {
      // discovery failure is non-fatal; fall through to manual deploy
    } finally {
      setDiscovering(false);
    }
  };

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKeyError(data.error || "Failed to save API key");
        return;
      }
      setStep("deploy");
    } catch (e: any) {
      setKeyError(e.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployError(null);
    try {
      // First, try to discover existing agents so we update rather than recreate
      let tid = targetId;
      if (!tid) {
        const discoverRes = await fetch("/api/admin/targets/discover", { method: "POST" });
        const discoverData = await discoverRes.json();
        if (discoverRes.ok && discoverData.found > 0) {
          // Agents found and state saved — mark done without a full redeploy
          setTargetId(discoverData.targetId);
          setStep("done");
          return;
        }
        // No existing agents — create a fresh CMA target
        const createRes = await fetch("/api/admin/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "cma", name: "Claude Managed Agents", config: {} }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          setDeployError(createData.error || "Failed to create deployment target");
          return;
        }
        tid = createData.target.id;
        setTargetId(tid);
      }

      // Deploy (creates new agents or updates existing ones via agentState in the target)
      const deployRes = await fetch(`/api/admin/targets/${tid}/deploy`, { method: "POST" });
      const deployData = await deployRes.json();
      if (!deployRes.ok) {
        setDeployError(deployData.error || "Deployment failed");
      } else {
        setStep("done");
      }
    } catch (e: any) {
      setDeployError(`Deploy failed: ${e.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const steps: Step[] = ["api-key", "deploy", "done"];
  const stepLabels = ["API Key", "Deploy", "Done"];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">

          {step !== "welcome" && (
            <div className="flex items-center gap-1.5 mb-8 text-[10px] font-semibold">
              {steps.map((s, i) => {
                const currentIdx = steps.indexOf(step);
                const isActive = step === s;
                const isDone = i < currentIdx;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <div className={`w-6 h-px ${isDone ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
                    )}
                    <span className={
                      isActive ? "text-[var(--accent)]"
                      : isDone ? "text-emerald-400"
                      : "text-[var(--text-muted)]"
                    }>
                      {isDone && <CheckCircle size={10} className="inline mr-0.5" />}
                      {stepLabels[i]}
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
                Welcome to AI Executive Team
              </h1>
              <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-8 leading-relaxed">
                Your AI-powered advisory team. Get expert guidance on strategy, technology,
                funding, finance, legal, and growth — all powered by intelligent agents.
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
                To get started, add your Anthropic API key to deploy your advisory team.
              </p>
              <button
                onClick={() => setStep("api-key")}
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Get Started
              </button>
            </div>
          )}

          {/* API Key */}
          {step === "api-key" && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Key size={20} className="text-[var(--accent)]" />
                <h2 className="text-lg font-bold text-[var(--text)]">Add Your Anthropic API Key</h2>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-5">
                Your agents run on Claude. Provide your Anthropic API key to deploy them.
                You can find or create keys at{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  console.anthropic.com
                </a>.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    API Key
                  </label>
                  <input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    onKeyDown={(e) => e.key === "Enter" && apiKey && handleSaveApiKey()}
                  />
                </div>

                {keyError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <XCircle size={16} className="text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">{keyError}</span>
                  </div>
                )}

                <button
                  onClick={handleSaveApiKey}
                  disabled={savingKey || !apiKey.trim()}
                  className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {savingKey ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : (
                    "Save & Continue"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Deploy */}
          {step === "deploy" && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-lg font-bold text-[var(--text)] mb-2">Deploy Your Advisors</h2>

              {discovering ? (
                <div className="flex items-center gap-3 py-6 text-sm text-[var(--text-muted)]">
                  <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
                  Checking for existing agents...
                </div>
              ) : (
                <>
                  <p className="text-sm text-[var(--text-muted)] mb-6">
                    This will deploy {COACH_META.length + 1} agents ({COACH_META.length} advisors + QA Judge)
                    to Claude Managed Agents. If you have existing agents they will be updated in place — no duplicates.
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
                      <span className="text-xs font-semibold text-[var(--text-muted)]">QA Judge</span>
                    </div>
                  </div>

                  {deployError && (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <XCircle size={16} className="text-red-400 shrink-0" />
                      <span className="text-xs text-red-400">{deployError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                  >
                    {deploying ? (
                      <><Loader2 size={14} className="animate-spin" /> Deploying...</>
                    ) : (
                      <><Rocket size={14} /> Deploy All Agents</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="bg-[var(--bg-secondary)] border border-emerald-500/30 rounded-xl p-8 text-center">
              <CheckCircle size={48} className="mx-auto mb-4 text-emerald-400" />
              <h2 className="text-xl font-bold text-[var(--text)] mb-2">You're All Set</h2>
              <p className="text-sm text-[var(--text-muted)] mb-8 max-w-md mx-auto">
                Your advisors have been deployed and are ready to help. Start a conversation
                and ask anything about your business.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
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

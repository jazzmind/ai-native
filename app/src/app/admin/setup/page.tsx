"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cloud, ArrowRight, CheckCircle, XCircle, Loader2, Key, AlertTriangle } from "lucide-react";

type Step = "configure" | "deploying" | "done";

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("configure");
  const [name, setName] = useState("Claude Managed Agents");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/api-key")
      .then(r => r.json())
      .then(data => setHasApiKey(!!data.hasKey))
      .catch(() => setHasApiKey(false))
      .finally(() => setLoadingKey(false));
  }, []);

  const handleValidateAndDeploy = async () => {
    setValidating(true);
    setValidationResult(null);
    setDeployError(null);

    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cma", config: { useStoredKey: true } }),
      });
      const result = await res.json();
      setValidationResult(result);

      if (!result.valid) {
        setValidating(false);
        return;
      }

      setStep("deploying");
      setValidating(false);
      setDeploying(true);

      const createRes = await fetch("/api/admin/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "cma",
          name: name || "Claude Managed Agents",
          config: { useStoredKey: true },
        }),
      });
      const { target } = await createRes.json();

      await fetch(`/api/admin/targets/${target.id}/deploy`, { method: "POST" });
      setStep("done");
    } catch (e: any) {
      setDeployError(e.message || "Deployment failed");
      setStep("configure");
    } finally {
      setValidating(false);
      setDeploying(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Deploy Advisors</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Deploy your AI advisory team to Claude Managed Agents.
        </p>

        <div className="flex items-center gap-2 mb-8 text-xs">
          {[
            { key: "configure", label: "1. Configure" },
            { key: "deploying", label: "2. Deploy" },
            { key: "done", label: "3. Done" },
          ].map(({ key, label }, i) => (
            <div key={key} className="flex items-center gap-2">
              {i > 0 && <ArrowRight size={12} className="text-[var(--text-muted)]" />}
              <span className={`font-semibold ${step === key ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>{label}</span>
            </div>
          ))}
        </div>

        {step === "configure" && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Cloud size={24} className="text-[var(--accent)]" />
              <div>
                <div className="text-sm font-bold text-[var(--text)]">Claude Managed Agents</div>
                <div className="text-xs text-[var(--text-muted)]">Deploy 8 agents (7 advisors + QA Judge) to Anthropic&apos;s platform.</div>
              </div>
            </div>

            <form autoComplete="off" onSubmit={e => e.preventDefault()}>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Deployment Name
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Claude Managed Agents"
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {loadingKey ? (
                  <div className="flex items-center gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                    <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-muted)]">Checking API key...</span>
                  </div>
                ) : hasApiKey ? (
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <Key size={14} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400">Your stored Anthropic API key will be used for deployment.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-xs text-amber-400">
                      No API key found.{" "}
                      <a href="/settings/api-keys" className="underline hover:no-underline">Add one in settings</a> first.
                    </span>
                  </div>
                )}

                {validationResult && !validationResult.valid && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <XCircle size={16} className="text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">{validationResult.error}</span>
                  </div>
                )}

                {deployError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <XCircle size={16} className="text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">{deployError}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => router.push("/admin")}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleValidateAndDeploy}
                    disabled={validating || !hasApiKey}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 flex items-center gap-2"
                  >
                    {validating ? (
                      <><Loader2 size={14} className="animate-spin" /> Validating...</>
                    ) : (
                      <>Deploy All Agents <ArrowRight size={14} /></>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {step === "deploying" && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 text-center">
            <Loader2 size={40} className="mx-auto mb-4 animate-spin text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text)] mb-2">Deploying Agents</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Creating and configuring 8 agents on Claude Managed Agents. This may take a minute.
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="bg-[var(--bg-secondary)] border border-emerald-500/30 rounded-xl p-6 text-center">
            <CheckCircle size={40} className="mx-auto mb-4 text-emerald-400" />
            <h2 className="text-lg font-bold text-[var(--text)] mb-2">Deployment Complete</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Your advisors have been deployed.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => router.push("/admin")}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
              >
                View Dashboard
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white"
              >
                Start Chatting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

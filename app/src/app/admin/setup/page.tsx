"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Server, ArrowRight, CheckCircle, XCircle, Loader2 } from "lucide-react";

type Step = "choose-type" | "credentials" | "validate" | "done";

const TARGET_TYPES = [
  { type: "cma", label: "Claude Managed Agents", description: "Deploy to Anthropic's managed cloud agent platform.", Icon: Cloud },
  { type: "busibox", label: "Busibox", description: "Deploy to a self-hosted Busibox instance with RAG, search, and bridge.", Icon: Server },
];

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose-type");
  const [targetType, setTargetType] = useState<string>("");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [targetId, setTargetId] = useState<string>("");

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

  const handleCreateAndDeploy = async () => {
    setDeploying(true);
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

      await fetch(`/api/admin/targets/${target.id}/deploy`, { method: "POST" });
      setStep("done");
    } catch (e: any) {
      setValidationResult({ valid: false, error: `Deploy failed: ${e.message}` });
    }
    setDeploying(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Setup Wizard</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Configure a new deployment target for your coach agents.</p>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8 text-xs">
        {[
          { key: "choose-type", label: "1. Choose Target" },
          { key: "credentials", label: "2. Credentials" },
          { key: "validate", label: "3. Validate & Deploy" },
          { key: "done", label: "4. Done" },
        ].map(({ key, label }, i) => (
          <div key={key} className="flex items-center gap-2">
            {i > 0 && <ArrowRight size={12} className="text-[var(--text-muted)]" />}
            <span className={`font-semibold ${step === key ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>{label}</span>
          </div>
        ))}
      </div>

      {step === "choose-type" && (
        <div className="space-y-3">
          {TARGET_TYPES.map(({ type, label, description, Icon }) => (
            <button key={type} onClick={() => { setTargetType(type); setStep("credentials"); }}
              className="w-full text-left bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/50 transition-colors">
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
      )}

      {step === "credentials" && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-lg font-bold text-[var(--text)] mb-4">
            {targetType === "cma" ? "Claude Managed Agents" : "Busibox"} Credentials
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Name (optional)</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={targetType === "cma" ? "My Claude Agents" : "My Busibox Instance"}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
            </div>

            {targetType === "busibox" && (
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Host URL</label>
                <input value={hostUrl} onChange={e => setHostUrl(e.target.value)} placeholder="https://busibox.example.com"
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">API Key</label>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="sk-..."
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
            </div>

            {validationResult && !validationResult.valid && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <XCircle size={16} className="text-red-400 shrink-0" />
                <span className="text-xs text-red-400">{validationResult.error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep("choose-type")}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]">
                Back
              </button>
              <button onClick={handleValidate} disabled={validating || !apiKey}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 flex items-center gap-2">
                {validating ? <><Loader2 size={14} className="animate-spin" /> Validating...</> : "Validate Credentials"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "validate" && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle size={24} className="text-emerald-400" />
            <div>
              <div className="text-sm font-bold text-[var(--text)]">Credentials validated</div>
              <div className="text-xs text-[var(--text-muted)]">Ready to deploy all coach agents.</div>
            </div>
          </div>

          <p className="text-sm text-[var(--text-muted)] mb-6">
            This will deploy 8 agents (7 coaches + QA Judge) to your {targetType === "cma" ? "Claude Managed Agents" : "Busibox"} instance.
            Existing agents will be updated; new agents will be created.
          </p>

          {validationResult && !validationResult.valid && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <XCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-xs text-red-400">{validationResult.error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep("credentials")}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]">
              Back
            </button>
            <button onClick={handleCreateAndDeploy} disabled={deploying}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 flex items-center gap-2">
              {deploying ? <><Loader2 size={14} className="animate-spin" /> Deploying...</> : "Deploy All Agents"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="bg-[var(--bg-secondary)] border border-emerald-500/30 rounded-xl p-6 text-center">
          <CheckCircle size={40} className="mx-auto mb-4 text-emerald-400" />
          <h2 className="text-lg font-bold text-[var(--text)] mb-2">Deployment Complete</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">Your coach agents have been deployed.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => router.push("/admin")}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] text-[var(--text-muted)]">
              View Dashboard
            </button>
            <button onClick={() => router.push("/")}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white">
              Start Chatting
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

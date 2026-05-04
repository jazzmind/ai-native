"use client";

import { useState, useRef, useCallback } from "react";
import { Shield, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Info, Zap, Activity } from "lucide-react";
import type { ScanFinding, ScanProgressEvent, ScanSummary } from "@/lib/security-scanner/types";

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<ScanFinding["severity"], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  critical: { label: "CRITICAL", color: "text-red-400", bg: "bg-red-950/40 border-red-700/50", icon: <AlertTriangle size={12} /> },
  high: { label: "HIGH", color: "text-orange-400", bg: "bg-orange-950/40 border-orange-700/50", icon: <AlertTriangle size={12} /> },
  medium: { label: "MEDIUM", color: "text-yellow-400", bg: "bg-yellow-950/40 border-yellow-700/50", icon: <AlertTriangle size={12} /> },
  low: { label: "LOW", color: "text-blue-400", bg: "bg-blue-950/40 border-blue-700/50", icon: <Info size={12} /> },
  info: { label: "INFO", color: "text-[var(--text-muted)]", bg: "bg-[var(--bg-tertiary)] border-[var(--border)]", icon: <Info size={12} /> },
  pass: { label: "PASS", color: "text-green-400", bg: "bg-green-950/20 border-green-800/30", icon: <CheckCircle size={12} /> },
};

const PHASE_LABELS: Record<string, string> = {
  auth: "Authentication",
  authz: "Authorization & IDOR",
  injection: "Injection & Fuzzing",
  config: "Configuration",
  "llm-agent": "LLM Security Agent",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: ScanFinding["severity"] }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function FindingCard({ finding }: { finding: ScanFinding }) {
  const [open, setOpen] = useState(finding.severity !== "pass" && finding.severity !== "info");
  const cfg = SEVERITY_CONFIG[finding.severity];

  return (
    <div className={`rounded-lg border ${cfg.bg} overflow-hidden`}>
      <button
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="mt-0.5 flex-shrink-0">
          {open ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={finding.severity} />
            <span className="text-sm font-medium text-[var(--text)] truncate">{finding.title}</span>
          </div>
          {finding.endpoint && (
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">{finding.endpoint}</div>
          )}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-white/5">
          <p className="text-xs text-[var(--text-muted)] mt-2">{finding.detail}</p>
          {finding.evidence && (
            <pre className="mt-2 p-2 rounded bg-black/30 text-[10px] text-[var(--text-muted)] font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {finding.evidence}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBar({ summary }: { summary: ScanSummary }) {
  const items: Array<{ label: string; value: number; color: string }> = [
    { label: "Critical", value: summary.critical, color: "text-red-400" },
    { label: "High", value: summary.high, color: "text-orange-400" },
    { label: "Medium", value: summary.medium, color: "text-yellow-400" },
    { label: "Low", value: summary.low, color: "text-blue-400" },
    { label: "Info", value: summary.info, color: "text-[var(--text-muted)]" },
    { label: "Pass", value: summary.pass, color: "text-green-400" },
  ];
  const secs = (summary.durationMs / 1000).toFixed(1);

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-[var(--text)]">Scan Summary</span>
        <span className="text-xs text-[var(--text-muted)]">{secs}s · {summary.total} checks</span>
      </div>
      <div className="flex flex-wrap gap-4">
        {items.map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ScanStatus = "idle" | "running" | "done" | "error";

interface PhaseState {
  label: string;
  findings: ScanFinding[];
  done: boolean;
}

export default function SecurityScanPage() {
  const [targetUrl, setTargetUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [skipLlm, setSkipLlm] = useState(false);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [phases, setPhases] = useState<Record<string, PhaseState>>({});
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startScan = useCallback(async () => {
    if (status === "running") return;

    setStatus("running");
    setPhases({});
    setCurrentPhase(null);
    setAgentLog([]);
    setSummary(null);
    setErrorMsg(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/admin/security-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: targetUrl || undefined, skipLlmAgent: skipLlm }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setErrorMsg(err.error || `HTTP ${res.status}`);
        setStatus("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setStatus("error"); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as ScanProgressEvent;
            handleEvent(event);
          } catch { /* malformed line */ }
        }
      }

      setStatus(prev => prev === "running" ? "done" : prev);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("idle");
      } else {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }
  }, [targetUrl, skipLlm, status]);

  function handleEvent(event: ScanProgressEvent) {
    switch (event.type) {
      case "phase_start":
        setCurrentPhase(event.phase);
        setPhases(p => ({ ...p, [event.phase]: { label: event.label, findings: [], done: false } }));
        break;

      case "finding":
        setPhases(p => {
          const phase = event.finding.category === "llm-probe" ? "llm-agent" : event.finding.category;
          const existing = p[phase] || { label: PHASE_LABELS[phase] || phase, findings: [], done: false };
          return { ...p, [phase]: { ...existing, findings: [...existing.findings, event.finding] } };
        });
        break;

      case "agent_thinking":
        setAgentLog(l => [...l, event.text]);
        break;

      case "done":
        setSummary(event.summary);
        setPhases(p => {
          const next = { ...p };
          for (const k of Object.keys(next)) next[k] = { ...next[k], done: true };
          return next;
        });
        setStatus("done");
        break;

      case "error":
        setErrorMsg(event.message);
        setStatus("error");
        break;
    }
  }

  const stop = () => {
    abortRef.current?.abort();
    setStatus("idle");
  };

  const allFindings = Object.values(phases).flatMap(p => p.findings);
  const criticalCount = allFindings.filter(f => f.severity === "critical").length;
  const highCount = allFindings.filter(f => f.severity === "high").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">

        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-600 mt-0.5">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Security Scanner</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Automated penetration testing: deterministic probes + LLM-driven creative attack exploration.
            </p>
          </div>
        </div>

        {/* Config */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">
                Target URL
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://your-deployment.vercel.app"
                disabled={status === "running"}
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipLlm}
                  onChange={e => setSkipLlm(e.target.checked)}
                  disabled={status === "running"}
                  className="rounded"
                />
                Skip LLM agent
              </label>
              {status === "running" ? (
                <button
                  onClick={stop}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={startScan}
                  disabled={!targetUrl}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white text-sm font-medium transition-opacity disabled:opacity-40"
                >
                  Run Scan
                </button>
              )}
            </div>
          </div>

          {status === "running" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Activity size={12} className="animate-pulse text-[var(--accent)]" />
              Scanning {targetUrl} — {currentPhase ? PHASE_LABELS[currentPhase] || currentPhase : "initialising"}…
              {allFindings.length > 0 && ` · ${allFindings.length} checks run`}
            </div>
          )}
        </div>

        {/* Critical/High alert banner */}
        {(criticalCount > 0 || highCount > 0) && (
          <div className="mb-5 flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-700/50 text-sm text-red-300">
            <AlertTriangle size={16} />
            {criticalCount > 0 && <span><strong>{criticalCount} CRITICAL</strong></span>}
            {criticalCount > 0 && highCount > 0 && <span>·</span>}
            {highCount > 0 && <span><strong>{highCount} HIGH</strong></span>}
            <span className="text-red-400">severity findings require immediate attention.</span>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-700/50 text-sm text-red-300">
            Error: {errorMsg}
          </div>
        )}

        {/* Summary */}
        {summary && <div className="mb-5"><SummaryBar summary={summary} /></div>}

        {/* Phase results */}
        {Object.entries(phases).map(([phase, state]) => {
          if (phase === "llm-agent") return null; // rendered separately
          const nonPass = state.findings.filter(f => f.severity !== "pass");
          const passCount = state.findings.filter(f => f.severity === "pass").length;
          return (
            <PhaseSection
              key={phase}
              label={state.label}
              findings={nonPass}
              passCount={passCount}
              active={currentPhase === phase}
            />
          );
        })}

        {/* LLM agent section */}
        {(phases["llm-agent"] || agentLog.length > 0) && (
          <LlmAgentSection
            findings={phases["llm-agent"]?.findings || []}
            log={agentLog}
            active={currentPhase === "llm-agent"}
          />
        )}
      </div>
    </div>
  );
}

// ── Phase section ─────────────────────────────────────────────────────────────

function PhaseSection({
  label,
  findings,
  passCount,
  active,
}: {
  label: string;
  findings: ScanFinding[];
  passCount: number;
  active: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          {active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
          <span className="text-sm font-semibold text-[var(--text)]">{label}</span>
          {findings.length > 0 && (
            <span className="text-xs font-bold text-orange-400 bg-orange-950/50 border border-orange-800/40 px-1.5 py-0.5 rounded">
              {findings.length} issue{findings.length !== 1 ? "s" : ""}
            </span>
          )}
          {passCount > 0 && (
            <span className="text-xs text-green-400">{passCount} passed</span>
          )}
        </div>
        {collapsed ? <ChevronRight size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
      </button>
      {!collapsed && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {findings.length === 0 && !active && (
            <p className="text-xs text-[var(--text-muted)] text-center py-2">No issues found in this phase.</p>
          )}
          {findings.map(f => <FindingCard key={f.id} finding={f} />)}
          {active && findings.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-2">
              <Activity size={12} className="animate-pulse" />
              Running…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── LLM agent section ─────────────────────────────────────────────────────────

function LlmAgentSection({
  findings,
  log,
  active,
}: {
  findings: ScanFinding[];
  log: string[];
  active: boolean;
}) {
  const [showLog, setShowLog] = useState(false);
  const nonPass = findings.filter(f => f.severity !== "pass");
  const passCount = findings.filter(f => f.severity === "pass").length;

  return (
    <div className="mb-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)]">
        {active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
        <Zap size={14} className="text-purple-400" />
        <span className="text-sm font-semibold text-[var(--text)]">LLM Security Agent</span>
        {nonPass.length > 0 && (
          <span className="text-xs font-bold text-orange-400 bg-orange-950/50 border border-orange-800/40 px-1.5 py-0.5 rounded">
            {nonPass.length} issue{nonPass.length !== 1 ? "s" : ""}
          </span>
        )}
        {passCount > 0 && <span className="text-xs text-green-400">{passCount} passed</span>}
        <button
          className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          onClick={() => setShowLog(s => !s)}
        >
          {showLog ? "Hide" : "Show"} agent log ({log.length})
        </button>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        {/* Agent thinking log */}
        {showLog && log.length > 0 && (
          <div className="mb-3 rounded-lg bg-black/30 border border-[var(--border)] p-3 max-h-64 overflow-y-auto">
            {log.map((line, i) => (
              <p key={i} className="text-[11px] text-[var(--text-muted)] font-mono mb-1 whitespace-pre-wrap">{line}</p>
            ))}
            {active && <p className="text-[11px] text-purple-400 animate-pulse">▌</p>}
          </div>
        )}

        {active && log.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-2">
            <Activity size={12} className="animate-pulse text-purple-400" />
            Agent initialising…
          </div>
        )}

        {nonPass.length === 0 && !active && (
          <p className="text-xs text-[var(--text-muted)] text-center py-2">No issues found by the LLM agent.</p>
        )}
        {nonPass.map(f => <FindingCard key={f.id} finding={f} />)}
      </div>
    </div>
  );
}

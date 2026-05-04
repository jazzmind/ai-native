import { runAuthProbes, runAuthzProbes, runInjectionProbes, runConfigProbes } from './deterministic-probes';
import { runSecurityAgent } from './llm-agent';
import type { ScanFinding, ScanProgressEvent, ScanSummary } from './types';

export type { ScanFinding, ScanProgressEvent, ScanSummary };

export interface ScanOptions {
  baseUrl: string;
  apiKey: string;
  sessionCookie?: string;
  skipLlmAgent?: boolean;
}

function summarise(findings: ScanFinding[], durationMs: number): ScanSummary {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, pass: 0 };
  for (const f of findings) counts[f.severity]++;
  return { total: findings.length, ...counts, durationMs };
}

export async function runSecurityScan(
  opts: ScanOptions,
  emit: (event: ScanProgressEvent) => void,
): Promise<void> {
  const { baseUrl, apiKey, sessionCookie, skipLlmAgent } = opts;
  const allFindings: ScanFinding[] = [];
  const started = Date.now();

  // ── Phase 1: Auth ──────────────────────────────────────────────────────────
  emit({ type: 'phase_start', phase: 'auth', label: 'Authentication checks' });
  const authFindings = await runAuthProbes(baseUrl);
  for (const f of authFindings) {
    allFindings.push(f);
    emit({ type: 'finding', finding: f });
  }

  // ── Phase 2: Authz / IDOR ─────────────────────────────────────────────────
  emit({ type: 'phase_start', phase: 'authz', label: 'Authorization & IDOR checks' });
  const authzFindings = await runAuthzProbes(baseUrl, sessionCookie);
  for (const f of authzFindings) {
    allFindings.push(f);
    emit({ type: 'finding', finding: f });
  }

  // ── Phase 3: Injection ────────────────────────────────────────────────────
  emit({ type: 'phase_start', phase: 'injection', label: 'Injection & fuzzing' });
  const injectionFindings = await runInjectionProbes(baseUrl, sessionCookie);
  for (const f of injectionFindings) {
    allFindings.push(f);
    emit({ type: 'finding', finding: f });
  }

  // ── Phase 4: Config / headers ─────────────────────────────────────────────
  emit({ type: 'phase_start', phase: 'config', label: 'Configuration & headers' });
  const configFindings = await runConfigProbes(baseUrl);
  for (const f of configFindings) {
    allFindings.push(f);
    emit({ type: 'finding', finding: f });
  }

  // ── Phase 5: LLM agent ────────────────────────────────────────────────────
  if (!skipLlmAgent) {
    emit({ type: 'phase_start', phase: 'llm-agent', label: 'LLM security agent (creative probing)' });

    const agentFindings = await runSecurityAgent({
      apiKey,
      baseUrl,
      deterministicFindings: allFindings,
      onThinking: (text) => emit({ type: 'agent_thinking', text }),
    });

    for (const f of agentFindings) {
      allFindings.push(f);
      emit({ type: 'finding', finding: f });
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  const summary = summarise(allFindings, Date.now() - started);
  emit({ type: 'done', summary, findings: allFindings });
}

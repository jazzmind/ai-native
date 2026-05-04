export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'pass';
export type ScanCategory = 'auth' | 'authz' | 'injection' | 'config' | 'llm-probe';
export type ScanPhase = 'auth' | 'authz' | 'injection' | 'config' | 'llm-agent';

export interface ScanFinding {
  id: string;
  category: ScanCategory;
  severity: ScanSeverity;
  title: string;
  detail: string;
  endpoint?: string;
  evidence?: string;
}

export interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  pass: number;
  durationMs: number;
}

export type ScanProgressEvent =
  | { type: 'phase_start'; phase: ScanPhase; label: string }
  | { type: 'probe_start'; name: string; endpoint?: string }
  | { type: 'finding'; finding: ScanFinding }
  | { type: 'agent_thinking'; text: string }
  | { type: 'done'; summary: ScanSummary; findings: ScanFinding[] }
  | { type: 'error'; message: string };

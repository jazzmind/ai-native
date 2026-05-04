import Anthropic from '@anthropic-ai/sdk';
import type { ScanFinding } from './types';

const MAX_REQUESTS = 50;
const MAX_TURNS = 12;
const REQUEST_TIMEOUT_MS = 15_000;

// ── Tool definitions ─────────────────────────────────────────────────────────

const HTTP_REQUEST_TOOL: Anthropic.Tool = {
  name: 'http_request',
  description: 'Make an HTTP request to the target deployment. Only paths on the target host are allowed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        description: 'HTTP method',
      },
      path: {
        type: 'string',
        description: 'URL path including query string, e.g. "/api/conversations?limit=10"',
      },
      headers: {
        type: 'object',
        description: 'Request headers as key-value pairs',
        additionalProperties: { type: 'string' },
      },
      body: {
        type: 'string',
        description: 'Request body as a string (use JSON.stringify for JSON payloads)',
      },
    },
    required: ['method', 'path'],
  },
};

const REPORT_FINDINGS_TOOL: Anthropic.Tool = {
  name: 'report_findings',
  description: 'Report security findings discovered during testing. Call this when done.',
  input_schema: {
    type: 'object' as const,
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info', 'pass'] },
            title: { type: 'string' },
            detail: { type: 'string' },
            endpoint: { type: 'string' },
            evidence: { type: 'string' },
          },
          required: ['severity', 'title', 'detail'],
        },
      },
      summary: { type: 'string', description: 'Brief overall assessment' },
    },
    required: ['findings'],
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(baseUrl: string, deterministicSummary: string): string {
  return `You are a professional web application penetration tester probing a live production SaaS deployment.

TARGET: ${baseUrl}

APP ARCHITECTURE (from source review):
- NextAuth v5 JWT sessions with email/OTP login + GitHub/Google OAuth
- Drizzle ORM on PostgreSQL (Neon). No raw SQL — parameterized queries throughout.
- Multi-tenant: orgs → users → conversations/projects. Each user has an orgId in their JWT.
- Anthropic API keys stored encrypted per (orgId, userId). Platform key in env for paid tiers.
- API routes under /api/*. Most require valid session cookie (next-auth.session-token).
- Admin-only routes at /api/admin/users, /api/admin/growth, /api/admin/analytics check isAdmin(email).
- Cron endpoints at /api/cron/* require Bearer CRON_SECRET.
- Public endpoints (no auth needed): /api/billing/webhook (Stripe sig), /api/marketplace/expert-count, /api/review-access/[token], /review/[token].
- File uploads stored in Vercel Blob with access: "public" (URLs are unlisted but not access-controlled).

WHAT THE DETERMINISTIC PROBES ALREADY CHECKED:
${deterministicSummary}

YOUR MISSION:
Probe for vulnerabilities NOT covered above. Think creatively as a real attacker would. Focus on:
1. Business logic flaws (e.g. can you create marketplace requests that exceed org quotas?)
2. Information disclosure in API responses (internal IDs, emails, org data from other tenants)
3. Parameter tampering (change orgId, userId, planType in request bodies)
4. Insecure direct object references via guessable or predictable IDs
5. Race conditions or state confusion (e.g. simultaneous requests)
6. Chained attacks (combine multiple low-severity findings for higher impact)
7. Headers and error messages that reveal internal architecture
8. OAuth/SSO flow manipulation
9. Webhook replay or SSRF via any URL parameters
10. Any endpoints that accept user-controlled URLs and might fetch them server-side

RULES:
- Only send requests to ${baseUrl} (paths on this host only)
- Maximum ${MAX_REQUESTS} HTTP requests total
- Do not attempt to exfiltrate real user data — stop if you accidentally see PII
- Do not send requests that could permanently delete or corrupt real data (avoid DELETE/PUT on real resource IDs)
- Report ALL findings including passes and informational items

When you are done testing, call report_findings with all findings.`;
}

// ── HTTP request executor ─────────────────────────────────────────────────────

async function executeHttpRequest(
  baseUrl: string,
  input: Record<string, unknown>,
  requestCount: { n: number },
): Promise<string> {
  if (requestCount.n >= MAX_REQUESTS) {
    return JSON.stringify({ error: `Request limit (${MAX_REQUESTS}) reached.` });
  }
  requestCount.n++;

  const method = String(input.method || 'GET');
  const path = String(input.path || '/');
  const userHeaders = (input.headers as Record<string, string>) || {};
  const body = input.body ? String(input.body) : undefined;

  // Safety: only allow requests to the target host
  const targetHost = new URL(baseUrl).host;
  if (path.startsWith('http')) {
    try {
      const reqHost = new URL(path).host;
      if (reqHost !== targetHost) {
        return JSON.stringify({ error: `Blocked: can only request ${targetHost}, not ${reqHost}` });
      }
    } catch {
      return JSON.stringify({ error: 'Invalid URL' });
    }
  }

  const url = path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...userHeaders },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const responseBody = await res.text().catch(() => '');
    const responseHeaders: Record<string, string> = {};
    ['content-type', 'set-cookie', 'location', 'access-control-allow-origin',
      'x-frame-options', 'content-security-policy', 'server', 'x-powered-by',
    ].forEach(h => {
      const v = res.headers.get(h);
      if (v) responseHeaders[h] = v;
    });

    return JSON.stringify({
      status: res.status,
      headers: responseHeaders,
      body: responseBody.slice(0, 2000),
      truncated: responseBody.length > 2000,
    });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

// ── Agent loop ────────────────────────────────────────────────────────────────

export interface AgentOptions {
  apiKey: string;
  baseUrl: string;
  deterministicFindings: ScanFinding[];
  onThinking: (text: string) => void;
}

export async function runSecurityAgent(opts: AgentOptions): Promise<ScanFinding[]> {
  const { apiKey, baseUrl, deterministicFindings, onThinking } = opts;
  const client = new Anthropic({ apiKey });

  const deterministicSummary = deterministicFindings
    .map(f => `[${f.severity.toUpperCase()}] ${f.title} (${f.endpoint || 'N/A'})`)
    .join('\n');

  const systemPrompt = buildSystemPrompt(baseUrl, deterministicSummary);
  const requestCount = { n: 0 };

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Begin your security assessment of ${baseUrl}. Use the http_request tool to probe the application. When finished, call report_findings.`,
    },
  ];

  let agentFindings: ScanFinding[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools: [HTTP_REQUEST_TOOL, REPORT_FINDINGS_TOOL],
      messages,
    });

    // Stream thinking text to caller
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        onThinking(block.text);
      }
    }

    // Check if done
    if (response.stop_reason === 'end_turn') {
      break;
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
    if (toolUseBlocks.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === 'report_findings') {
        const input = toolUse.input as { findings: Array<Record<string, string>>; summary?: string };
        agentFindings = (input.findings || []).map((f, i) => ({
          id: `llm-${i}-${Date.now()}`,
          category: 'llm-probe' as const,
          severity: (f.severity as ScanFinding['severity']) || 'info',
          title: f.title || 'Untitled finding',
          detail: f.detail || '',
          endpoint: f.endpoint,
          evidence: f.evidence,
        }));
        if (input.summary) {
          onThinking(`\n**Summary:** ${input.summary}`);
        }
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Findings recorded.' });
        // After report_findings, end the loop
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });
        return agentFindings;
      }

      if (toolUse.name === 'http_request') {
        const input = toolUse.input as Record<string, unknown>;
        onThinking(`→ ${input.method} ${input.path}`);
        const result = await executeHttpRequest(baseUrl, input, requestCount);
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
      }
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }

  return agentFindings;
}

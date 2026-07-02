import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the busibox-app AI adapter so tests never hit the network. The mock
// instance is captured so individual tests can control what streamChat/invoke
// resolve to. vi.hoisted() is required because vi.mock() factories are
// hoisted above top-level const declarations.
const { streamChatMock, invokeMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("@jazzmind/busibox-app/platform/busibox", () => {
  return {
    BusiboxAIAdapter: vi.fn().mockImplementation(function BusiboxAIAdapterMock() {
      return { streamChat: streamChatMock, invoke: invokeMock };
    }),
    BusiboxSearchAdapter: vi.fn(),
  };
});

vi.mock("@jazzmind/busibox-app/lib/agent/sync", () => ({
  syncAgentDefinitions: vi.fn(),
  getAgentSyncStatus: vi.fn(),
}));

import { BusiboxAgentProvider } from "../agent-provider";

/** Build a ReadableStream<StreamEvent> from a plain array, mimicking BusiboxAIAdapter's output. */
function streamOf(events: Array<Record<string, unknown>>): ReadableStream<Record<string, unknown>> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < events.length) {
        controller.enqueue(events[i]!);
        i += 1;
      } else {
        controller.close();
      }
    },
  });
}

describe("BusiboxAgentProvider.routeMessage", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    streamChatMock.mockReset();
  });

  it("short-circuits on explicit coach selection without calling the agent API", async () => {
    const provider = new BusiboxAgentProvider("token-123");
    const decision = await provider.routeMessage({
      message: "help me with pricing",
      explicitCoachKeys: ["strategy", "founder"],
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(decision.coaches.map((c) => c.key)).toEqual(["strategy", "founder"]);
    expect(decision.lead).toBe("strategy");
    expect(decision.synthesize).toBe(true);
    expect(decision.mode).toBe("advise");
  });

  it("delegates to invoke() with a zod response schema when no explicit coaches are given", async () => {
    invokeMock.mockResolvedValue({
      coaches: ["founder"],
      lead: "founder",
      mode: "coach",
      synthesize: false,
      reasoning: "Personal goals question.",
    });

    const provider = new BusiboxAgentProvider("token-123");
    const decision = await provider.routeMessage({ message: "how do I stay motivated?" });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const call = invokeMock.mock.calls[0]![0];
    expect(call.agent).toBe("router");
    expect(typeof call.responseSchema.parse).toBe("function");
    expect(decision.coaches.map((c) => c.key)).toEqual(["founder"]);
    expect(decision.mode).toBe("coach");
  });

  it("falls back to the strategy advisor when the router returns unknown coach keys", async () => {
    invokeMock.mockResolvedValue({
      coaches: ["not-a-real-coach"],
      lead: "not-a-real-coach",
      mode: "bogus-mode",
      synthesize: false,
      reasoning: "n/a",
    });

    const provider = new BusiboxAgentProvider("token-123");
    const decision = await provider.routeMessage({ message: "??" });

    expect(decision.coaches.map((c) => c.key)).toEqual(["strategy"]);
    expect(decision.mode).toBe("advise");
  });
});

describe("BusiboxAgentProvider.streamResponse", () => {
  beforeEach(() => {
    streamChatMock.mockReset();
  });

  it("maps normalized adapter events onto core StreamEvent shapes", async () => {
    streamChatMock.mockResolvedValue(
      streamOf([
        { type: "text-delta", content: "Hello " },
        { type: "text-delta", content: "world" },
        { type: "tool-call", toolCall: { id: "1", name: "search", args: { q: "x" } } },
        { type: "done", usage: { inputTokens: 10, outputTokens: 5 } },
      ]),
    );

    const provider = new BusiboxAgentProvider("token-123");
    const events = [];
    for await (const event of provider.streamResponse(
      { conversationId: "c1", coachKey: "strategy", orgId: "org1", userId: "u1", projectId: "p1" },
      "hi",
      "system context",
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "text", coachKey: "strategy", text: "Hello " },
      { type: "text", coachKey: "strategy", text: "world" },
      {
        type: "tool_use",
        coachKey: "strategy",
        toolName: "search",
        toolInput: { q: "x" },
        requiresConfirmation: false,
      },
      { type: "usage", coachKey: "strategy", inputTokens: 10, outputTokens: 5 },
      { type: "done", coachKey: "strategy", fullText: "Hello world" },
    ]);
  });

  it("yields an error event and stops when the adapter reports a connection failure", async () => {
    streamChatMock.mockResolvedValue(
      streamOf([
        { type: "error", error: "Agent API error: 503" },
        { type: "done" },
      ]),
    );

    const provider = new BusiboxAgentProvider("token-123");
    const events = [];
    for await (const event of provider.streamResponse(
      { conversationId: "c1", coachKey: "ea", orgId: "org1", userId: "u1", projectId: "p1" },
      "hi",
      "",
    )) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "error", coachKey: "ea", message: "Agent API error: 503" }]);
  });
});

describe("BusiboxAgentProvider.synthesize", () => {
  beforeEach(() => {
    streamChatMock.mockReset();
  });

  it("streams synthesis text under the lead coach's key", async () => {
    streamChatMock.mockResolvedValue(
      streamOf([
        { type: "text-delta", content: "Combined answer." },
        { type: "done" },
      ]),
    );

    const provider = new BusiboxAgentProvider("token-123");
    const events = [];
    for await (const event of provider.synthesize(
      [
        { coachKey: "strategy", coachName: "Strategy Advisor", response: "Do X." },
        { coachKey: "founder", coachName: "Founder Advisor", response: "Do Y." },
      ],
      "what should I do?",
      "advise",
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "text", coachKey: "strategy", text: "Combined answer." },
      { type: "done", coachKey: "strategy", fullText: "Combined answer." },
    ]);
  });
});

describe("BusiboxAgentProvider.isAvailable", () => {
  it("returns true when the agent-api health check succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BusiboxAgentProvider("token-123", "http://agent-api.test");
    await expect(provider.isAvailable()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://agent-api.test/health", expect.any(Object));

    vi.unstubAllGlobals();
  });

  it("returns false when the health check throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const provider = new BusiboxAgentProvider("token-123", "http://agent-api.test");
    await expect(provider.isAvailable()).resolves.toBe(false);

    vi.unstubAllGlobals();
  });
});

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square } from "lucide-react";
import {
  CoachSelector,
  ModeSelector,
  TabbedAdvisorResponse,
  type AdvisorTab,
  type ActivityItem,
} from "@ai-native/core/components";
import type { FeedbackPayload } from "@ai-native/core/components";
import { COACH_META } from "@ai-native/core";
import type { AgentMode, CoachIconName } from "@ai-native/core";

export interface ChatProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  projectId: string;
  initialAdvisorKey?: string;
}

interface AdvisorTurn {
  id: string;
  advisorTabs: AdvisorTab[];
  synthesis: {
    content: string;
    leadKey: string;
    leadName: string;
    leadIcon?: CoachIconName | string;
    isStreaming: boolean;
  } | null;
  mode?: string;
}

interface UserMessage {
  id: string;
  content: string;
}

type RenderItem =
  | { type: "user"; msg: UserMessage }
  | { type: "turn"; turn: AdvisorTurn };

async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      rating: payload.rating,
      coachKey: payload.coachKey,
      mode: payload.mode,
      comment: payload.comment,
    }),
  });
}

function getCoachInfo(key: string | null | undefined): { name: string; icon?: CoachIconName } {
  if (!key) return { name: "Advisor" };
  const coach = COACH_META.find((c) => c.key === key);
  return { name: coach?.name ?? key, icon: coach?.icon };
}

export function Chat({ conversationId, onConversationCreated, projectId, initialAdvisorKey }: ChatProps) {
  const [items, setItems] = useState<RenderItem[]>([]);
  const [activeTurn, setActiveTurn] = useState<AdvisorTurn | null>(null);
  const [input, setInput] = useState("");
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>(
    initialAdvisorKey ? [initialAdvisorKey] : [],
  );
  const [selectedMode, setSelectedMode] = useState<AgentMode | "auto">("auto");
  const [isStreaming, setIsStreaming] = useState(false);
  const currentConvId = useRef<string | null>(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, activeTurn]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    // Add user message immediately
    const userMsgId = crypto.randomUUID();
    setItems((prev) => [...prev, { type: "user", msg: { id: userMsgId, content: text } }]);

    // Create turn skeleton
    const turnId = crypto.randomUUID();
    const newTurn: AdvisorTurn = {
      id: turnId,
      advisorTabs: [],
      synthesis: null,
    };
    setActiveTurn(newTurn);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let currentMode: string | undefined;
    let coachBuffers: Record<string, string> = {};
    let leadKey = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: text,
          conversationId: currentConvId.current,
          projectId,
          coachKeys: selectedCoaches,
          mode: selectedMode === "auto" ? undefined : selectedMode,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat API error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

            if (event["type"] === "conversation_id") {
              const cid = event["conversationId"] as string;
              currentConvId.current = cid;
              onConversationCreated(cid);
            } else if (event["type"] === "routing") {
              currentMode = event["mode"] as string;
              leadKey = event["lead"] as string;
              const coaches = (event["coaches"] as string[]) ?? [];
              setActiveTurn((prev) => ({
                ...(prev ?? { id: turnId, advisorTabs: [], synthesis: null }),
                mode: currentMode,
                advisorTabs: coaches.map((key) => {
                  const info = getCoachInfo(key);
                  return {
                    coachKey: key,
                    coachName: info.name,
                    coachIcon: info.icon,
                    content: "",
                    isStreaming: true,
                    isLead: key === leadKey,
                  };
                }),
              }));
            } else if (event["type"] === "text") {
              const coachKey = event["coachKey"] as string;
              coachBuffers[coachKey] = (coachBuffers[coachKey] ?? "") + (event["text"] as string);
              const buffer = coachBuffers[coachKey];
              setActiveTurn((prev) => {
                if (!prev) return prev;
                const tabs = prev.advisorTabs.map((t) =>
                  t.coachKey === coachKey ? { ...t, content: buffer } : t,
                );
                // If tab not found yet (dispatched advisor), add it
                if (!tabs.some((t) => t.coachKey === coachKey)) {
                  const info = getCoachInfo(coachKey);
                  tabs.push({
                    coachKey,
                    coachName: info.name,
                    coachIcon: info.icon,
                    content: buffer,
                    isStreaming: true,
                  });
                }
                return { ...prev, advisorTabs: tabs };
              });
            } else if (event["type"] === "synthesis_text") {
              const text = event["text"] as string;
              setActiveTurn((prev) => {
                if (!prev) return prev;
                const info = getCoachInfo(leadKey);
                const existing = prev.synthesis;
                return {
                  ...prev,
                  synthesis: {
                    content: (existing?.content ?? "") + text,
                    leadKey,
                    leadName: info.name,
                    leadIcon: info.icon,
                    isStreaming: true,
                  },
                };
              });
            } else if (event["type"] === "synthesis_done") {
              setActiveTurn((prev) => {
                if (!prev?.synthesis) return prev;
                return { ...prev, synthesis: { ...prev.synthesis, isStreaming: false } };
              });
            } else if (event["type"] === "coach_done") {
              const coachKey = event["coachKey"] as string;
              setActiveTurn((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  advisorTabs: prev.advisorTabs.map((t) =>
                    t.coachKey === coachKey ? { ...t, isStreaming: false } : t,
                  ),
                };
              });
            } else if (event["type"] === "done") {
              // Finalize
              setActiveTurn((prev) => {
                if (prev) {
                  setItems((items) => [...items, { type: "turn", turn: { ...prev, advisorTabs: prev.advisorTabs.map((t) => ({ ...t, isStreaming: false })) } }]);
                }
                return null;
              });
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User cancelled
      } else {
        console.error("Chat error:", err);
      }
    } finally {
      setIsStreaming(false);
      setActiveTurn((prev) => {
        if (prev) {
          setItems((items) => [
            ...items,
            {
              type: "turn",
              turn: {
                ...prev,
                advisorTabs: prev.advisorTabs.map((t) => ({ ...t, isStreaming: false })),
                synthesis: prev.synthesis ? { ...prev.synthesis, isStreaming: false } : null,
              },
            },
          ]);
        }
        return null;
      });
    }
  }, [input, isStreaming, selectedCoaches, selectedMode, conversationId, projectId, onConversationCreated]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const renderTurn = (turn: AdvisorTurn, convId: string) => {
    if (turn.advisorTabs.length === 1 && !turn.synthesis) {
      const tab = turn.advisorTabs[0]!;
      return (
        <TabbedAdvisorResponse
          advisorTabs={[tab]}
          synthesis={null}
          conversationId={convId}
          mode={turn.mode}
          onFeedback={submitFeedback}
        />
      );
    }
    return (
      <TabbedAdvisorResponse
        advisorTabs={turn.advisorTabs}
        synthesis={turn.synthesis}
        conversationId={convId}
        mode={turn.mode}
        onFeedback={submitFeedback}
      />
    );
  };

  const convId = currentConvId.current ?? "";

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {items.map((item) =>
          item.type === "user" ? (
            <div key={item.msg.id} className="flex justify-end mb-4">
              <div className="max-w-[80%] bg-[var(--accent)] text-white rounded-2xl px-4 py-2.5 text-sm">
                {item.msg.content}
              </div>
            </div>
          ) : (
            <div key={item.turn.id}>{renderTurn(item.turn, convId)}</div>
          ),
        )}

        {/* Active (streaming) turn */}
        {activeTurn && (
          <div key={activeTurn.id}>{renderTurn(activeTurn, convId)}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
        {/* Controls row */}
        <div className="flex items-center gap-2 mb-2">
          <CoachSelector selectedCoaches={selectedCoaches} onSelect={setSelectedCoaches} />
          <div className="ml-auto">
            <ModeSelector selected={selectedMode} onSelect={setSelectedMode} />
          </div>
        </div>

        {/* Text input row */}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your advisory team..."
            className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] min-h-[44px] max-h-32"
            rows={1}
          />
          <button
            onClick={isStreaming ? stop : sendMessage}
            disabled={!input.trim() && !isStreaming}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
            title={isStreaming ? "Stop" : "Send"}
          >
            {isStreaming ? <Square size={14} fill="white" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

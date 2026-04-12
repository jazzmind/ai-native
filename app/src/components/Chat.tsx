"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CoachSelector } from "./CoachSelector";
import { ChatMessage } from "./ChatMessage";
import { CoachIcon } from "./CoachIcon";
import { ModeSelector } from "./ModeSelector";
import { ExpertCommentDisplay } from "./ExpertComment";
import { COACH_META } from "@/lib/coaches";
import type { CoachIconName, AgentMode } from "@/lib/coaches";

export interface ActivityItem {
  coachKey: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface ExpertCommentData {
  id: string;
  author_email: string;
  author_name: string | null;
  content: string;
  parent_message_id: number | null;
  created_at: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system" | "expert";
  content: string;
  coachKey?: string | null;
  isLead?: boolean;
  isSynthesis?: boolean;
  activity?: ActivityItem[];
  messageId?: number;
  mode?: string | null;
  expertData?: ExpertCommentData;
}

interface ChatProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  projectId: string;
}

function getCoachInfo(key: string | null | undefined): {
  name: string | undefined;
  icon: CoachIconName | undefined;
} {
  if (!key) return { name: undefined, icon: undefined };
  if (key === "synthesis") {
    return { name: "Synthesis", icon: "Link" as CoachIconName };
  }
  const coach = COACH_META.find((c) => c.key === key);
  return { name: coach?.name, icon: coach?.icon };
}

export function Chat({ conversationId, onConversationCreated, projectId }: ChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<AgentMode | "auto">("auto");
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeCoaches, setActiveCoaches] = useState<Set<string>>(new Set());
  const [routingInfo, setRoutingInfo] = useState<string | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthLead, setSynthLead] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentConvId = useRef<string | null>(conversationId);

  useEffect(() => {
    currentConvId.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetch(`/api/conversations?id=${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) {
          const activityByCoach: Record<string, ActivityItem[]> = {};
          if (data.activity) {
            for (const a of data.activity) {
              if (!activityByCoach[a.coach_key]) activityByCoach[a.coach_key] = [];
              activityByCoach[a.coach_key].push({
                coachKey: a.coach_key,
                eventType: a.event_type,
                data: JSON.parse(a.event_data || "{}"),
                timestamp: new Date(a.created_at).getTime(),
              });
            }
          }

          const msgs: DisplayMessage[] = data.messages.map((m: any) => ({
            id: String(m.id),
            role: m.role,
            content: m.content,
            coachKey: m.coach_key,
            isSynthesis: m.coach_key === "synthesis",
            activity: m.role === "assistant" && m.coach_key
              ? activityByCoach[m.coach_key] || []
              : undefined,
            messageId: m.id,
            mode: m.mode || null,
          }));

          // Interleave expert comments by timestamp
          if (data.expertComments) {
            for (const ec of data.expertComments) {
              const expertMsg: DisplayMessage = {
                id: `expert-${ec.id}`,
                role: "expert" as const,
                content: ec.content,
                expertData: ec,
              };
              // Insert after the parent message if linked, otherwise at the end
              if (ec.parent_message_id) {
                const idx = msgs.findIndex((m) => m.messageId === ec.parent_message_id);
                if (idx !== -1) {
                  msgs.splice(idx + 1, 0, expertMsg);
                } else {
                  msgs.push(expertMsg);
                }
              } else {
                msgs.push(expertMsg);
              }
            }
          }

          const assistantKeys = msgs
            .filter((m) => m.role === "assistant" && m.coachKey && m.coachKey !== "synthesis")
            .map((m) => m.coachKey);
          if (assistantKeys.length > 1) {
            const leadKey = assistantKeys[0];
            for (const m of msgs) {
              if (m.coachKey === leadKey && m.role === "assistant") {
                m.isLead = true;
              }
            }
          }
          setMessages(msgs);
        }
      })
      .catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setRoutingInfo(null);
    setActiveCoaches(new Set());
    setSynthesizing(false);
    setSynthLead(null);
    setActiveMode(null);

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    const liveActivity: Map<string, ActivityItem[]> = new Map();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: currentConvId.current,
          coachKeys: selectedCoaches.length > 0 ? selectedCoaches : undefined,
          projectId,
          mode: selectedMode !== "auto" ? selectedMode : undefined,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to send message");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const streamingMessages: Map<string, DisplayMessage> = new Map();

      const addActivityItem = (coachKey: string, eventType: string, data: Record<string, unknown>) => {
        if (!liveActivity.has(coachKey)) liveActivity.set(coachKey, []);
        liveActivity.get(coachKey)!.push({
          coachKey,
          eventType,
          data,
          timestamp: Date.now(),
        });
        const msg = streamingMessages.get(coachKey);
        if (msg) {
          msg.activity = [...(liveActivity.get(coachKey) || [])];
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...msg } : m))
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case "routing":
                if (!currentConvId.current) {
                  currentConvId.current = event.conversationId;
                  onConversationCreated(event.conversationId);
                }
                if (event.mode) setActiveMode(event.mode);
                setRoutingInfo(
                  `Routed to: ${event.coaches.map((c: any) => c.name).join(", ")}` +
                    (event.lead
                      ? ` (lead: ${event.coaches.find((c: any) => c.key === event.lead)?.name || event.lead})`
                      : "") +
                    (event.mode ? ` [${event.mode}]` : "")
                );
                break;

              case "coach_start": {
                setActiveCoaches((prev) => new Set(prev).add(event.coachKey));
                const msgId = `assistant-${event.coachKey}-${Date.now()}`;
                streamingMessages.set(event.coachKey, {
                  id: msgId,
                  role: "assistant",
                  content: "",
                  coachKey: event.coachKey,
                  isLead: event.isLead,
                  activity: [],
                  mode: activeMode,
                });
                setMessages((prev) => [
                  ...prev,
                  streamingMessages.get(event.coachKey)!,
                ]);
                break;
              }

              case "text": {
                const msg = streamingMessages.get(event.coachKey);
                if (msg) {
                  msg.content += event.content;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === msg.id ? { ...msg } : m))
                  );
                }
                break;
              }

              case "tool_use":
                addActivityItem(event.coachKey, "tool_use", { tool: event.tool });
                break;

              case "tool_result":
                addActivityItem(event.coachKey, "tool_result", {
                  tool: event.toolName,
                  result: event.content,
                });
                break;

              case "thinking":
                addActivityItem(event.coachKey, "thinking", {});
                break;

              case "usage":
                addActivityItem(event.coachKey, "usage", event.usage || {});
                break;

              case "context_compacted":
                addActivityItem(event.coachKey, "context_compacted", {});
                break;

              case "coach_done":
                setActiveCoaches((prev) => {
                  const next = new Set(prev);
                  next.delete(event.coachKey);
                  return next;
                });
                break;

              case "synthesis_start": {
                setSynthesizing(true);
                setSynthLead(event.leadKey || null);
                const synthId = `synthesis-${Date.now()}`;
                streamingMessages.set("synthesis", {
                  id: synthId,
                  role: "assistant",
                  content: "",
                  coachKey: event.leadKey || "synthesis",
                  isSynthesis: true,
                  mode: activeMode,
                });
                setMessages((prev) => [
                  ...prev,
                  streamingMessages.get("synthesis")!,
                ]);
                break;
              }

              case "synthesis_text": {
                const synthMsg = streamingMessages.get("synthesis");
                if (synthMsg) {
                  synthMsg.content += event.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === synthMsg.id ? { ...synthMsg } : m
                    )
                  );
                }
                break;
              }

              case "synthesis_done":
                setSynthesizing(false);
                setSynthLead(null);
                break;

              case "error":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `error-${Date.now()}-${Math.random()}`,
                    role: "system",
                    content: `Error: ${event.content}`,
                    coachKey: event.coachKey,
                  },
                ]);
                break;

              case "done":
                break;
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "system",
          content: `Failed to get response: ${err}`,
        },
      ]);
    } finally {
      setIsStreaming(false);
      setActiveCoaches(new Set());
      setSynthesizing(false);
      setSynthLead(null);
    }
  }, [input, isStreaming, selectedCoaches, selectedMode, activeMode, onConversationCreated, projectId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const placeholderText =
    selectedCoaches.length === 0
      ? "Ask your executive team anything..."
      : selectedCoaches.length === 1
        ? `Ask the ${COACH_META.find((c) => c.key === selectedCoaches[0])?.name || "advisor"}...`
        : `Ask ${selectedCoaches.length} advisors...`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-2xl font-semibold mb-2">Executive Team</h2>
            <p className="text-[var(--text-muted)] max-w-md mb-6">
              Ask anything about your business. Select advisors below or let the
              router pick the best team. Choose a mode to control how they respond.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {COACH_META.slice(0, 4).map((coach) => (
                <button
                  key={coach.key}
                  onClick={() => {
                    setSelectedCoaches([coach.key]);
                    inputRef.current?.focus();
                  }}
                  className="text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <CoachIcon
                    name={coach.icon}
                    size={20}
                    className="text-[var(--accent)]"
                  />
                  <div className="text-sm font-medium mt-1">{coach.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {coach.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === "expert" && msg.expertData) {
            return (
              <ExpertCommentDisplay
                key={msg.id}
                authorEmail={msg.expertData.author_email}
                authorName={msg.expertData.author_name}
                content={msg.expertData.content}
                createdAt={msg.expertData.created_at}
              />
            );
          }

          const { name, icon } = getCoachInfo(msg.coachKey);
          return (
            <ChatMessage
              key={msg.id}
              role={msg.role as "user" | "assistant" | "system"}
              content={msg.content}
              coachKey={msg.coachKey}
              coachName={
                msg.isSynthesis ? `${name || "Advisor"} — Synthesis` : name
              }
              coachIcon={icon}
              isLead={msg.isLead}
              isSynthesis={msg.isSynthesis}
              isStreaming={
                msg.role === "assistant" &&
                !!(
                  (msg.coachKey && activeCoaches.has(msg.coachKey)) ||
                  (msg.isSynthesis && synthesizing)
                )
              }
              activity={msg.activity}
              messageId={msg.messageId}
              conversationId={currentConvId.current || undefined}
              mode={msg.mode}
            />
          );
        })}

        {activeCoaches.size > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 ml-1">
            {Array.from(activeCoaches).map((key) => {
              const { name, icon } = getCoachInfo(key);
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-full px-3 py-1 border border-[var(--border)]"
                >
                  <span
                    className="inline-block text-[var(--accent)]"
                    style={{ animation: "pulse-dot 1.5s infinite" }}
                  >
                    ●
                  </span>
                  <CoachIcon name={icon} size={12} />
                  {name} is thinking...
                </div>
              );
            })}
          </div>
        )}

        {synthesizing && synthLead && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2 ml-1 bg-[var(--bg-tertiary)] rounded-full px-3 py-1 border border-[var(--border)] w-fit">
            <span
              className="inline-block text-yellow-400"
              style={{ animation: "pulse-dot 1.5s infinite" }}
            >
              ●
            </span>
            <CoachIcon name={getCoachInfo(synthLead).icon} size={12} />
            {getCoachInfo(synthLead).name} is synthesizing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {routingInfo && (
        <div className="px-6 py-1">
          <span className="text-xs text-[var(--text-muted)]">
            {routingInfo}
          </span>
        </div>
      )}

      <div className="p-4 border-t border-[var(--border)]">
        <div className="mb-3 flex flex-col gap-2">
          <ModeSelector selected={selectedMode} onSelect={setSelectedMode} />
          <CoachSelector
            selectedCoaches={selectedCoaches}
            onSelect={setSelectedCoaches}
          />
        </div>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            rows={1}
            className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

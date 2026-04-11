"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CoachSelector } from "./CoachSelector";
import { ChatMessage } from "./ChatMessage";
import { CoachIcon } from "./CoachIcon";
import { COACH_META } from "@/lib/coaches";
import type { CoachIconName } from "@/lib/coaches";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  coachKey?: string | null;
}

interface ChatProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

function getCoachInfo(key: string | null | undefined): { name: string | undefined; icon: CoachIconName | undefined } {
  if (!key || key === "synthesis") {
    return key === "synthesis"
      ? { name: "Synthesis", icon: "Link" as CoachIconName }
      : { name: undefined, icon: undefined };
  }
  const coach = COACH_META.find((c) => c.key === key);
  return { name: coach?.name, icon: coach?.icon };
}

export function Chat({ conversationId, onConversationCreated }: ChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingCoach, setStreamingCoach] = useState<string | null>(null);
  const [routingInfo, setRoutingInfo] = useState<string | null>(null);
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
          setMessages(
            data.messages.map((m: any) => ({
              id: String(m.id),
              role: m.role,
              content: m.content,
              coachKey: m.coach_key,
            }))
          );
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

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: currentConvId.current,
          coachKey: selectedCoach,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to send message");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const streamingMessages: Map<string, DisplayMessage> = new Map();

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
                setRoutingInfo(
                  `Routed to: ${event.coaches.map((c: any) => c.name).join(", ")}`
                );
                break;

              case "coach_start":
                setStreamingCoach(event.coachKey);
                streamingMessages.set(event.coachKey, {
                  id: `assistant-${event.coachKey}-${Date.now()}`,
                  role: "assistant",
                  content: "",
                  coachKey: event.coachKey,
                });
                setMessages((prev) => [
                  ...prev,
                  streamingMessages.get(event.coachKey)!,
                ]);
                break;

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
                break;

              case "coach_done":
                setStreamingCoach(null);
                break;

              case "synthesis_start":
                setStreamingCoach("synthesis");
                streamingMessages.set("synthesis", {
                  id: `synthesis-${Date.now()}`,
                  role: "assistant",
                  content: "",
                  coachKey: "synthesis",
                });
                setMessages((prev) => [
                  ...prev,
                  streamingMessages.get("synthesis")!,
                ]);
                break;

              case "synthesis_text": {
                const synthMsg = streamingMessages.get("synthesis");
                if (synthMsg) {
                  synthMsg.content = event.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === synthMsg.id ? { ...synthMsg } : m
                    )
                  );
                }
                break;
              }

              case "synthesis_done":
                setStreamingCoach(null);
                break;

              case "error":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `error-${Date.now()}`,
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
      setStreamingCoach(null);
    }
  }, [input, isStreaming, selectedCoach, onConversationCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-2xl font-semibold mb-2">Coach Router</h2>
            <p className="text-[var(--text-muted)] max-w-md mb-6">
              Ask anything about your business. Your question will be routed to
              the right coach, or select one directly.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {COACH_META.slice(0, 4).map((coach) => (
                <button
                  key={coach.key}
                  onClick={() => {
                    setSelectedCoach(coach.key);
                    inputRef.current?.focus();
                  }}
                  className="text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <CoachIcon name={coach.icon} size={20} className="text-[var(--accent)]" />
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
          const { name, icon } = getCoachInfo(msg.coachKey);
          return (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              coachKey={msg.coachKey}
              coachName={name}
              coachIcon={icon}
            />
          );
        })}

        {streamingCoach && (
          <div className="text-xs text-[var(--text-muted)] mb-2 ml-1">
            <span
              className="inline-block"
              style={{ animation: "pulse-dot 1.5s infinite" }}
            >
              ●
            </span>{" "}
            {streamingCoach === "synthesis"
              ? "Synthesizing responses..."
              : `${getCoachInfo(streamingCoach).name || streamingCoach} is thinking...`}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {routingInfo && (
        <div className="px-6 py-1">
          <span className="text-xs text-[var(--text-muted)]">{routingInfo}</span>
        </div>
      )}

      <div className="p-4 border-t border-[var(--border)]">
        <div className="mb-3">
          <CoachSelector
            selectedCoach={selectedCoach}
            onSelect={setSelectedCoach}
          />
        </div>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedCoach
                ? `Ask the ${COACH_META.find((c) => c.key === selectedCoach)?.name || "coach"}...`
                : "Ask your business coaches anything..."
            }
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

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Brain } from "lucide-react";
import { CoachSelector } from "./CoachSelector";
import { ChatMessage } from "./ChatMessage";
import { CoachIcon } from "./CoachIcon";
import { ModeSelector } from "./ModeSelector";
import { ExpertCommentDisplay } from "./ExpertComment";
import { TabbedAdvisorResponse, type AdvisorTab } from "./TabbedAdvisorResponse";
import { ReviewSuggestionBanner } from "./ReviewSuggestionBanner";
import { FileDropZone, type UploadedFile } from "./FileDropZone";
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
  turnId?: string;
  attachments?: { filename: string; mimeType: string }[];
}

interface TabbedTurn {
  id: string;
  advisorTabs: AdvisorTab[];
  synthesis: {
    content: string;
    leadKey: string;
    leadName: string;
    leadIcon?: CoachIconName | string;
    isStreaming: boolean;
    messageId?: number;
  } | null;
  mode?: string | null;
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

type RenderItem =
  | { type: "message"; msg: DisplayMessage }
  | { type: "expert"; msg: DisplayMessage }
  | { type: "tabbed"; turn: TabbedTurn };

function buildRenderItems(messages: DisplayMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "expert" && msg.expertData) {
      items.push({ type: "expert", msg });
      i++;
      continue;
    }

    if (msg.role !== "assistant" || msg.isSynthesis) {
      // For a synthesis that follows advisor messages, it would have been
      // captured by the tabbed group below. If it appears standalone, render as message.
      if (msg.role === "assistant" && msg.isSynthesis) {
        items.push({ type: "message", msg });
        i++;
        continue;
      }
      items.push({ type: "message", msg });
      i++;
      continue;
    }

    // Peek ahead: is this the start of a multi-advisor group?
    // Look for consecutive assistant messages (non-synthesis) possibly followed by a synthesis
    const groupStart = i;
    const group: DisplayMessage[] = [msg];
    let j = i + 1;
    while (j < messages.length) {
      const next = messages[j];
      if (next.role === "expert") {
        j++;
        continue;
      }
      if (next.role === "assistant" && !next.isSynthesis && next.coachKey) {
        group.push(next);
        j++;
        continue;
      }
      break;
    }

    // Check for a synthesis message right after
    let synthMsg: DisplayMessage | null = null;
    if (j < messages.length && messages[j].role === "assistant" && messages[j].isSynthesis) {
      synthMsg = messages[j];
      j++;
    }

    if (group.length > 1 || synthMsg) {
      // Multi-advisor turn: build a tabbed block
      const turn: TabbedTurn = {
        id: `turn-${group[0].id}`,
        advisorTabs: group.map((m) => {
          const info = getCoachInfo(m.coachKey);
          return {
            coachKey: m.coachKey || "unknown",
            coachName: info.name || m.coachKey || "Advisor",
            coachIcon: info.icon,
            content: m.content,
            isLead: m.isLead,
            isStreaming: false,
            activity: m.activity,
            messageId: m.messageId,
          };
        }),
        synthesis: synthMsg
          ? (() => {
              const synthInfo = getCoachInfo(synthMsg!.coachKey);
              return {
                content: synthMsg!.content,
                leadKey: synthMsg!.coachKey || "synthesis",
                leadName: synthInfo.name || "Synthesis",
                leadIcon: synthInfo.icon,
                isStreaming: false,
                messageId: synthMsg!.messageId,
              };
            })()
          : null,
        mode: group[0].mode,
      };
      items.push({ type: "tabbed", turn });

      // Also include any expert comments that were between grouped messages
      for (let k = groupStart + 1; k < j; k++) {
        if (messages[k].role === "expert") {
          items.push({ type: "expert", msg: messages[k] });
        }
      }

      i = j;
    } else {
      // Single advisor response
      items.push({ type: "message", msg });
      i++;
    }
  }

  return items;
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
  const [isLearning, setIsLearning] = useState(false);

  // Multi-advisor streaming state
  const [streamingTurn, setStreamingTurn] = useState<TabbedTurn | null>(null);

  // Review suggestion state
  const [reviewSuggestion, setReviewSuggestion] = useState<{
    reason: string;
    domain: string;
    urgency: 'low' | 'medium' | 'high';
  } | null>(null);

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentConvId = useRef<string | null>(conversationId);

  useEffect(() => {
    currentConvId.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoadError(null);
      return;
    }
    setLoadError(null);
    fetch(`/api/conversations?id=${conversationId}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load conversation (${r.status})`);
        }
        return r.json();
      })
      .then((data) => {
        if (data.messages) {
          const activityByCoach: Record<string, ActivityItem[]> = {};
          if (data.activity) {
            for (const a of data.activity) {
              if (!activityByCoach[a.coach_key]) activityByCoach[a.coach_key] = [];
              let parsedData: Record<string, unknown> = {};
              try {
                parsedData = JSON.parse(a.event_data || "{}");
              } catch {
                // malformed activity row — skip data, keep entry
              }
              activityByCoach[a.coach_key].push({
                coachKey: a.coach_key,
                eventType: a.event_type,
                data: parsedData,
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

          if (data.expertComments) {
            for (const ec of data.expertComments) {
              const expertMsg: DisplayMessage = {
                id: `expert-${ec.id}`,
                role: "expert" as const,
                content: ec.content,
                expertData: ec,
              };
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
      .catch((err: Error) => {
        setLoadError(err.message || "Failed to load conversation");
      });
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingTurn]);

  const sendMessage = useCallback(async (directText?: string) => {
    const text = (directText || input).trim();
    if (!text || isStreaming) return;

    if (!directText) setInput("");
    setIsStreaming(true);
    setRoutingInfo(null);
    setActiveCoaches(new Set());
    setActiveMode(null);
    setStreamingTurn(null);
    setIsLearning(false);
    setReviewSuggestion(null);

    const attachments = pendingFiles.length > 0
      ? pendingFiles.map(f => ({ fileId: f.fileId, filename: f.filename, extractedText: f.extractedText, mimeType: f.mimeType }))
      : undefined;

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      attachments: attachments?.map(a => ({ filename: a.filename, mimeType: a.mimeType })),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPendingFiles([]);

    const liveActivity: Map<string, ActivityItem[]> = new Map();
    let isMultiAdvisor = false;
    let currentTurn: TabbedTurn | null = null;

    // For single-advisor fallback
    const streamingMessages: Map<string, DisplayMessage> = new Map();

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
          attachments,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to send message");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const addActivityItem = (coachKey: string, eventType: string, data: Record<string, unknown>) => {
        if (!liveActivity.has(coachKey)) liveActivity.set(coachKey, []);
        liveActivity.get(coachKey)!.push({ coachKey, eventType, data, timestamp: Date.now() });

        if (isMultiAdvisor && currentTurn) {
          const tab = currentTurn.advisorTabs.find((t) => t.coachKey === coachKey);
          if (tab) {
            tab.activity = [...(liveActivity.get(coachKey) || [])];
            setStreamingTurn({ ...currentTurn });
          }
        } else {
          const msg = streamingMessages.get(coachKey);
          if (msg) {
            msg.activity = [...(liveActivity.get(coachKey) || [])];
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...msg } : m)));
          }
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
              case "routing": {
                if (!currentConvId.current) {
                  currentConvId.current = event.conversationId;
                  onConversationCreated(event.conversationId);
                }
                if (event.mode) setActiveMode(event.mode);
                isMultiAdvisor = event.synthesize && event.coaches.length > 1;

                setRoutingInfo(
                  `Routed to: ${event.coaches.map((c: any) => c.name).join(", ")}` +
                    (event.lead
                      ? ` (lead: ${event.coaches.find((c: any) => c.key === event.lead)?.name || event.lead})`
                      : "") +
                    (event.mode ? ` [${event.mode}]` : "")
                );

                if (isMultiAdvisor) {
                  currentTurn = {
                    id: `turn-${Date.now()}`,
                    advisorTabs: event.coaches.map((c: any) => ({
                      coachKey: c.key,
                      coachName: c.name,
                      coachIcon: c.icon,
                      content: "",
                      isLead: c.isLead,
                      isStreaming: true,
                      activity: [],
                    })),
                    synthesis: null,
                    mode: event.mode,
                  };
                  setStreamingTurn({ ...currentTurn });
                }
                break;
              }

              case "coach_start": {
                setActiveCoaches((prev) => new Set(prev).add(event.coachKey));
                if (!isMultiAdvisor) {
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
                  setMessages((prev) => [...prev, streamingMessages.get(event.coachKey)!]);
                }
                break;
              }

              case "text": {
                if (isMultiAdvisor && currentTurn) {
                  const tab = currentTurn.advisorTabs.find((t) => t.coachKey === event.coachKey);
                  if (tab) {
                    tab.content += event.content;
                    setStreamingTurn({ ...currentTurn });
                  }
                } else {
                  const msg = streamingMessages.get(event.coachKey);
                  if (msg) {
                    msg.content += event.content;
                    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...msg } : m)));
                  }
                }
                break;
              }

              case "tool_use":
                addActivityItem(event.coachKey, "tool_use", { tool: event.tool });
                break;

              case "tool_result":
                addActivityItem(event.coachKey, "tool_result", { tool: event.toolName, result: event.content });
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

              case "coach_done": {
                setActiveCoaches((prev) => {
                  const next = new Set(prev);
                  next.delete(event.coachKey);
                  return next;
                });
                if (isMultiAdvisor && currentTurn) {
                  const tab = currentTurn.advisorTabs.find((t) => t.coachKey === event.coachKey);
                  if (tab) {
                    tab.isStreaming = false;
                    setStreamingTurn({ ...currentTurn });
                  }
                }
                break;
              }

              case "synthesis_start": {
                if (isMultiAdvisor && currentTurn) {
                  const leadInfo = getCoachInfo(event.leadKey);
                  currentTurn.synthesis = {
                    content: "",
                    leadKey: event.leadKey || "synthesis",
                    leadName: event.leadName || leadInfo.name || "Synthesis",
                    leadIcon: leadInfo.icon,
                    isStreaming: true,
                  };
                  setStreamingTurn({ ...currentTurn });
                } else {
                  const synthId = `synthesis-${Date.now()}`;
                  streamingMessages.set("synthesis", {
                    id: synthId,
                    role: "assistant",
                    content: "",
                    coachKey: event.leadKey || "synthesis",
                    isSynthesis: true,
                    mode: activeMode,
                  });
                  setMessages((prev) => [...prev, streamingMessages.get("synthesis")!]);
                }
                break;
              }

              case "synthesis_text": {
                if (isMultiAdvisor && currentTurn?.synthesis) {
                  currentTurn.synthesis.content += event.content;
                  setStreamingTurn({ ...currentTurn });
                } else {
                  const synthMsg = streamingMessages.get("synthesis");
                  if (synthMsg) {
                    synthMsg.content += event.content;
                    setMessages((prev) => prev.map((m) => (m.id === synthMsg.id ? { ...synthMsg } : m)));
                  }
                }
                break;
              }

              case "synthesis_done": {
                if (isMultiAdvisor && currentTurn?.synthesis) {
                  currentTurn.synthesis.isStreaming = false;
                  setStreamingTurn({ ...currentTurn });
                }
                break;
              }

              case "review_suggestion":
                setReviewSuggestion({
                  reason: event.reason,
                  domain: event.domain,
                  urgency: event.urgency,
                });
                break;

              case "task_created":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `task-${Date.now()}`,
                    role: "system" as const,
                    content: `📋 Task scheduled: "${event.title}" — ${event.triggerDescription}`,
                  },
                ]);
                break;

              case "extraction_start":
                setIsLearning(true);
                break;

              case "extraction_done":
                setIsLearning(false);
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
                // Finalize: convert streaming turn into persisted messages for history
                if (isMultiAdvisor && currentTurn) {
                  const finalMessages: DisplayMessage[] = [];
                  for (const tab of currentTurn.advisorTabs) {
                    if (tab.content) {
                      finalMessages.push({
                        id: `final-${tab.coachKey}-${Date.now()}`,
                        role: "assistant",
                        content: tab.content,
                        coachKey: tab.coachKey,
                        isLead: tab.isLead,
                        activity: tab.activity,
                        messageId: tab.messageId,
                        mode: currentTurn.mode,
                      });
                    }
                  }
                  if (currentTurn.synthesis?.content) {
                    finalMessages.push({
                      id: `final-synthesis-${Date.now()}`,
                      role: "assistant",
                      content: currentTurn.synthesis.content,
                      coachKey: currentTurn.synthesis.leadKey,
                      isSynthesis: true,
                      messageId: currentTurn.synthesis.messageId,
                      mode: currentTurn.mode,
                    });
                  }
                  setMessages((prev) => [...prev, ...finalMessages]);
                  setStreamingTurn(null);
                }
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
      setStreamingTurn(null);
      setIsLearning(false);
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

  const renderItems = buildRenderItems(messages);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loadError && (
          <div className="flex items-center gap-2 p-4 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            <span>⚠</span>
            <span>{loadError}</span>
          </div>
        )}
        {messages.length === 0 && !streamingTurn && !loadError && (
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
                  <CoachIcon name={coach.icon} size={20} className="text-[var(--accent)]" />
                  <div className="text-sm font-medium mt-1">{coach.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{coach.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {renderItems.map((item) => {
          if (item.type === "expert" && item.msg.expertData) {
            return (
              <ExpertCommentDisplay
                key={item.msg.id}
                authorEmail={item.msg.expertData.author_email}
                authorName={item.msg.expertData.author_name}
                content={item.msg.expertData.content}
                createdAt={item.msg.expertData.created_at}
              />
            );
          }

          if (item.type === "tabbed") {
            return (
              <TabbedAdvisorResponse
                key={item.turn.id}
                advisorTabs={item.turn.advisorTabs}
                synthesis={item.turn.synthesis}
                conversationId={currentConvId.current || undefined}
                mode={item.turn.mode}
              />
            );
          }

          const msg = item.msg;
          const { name, icon } = getCoachInfo(msg.coachKey);
          return (
            <ChatMessage
              key={msg.id}
              role={msg.role as "user" | "assistant" | "system"}
              content={msg.content}
              coachKey={msg.coachKey}
              coachName={msg.isSynthesis ? `${name || "Advisor"} — Synthesis` : name}
              coachIcon={icon}
              isLead={msg.isLead}
              isSynthesis={msg.isSynthesis}
              isStreaming={
                msg.role === "assistant" &&
                !!(msg.coachKey && activeCoaches.has(msg.coachKey))
              }
              activity={msg.activity}
              messageId={msg.messageId}
              conversationId={currentConvId.current || undefined}
              mode={msg.mode}
              onSendMessage={sendMessage}
            />
          );
        })}

        {/* Live streaming tabbed turn */}
        {streamingTurn && (
          <TabbedAdvisorResponse
            advisorTabs={streamingTurn.advisorTabs}
            synthesis={streamingTurn.synthesis}
            conversationId={currentConvId.current || undefined}
            mode={streamingTurn.mode}
          />
        )}

        {/* Single-advisor thinking indicators (only when not using tabbed view) */}
        {!streamingTurn && activeCoaches.size > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 ml-1">
            {Array.from(activeCoaches).map((key) => {
              const { name, icon } = getCoachInfo(key);
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-full px-3 py-1 border border-[var(--border)]"
                >
                  <span className="inline-block text-[var(--accent)]" style={{ animation: "pulse-dot 1.5s infinite" }}>●</span>
                  <CoachIcon name={icon} size={12} />
                  {name} is thinking...
                </div>
              );
            })}
          </div>
        )}

        {/* Learning indicator */}
        {isLearning && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2 ml-1 bg-[var(--bg-tertiary)] rounded-full px-3 py-1 border border-[var(--border)] w-fit">
            <Brain size={12} className="text-purple-400" />
            <span>Learning from this conversation...</span>
            <span className="text-purple-400" style={{ animation: "pulse-dot 1.5s infinite" }}>●</span>
          </div>
        )}

        {/* Review suggestion */}
        {reviewSuggestion && currentConvId.current && (
          <ReviewSuggestionBanner
            reason={reviewSuggestion.reason}
            domain={reviewSuggestion.domain}
            urgency={reviewSuggestion.urgency}
            conversationId={currentConvId.current}
            onDismiss={() => setReviewSuggestion(null)}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {routingInfo && (
        <div className="px-6 py-1">
          <span className="text-xs text-[var(--text-muted)]">{routingInfo}</span>
        </div>
      )}

      <div className="p-4 border-t border-[var(--border)]">
        <div className="mb-3 flex flex-col gap-2">
          <ModeSelector selected={selectedMode} onSelect={setSelectedMode} />
          <CoachSelector selectedCoaches={selectedCoaches} onSelect={setSelectedCoaches} />
        </div>
        <FileDropZone
          files={pendingFiles}
          onFilesChange={setPendingFiles}
          disabled={isStreaming}
        />
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
            onClick={() => sendMessage()}
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

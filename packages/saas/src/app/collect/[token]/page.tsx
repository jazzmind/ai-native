"use client";

import { useState, useEffect, useRef, use } from "react";
import { Send, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function CollectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/collect/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          if (data.complete) setDone(true);
        } else {
          setMessages(data.messages || []);
          setExpiresAt(data.expiresAt || null);
          if (data.messages?.length === 0) {
            // Seed with opening AI message
            setMessages([{
              role: "assistant",
              content: "Hi! I'm here to gather your status updates so I can compile the report. Let's start — what are the key things you accomplished this period?",
              timestamp: new Date().toISOString(),
            }]);
          }
        }
      })
      .catch(() => setError("Failed to load session"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(markDone = false) {
    const text = input.trim();
    if (!text && !markDone) return;
    setSending(true);

    const userMsg: ChatMessage = { role: "user", content: text || "(done)", timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch(`/api/collect/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: text || "I'm done providing updates.", complete: markDone }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send");
        return;
      }

      const data = await res.json();

      if (data.complete || data.done) {
        setDone(true);
        if (data.reply && !data.complete) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply, timestamp: new Date().toISOString() }]);
        } else {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: "I have enough information to compile the report. I'll send you an email with a link once it's ready — usually within a few minutes.",
            timestamp: new Date().toISOString(),
          }]);
        }
      } else if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply, timestamp: new Date().toISOString() }]);
      }
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-[#737373] text-sm">Loading…</div>
      </div>
    );
  }

  if (error && !done) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-[#e5e5e5] font-medium mb-1">Unable to load session</p>
          <p className="text-[#737373] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <CheckCircle className="mx-auto mb-4 text-green-400" size={40} />
          <h1 className="text-[#e5e5e5] text-lg font-semibold mb-2">Updates received</h1>
          <p className="text-[#737373] text-sm">
            Your Chief of Staff is compiling the report. You'll receive an email with a link when it's ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[#e5e5e5] font-semibold text-sm">Status Update</h1>
            <p className="text-[#737373] text-xs">Chief of Staff · Data Collection</p>
          </div>
          {expiresAt && (
            <div className="flex items-center gap-1 text-xs text-[#737373]">
              <Clock size={11} />
              Expires {new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#7c3aed] text-white rounded-br-sm"
                    : "bg-[#1a1a1a] border border-[#2a2a2a] text-[#e5e5e5] rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-[#2a2a2a] bg-[#1a1a1a] px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl overflow-hidden focus-within:border-[#7c3aed] transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your update… (Enter to send, Shift+Enter for newline)"
                rows={3}
                className="w-full px-4 py-3 bg-transparent text-[#e5e5e5] placeholder-[#525252] text-sm resize-none focus:outline-none"
                disabled={sending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center hover:bg-[#6d28d9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send"
              >
                <Send size={14} />
              </button>
              <button
                onClick={() => send(true)}
                disabled={sending}
                className="w-9 h-9 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#737373] flex items-center justify-center hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="I'm done — compile the report"
              >
                <CheckCircle size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-[#525252] mt-2">
            Click <CheckCircle size={10} className="inline" /> when you're done providing updates to trigger report generation.
          </p>
        </div>
      </div>
    </div>
  );
}

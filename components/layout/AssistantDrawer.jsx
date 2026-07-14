"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Sparkles } from "lucide-react";

import Drawer from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Field";
import Markdown from "@/components/shared/Markdown";
import { askAssistant } from "@/services/aiService";

const SUGGESTIONS = [
  "Which projects are delayed?",
  "Who has not submitted today's follow-up?",
  "What are my deadlines this week?",
  "Who is blocked right now?",
];

export default function AssistantDrawer({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const ask = useMutation({
    mutationFn: askAssistant,
    onSuccess: (answer) => setMessages((m) => [...m, { role: "assistant", text: answer }]),
    onError: (e) =>
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            e.response?.status === 503
              ? "AI is not configured yet — add a Gemini API key to the backend to enable the assistant."
              : "That request failed. Try again in a moment.",
        },
      ]),
  });

  const send = (text) => {
    const message = (text ?? input).trim();
    if (!message || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    ask.mutate(message);
  };

  return (
    <Drawer open={open} onClose={onClose} title="WorkOS Assistant">
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                Ask about your projects, tasks, deadlines and team. Try:
              </p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-btn border border-border bg-background/60 px-3 py-2 text-left text-sm transition-colors duration-150 hover:border-muted/40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto whitespace-pre-wrap bg-primary text-primary-foreground"
                  : "border border-border bg-background/60"
              }`}
            >
              {m.role === "assistant" ? <Markdown text={m.text} /> : m.text}
            </div>
          ))}
          {ask.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Sparkles size={14} className="animate-pulse" /> Thinking…
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border pt-3">
          <input
            aria-label="Ask the assistant"
            placeholder="Ask anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="flex-1 rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          />
          <Button onClick={() => send()} disabled={!input.trim() || ask.isPending} aria-label="Send">
            <Send size={15} />
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

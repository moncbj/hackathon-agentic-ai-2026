"use client";

// components/tutor/tutor-chat.tsx
// Reusable interactive Tutor Chat component (SPEC-005 §3.1, §3.5)

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  followUps?: string[];
  suggestedAction?: {
    type: "start_assessment" | "open_skill" | "open_journey" | "open_notebook";
    skillSlug?: string;
    notebookId?: string;
  };
}

export interface SkillOption {
  slug: string;
  name: string;
}

export interface NotebookOption {
  id: string;
  title: string;
}

interface TutorChatProps {
  initialSkillSlug?: string;
  initialNotebookId?: string;
  isCompact?: boolean;
}

let messageCounter = 0;
function nextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function TutorChat({
  initialSkillSlug,
  initialNotebookId,
  isCompact = false,
}: TutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Hello! I am your personal learning tutor. I am here to help you navigate your journey, explain difficult concepts with real-world examples, and keep you moving forward. What would you like to explore today?",
      followUps: [
        "What should I do this week?",
        "Why is SQL important for my role?",
        "How can I test my current level?",
      ],
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skill and Notebook context options
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookOption[]>([]);
  const [selectedSkillSlug, setSelectedSkillSlug] = useState<string>(
    initialSkillSlug || ""
  );
  const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>(
    initialNotebookId ? [initialNotebookId] : []
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new message
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    // Fetch available skills for focus dropdown
    fetch("/api/learner")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.skillStates) {
          setSkills(
            data.skillStates.map((s: { skillSlug: string; skillName: string }) => ({
              slug: s.skillSlug,
              name: s.skillName,
            }))
          );
        }
      })
      .catch(() => {});

    // Fetch available notebooks
    fetch("/api/notebooks")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setNotebooks(
            data.map((nb: { id: string; title: string }) => ({
              id: nb.id,
              title: nb.title,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  async function sendMessage(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsgId = nextMessageId("user");
    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, role: "user", content: trimmed },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Build history (last 10 turns excluding the current question)
    const historyPayload = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: historyPayload,
          focusSkillSlug: selectedSkillSlug || undefined,
          notebookIds:
            selectedNotebookIds.length > 0 ? selectedNotebookIds : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to reach your tutor");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId("asst"),
          role: "assistant",
          content: data.answer,
          followUps: data.followUps,
          suggestedAction: data.suggestedAction,
        },
      ]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while communicating with the tutor."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content);
    }
  }

  function toggleNotebookSelection(nbId: string) {
    setSelectedNotebookIds((prev) =>
      prev.includes(nbId) ? prev.filter((id) => id !== nbId) : [...prev, nbId].slice(-2)
    );
  }

  return (
    <div
      className={`flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${
        isCompact ? "h-[560px]" : "h-[740px]"
      }`}
    >
      {/* Context Bar */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600">Focus skill:</span>
            <select
              value={selectedSkillSlug}
              onChange={(e) => setSelectedSkillSlug(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-700 font-medium outline-none focus:border-emerald-600"
            >
              <option value="">(All skills)</option>
              {skills.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {notebooks.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-600">Notebooks:</span>
              {notebooks.slice(0, 3).map((nb) => {
                const isSelected = selectedNotebookIds.includes(nb.id);
                return (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => toggleNotebookSelection(nb.id)}
                    className={`rounded-full px-2.5 py-0.5 font-semibold transition text-[11px] ${
                      isSelected
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    📓 {nb.title.length > 18 ? nb.title.slice(0, 18) + "..." : nb.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setMessages([
              {
                id: "welcome-reset",
                role: "assistant",
                content: "Chat reset. How can I help you next?",
                followUps: ["What should I do this week?", "Why SQL first?"],
              },
            ]);
            setError(null);
          }}
          className="text-slate-400 hover:text-slate-700 font-semibold"
          title="Reset conversation"
        >
          Clear chat
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-emerald-700 text-white rounded-br-none shadow-sm"
                  : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Action Button if provided */}
              {m.suggestedAction && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  {m.suggestedAction.type === "start_assessment" && m.suggestedAction.skillSlug && (
                    <Link
                      href={`/assessment/${m.suggestedAction.skillSlug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition"
                    >
                      ⚡ Start {m.suggestedAction.skillSlug.toUpperCase()} Assessment →
                    </Link>
                  )}
                  {m.suggestedAction.type === "open_skill" && m.suggestedAction.skillSlug && (
                    <Link
                      href={`/skills/${m.suggestedAction.skillSlug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-800 transition"
                    >
                      📖 View Skill Details →
                    </Link>
                  )}
                  {m.suggestedAction.type === "open_journey" && (
                    <Link
                      href="/journey"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition"
                    >
                      🗺️ Open Learning Plan →
                    </Link>
                  )}
                  {m.suggestedAction.type === "open_notebook" && m.suggestedAction.notebookId && (
                    <Link
                      href={`/notebooks?id=${m.suggestedAction.notebookId}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-800 transition"
                    >
                      📓 Open Notebook →
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Follow-up question suggestion chips */}
            {m.role === "assistant" && m.followUps && m.followUps.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.followUps.map((f, i) => (
                  <button
                    key={i}
                    disabled={loading}
                    onClick={() => sendMessage(f)}
                    className="rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-50"
                  >
                    ✦ {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold p-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-bounce" />
            <span
              className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-bounce"
              style={{ animationDelay: "0.4s" }}
            />
            <span>Your tutor is formulating an explanation...</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              onClick={handleRetry}
              className="rounded-lg bg-rose-700 px-3 py-1 font-bold text-white hover:bg-rose-800"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-slate-200 p-3 sm:p-4 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your plan, concepts, or notes..."
          disabled={loading}
          maxLength={1000}
          className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-emerald-600 transition"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}

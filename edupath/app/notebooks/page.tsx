"use client";

// app/notebooks/page.tsx
// Interactive Study Notebooks interface and subject viewer (SPEC-005 §3.3, §3.5)

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NotebookRecord } from "@/lib/db/repositories/notebooks";

interface CatalogSkill {
  id: string;
  slug: string;
  name: string;
}

function NotebooksContent() {
  const searchParams = useSearchParams();
  const selectedIdFromUrl = searchParams.get("id");

  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [catalogSkills, setCatalogSkills] = useState<CatalogSkill[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formSkillIds, setFormSkillIds] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activeId = selectedNotebookId ?? selectedIdFromUrl;
  const selectedNotebook = useMemo(() => {
    if (activeId) {
      const match = notebooks.find((n) => n.id === activeId);
      if (match) return match;
    }
    return notebooks.length > 0 ? notebooks[0] : null;
  }, [activeId, notebooks]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [nbRes, learnerRes] = await Promise.all([
          fetch("/api/notebooks"),
          fetch("/api/learner"),
        ]);

        if (!nbRes.ok) {
          throw new Error("Failed to load notebooks");
        }

        const nbData: NotebookRecord[] = await nbRes.json();
        if (active) {
          setNotebooks(nbData);
        }

        if (learnerRes.ok) {
          const learnerData = await learnerRes.json();
          if (active && learnerData?.skillStates) {
            setCatalogSkills(
              learnerData.skillStates.map((s: { skillId: string; skillSlug: string; skillName: string }) => ({
                id: s.skillId,
                slug: s.skillSlug,
                name: s.skillName,
              }))
            );
          }
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error loading data");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  function openCreateModal() {
    setIsEditing(false);
    setFormId(null);
    setFormTitle("");
    setFormContent("");
    setFormSkillIds(catalogSkills.length > 0 ? [catalogSkills[0].id] : []);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(nb: NotebookRecord) {
    setIsEditing(true);
    setFormId(nb.id);
    setFormTitle(nb.title);
    setFormContent(nb.content);
    setFormSkillIds(nb.skills.map((s) => s.id));
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Title is required");
      return;
    }
    if (formSkillIds.length === 0) {
      setFormError("Please select at least one associated skill");
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      if (isEditing && formId) {
        const res = await fetch(`/api/notebooks/${formId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent,
            skillIds: formSkillIds,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || "Failed to update notebook");
        }

        const updated: NotebookRecord = await res.json();
        setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSelectedNotebookId(updated.id);
      } else {
        const res = await fetch("/api/notebooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent,
            skillIds: formSkillIds,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || "Failed to create notebook");
        }

        const created: NotebookRecord = await res.json();
        setNotebooks((prev) => [created, ...prev]);
        setSelectedNotebookId(created.id);
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Submission error");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this notebook?")) {
      return;
    }

    try {
      const res = await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete notebook");
      }

      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      if (selectedNotebook?.id === id) {
        const remaining = notebooks.filter((n) => n.id !== id);
        setSelectedNotebookId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function toggleSkillInForm(skillId: string) {
    setFormSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-28 rounded-3xl bg-slate-200" />
        <div className="grid gap-6 md:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="h-96 rounded-3xl bg-slate-200" />
          <div className="h-96 rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
            Study Subjects & Notes
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900 tracking-tight">
            Learning Notebooks
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create subjects, link them to catalog skills, and let your tutor ground its answers on your notes.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-emerald-800 transition"
        >
          + New Notebook
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold text-rose-700">✕</button>
        </div>
      )}

      {notebooks.length === 0 ? (
        <div className="rounded-3xl border border-emerald-100 bg-white p-12 text-center shadow-sm space-y-4">
          <span className="text-5xl">📓</span>
          <h2 className="text-xl font-black text-slate-900">No notebooks yet</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Create your first notebook to write code snippets, capture key definitions, and link them to your target role skills.
          </p>
          <button
            onClick={openCreateModal}
            className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
          >
            Create your first notebook
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[20rem_minmax(0,1fr)]">
          {/* Left: Card list of notebooks */}
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider px-1">
              Your Notebooks ({notebooks.length})
            </h2>

            <div className="space-y-2.5">
              {notebooks.map((nb) => {
                const isSelected = selectedNotebook?.id === nb.id;
                return (
                  <div
                    key={nb.id}
                    onClick={() => setSelectedNotebookId(nb.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition text-left flex flex-col justify-between ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <h3 className="font-black text-sm text-slate-900 line-clamp-1">
                        {nb.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {nb.content || "Empty notebook..."}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1 items-center">
                      {nb.skills.map((s) => (
                        <span
                          key={s.id}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Subject Detail View */}
          {selectedNotebook ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Detail Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
                      Subject Detail
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                      {selectedNotebook.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Created on {new Date(selectedNotebook.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(selectedNotebook)}
                      className="rounded-xl border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(selectedNotebook.id)}
                      className="rounded-xl border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Associated Skills Bar */}
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Associated Skills & Competency
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {selectedNotebook.skills.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs flex items-center gap-2"
                      >
                        <span className="font-black text-slate-900">{s.name}</span>
                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          Level {s.level ?? 0}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 capitalize">
                          {s.status?.replace("_", " ") ?? "available"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notebook Content */}
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Notes & Reference
                  </h4>
                  <div className="mt-2 rounded-2xl bg-slate-50 p-5 font-mono text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-200/60 max-h-[400px] overflow-y-auto">
                    {selectedNotebook.content || "(No content written yet)"}
                  </div>
                </div>
              </div>

              {/* Action: Ask Tutor about this Notebook */}
              <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  Discuss or practice these notes with your personalized AI tutor.
                </p>
                <Link
                  href={`/tutor?notebookId=${selectedNotebook.id}`}
                  className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-800 transition"
                >
                  ✦ Ask the tutor about this notebook →
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-400">
              Select a notebook to view details.
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {isEditing ? "Edit Notebook" : "Create New Notebook"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-600 tracking-wider">
                  Title (max 80 chars)
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. SQL Window Functions & Aggregates"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-600 tracking-wider">
                  Associated Skills (at least one)
                </label>
                <div className="mt-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {catalogSkills.map((s) => {
                    const isChecked = formSkillIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSkillInForm(s.id)}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                          isChecked
                            ? "bg-emerald-700 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {isChecked ? "✓ " : "+ "}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black uppercase text-slate-600 tracking-wider">
                    Content & Notes (max 20,000 chars)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {formContent.length}/20,000
                  </span>
                </div>
                <textarea
                  rows={8}
                  maxLength={20000}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Paste code snippets, formulas, key questions, or study notes..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {formSubmitting
                    ? "Saving..."
                    : isEditing
                    ? "Save Changes"
                    : "Create Notebook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotebooksPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto h-[500px] rounded-3xl bg-slate-100 animate-pulse" />
      }
    >
      <NotebooksContent />
    </Suspense>
  );
}

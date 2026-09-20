"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextAreaField, TextField } from "@/components/ui/field";

type Action = { label: string; href: string };
type Message = { id: number; author: "learner" | "tutor"; text: string; action?: Action };
type Skill = { id: string; name: string; level: number; status: string };
type Notebook = { id: string; title: string; content: string; skillIds: string[]; updatedAt: string };

const skills: Skill[] = [
  { id: "sql", name: "SQL fundamentals", level: 2, status: "In progress" },
  { id: "sheets", name: "Spreadsheets", level: 3, status: "Acquired" },
  { id: "python", name: "Basic Python", level: 1, status: "In progress" },
  { id: "stats", name: "Descriptive statistics", level: 2, status: "Needs verification" },
];

const initialNotebooks: Notebook[] = [
  { id: "sql-notes", title: "SQL joins cheat sheet", content: "INNER JOIN keeps matching records. Use LEFT JOIN when every row from the left table matters.", skillIds: ["sql"], updatedAt: "Today" },
  { id: "python-notes", title: "Python patterns", content: "Lists are ordered collections. Start with small transformations and name intermediate values clearly.", skillIds: ["python"], updatedAt: "Yesterday" },
];

function SkillLabel({ skillId }: { skillId: string }) {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{skills.find((skill) => skill.id === skillId)?.name}</span>;
}

export function TutorView() {
  const [messages, setMessages] = useState<Message[]>([{ id: 1, author: "tutor", text: "Hi Alex! I can help you understand your plan, practice a concept, or use one of your notebooks." }]);
  const [question, setQuestion] = useState("");
  const [focusSkill, setFocusSkill] = useState("");
  const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);

  function ask(rawQuestion: string) {
    const trimmed = rawQuestion.trim().slice(0, 1000);
    if (!trimmed || typing) return;
    setMessages((current) => [...current, { id: Date.now(), author: "learner", text: trimmed }]);
    setQuestion("");
    setTyping(true);
    window.setTimeout(() => {
      const focus = skills.find((skill) => skill.id === focusSkill);
      const notebook = initialNotebooks.find((item) => selectedNotebookIds.includes(item.id));
      const mentionsLevel = /level|raise|increase/i.test(trimmed);
      setMessages((current) => [...current, {
        id: Date.now() + 1,
        author: "tutor",
        text: mentionsLevel
          ? "I can’t change a level. Assessments measure that; when a skill is eligible, you can start one to verify what you know."
          : notebook
            ? `Using “${notebook.title}”: ${notebook.content} ${focus ? `This supports your ${focus.name} focus.` : ""}`
            : focus
              ? `Let’s focus on ${focus.name}. Your next small step is to turn one idea into a short practice session. Want to break it down together?`
              : "This week, start with the SQL filtering mission. It is a focused step that supports the rest of your data-learning path.",
        action: mentionsLevel ? { label: "Start assessment", href: "/assessment/sql" } : { label: "Open your plan", href: "/journey" },
      }]);
      setTyping(false);
    }, 500);
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); ask(question); }
  function toggleNotebook(id: string) { setSelectedNotebookIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); }

  return <div className="mx-auto max-w-4xl space-y-5">
    <div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Your tutor</p><h1 className="mt-1 text-3xl font-black">Learn with a thinking partner</h1></div>
    <Card className="overflow-hidden"><div className="border-b border-slate-100 bg-emerald-50 px-5 py-4"><p className="font-bold text-emerald-950">Friendly · clear · practical</p><p className="text-sm text-emerald-800">Your chat stays on this device and resets when you reload.</p></div>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Focus skill<select value={focusSkill} onChange={(event) => setFocusSkill(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="">No focus skill</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label><fieldset><legend className="text-sm font-semibold text-slate-700">Use notebooks (optional)</legend><div className="mt-2 flex flex-wrap gap-2">{initialNotebooks.map((notebook) => <label key={notebook.id} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700"><input checked={selectedNotebookIds.includes(notebook.id)} onChange={() => toggleNotebook(notebook.id)} type="checkbox" /> {notebook.title}</label>)}</div></fieldset></div>
        <div aria-live="polite" className="min-h-80 space-y-4">{messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[76%] ${message.author === "learner" ? "ml-auto bg-emerald-700 text-white" : "bg-slate-100 text-slate-800"}`}><p>{message.text}</p>{message.action && <a href={message.action.href} className="mt-3 inline-block rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm">{message.action.label} →</a>}</div>)}{typing && <div className="flex w-fit items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600"/><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:150ms]"/><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:300ms]"/></span>Tutor is thinking…</div>}</div>
        <div className="flex flex-wrap gap-2">{["What should I do this week?", "Why did my plan change?", "Explain SQL joins simply"].map((suggestion) => <button key={suggestion} onClick={() => ask(suggestion)} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{suggestion}</button>)}</div>
        <form onSubmit={submit} className="flex gap-2 border-t border-slate-100 pt-4"><input value={question} maxLength={1000} onChange={(event) => setQuestion(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Ask about your plan or a concept…"/><Button disabled={!question.trim() || typing} type="submit">Send</Button></form>
      </CardContent>
    </Card>
  </div>;
}

const reportBlocks = [
  { title: "Acquired", accent: "border-emerald-200", items: ["Spreadsheets · verified"] },
  { title: "In progress", accent: "border-blue-200", items: ["SQL fundamentals · 62%", "Basic Python · 35%"] },
  { title: "Remaining gaps", accent: "border-amber-200", items: ["pandas · gap 3", "Data cleaning · gap 3"] },
];

export function ProgressView() {
  const [generatedAt, setGeneratedAt] = useState("Today, 9:40 AM");
  const [reports, setReports] = useState(["Today, 9:40 AM", "September 18, 4:15 PM"]);
  function generate() { const timestamp = "Just now"; setGeneratedAt(timestamp); setReports((items) => [timestamp, ...items].slice(0, 5)); }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Progress report</p><h1 className="mt-1 text-3xl font-black">A clear view of your growth</h1></div><Button onClick={generate}>Generate report</Button></div>
    <section className="rounded-3xl bg-violet-700 p-6 text-white sm:p-8"><p className="text-sm font-bold text-violet-200">Report narrative · {generatedAt}</p><h2 className="mt-2 max-w-3xl text-2xl font-black">You have a strong foundation. Building confidence in SQL now creates a practical bridge to Python and data cleaning.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-violet-100">You have kept momentum on your current path. Focus on one short SQL practice this week, then use an assessment when you are ready to verify your knowledge.</p></section>
    <div className="grid gap-5 md:grid-cols-3">{reportBlocks.map((block) => <Card key={block.title} className={`border-2 ${block.accent}`}><CardContent><h2 className="font-black">{block.title}</h2><ul className="mt-3 space-y-2 text-sm text-slate-700">{block.items.map((item) => <li key={item}>• {item}</li>)}</ul></CardContent></Card>)}</div>
    <Card><CardContent><h2 className="text-xl font-black">Next steps</h2><ol className="mt-4 space-y-3">{[["Finish a SQL practice", "/skills/sql"], ["Verify spreadsheet knowledge", "/assessment/spreadsheets"], ["Open this week’s plan", "/journey"]].map(([text, href], index) => <li key={text} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-3 font-semibold"><b className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-xs text-emerald-800">{index + 1}</b>{text}</span><a href={href} className="text-sm font-bold text-emerald-700">Open →</a></li>)}</ol></CardContent></Card>
    <Card><CardContent><h2 className="font-black">Previous reports</h2><ul className="mt-3 divide-y divide-slate-100">{reports.map((report, index) => <li key={`${report}-${index}`} className="flex items-center justify-between py-3 text-sm"><span>{report}</span><button className="font-bold text-emerald-700">View summary</button></li>)}</ul></CardContent></Card>
  </div>;
}

export function NotebooksView() {
  const [notebooks, setNotebooks] = useState<Notebook[]>(initialNotebooks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [skillIds, setSkillIds] = useState<string[]>([]); const [error, setError] = useState("");
  const active = notebooks.find((notebook) => notebook.id === activeId);
  function begin(notebook?: Notebook) { setActiveId(notebook?.id ?? "new"); setTitle(notebook?.title ?? ""); setContent(notebook?.content ?? ""); setSkillIds(notebook?.skillIds ?? []); setError(""); }
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!title.trim() || !content.trim() || !skillIds.length) { setError("Add a title, content, and at least one skill."); return; } const item: Notebook = { id: activeId === "new" ? `note-${Date.now()}` : activeId!, title: title.trim(), content: content.trim(), skillIds, updatedAt: "Just now" }; setNotebooks((items) => activeId === "new" ? [item, ...items] : items.map((notebook) => notebook.id === item.id ? item : notebook)); setActiveId(null); }
  function toggleSkill(id: string) { setSkillIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); }
  function remove(id: string) { setNotebooks((items) => items.filter((item) => item.id !== id)); if (activeId === id) setActiveId(null); }
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Study notebooks</p><h1 className="mt-1 text-3xl font-black">Your subjects, in your words</h1><p className="mt-2 text-slate-600">Associate notes with skills so you can bring them into a tutor chat.</p></div><Button onClick={() => begin()}>+ New notebook</Button></div>
    {activeId && <Card className="border-emerald-200"><CardContent><form onSubmit={save} className="space-y-4"><h2 className="text-xl font-black">{activeId === "new" ? "Create notebook" : "Edit notebook"}</h2><TextField label="Title" required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} /><TextAreaField label="Content" required maxLength={20000} value={content} onChange={(event) => setContent(event.target.value)} /><fieldset><legend className="text-sm font-medium text-slate-800">Associated skills *</legend><div className="mt-2 flex flex-wrap gap-3">{skills.map((skill) => <label key={skill.id} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-sm"><input type="checkbox" checked={skillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)} />{skill.name}</label>)}</div></fieldset>{error && <p className="text-sm font-medium text-rose-700">{error}</p>}<div className="flex gap-3"><Button type="submit">Save notebook</Button><Button type="button" variant="ghost" onClick={() => setActiveId(null)}>Cancel</Button></div></form></CardContent></Card>}
    {active && activeId !== "new" && <Card><CardContent><p className="text-sm font-bold text-emerald-700">Notebook detail</p><h2 className="mt-1 text-2xl font-black">{active.title}</h2><p className="mt-3 whitespace-pre-wrap text-slate-700">{active.content}</p><div className="mt-4 flex flex-wrap gap-2">{active.skillIds.map((id) => <SkillLabel key={id} skillId={id} />)}</div><a href="/tutor" className="mt-5 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Ask the tutor about this notebook →</a></CardContent></Card>}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{notebooks.map((notebook) => <Card key={notebook.id}><CardContent className="flex h-full flex-col"><span className="text-3xl">📓</span><h2 className="mt-3 text-lg font-black">{notebook.title}</h2><p className="mt-2 line-clamp-3 text-sm text-slate-600">{notebook.content}</p><div className="mt-4 flex flex-wrap gap-1">{notebook.skillIds.map((id) => <SkillLabel key={id} skillId={id} />)}</div><p className="mt-3 text-xs text-slate-500">Updated {notebook.updatedAt}</p><div className="mt-4 flex gap-3 text-sm font-bold"><button onClick={() => begin(notebook)} className="text-emerald-700">Open / edit</button><button onClick={() => remove(notebook.id)} className="text-rose-700">Delete</button></div></CardContent></Card>)}</div>
  </div>;
}

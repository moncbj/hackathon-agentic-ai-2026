"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TextAreaField } from "@/components/ui/field";
import { IconCheckCircle } from "@/components/ui/icons";
import { extractProfile } from "@/app/_lib/api/onboarding";
import type {
    ExtraSkill,
    ProposedSkill,
    RoleSkill,
    SkillLevel,
    UnmappedSkill,
} from "@/app/_lib/api/onboarding-types";
import {
    addExtraSkill,
    sanitizeProposals,
    sanitizeUnmapped,
} from "@/app/onboarding/cv-proposals";
import { getLevelInfo } from "@/app/onboarding/levels";
import { LIMITS, validateCvText } from "@/app/onboarding/validation";

interface CvHelperProps {
    roleSkills: readonly RoleSkill[];
    skillLevels: Record<string, SkillLevel>;
    extraSkills: readonly ExtraSkill[];
    /** Called with the levels to change. The parent merges them into the form. */
    onApplyLevels: (levels: Record<string, SkillLevel>) => void;
    onChangeExtraSkills: (extraSkills: ExtraSkill[]) => void;
}

type ExtractState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; proposals: ProposedSkill[]; unmapped: UnmappedSkill[]; summary: string };

const CONFIDENCE_LABEL: Record<ProposedSkill["confidence"], string> = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
};

const CONFIDENCE_CLASS: Record<ProposedSkill["confidence"], string> = {
    high: "bg-emerald-50 text-emerald-800 border-emerald-200",
    medium: "bg-amber-50 text-amber-800 border-amber-200",
    low: "bg-slate-100 text-slate-700 border-slate-200",
};

// Keys for the "already handled" sets. Prefixed so a skill slug can never collide with an unmapped skill name.
const proposalKey = (slug: string) => `p:${slug}`;
const unmappedKey = (name: string) => `u:${name.trim().toLowerCase()}`;

const MANUAL_HINT = "You can keep setting your levels by hand below.";

function errorMessage(status: number | undefined, type: string): string {
    if (type === "network") return `We couldn't reach the CV assistant. Check your connection and try again. ${MANUAL_HINT}`;
    if (status === 400 || status === 413 || status === 422) {
        return `The assistant couldn't read that text. Try pasting a shorter or cleaner version. ${MANUAL_HINT}`;
    }
    return `The CV assistant isn't available right now. ${MANUAL_HINT}`;
}

export function CvHelper({ roleSkills, skillLevels, extraSkills, onApplyLevels, onChangeExtraSkills }: CvHelperProps) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [textError, setTextError] = useState<string | undefined>();
    const [state, setState] = useState<ExtractState>({ status: "idle" });
    // Proposals the person already dealt with, keyed by skill slug or by lowercase name.
    const [applied, setApplied] = useState<Set<string>>(new Set());
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [notice, setNotice] = useState<string | null>(null);

    const skillBySlug = new Map(roleSkills.map((skill) => [skill.slug, skill]));
    const currentLevel = (slug: string): SkillLevel => skillLevels[slug] ?? 0;

    async function handleAnalyze() {
        const problem = validateCvText(text);
        if (problem) {
            setTextError(problem);
            return;
        }
        setTextError(undefined);
        setNotice(null);
        setState({ status: "loading" });

        const { data, error } = await extractProfile(text.trim());
        if (error || !data) {
            setState({ status: "error", message: errorMessage(error?.status, error?.type ?? "unknown") });
            return;
        }

        setApplied(new Set());
        setDismissed(new Set());
        setState({
            status: "ready",
            proposals: sanitizeProposals(
                data.proposedSkills,
                roleSkills.map((skill) => skill.slug),
            ),
            unmapped: sanitizeUnmapped(data.unmappedSkills),
            summary: typeof data.summary === "string" ? data.summary : "",
        });
    }

    function markApplied(keys: string[]) {
        setApplied((current) => new Set([...current, ...keys]));
    }

    function markDismissed(key: string) {
        setDismissed((current) => new Set([...current, key]));
    }

    function applyOne(proposal: ProposedSkill) {
        onApplyLevels({ [proposal.skillSlug]: proposal.proposedLevel });
        markApplied([proposalKey(proposal.skillSlug)]);
    }

    function addUnmapped(skill: UnmappedSkill) {
        const result = addExtraSkill(extraSkills, { name: skill.name, level: skill.proposedLevel });
        if (result.status === "limit") {
            setNotice(`You can add up to ${LIMITS.extraSkillsMax} other skills. Remove one to add another.`);
            return;
        }
        setNotice(null);
        if (result.status === "added") onChangeExtraSkills(result.extraSkills);
        markApplied([unmappedKey(skill.name)]);
    }

    const isLoading = state.status === "loading";

    // Proposals still waiting for a decision that would actually change a level.
    const pending =
        state.status === "ready"
            ? state.proposals.filter(
                  (proposal) =>
                      !applied.has(proposalKey(proposal.skillSlug)) &&
                      !dismissed.has(proposalKey(proposal.skillSlug)) &&
                      currentLevel(proposal.skillSlug) !== proposal.proposedLevel,
              )
            : [];

    function applyAll() {
        const patch: Record<string, SkillLevel> = {};
        for (const proposal of pending) patch[proposal.skillSlug] = proposal.proposedLevel;
        onApplyLevels(patch);
        markApplied(pending.map((proposal) => proposalKey(proposal.skillSlug)));
    }

    if (!open) {
        return (
            <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                    Have a CV or project notes? Paste them and we&apos;ll suggest levels. You decide which ones to use.
                </p>
                <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
                    Help me with my CV
                </Button>
            </div>
        );
    }

    return (
        <section aria-label="Help me with my CV" className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h4 className="text-base font-semibold text-slate-900">Help me with my CV</h4>
                    <p className="mt-0.5 text-sm text-slate-600">
                        Paste text from your CV, portfolio or projects. We won&apos;t save it, and nothing changes until you apply a suggestion.
                    </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Close
                </Button>
            </div>

            <TextAreaField
                label="Your text"
                value={text}
                maxLength={LIMITS.cvTextMax}
                error={textError}
                disabled={isLoading}
                placeholder="For example: Built weekly sales reports with SQL and Excel..."
                onChange={(event) => {
                    setText(event.target.value);
                    setTextError(undefined);
                }}
            />

            <div className="flex items-center gap-3">
                <Button type="button" onClick={handleAnalyze} disabled={isLoading}>
                    {state.status === "ready" || state.status === "error" ? "Analyze again" : "Suggest my levels"}
                </Button>
                {isLoading && (
                    <span className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
                        <Spinner size="sm" />
                        Reading your text...
                    </span>
                )}
            </div>

            {state.status === "error" && (
                <Alert variant="error" title="We couldn't get suggestions">
                    {state.message}
                </Alert>
            )}

            {state.status === "ready" && (
                <div className="space-y-4" aria-live="polite">
                    {state.summary && <p className="text-sm text-slate-700">{state.summary}</p>}

                    {state.proposals.length === 0 && state.unmapped.length === 0 && (
                        <Alert variant="info" title="No clear matches found">
                            The text didn&apos;t show clear evidence for this role&apos;s skills. {MANUAL_HINT}
                        </Alert>
                    )}

                    {state.proposals.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h5 className="text-sm font-semibold text-slate-900">Suggested levels</h5>
                                <Button type="button" size="sm" onClick={applyAll} disabled={pending.length === 0}>
                                    {pending.length > 0 ? `Apply all (${pending.length})` : "Apply all"}
                                </Button>
                            </div>
                            <ul className="space-y-2">
                                {state.proposals
                                    .filter((proposal) => !dismissed.has(proposalKey(proposal.skillSlug)))
                                    .map((proposal) => {
                                        const skill = skillBySlug.get(proposal.skillSlug);
                                        if (!skill) return null;
                                        const isApplied = applied.has(proposalKey(proposal.skillSlug));
                                        const isSame = currentLevel(proposal.skillSlug) === proposal.proposedLevel;
                                        return (
                                            <li
                                                key={proposal.skillSlug}
                                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                                            >
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-slate-900">{skill.name}</span>
                                                    <span
                                                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[proposal.confidence]}`}
                                                    >
                                                        {CONFIDENCE_LABEL[proposal.confidence]}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-700">
                                                    Level {currentLevel(proposal.skillSlug)} ({getLevelInfo(currentLevel(proposal.skillSlug)).label}) to level{" "}
                                                    {proposal.proposedLevel} ({getLevelInfo(proposal.proposedLevel).label})
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">{proposal.rationale}</p>
                                                <div className="mt-3 flex items-center gap-2">
                                                    {isApplied || isSame ? (
                                                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                                                            <IconCheckCircle className="h-4 w-4" aria-hidden="true" />
                                                            {isApplied ? "Applied" : "Already at this level"}
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Button type="button" size="sm" onClick={() => applyOne(proposal)}>
                                                                Apply
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => markDismissed(proposalKey(proposal.skillSlug))}
                                                            >
                                                                Dismiss
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    )}

                    {state.unmapped.length > 0 && (
                        <div className="space-y-2">
                            <div>
                                <h5 className="text-sm font-semibold text-slate-900">Other skills we found</h5>
                                <p className="text-sm text-slate-600">
                                    These aren&apos;t part of this role. You can save them as notes.
                                </p>
                            </div>
                            {notice && <p className="text-sm font-medium text-amber-800">{notice}</p>}
                            <ul className="space-y-2">
                                {state.unmapped
                                    .filter((skill) => !dismissed.has(unmappedKey(skill.name)))
                                    .map((skill) => {
                                        const key = unmappedKey(skill.name);
                                        const isAdded =
                                            applied.has(key) ||
                                            extraSkills.some((extra) => unmappedKey(extra.name) === key);
                                        return (
                                            <li
                                                key={key}
                                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                                            >
                                                <p className="font-medium text-slate-900">
                                                    {skill.name}{" "}
                                                    <span className="text-sm font-normal text-slate-600">
                                                        (level {skill.proposedLevel}, {getLevelInfo(skill.proposedLevel).label})
                                                    </span>
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">{skill.rationale}</p>
                                                <div className="mt-3 flex items-center gap-2">
                                                    {isAdded ? (
                                                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                                                            <IconCheckCircle className="h-4 w-4" aria-hidden="true" />
                                                            Added to other skills
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Button type="button" size="sm" variant="secondary" onClick={() => addUnmapped(skill)}>
                                                                Add to other skills
                                                            </Button>
                                                            <Button type="button" size="sm" variant="ghost" onClick={() => markDismissed(key)}>
                                                                Dismiss
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

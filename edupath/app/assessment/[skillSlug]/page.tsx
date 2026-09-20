"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconActivity,
  IconRefresh,
} from "@/components/ui/icons";

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionRubricCriterion {
  description: string;
  points: number;
}

interface QuestionRubric {
  criteria: QuestionRubricCriterion[];
  maxPoints: number;
}

interface AssessmentQuestion {
  id: string;
  type: "multiple_choice" | "short_answer";
  prompt: string;
  options?: QuestionOption[];
  correctOptionId?: string;
  rubric?: QuestionRubric;
  explanation?: string;
}

interface AssessmentMeta {
  id: string;
  kind: string;
  targetLevel: number;
  skillSlug: string;
  skillName: string;
  status: string;
  createdAt: string;
}

interface SubmitResult {
  score: number;
  measuredLevel: number;
  passed: boolean;
  newLevel: number;
  verification: string;
  status: string;
  itemFeedback: Array<{ questionId: string; score: number; feedback?: string }>;
  overallFeedback: string;
  strugglesWith: string[];
  replanRecommended: boolean;
  stateChanges: {
    skillSlug: string;
    oldLevel: number;
    newLevel: number;
    oldStatus: string;
    newStatus: string;
    unlockedSkills: string[];
  };
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const skillSlug = params?.skillSlug as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<AssessmentMeta | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [step, setStep] = useState<"intro" | "questions" | "submitting" | "results">("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [result, setResult] = useState<SubmitResult | null>(null);
  const [revealedQuestions, setRevealedQuestions] = useState<AssessmentQuestion[]>([]);
  const [replanning, setReplanning] = useState(false);

  // Initialize or fetch assessment
  useEffect(() => {
    if (!skillSlug) return;
    let active = true;

    async function init() {
      setLoading(true);
      setError(null);
      setIneligibleReason(null);

      try {
        const res = await fetch("/api/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillSlug }),
        });

        if (res.status === 409) {
          const errData = await res.json();
          if (active) {
            setIneligibleReason(
              errData.error ||
                "Esta habilidad no es elegible para evaluación en este momento. Requiere nivel auto-declarado >= 1 o progreso >= 100%."
            );
            setLoading(false);
          }
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error initializing assessment (${res.status})`);
        }

        const data = await res.json();
        if (active) {
          setAssessment(data.assessment);
          setQuestions(data.questions || []);
          setStep("intro");
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error initializing assessment");
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [skillSlug]);

  // Handle MCQ selection
  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  // Handle Short Answer input
  const handleShortAnswerChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  // Submit assessment
  const handleSubmit = async () => {
    if (!assessment) return;
    setStep("submitting");
    setError(null);

    try {
      const res = await fetch(`/api/assessments/${assessment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || "No se pudo calificar la evaluación. Por favor, intenta de nuevo."
        );
      }

      const submitData: SubmitResult = await res.json();
      setResult(submitData);

      // Now fetch revealed questions (full answers, rubrics, and explanations)
      const detailRes = await fetch(`/api/assessments/${assessment.id}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        if (detailData.assessment?.questions) {
          setRevealedQuestions(detailData.assessment.questions);
        }
      }

      setStep("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar la evaluación");
      setStep("questions");
    }
  };

  // Trigger Replan
  const handleReplan = async () => {
    setReplanning(true);
    setError(null);

    try {
      const res = await fetch("/api/journey/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "assessment" }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al replanificar la ruta");
      }

      router.push("/dashboard?replanned=true");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al replanificar la ruta");
      setReplanning(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <Spinner className="w-10 h-10 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Preparando tu evaluación</h2>
          <p className="text-sm text-slate-500 mt-2">
            El Agente Auditor está configurando una prueba técnica adaptada a tu nivel objetivo...
          </p>
        </div>
      </main>
    );
  }

  // Ineligible Screen
  if (ineligibleReason) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white rounded-3xl p-8 border border-amber-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <IconAlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Evaluación no disponible</h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">{ineligibleReason}</p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button variant="primary" className="w-full">
                Volver al Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Error Screen
  if (error && step !== "questions") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white rounded-3xl p-8 border border-rose-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
            <IconAlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Ocurrió un inconveniente</h2>
          <p className="text-sm text-rose-600 mt-2">{error}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                setStep("intro");
              }}
            >
              Reintentar
            </Button>
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 1. INTRO SCREEN
  if (step === "intro" && assessment) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              <IconActivity className="w-3.5 h-3.5" />
              Evaluación de {assessment.kind === "verification" ? "Verificación" : "Progreso"}
            </span>
            <span className="text-xs font-medium text-slate-400">
              Nivel objetivo: {assessment.targetLevel}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Evaluar {assessment.skillName}
          </h1>

          <p className="mt-3 text-slate-600 leading-relaxed text-sm md:text-base">
            Esta evaluación contiene exactamente <strong>5 preguntas</strong> (3 de opción múltiple y 2 de respuesta corta). Será auditada de forma objetiva para verificar tu nivel de dominio real y calibrar tu ruta de aprendizaje.
          </p>

          <div className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-xs md:text-sm text-slate-600">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ✓
              </span>
              <span>
                <strong>Aprobación:</strong> Un puntaje igual o superior al 70% consolida tu competencia verificada.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ℹ
              </span>
              <span>
                <strong>Auditoría:</strong> Tus respuestas son evaluadas contra una rúbrica técnica rigurosa.
              </span>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" className="gap-2">
                <IconArrowLeft className="w-4 h-4" /> Cancelar
              </Button>
            </Link>
            <Button
              variant="primary"
              size="lg"
              className="gap-2 shadow-indigo-200 shadow-md"
              onClick={() => {
                setCurrentIndex(0);
                setStep("questions");
              }}
            >
              Comenzar evaluación <IconArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // 2. SUBMITTING SCREEN
  if (step === "submitting") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white rounded-3xl p-10 border border-indigo-100 shadow-lg">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-75" />
            <div className="relative w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <IconActivity className="w-8 h-8 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900">Auditando tus respuestas</h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            El Agente Auditor está calificando las opciones múltiples y analizando tus respuestas abiertas según la rúbrica técnica...
          </p>
          <p className="text-xs text-slate-400 mt-4">Un momento por favor</p>
        </div>
      </main>
    );
  }

  // 3. QUESTIONS STEP
  if (step === "questions" && questions.length > 0) {
    const currentQ = questions[currentIndex];
    const isLast = currentIndex === questions.length - 1;
    const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="max-w-2xl w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Header & Progress Bar */}
          <div className="p-6 md:p-8 border-b border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-3">
              <span className="uppercase tracking-wider">
                Pregunta {currentIndex + 1} de {questions.length}
              </span>
              <span className="font-bold text-indigo-600">
                {currentQ.type === "multiple_choice" ? "Opción Múltiple" : "Respuesta Abierta"}
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Question Content */}
          <div className="p-6 md:p-8 flex-1">
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-snug">
              {currentQ.prompt}
            </h2>

            {/* MCQ Options */}
            {currentQ.type === "multiple_choice" && currentQ.options && (
              <div className="mt-6 space-y-3">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = answers[currentQ.id] === opt.id;
                  const letter = String.fromCharCode(65 + idx);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(currentQ.id, opt.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-600 text-slate-900"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-sm leading-relaxed">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short Answer Text Area */}
            {currentQ.type === "short_answer" && (
              <div className="mt-6">
                <textarea
                  rows={5}
                  value={answers[currentQ.id] || ""}
                  onChange={(e) => handleShortAnswerChange(currentQ.id, e.target.value)}
                  placeholder="Escribe tu respuesta explicando los conceptos técnicos requeridos..."
                  className="w-full p-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm text-slate-800 leading-relaxed resize-y placeholder:text-slate-400"
                />
                <p className="mt-2 text-xs text-slate-400 text-right">
                  {(answers[currentQ.id] || "").length} caracteres
                </p>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <Button
              variant="secondary"
              size="md"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="gap-1.5"
            >
              <IconArrowLeft className="w-4 h-4" /> Anterior
            </Button>

            {isLast ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 shadow-sm"
              >
                Enviar evaluación <IconCheckCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="gap-1.5"
              >
                Siguiente <IconArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // 4. RESULTS STEP
  if (step === "results" && result) {
    const questionsWithDetails = revealedQuestions.length > 0 ? revealedQuestions : questions;
    const scorePercent = Math.round(result.score * 100);

    return (
      <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Main Results Hero Card */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                  <IconCheckCircle className="w-4 h-4" /> Sello Verificado
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  Resultados: {assessment?.skillName}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Evaluación completada y verificada en la plataforma
                </p>
              </div>

              {/* Score Badge */}
              <div
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border min-w-[120px] ${
                  result.passed
                    ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                    : "bg-amber-50 border-amber-200 text-amber-950"
                }`}
              >
                <span className="text-3xl font-black tracking-tight">{scorePercent}%</span>
                <span className="text-xs font-bold uppercase tracking-wider mt-0.5">
                  {result.passed ? "Aprobado" : "Requiere refuerzo"}
                </span>
              </div>
            </div>

            {/* Level Comparison Stats */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Nivel medido</span>
                <span className="text-lg font-extrabold text-slate-900">
                  Nivel {result.measuredLevel}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">Nuevo nivel</span>
                <span className="text-lg font-extrabold text-indigo-700">
                  Nivel {result.newLevel}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">Estado</span>
                <span className="text-sm font-bold capitalize text-slate-800 block mt-1">
                  {result.status.replace("_", " ")}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">Verificación</span>
                <span className="text-sm font-bold text-emerald-700 block mt-1">
                  {result.verification}
                </span>
              </div>
            </div>

            {/* Overall Feedback */}
            {result.overallFeedback && (
              <div className="mt-6 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-sm text-slate-700 leading-relaxed">
                <strong className="font-bold text-indigo-950 block mb-1">
                  Dictamen del Auditor:
                </strong>
                {result.overallFeedback}
              </div>
            )}

            {/* Concepts Struggling With */}
            {result.strugglesWith && result.strugglesWith.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Conceptos a reforzar:
                </span>
                <div className="flex flex-wrap gap-2">
                  {result.strugglesWith.map((concept, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Call To Action Buttons */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <Link href="/dashboard">
                <Button variant="secondary">Volver al Dashboard</Button>
              </Link>

              {result.replanRecommended && (
                <Button
                  variant="primary"
                  size="lg"
                  disabled={replanning}
                  onClick={handleReplan}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-md font-bold"
                >
                  {replanning ? (
                    <>
                      <Spinner className="w-5 h-5 text-white" />
                      Replanificando tu plan...
                    </>
                  ) : (
                    <>
                      <IconRefresh className="w-5 h-5" />
                      Ver cómo cambió tu plan
                    </>
                  )}
                </Button>
              )}
            </div>
          </section>

          {/* Question by Question Detailed Breakdown */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 px-1">
              Desglose detallado por pregunta
            </h2>

            {questionsWithDetails.map((q, idx) => {
              const studentAnswer = answers[q.id];
              const itemFeedback = result.itemFeedback?.find((f) => f.questionId === q.id);
              const isMCQ = q.type === "multiple_choice";
              const isCorrectMCQ = isMCQ && q.correctOptionId && studentAnswer === q.correctOptionId;

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        {isMCQ ? "Opción múltiple" : "Respuesta corta"}
                      </span>
                    </div>

                    {isMCQ ? (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                          isCorrectMCQ
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isCorrectMCQ ? "Correcta (1.0)" : "Incorrecta (0.0)"}
                      </span>
                    ) : (
                      itemFeedback && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800">
                          Puntaje: {itemFeedback.score.toFixed(1)} / 1.0
                        </span>
                      )
                    )}
                  </div>

                  <p className="text-sm md:text-base font-semibold text-slate-900 leading-snug">
                    {q.prompt}
                  </p>

                  {/* MCQ choices with revealed answer key */}
                  {isMCQ && q.options && (
                    <div className="space-y-2 mt-2">
                      {q.options.map((opt) => {
                        const isStudent = studentAnswer === opt.id;
                        const isRight = q.correctOptionId === opt.id;

                        let style = "border-slate-200 bg-slate-50 text-slate-600";
                        if (isRight) {
                          style = "border-emerald-500 bg-emerald-50 text-emerald-950 font-medium";
                        } else if (isStudent && !isRight) {
                          style = "border-rose-300 bg-rose-50 text-rose-900";
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-xl border text-xs md:text-sm flex items-center justify-between ${style}`}
                          >
                            <span>{opt.text}</span>
                            <div className="flex items-center gap-2 text-xs font-bold">
                              {isStudent && (
                                <span className="text-slate-500 text-[10px] uppercase bg-white/70 px-1.5 py-0.5 rounded border border-slate-200">
                                  Tu elección
                                </span>
                              )}
                              {isRight && (
                                <span className="text-emerald-700 text-xs font-bold">
                                  ✓ Correcta
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Short Answer Student Text and Feedback */}
                  {!isMCQ && (
                    <div className="space-y-3 mt-2">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs md:text-sm">
                        <strong className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Tu respuesta:
                        </strong>
                        <p className="text-slate-800 italic">
                          {studentAnswer ? `"${studentAnswer}"` : "(Sin respuesta)"}
                        </p>
                      </div>

                      {itemFeedback?.feedback && (
                        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950">
                          <strong className="block text-[11px] font-bold uppercase tracking-wider text-indigo-800 mb-1">
                            Retroalimentación:
                          </strong>
                          {itemFeedback.feedback}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Revealed Explanation */}
                  {q.explanation && (
                    <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs text-amber-950">
                      <strong className="block text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-0.5">
                        Explicación técnica:
                      </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </main>
    );
  }

  return null;
}

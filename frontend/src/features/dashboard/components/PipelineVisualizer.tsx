"use client";

import { useState, useEffect } from "react";
import { SpecialistResult, SynthesisReport } from "@/types";
import { HoverScale } from "@/components/animations/HoverScale";

function TypingText({ text = "", speed = 120, delay = 1200 }: { text: string; speed?: number; delay?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text.charAt(index));
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setDisplayedText("");
        setIndex(0);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [index, text, speed, delay]);

  return (
    <span className="font-mono inline-block w-[170px] text-left">
      {displayedText}
      <span className="animate-cursor-blink text-sky-500 font-bold ml-[1px]">|</span>
    </span>
  );
}

interface PipelineVisualizerProps {
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  isLoading: boolean;
  patientId: string | null;
}

const specialistKeys = ["renal", "neuropathy", "retinal", "cardiovascular"];
const specialistNames: Record<string, string> = {
  renal: "Renal",
  neuropathy: "Nerves",
  retinal: "Retinal",
  cardiovascular: "Heart",
};

export function PipelineVisualizer({
  specialists,
  synthesis,
  isLoading,
  patientId,
}: PipelineVisualizerProps) {
  const hasLabs = !!patientId;
  const completedSpecialists = specialists.reduce((acc, spec) => {
    acc[spec.specialist] = spec;
    return acc;
  }, {} as Record<string, SpecialistResult>);

  const renalDone = !!completedSpecialists["renal"];
  const neuropathyDone = !!completedSpecialists["neuropathy"];
  const retinalDone = !!completedSpecialists["retinal"];
  const cardiovascularDone = !!completedSpecialists["cardiovascular"];
  const allSpecialistsDone = renalDone && neuropathyDone && retinalDone && cardiovascularDone;

  const synthesisDone = !!synthesis;
  const pipelineFinished = allSpecialistsDone && synthesisDone && !isLoading;

  // Soft, tinted badge colors (bg + text pair) per risk tier - replaces the
  // old bordered-rectangle + harsh-red-triangle treatment with the same
  // "filled circle" language used by the other three pipeline nodes.
  const getBadgeTone = (spec: SpecialistResult | undefined) => {
    if (!spec || !spec.available || spec.risk_score === null) {
      return { bg: "bg-slate-50", ring: "ring-slate-200", text: "text-slate-400" };
    }
    if (spec.flag || spec.risk_score >= 0.7) {
      return { bg: "bg-rose-50", ring: "ring-rose-200", text: "text-rose-500" };
    }
    if (spec.risk_score >= 0.4) {
      return { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-500" };
    }
    return { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-500" };
  };

  return (
    <HoverScale className="rounded-[32px] border border-slate-200 bg-white p-5 md:p-6 transition-colors duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-700">Swarm execution</h3>
          <p className="text-xs text-slate-400">How a patient's labs become a referral</p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-500">
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-sky-600">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
              <TypingText text="Streaming node data..." />
            </span>
          ) : pipelineFinished ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Complete
            </span>
          ) : hasLabs ? (
            <span className="text-slate-400">Ready</span>
          ) : (
            <span className="text-slate-300">Idle</span>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-start justify-between gap-4 md:gap-2 relative w-full">

        {/* Node 1: Patient Labs */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ${
            pipelineFinished
              ? "bg-emerald-50 text-emerald-600"
              : hasLabs
              ? "bg-sky-50 text-sky-600"
              : "bg-slate-50 text-slate-300"
          }`}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className={`mt-2.5 text-xs font-semibold ${hasLabs ? "text-slate-700" : "text-slate-300"}`}>Patient labs</span>
          <span className="text-[10px] text-slate-400 font-mono">{patientId || "none selected"}</span>
        </div>

        {/* Connector 1 */}
        <div className="hidden md:block flex-1 h-px bg-slate-100 min-w-[16px] relative overflow-hidden rounded-full mt-7">
          {isLoading && !allSpecialistsDone && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-shimmer-connector" />
          )}
          {pipelineFinished && <div className="absolute inset-0 bg-emerald-300" />}
        </div>

        {/* Node 2: 4 Specialist Agents - plain cluster of soft circular
            badges, no outer bordered box. Matches the single-circle
            language of every other node instead of nesting a bordered
            rectangle group full of bordered rectangle cards. */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          <div className="grid grid-cols-4 gap-4 sm:gap-5">
            {specialistKeys.map((key) => {
              const spec = completedSpecialists[key];
              const isDone = !!spec;
              const isActive = isLoading && !isDone;
              const name = specialistNames[key];
              const tone = getBadgeTone(spec);

              return (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full ring-1 transition-all duration-300 ${
                    isDone ? `${tone.bg} ${tone.ring}` : isActive ? "bg-sky-50 ring-sky-200" : "bg-slate-50 ring-slate-100"
                  }`}>
                    {isDone ? (
                      !spec.available || spec.risk_score === null ? (
                        <span className="text-[9px] font-bold text-slate-400">N/A</span>
                      ) : spec.flag ? (
                        <svg className={`h-6 w-6 ${tone.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <span className={`text-sm font-bold ${tone.text}`}>{Math.round(spec.risk_score * 100)}%</span>
                      )
                    ) : isActive ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-200" />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">{name}</span>
                </div>
              );
            })}
          </div>
          <span className="mt-3 text-xs font-semibold text-slate-700">4 specialist agents</span>
          <span className="text-[10px] text-slate-400 font-mono">running in parallel</span>
        </div>

        {/* Connector 2 */}
        <div className="hidden md:block flex-1 h-px bg-slate-100 min-w-[16px] relative overflow-hidden rounded-full mt-7">
          {isLoading && allSpecialistsDone && !synthesisDone && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-shimmer-connector" />
          )}
          {pipelineFinished && <div className="absolute inset-0 bg-emerald-300" />}
        </div>

        {/* Node 3: Synthesis Agent */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ${
            pipelineFinished
              ? "bg-emerald-50 text-emerald-600"
              : synthesisDone
              ? "bg-sky-50 text-sky-600"
              : isLoading && allSpecialistsDone
              ? "bg-sky-50 text-sky-400"
              : "bg-slate-50 text-slate-300"
          }`}>
            {synthesisDone ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : isLoading && allSpecialistsDone ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            )}
          </div>
          <span className={`mt-2.5 text-xs font-semibold ${synthesisDone ? "text-slate-700" : "text-slate-300"}`}>Synthesis agent</span>
          <span className="text-[10px] text-slate-400 font-mono">builds consensus</span>
        </div>

        {/* Connector 3 */}
        <div className="hidden md:block flex-1 h-px bg-slate-100 min-w-[16px] relative overflow-hidden rounded-full mt-7">
          {isLoading && synthesisDone && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-shimmer-connector" />
          )}
          {pipelineFinished && <div className="absolute inset-0 bg-emerald-300" />}
        </div>

        {/* Node 4: Referral Recommendation */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ${
            pipelineFinished ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-300"
          }`}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className={`mt-2.5 text-xs font-semibold ${pipelineFinished ? "text-slate-700" : "text-slate-300"}`}>Referral issued</span>
          <span className="text-[10px] text-slate-400 font-mono">{synthesis?.top_concern || "pending"}</span>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer-connector {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer-connector {
          animation: shimmer-connector 1.5s infinite linear;
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-cursor-blink {
          animation: cursor-blink 0.8s infinite step-start;
        }
      `}} />
    </HoverScale>
  );
}
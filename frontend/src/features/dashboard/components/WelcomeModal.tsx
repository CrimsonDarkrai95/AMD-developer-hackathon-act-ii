"use client";

import { useState, useEffect } from "react";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  // Reset to slide 0 when modal is opened
  useEffect(() => {
    if (isOpen) {
      setActiveSlide(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-300 md:p-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Carousel Content */}
        {activeSlide === 0 ? (
          /* SLIDE 1: Introduction & Architecture Flex */
          <div className="space-y-6 animate-slide-in-right">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/50 shadow-sm">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">DiaSentry Swarm</h2>
                <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">AI-Powered Diabetic Complication Triage</p>
              </div>
            </div>

            <p className="text-base leading-relaxed text-slate-600">
              <strong className="text-slate-800">DiaSentry Swarm</strong> runs four specialist AI agents against a patient's lab results to catch diabetic kidney, nerve, eye, and heart damage years before standard screening would flag them.
            </p>

            {/* The Story / Architecture Flex Box */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 md:p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-sky-800 uppercase tracking-wider mb-2">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                The Swarm Sandbox Architecture
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Each specialist agent doesn't just run static checks. They evaluate inputs and dynamically write and execute their own Python analysis code in a secure backend environment against the patient's real labs (from the NHANES dataset). Finally, a Chief Synthesis Agent compiles all four specialist outputs into a single, cohesive clinical referral recommendation.
              </p>
            </div>
          </div>
        ) : (
          /* SLIDE 2: Specialist Roster */
          <div className="space-y-5 animate-slide-in-right">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">How It Works</h2>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Meet the Swarm Roster</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
              {/* Renal */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:border-slate-200">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Renal Specialist
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Reads <strong className="text-slate-700">eGFR + UACR</strong>. Flags kidney stress at early-warning thresholds well below standard "chronic kidney disease" diagnostics.
                </p>
              </div>

              {/* Neuropathy */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:border-slate-200">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  Neuropathy Specialist
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Reads <strong className="text-slate-700">A1c + years with diabetes</strong>. Screens for neuropathic degradation and cumulative peripheral nerve damage risk.
                </p>
              </div>

              {/* Retinal */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:border-slate-200">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Retinal Specialist
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Reads <strong className="text-slate-700">systolic BP + diabetes duration</strong>. Flags early signs of retinopathy and microvascular stress.
                </p>
              </div>

              {/* Cardiovascular */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:border-slate-200">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Cardiovascular Agent
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Reads <strong className="text-slate-700">lipid panel (LDL, HDL, Triglycerides)</strong>. Flags silent cardiovascular risks that a standard HbA1c screening misses.
                </p>
              </div>

              {/* Synthesis */}
              <div className="col-span-1 md:col-span-2 rounded-2xl border border-sky-100 bg-sky-50/20 p-4 transition-all hover:bg-sky-50/30">
                <h3 className="flex items-center gap-2 text-sm font-bold text-sky-800">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  Synthesis Agent (Chief)
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  The central consolidator. Compiles reports from all four specialists, resolves conflicts, and issues the high-level clinician referral recommendation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          {/* Pagination Indicators */}
          <div className="flex gap-1.5">
            <span className={`h-2 w-2 rounded-full transition-all duration-200 ${activeSlide === 0 ? "w-4 bg-emerald-600" : "bg-slate-200"}`} />
            <span className={`h-2 w-2 rounded-full transition-all duration-200 ${activeSlide === 1 ? "w-4 bg-emerald-600" : "bg-slate-200"}`} />
          </div>

          <div className="flex gap-3">
            {activeSlide === 0 ? (
              <>
                <button
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => setActiveSlide(1)}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveSlide(0)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

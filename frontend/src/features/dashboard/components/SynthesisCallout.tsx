import { SpecialistResult, SynthesisReport } from "@/types";

interface SynthesisCalloutProps {
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  isLoading: boolean;
}

export function SynthesisCallout({ specialists, synthesis, isLoading }: SynthesisCalloutProps) {
  if (isLoading || !synthesis) return null;
  const flaggedCount = specialists.filter((s) => s.flag).length;

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5 lg:p-6 transition-all duration-200 hover:border-sky-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
        <p className="text-base font-semibold text-sky-800">Synthesis recommendation</p>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">{flaggedCount} of {specialists.length} specialists flagged</p>
      </div>
      <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-700">{synthesis.recommendation}</p>
    </div>
  );
}
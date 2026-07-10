import { useState } from "react";
import { Labs } from "@/types";
import { StaggerContainer, StaggerItem } from "@/components/animations/Stagger";
import { HoverScale } from "@/components/animations/HoverScale";

interface LabRow { label: string; value: number; max: number; unit: string; decimals: number; normalLabel: string; }


function buildRows(labs: Labs, a1cPercent?: number | null): LabRow[] {
  const rows: LabRow[] = [];
  if (typeof a1cPercent === "number") {
    rows.push({ label: "HbA1c", value: a1cPercent, max: 14, unit: "%", decimals: 1, normalLabel: "Controlled ≤ 7.0%" });
  }
  rows.push(
    { label: "eGFR", value: labs.egfr, max: 120, unit: "", decimals: 1, normalLabel: "Normal \u2265 84.8" },
    { label: "UACR", value: labs.uacr_mg_g, max: 60, unit: "mg/g", decimals: 1, normalLabel: "Normal \u2264 15.5 mg/g" },
    { label: "Creatinine", value: labs.creatinine_mg_dl, max: 3, unit: "mg/dL", decimals: 2, normalLabel: "Normal \u2264 1.1 mg/dL" },
    { label: "LDL cholesterol", value: labs.ldl_mg_dl, max: 200, unit: "mg/dL", decimals: 0, normalLabel: "Normal < 100 mg/dL" },
    { label: "HDL cholesterol", value: labs.hdl_mg_dl, max: 100, unit: "mg/dL", decimals: 0, normalLabel: "Normal \u2265 50 mg/dL" },
    { label: "Triglycerides", value: labs.triglycerides_mg_dl, max: 500, unit: "mg/dL", decimals: 0, normalLabel: "Normal < 150 mg/dL" },
    { label: "Systolic BP", value: labs.systolic_bp, max: 200, unit: "mmHg", decimals: 0, normalLabel: "Normal \u2264 130 mmHg" },
  );
  return rows;
}

type Severity = "good" | "moderate" | "high";

function getSeverity(label: string, value: number): Severity {
  switch (label) {
    case "HbA1c":
      if (value <= 7.0) return "good";
      if (value <= 8.5) return "moderate";
      return "high";
    case "eGFR":
      if (value >= 84.8) return "good";
      if (value >= 60) return "moderate";
      return "high";
    case "UACR":
      if (value <= 15.5) return "good";
      if (value <= 30) return "moderate";
      return "high";
    case "Creatinine":
      if (value <= 1.1) return "good";
      if (value <= 1.3) return "moderate";
      return "high";
    case "LDL cholesterol":
      if (value < 100) return "good";
      if (value < 160) return "moderate";
      return "high";
    case "HDL cholesterol":
      if (value >= 50) return "good";
      if (value >= 40) return "moderate";
      return "high";
    case "Triglycerides":
      if (value < 150) return "good";
      if (value < 200) return "moderate";
      return "high";
    case "Systolic BP":
      if (value <= 130) return "good";
      if (value <= 140) return "moderate";
      return "high";
    default:
      return "good";
  }
}


const severityStyles: Record<Severity, { bar: string; text: string; dot: string }> = {
  good: { bar: "from-teal-400 to-teal-600", text: "text-teal-600", dot: "bg-teal-500" },
  moderate: { bar: "from-yellow-400 to-yellow-600", text: "text-yellow-600", dot: "bg-yellow-500" },
  high: { bar: "from-rose-500 to-rose-700", text: "text-rose-600", dot: "bg-rose-500" },
};

interface LabsPanelProps { labs: Labs | null; isLoading: boolean; a1cPercent?: number | null; }

export function LabsPanel({ labs, isLoading, a1cPercent }: LabsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading && !labs) {
    return (
      <HoverScale className="rounded-[32px] border border-slate-200 bg-white p-3 sm:p-4 transition-colors duration-200 hover:shadow-md">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Labs</h3>
        <div className="space-y-3">
          {buildRows({ egfr: NaN, uacr_mg_g: NaN, creatinine_mg_dl: NaN, ldl_mg_dl: NaN, hdl_mg_dl: NaN, triglycerides_mg_dl: NaN, systolic_bp: NaN } as Labs, a1cPercent).map((row) => (
            <div key={row.label} className="rounded-xl p-2">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-semibold text-slate-400">{row.label}</span>
                <span className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-200 to-transparent animate-shimmer-lab" />
              </div>
            </div>
          ))}
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shimmer-lab {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-shimmer-lab {
            animation: shimmer-lab 1.4s infinite linear;
          }
        `}} />
      </HoverScale>
    );
  }

  if (!labs) {
    return (
      <HoverScale className="rounded-[32px] border border-slate-200 mb-3 bg-white p-3 sm:p-4 transition-colors duration-200 hover:shadow-md flex flex-col items-center justify-center min-h-[240px] text-center gap-3">
        <svg className="h-9 w-9 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 20.25a48.25 48.25 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
        <p className="text-sm font-semibold text-slate-500">No labs to show yet</p>
        <p className="text-xs text-slate-400 max-w-[220px]">Run an analysis to pull this patient&apos;s lab panel in real time.</p>
      </HoverScale>
    );
  }

  return (
    <HoverScale className="rounded-[32px] border border-slate-200 bg-white p-3 sm:p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-md">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Labs</h3>
      <StaggerContainer className="space-y-3">
        {buildRows(labs, a1cPercent).slice(0, isExpanded ? undefined : 4).map((row) => {
          const hasValue = typeof row.value === "number" && !isNaN(row.value);
          const valText = hasValue ? row.value.toFixed(row.decimals) : "--";
          const pct = hasValue ? Math.max(0, Math.min(100, (row.value / row.max) * 100)) : 0;
          const severity = hasValue ? getSeverity(row.label, row.value) : "good";
          const style = severityStyles[severity];
          return (
            <StaggerItem key={row.label} className="rounded-xl px-2 pb-2 pt-1 transition-colors duration-150 hover:bg-slate-50/50">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  {row.label}
                </span>
                <span className={`font-mono ${hasValue ? style.text : "text-slate-400"}`}>
                  {valText} <span className="text-slate-400">/ {row.max} {row.unit}</span>
                </span>
              </div>
              <div className="mb-1.5 pl-3 text-[10px] leading-tight text-slate-400">{row.normalLabel}</div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${style.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
      {buildRows(labs, a1cPercent).length > 4 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          {isExpanded ? "Show Less" : "Show More"}
          <svg
            className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </HoverScale>
  );
}
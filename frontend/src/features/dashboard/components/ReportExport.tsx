"use client";

import { useState } from "react";

interface SpecialistResult {
  specialist: string;
  risk_score: number;
  flag: boolean;
  reasoning: string;
}

interface ReportExportProps {
  patientId: string | null;
  demographics: {
    age: number;
    sex: string;
    a1c_percent: number;
  } | null;
  specialists: SpecialistResult[];
  synthesis: {
    top_concern: string;
    recommendation: string;
  } | null;
}

const specialistLabels: Record<string, string> = {
  retinal: "Retina (Retinopathy)",
  renal: "Kidneys (Nephropathy)",
  neuropathy: "Nerves (Neuropathy)",
  cardiovascular: "Heart & Vessels (Cardiovascular)",
};

/**
 * Compiles patient analysis parameters and triggers a clean markdown download file.
 */
export function ReportExport({ patientId, demographics, specialists = [], synthesis }: ReportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function handleExport() {
    if (!patientId || specialists.length === 0) return;
    setIsExporting(true);
    setStatusMessage("");

    try {
      const reportLines = [
        "======================================================================",
        "          DIABETIC COMPLICATION MULTI-AGENT ANALYSIS REPORT           ",
        "======================================================================",
        `Report Generated : ${new Date().toLocaleString()}`,
        `Patient ID       : ${patientId}`,
        `Age / Gender     : ${demographics?.age ?? "N/A"} / ${demographics?.sex ?? "N/A"}`,
        `Latest HbA1c     : ${demographics?.a1c_percent ?? "N/A"}%`,
        "----------------------------------------------------------------------",
        "",
        "## EXECUTIVE CLINICAL SYNTHESIS",
        `PRIMARY CONCERN  : ${synthesis?.top_concern ?? "Undetermined"}`,
        `RECOMMENDATION   : ${synthesis?.recommendation ?? "No manual clinical summary issued."}`,
        "",
        "----------------------------------------------------------------------",
        "## INDIVIDUAL SPECIALIST TRACKING INSIGHTS",
        "",
      ];

      specialists.forEach((agent) => {
        const title = specialistLabels[agent.specialist] || agent.specialist.toUpperCase();
        reportLines.push(`### ${title}`);
        reportLines.push(`- Risk Probability Score : ${(agent.risk_score * 100).toFixed(0)}%`);
        reportLines.push(`- Boundary Anomaly Flag  : ${agent.flag ? "⚠️ CRITICAL DEVIATION" : "NORMAL BOUNDARY"}`);
        reportLines.push(`- Algorithmic Reasoning  :\n  ${agent.reasoning.split('\n').join('\n  ')}`);
        reportLines.push("");
      });

      reportLines.push("======================================================================");
      reportLines.push("   CONFIDENTIAL MEDICAL ANALYSIS DATA — FOR CLINICAL REVIEW ONLY     ");
      reportLines.push("======================================================================");

      const blob = new Blob([reportLines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinical_report_${patientId}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Clinical file downloaded.");
    } catch (err) {
      console.error("Export failed:", err);
      setStatusMessage("Export protocol failed.");
    } finally {
      setIsExporting(false);
    }
  }

  const isButtonDisabled = !patientId || specialists.length === 0 || isExporting;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-white/10 bg-black/10 rounded-lg p-4 font-sans">
      <div>
        <h2 className="text-sm font-medium text-foreground/80">
          Clinical Document Export
        </h2>
        <p className="text-xs text-foreground/40 mt-0.5">
          Generate structured clinical documentation for medical records.
        </p>
        {statusMessage && (
          <p className="mt-1 text-xs text-emerald-400 font-mono">{statusMessage}</p>
        )}
      </div>
      <button
        onClick={handleExport}
        disabled={isButtonDisabled}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 whitespace-nowrap shadow-md self-start sm:self-center"
      >
        {isExporting ? "Compiling..." : "Export Assessment"}
      </button>
    </div>
  );
}
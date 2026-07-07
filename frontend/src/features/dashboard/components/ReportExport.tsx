"use client";

import { useState } from "react";
import { Demographics, Labs, SpecialistResult, SynthesisReport } from "@/types";

interface ReportExportProps {
  patientId: string | null;
  demographics: Demographics | null;
  labs: Labs | null;
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
}

export function ReportExport({
  patientId,
  demographics,
  labs,
  specialists = [],
  synthesis,
}: ReportExportProps) {
  const [isCompiling, setIsCompiling] = useState(false);
  const [clinicalBrief, setClinicalBrief] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleFetchBrief() {
    if (!patientId || !demographics || !labs || specialists.length === 0 || !synthesis) {
      setStatusMessage("Required analysis data is incomplete.");
      return;
    }

    setIsCompiling(true);
    setStatusMessage("");
    setCopied(false);

    try {
      const payload = {
        patient_id: patientId,
        demographics,
        labs,
        specialists,
        synthesis,
      };

      const res = await fetch(`/api/report/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to compile clinical brief: status ${res.status}`);
      }

      const data = await res.json();
      setClinicalBrief(data.brief);
      setStatusMessage("Discovery Brief successfully generated.");
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || "Failed to contact report generation endpoint.");
    } finally {
      setIsCompiling(false);
    }
  }

  function handleCopyBrief() {
    if (!clinicalBrief) return;
    navigator.clipboard.writeText(clinicalBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadBrief() {
    if (!clinicalBrief || !patientId) return;
    try {
      const blob = new Blob([clinicalBrief], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinical_brief_${patientId}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Clinical report downloaded successfully.");
    } catch (err) {
      console.error("Export failed:", err);
      setStatusMessage("Failed to download local brief document.");
    }
  }

  const isButtonDisabled = !patientId || specialists.length === 0 || isCompiling || !synthesis;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-slate-100 bg-slate-50/50 rounded-2xl p-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-800">
            Clinical discovery brief &amp; document export
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Query the Clinical Brief compiler to compose a structured, plain-language triage record.
          </p>
          {statusMessage && (
            <p className="mt-1.5 text-xs text-emerald-600 font-mono font-medium">{statusMessage}</p>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleFetchBrief}
            disabled={isButtonDisabled}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 whitespace-nowrap shadow-sm w-full sm:w-auto text-center"
          >
            {isCompiling ? "Compiling..." : clinicalBrief ? "Recompile Brief" : "Generate Clinical Brief"}
          </button>
        </div>
      </div>

      {clinicalBrief && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Discovery Brief Document</span>
            <div className="flex gap-2">
              <button
                onClick={handleCopyBrief}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-sm flex items-center gap-1.5"
              >
                {copied ? "✓ Copied" : "Copy to Clipboard"}
              </button>
              <button
                onClick={handleDownloadBrief}
                className="text-xs font-semibold text-slate-700 hover:text-slate-600 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-sm flex items-center gap-1.5"
              >
                Download (.TXT)
              </button>
            </div>
          </div>
          
          <div className="relative rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-inner">
            <pre className="scrollbar-thin scrollbar-thumb-white/10 max-h-[400px] overflow-y-auto font-mono text-xs md:text-sm text-sky-400/90 whitespace-pre-wrap leading-relaxed">
              {clinicalBrief}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
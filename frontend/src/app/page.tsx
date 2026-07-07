"use client";

import { useEffect, useState } from "react";
import { PatientOverviewHeader } from "@/features/dashboard/components/PatientOverviewHeader";
import { OrganRiskMap } from "@/features/dashboard/components/OrganRiskMap";
import { RiskForecastPanel } from "@/features/dashboard/components/RiskForecastPanel";
import { LabsPanel } from "@/features/dashboard/components/LabsPanel";
import { SynthesisCallout } from "@/features/dashboard/components/SynthesisCallout";
import { LiveAgentTerminal } from "@/features/dashboard/components/LiveAgentTerminal";
import { ReportExport } from "@/features/dashboard/components/ReportExport";
import type {
  PatientDropdownItem,
  Demographics,
  Labs,
  SpecialistResult,
  SynthesisReport,
} from "@/types";

export default function DashboardPage() {
  const [patients, setPatients] = useState<PatientDropdownItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [labs, setLabs] = useState<Labs | null>(null);
  const [specialists, setSpecialists] = useState<SpecialistResult[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisReport | null>(null);

  const [isPatientsLoading, setIsPatientsLoading] = useState<boolean>(true);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(" ");
  const [llmStatus, setLlmStatus] = useState<string>("checking...");

  useEffect(() => {
    async function loadPatients() {
      try {
        setIsPatientsLoading(true);
        const res = await fetch("/api/patients");
        if (!res.ok) throw new Error("Could not acquire patient index repository.");
        const data = await res.json();
        setPatients(data);

        if (data.length > 0) {
          setSelectedPatientId(data[0].patient_id);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed initializing patient records list.");
      } finally {
        setIsPatientsLoading(false);
      }
    }

    async function loadStatus() {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          setLlmStatus(data.llm_status);
        } else {
          setLlmStatus("offline");
        }
      } catch {
        setLlmStatus("offline");
      }
    }

    loadPatients();
    loadStatus();
  }, []);

  async function triggerPipelineAnalysis(patientId: string) {
    if (!patientId) return;
    try {
      setIsPipelineRunning(true);
      setErrorMessage("");

      const res = await fetch(`/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });

      if (!res.ok) throw new Error(`Pipeline breakdown: API returned code ${res.status}`);
      const report = await res.json();

      setDemographics(report.demographics);
      setLabs(report.labs);
      setSpecialists(report.specialists);
      setSynthesis(report.synthesis);

      // Refresh the status in case of config updates
      try {
        const statusRes = await fetch("/api/status");
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setLlmStatus(statusData.llm_status);
        }
      } catch {
        // ignore status refresh error
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Execution loop experienced an unhandled fault.");
    } finally {
      setIsPipelineRunning(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 bg-slate-50 p-4 font-sans antialiased sm:p-6 lg:p-12">

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Clinician Dashboard
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            Diabetic complication risk triage — multi-agent panel synthesis
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:px-4 sm:py-2.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
          <label htmlFor="patient-select" className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-400">
            Select Record:
          </label>
          {isPatientsLoading ? (
            <span className="animate-pulse text-sm text-slate-400 font-medium">Index mapping...</span>
          ) : (
            <select
              id="patient-select"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              disabled={isPipelineRunning}
              className="cursor-pointer bg-transparent text-sm font-mono font-semibold text-slate-900 focus:outline-none disabled:opacity-40 w-full sm:w-auto"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.patient_id} (Age: {p.age}, A1c: {p.a1c_percent}%)
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => triggerPipelineAnalysis(selectedPatientId)}
            disabled={isPipelineRunning || !selectedPatientId}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-30 w-full sm:w-auto shadow-sm"
          >
            {isPipelineRunning ? "Running Swarm..." : "Analyze Dataset"}
          </button>
        </div>
      </header>

      {errorMessage && errorMessage.trim() && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-mono text-sm text-rose-600 shadow-sm">
          ⚠️ [PIPELINE EXCEPTION]: {errorMessage}
        </div>
      )}

      <PatientOverviewHeader
        patientId={selectedPatientId || null}
        demographics={demographics}
        labs={labs}
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7 xl:col-span-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
            <OrganRiskMap
              specialists={specialists}
              synthesis={synthesis}
              isLoading={isPipelineRunning}
            />
          </div>
          <RiskForecastPanel specialists={specialists} isLoading={isPipelineRunning} />
          <SynthesisCallout specialists={specialists} synthesis={synthesis} isLoading={isPipelineRunning} />
        </div>
        
        <div className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
          <LiveAgentTerminal
            specialists={specialists}
            synthesis={synthesis}
            isLoading={isPipelineRunning}
            llmStatus={llmStatus}
          />
          <LabsPanel labs={labs} isLoading={isPipelineRunning} />
        </div>

        <div className="lg:col-span-12">
          <ReportExport
            patientId={selectedPatientId || null}
            demographics={demographics}
            specialists={specialists}
            synthesis={synthesis}
          />
        </div>
      </section>
    </main>
  );
}
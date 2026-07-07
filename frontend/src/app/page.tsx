"use client";

import { useEffect, useState } from "react";
import { OrganRiskMap } from "@/features/dashboard/components/OrganRiskMap";
import { LiveAgentTerminal } from "@/features/dashboard/components/LiveAgentTerminal";
import { ReportExport } from "@/features/dashboard/components/ReportExport";

interface PatientDropdownItem {
  patient_id: string;
  age: number;
  sex: string;
  a1c_percent: number;
}

interface Demographics {
  age: number;
  sex: string;
  a1c_percent: number;
}

interface SpecialistResult {
  specialist: string;
  risk_score: number;
  flag: boolean;
  reasoning: string;
}

interface SynthesisReport {
  top_concern: string;
  recommendation: string;
}

export default function DashboardPage() {
  // State for populating the dropdown selector
  const [patients, setPatients] = useState<PatientDropdownItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  // States for the active diagnostic analysis pipeline
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [specialists, setSpecialists] = useState<SpecialistResult[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisReport | null>(null);
  
  // UX State Indicators
  const [isPatientsLoading, setIsPatientsLoading] = useState<boolean>(true);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 1. Fetch available sample records on mount to populate the selector dropdown
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
    loadPatients();
  }, []);

  // 2. Trigger the multi-agent code execution sandbox pipeline
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

      // Distribute the incoming python execution payload directly to layout components
      setDemographics(report.demographics);
      setSpecialists(report.specialists);
      setSynthesis(report.synthesis);
    } catch (err: any) {
      setErrorMessage(err.message || "Execution loop experienced an unhandled fault.");
    } finally {
      setIsPipelineRunning(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6 lg:p-10 font-sans antialiased text-foreground selection:bg-emerald-500/30">
      
      {/* Structural Header Grid */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Clinician Dashboard
          </h1>
          <p className="text-sm text-foreground/60">
            Diabetic complication risk triage — multi-agent panel synthesis
          </p>
        </div>

        {/* Diagnostic Selector Panel */}
        <div className="flex items-center gap-3 bg-black/20 border border-white/10 px-4 py-2 rounded-lg backdrop-blur-sm self-start sm:self-center">
          <label htmlFor="patient-select" className="text-xs font-medium text-foreground/40 uppercase tracking-wider whitespace-nowrap">
            Select Record:
          </label>
          {isPatientsLoading ? (
            <span className="text-xs text-foreground/40 animate-pulse">Index mapping...</span>
          ) : (
            <select
              id="patient-select"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              disabled={isPipelineRunning}
              className="bg-transparent text-sm font-mono font-medium text-foreground focus:outline-none cursor-pointer disabled:opacity-40"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id} className="bg-zinc-900 text-foreground">
                  {p.patient_id} (Age: {p.age}, A1c: {p.a1c_percent}%)
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => triggerPipelineAnalysis(selectedPatientId)}
            disabled={isPipelineRunning || !selectedPatientId}
            className="ml-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded font-medium text-xs transition-all shadow"
          >
            {isPipelineRunning ? "Running Swarm..." : "Analyze Dataset"}
          </button>
        </div>
      </header>

      {/* Global Framework Network System Fault Flags */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs font-mono">
          ⚠️ [PIPELINE EXCEPTION]: {errorMessage}
        </div>
      )}

      {/* Main Layout Presentation Blocks */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card col-span-1 border border-white/10 bg-white/[0.02] rounded-xl p-5 lg:col-span-2 shadow-xl backdrop-blur-md">
          <OrganRiskMap 
            specialists={specialists} 
            synthesis={synthesis} 
            isLoading={isPipelineRunning} 
          />
        </div>
        <div className="glass-card col-span-1 border border-white/10 bg-white/[0.02] rounded-xl p-5 shadow-xl backdrop-blur-md">
          <LiveAgentTerminal 
            specialists={specialists} 
            synthesis={synthesis} 
            isLoading={isPipelineRunning} 
          />
        </div>
      </section>

      {/* Operational Infrastructure Output Exporters */}
      <section className="glass-card border border-white/10 bg-white/[0.02] rounded-xl p-5 shadow-xl backdrop-blur-md">
        <ReportExport 
          patientId={selectedPatientId || null}
          demographics={demographics}
          specialists={specialists}
          synthesis={synthesis}
        />
      </section>
    </main>
  );
}
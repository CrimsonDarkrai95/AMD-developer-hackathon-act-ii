"use client";

import { useEffect, useState, useRef } from "react";

interface SpecialistResult {
  specialist: string;
  risk_score: number;
  flag: boolean;
  reasoning: string;
}

interface LiveAgentTerminalProps {
  specialists: SpecialistResult[];
  synthesis: {
    top_concern: string;
    recommendation: string;
  } | null;
  isLoading?: boolean;
}

const specialistLabels: Record<string, string> = {
  retinal: "RETINAL_SPECIALIST",
  renal: "RENAL_SPECIALIST",
  neuropathy: "NEUROPATHY_SPECIALIST",
  cardiovascular: "CARDIOVASCULAR_SPECIALIST",
};

export function LiveAgentTerminal({ specialists = [], synthesis, isLoading = false }: LiveAgentTerminalProps) {
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeSpecialistIdx, setActiveSpecialistIdx] = useState<number>(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of terminal logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs, activeSpecialistIdx, isLoading, specialists, synthesis]);

  // Terminal logging state machine
  useEffect(() => {
    if (isLoading) {
      setTerminalLogs([]);
      setActiveSpecialistIdx(-1);

      const logs = [
        "&gt; [SYSTEM] Initializing Diabetic Complication Swarm Engine...",
        "&gt; [SYSTEM] Loading NHANES 2017-2018 patient records structured matrix...",
        "&gt; [SYSTEM] Spawning Multidisciplinary Board of Medical Specialist Agents...",
        "&gt; [SYSTEM] Allocating AMD Developer Cloud sandboxed exec() execution cores...",
        "&gt; [SWARM] Broadcasting patient demographics parallel inference...",
        "&gt; [SWARM] Running sandboxed Python execution loop...",
      ];

      let delay = 100;
      logs.forEach((log, idx) => {
        setTimeout(() => {
          setTerminalLogs((prev) => [...prev, log]);
        }, delay * (idx + 1));
      });
    }
  }, [isLoading]);

  // Handle printing specialists and synthesis sequentially
  useEffect(() => {
    if (!isLoading && specialists.length > 0) {
      // Start printing specialists one by one
      setActiveSpecialistIdx(0);
    } else if (!isLoading && specialists.length === 0) {
      setTerminalLogs([]);
      setActiveSpecialistIdx(-1);
    }
  }, [isLoading, specialists]);

  useEffect(() => {
    if (activeSpecialistIdx >= 0 && activeSpecialistIdx < specialists.length) {
      const spec = specialists[activeSpecialistIdx];
      const name = specialistLabels[spec.specialist] || spec.specialist.toUpperCase();
      const statusLog = `&gt; [SWARM] Specialist agent [${name}] completed code execution.`;
      
      setTerminalLogs((prev) => [...prev, statusLog]);

      // Trigger next specialist after a delay
      const timer = setTimeout(() => {
        setActiveSpecialistIdx((prev) => prev + 1);
      }, 750);

      return () => clearTimeout(timer);
    } else if (activeSpecialistIdx === specialists.length && synthesis) {
      // Print synthesis report after specialists finish
      const timer = setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          "&gt; [SWARM] Synthesis Orchestrator compiling clinical decisions...",
          `&gt; [SYNTHESIS] Primary Concern Flagged: ${synthesis.top_concern}`,
          `&gt; [SYNTHESIS] Referral Recommendation Issued.`,
        ]);
        setActiveSpecialistIdx(-1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeSpecialistIdx, specialists, synthesis]);

  return (
    <div className="flex h-full flex-col gap-3 font-mono">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-tight text-foreground/80 font-sans">
          Live Agent Reasoning Terminal
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] uppercase text-emerald-400 font-sans tracking-wide">
            Connected to Sandbox
          </span>
        </div>
      </div>

      {/* Terminal Window Wrapper */}
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-md min-h-[420px] max-h-[500px]">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between bg-zinc-900/80 px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[10px] text-foreground/40 font-sans select-none">bash - sandbox_exec@amd_cloud</span>
          <span className="w-10" />
        </div>

        {/* Scanlines Effect */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-40" />

        {/* Terminal Logs Viewport */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin scrollbar-thumb-white/10">
          
          {/* Default blank state */}
          {!isLoading && specialists.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-foreground/30 italic font-sans py-16">
              <span className="text-xl mb-2 font-mono">_</span>
              <p>&gt; Awaiting patient selection to boot swarm pipeline...</p>
            </div>
          )}

          {/* Sequential Status Logs */}
          <div className="space-y-1 text-emerald-400/80">
            {terminalLogs.map((log, index) => (
              <p key={index} dangerouslySetInnerHTML={{ __html: log }} />
            ))}
            {isLoading && (
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-ping ml-1" />
            )}
          </div>

          {/* Agent reasoning blocks printout */}
          {!isLoading && specialists.slice(0, activeSpecialistIdx >= 0 ? activeSpecialistIdx : specialists.length).map((agent) => {
            const name = specialistLabels[agent.specialist] || agent.specialist.toUpperCase();
            return (
              <div key={agent.specialist} className="border border-white/5 bg-zinc-950/40 p-3 rounded-lg space-y-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[10px]">
                  <span className="text-amber-400 font-bold">{name}</span>
                  <span className={agent.flag ? "text-red-400" : "text-emerald-400"}>
                    SCORE: {(agent.risk_score * 100).toFixed(0)}% | FLAGGED: {agent.flag ? "TRUE" : "FALSE"}
                  </span>
                </div>
                
                {/* Agent reasoning block */}
                <div className="space-y-1.5 text-foreground/80 leading-relaxed max-h-[150px] overflow-y-auto scrollbar-none font-mono">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">// Execution Output & Logic</p>
                  <pre className="whitespace-pre-wrap text-[11px] text-white/90 bg-black/40 p-2 rounded border border-white/5 leading-tight">
                    {agent.reasoning}
                  </pre>
                </div>
              </div>
            );
          })}

          {/* Synthesis Compiling Printout */}
          {!isLoading && synthesis && activeSpecialistIdx === -1 && terminalLogs.some(log => log.includes("SYNTHESIS")) && (
            <div className="border border-emerald-500/20 bg-emerald-500/[0.04] p-3 rounded-lg space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-emerald-500/10 pb-1 text-[10px]">
                <span className="text-emerald-300 font-bold">SYNTHESIS_ORCHESTRATOR</span>
                <span className="text-amber-400 font-bold">TOP CONCERN: {synthesis.top_concern}</span>
              </div>
              <p className="text-white leading-relaxed italic text-[11px]">
                &quot;{synthesis.recommendation}&quot;
              </p>
            </div>
          )}
          
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";

interface SpecialistResult {
  specialist: string;
  risk_score: number;
  flag: boolean;
  reasoning: string;
}

const specialistLabels: Record<string, string> = {
  retinal: "Retina",
  renal: "Kidneys",
  neuropathy: "Nerves",
  cardiovascular: "Heart & Vessels",
};

interface OrganRiskMapProps {
  specialists: SpecialistResult[];
  synthesis: {
    top_concern: string;
    recommendation: string;
  } | null;
  isLoading?: boolean;
}

export function OrganRiskMap({ specialists = [], synthesis, isLoading = false }: OrganRiskMapProps) {
  const [hoveredSpec, setHoveredSpec] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-sm text-slate-400 animate-pulse font-sans">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-12 w-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <span className="text-xs font-mono text-emerald-600 mt-20 uppercase tracking-widest">Running Swarm Sandboxes...</span>
        </div>
      </div>
    );
  }

  if (!specialists.length) {
    return (
      <div className="flex min-h-[400px] h-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-sm text-slate-400 font-sans text-center">
        <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <span className="font-medium text-slate-700">No active patient data loaded.</span>
        <span className="text-xs text-slate-400">Select a patient record at the top to run the diagnostic swarm.</span>
      </div>
    );
  }

  // Find the highest risk factor
  const highestRisk = specialists.reduce((current, item) => {
    return item.risk_score > current.risk_score ? item : current;
  }, specialists[0] ?? { specialist: "System", risk_score: 0, flag: false, reasoning: "" });

  // Compute color based on score and flag status for light theme
  const getRiskColorClass = (score: number, flag: boolean) => {
    if (flag || score >= 0.7) return "text-red-700 border-red-200 bg-red-50/60 hover:bg-red-50 hover:border-red-300";
    if (score >= 0.4) return "text-amber-700 border-amber-200 bg-amber-50/60 hover:bg-amber-50 hover:border-amber-300";
    return "text-emerald-700 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 hover:border-emerald-300";
  };

  const getHotspotColor = (score: number, flag: boolean) => {
    if (flag || score >= 0.7) return "#ef4444"; // Red
    if (score >= 0.4) return "#f59e0b"; // Amber
    return "#10b981"; // Emerald
  };

  // Find results for specific organs to render in the SVG
  const specMap = specialists.reduce((acc, item) => {
    acc[item.specialist] = item;
    return acc;
  }, {} as Record<string, SpecialistResult>);

  return (
    <div className="flex h-full flex-col gap-4 font-sans text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold tracking-tight text-slate-700">
            Anatomical Risk Map
          </h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Localized Bio-markers</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
            Pipeline Active
          </span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]" />
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="flex flex-col md:flex-row gap-5 flex-1 items-stretch">
        
        {/* SVG Silhouette Panel (Left side) */}
        <div className="flex-1 flex items-center justify-center bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 min-h-[300px] relative overflow-hidden select-none">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:14px_24px]" />
          
          <svg className="w-full h-full max-w-[220px] max-h-[300px]" viewBox="0 0 200 280" fill="none">
            {/* Minimalist Human Body Outline */}
            <g stroke="#0f172a" strokeWidth="1" strokeOpacity="0.12" fill="none">
              {/* Head */}
              <ellipse cx="100" cy="40" rx="16" ry="20" />
              {/* Neck */}
              <path d="M 95,59 L 95,68 L 105,68 L 105,59" />
              {/* Torso & Shoulders */}
              <path d="M 60,88 C 60,88 72,70 100,70 C 128,70 140,88 140,88 L 134,175 C 134,175 120,185 100,185 C 80,185 66,175 66,175 Z" />
              {/* Arms */}
              <path d="M 60,88 L 45,150 C 45,150 49,154 52,151 L 63,108" />
              <path d="M 140,88 L 155,150 C 155,150 151,154 148,151 L 137,108" />
              {/* Legs */}
              <path d="M 66,175 L 61,250 C 61,250 67,258 72,258 C 77,258 79,240 79,210 L 86,210 L 86,260 C 86,260 92,267 98,267 L 98,185 L 102,185 L 102,267 C 108,267 114,260 114,260 L 114,210 L 121,210 C 121,240 123,258 128,258 C 133,258 139,250 139,250 L 134,175" />
            </g>

            {/* Glowing Hotspots */}
            
            {/* Eyes (Retinal) */}
            {specMap["retinal"] && (
              <g 
                className="cursor-pointer"
                onMouseEnter={() => setHoveredSpec("retinal")}
                onMouseLeave={() => setHoveredSpec(null)}
              >
                {/* Visual Connection Line */}
                <path d="M 100,40 L 145,40" stroke={getHotspotColor(specMap["retinal"].risk_score, specMap["retinal"].flag)} strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity={hoveredSpec === "retinal" ? "0.8" : "0.3"} />
                {/* Left Eye */}
                <circle cx="95" cy="38" r="3" fill={getHotspotColor(specMap["retinal"].risk_score, specMap["retinal"].flag)} fillOpacity="0.8" />
                <circle cx="95" cy="38" r="8" stroke={getHotspotColor(specMap["retinal"].risk_score, specMap["retinal"].flag)} strokeWidth="1" strokeOpacity="0.4" className={specMap["retinal"].flag ? "animate-ping" : ""} />
                {/* Right Eye */}
                <circle cx="105" cy="38" r="3" fill={getHotspotColor(specMap["retinal"].risk_score, specMap["retinal"].flag)} fillOpacity="0.8" />
                <circle cx="105" cy="38" r="8" stroke={getHotspotColor(specMap["retinal"].risk_score, specMap["retinal"].flag)} strokeWidth="1" strokeOpacity="0.4" className={specMap["retinal"].flag ? "animate-ping" : ""} />
              </g>
            )}

            {/* Heart (Cardiovascular) */}
            {specMap["cardiovascular"] && (
              <g 
                className="cursor-pointer"
                onMouseEnter={() => setHoveredSpec("cardiovascular")}
                onMouseLeave={() => setHoveredSpec(null)}
              >
                <path d="M 94,102 L 40,102" stroke={getHotspotColor(specMap["cardiovascular"].risk_score, specMap["cardiovascular"].flag)} strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity={hoveredSpec === "cardiovascular" ? "0.8" : "0.3"} />
                <circle cx="94" cy="102" r="5" fill={getHotspotColor(specMap["cardiovascular"].risk_score, specMap["cardiovascular"].flag)} />
                <circle cx="94" cy="102" r="11" stroke={getHotspotColor(specMap["cardiovascular"].risk_score, specMap["cardiovascular"].flag)} strokeWidth="1.5" strokeOpacity="0.5" className={(specMap["cardiovascular"].flag || specMap["cardiovascular"].risk_score >= 0.7) ? "animate-pulse" : ""} />
              </g>
            )}

            {/* Kidneys (Renal) */}
            {specMap["renal"] && (
              <g 
                className="cursor-pointer"
                onMouseEnter={() => setHoveredSpec("renal")}
                onMouseLeave={() => setHoveredSpec(null)}
              >
                <path d="M 108,142 L 155,142" stroke={getHotspotColor(specMap["renal"].risk_score, specMap["renal"].flag)} strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity={hoveredSpec === "renal" ? "0.8" : "0.3"} />
                {/* Left Kidney */}
                <circle cx="92" cy="142" r="4" fill={getHotspotColor(specMap["renal"].risk_score, specMap["renal"].flag)} />
                <circle cx="92" cy="142" r="9" stroke={getHotspotColor(specMap["renal"].risk_score, specMap["renal"].flag)} strokeWidth="1" strokeOpacity="0.4" className={specMap["renal"].flag ? "animate-pulse" : ""} />
                {/* Right Kidney */}
                <circle cx="108" cy="142" r="4" fill={getHotspotColor(specMap["renal"].risk_score, specMap["renal"].flag)} />
                <circle cx="108" cy="142" r="9" stroke={getHotspotColor(specMap["renal"].risk_score, specMap["renal"].flag)} strokeWidth="1" strokeOpacity="0.4" className={specMap["renal"].flag ? "animate-pulse" : ""} />
              </g>
            )}

            {/* Nerves (Neuropathy) */}
            {specMap["neuropathy"] && (
              <g 
                className="cursor-pointer"
                onMouseEnter={() => setHoveredSpec("neuropathy")}
                onMouseLeave={() => setHoveredSpec(null)}
              >
                <path d="M 68,252 L 35,252" stroke={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity={hoveredSpec === "neuropathy" ? "0.8" : "0.3"} />
                {/* Left Foot */}
                <circle cx="68" cy="252" r="4" fill={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} />
                <circle cx="68" cy="252" r="9" stroke={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} strokeWidth="1" strokeOpacity="0.4" className={specMap["neuropathy"].flag ? "animate-ping" : ""} />
                {/* Right Foot */}
                <circle cx="132" cy="252" r="4" fill={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} />
                <circle cx="132" cy="252" r="9" stroke={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} strokeWidth="1" strokeOpacity="0.4" className={specMap["neuropathy"].flag ? "animate-ping" : ""} />
              </g>
            )}
          </svg>
        </div>

        {/* Right side Detail List */}
        <div className="flex-[1.5] flex flex-col gap-3">
          {/* Executive Summary Compiling */}
          {synthesis && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.24em] font-semibold text-slate-400">
                Highest Risk Trajectory
              </p>
              <div className="mt-1 flex items-center justify-between">
                <p className="font-semibold text-slate-900 text-base">
                  {specialistLabels[highestRisk.specialist] ?? highestRisk.specialist}
                </p>
                <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded text-slate-800 font-medium border border-slate-200">
                  Score: {(highestRisk.risk_score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-2.5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
                <span className="font-bold text-slate-800">Clinical Rec:</span> {synthesis.recommendation}
              </p>
            </div>
          )}

          {/* Specialist Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {specialists.map((finding) => {
              const isHovered = hoveredSpec === finding.specialist;
              return (
                <div
                  key={finding.specialist}
                  onMouseEnter={() => setHoveredSpec(finding.specialist)}
                  onMouseLeave={() => setHoveredSpec(null)}
                  className={`rounded-xl border p-4 flex flex-col justify-between min-h-[110px] transition-all duration-200 cursor-pointer ${getRiskColorClass(
                    finding.risk_score,
                    finding.flag
                  )} ${isHovered ? "ring-1 ring-slate-300 scale-[1.02]" : "shadow-sm"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">
                        {specialistLabels[finding.specialist] ?? finding.specialist}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
                        {finding.flag ? "Anomaly Flagged" : "Within Boundary"}
                      </span>
                    </div>
                    {/* Ring indicator */}
                    <div className="relative flex items-center justify-center h-3.5 w-3.5 mt-0.5">
                      <span className={`absolute h-full w-full rounded-full animate-ping opacity-75 ${
                        finding.flag ? "bg-red-400" : finding.risk_score >= 0.4 ? "bg-amber-400" : "bg-emerald-400"
                      }`} style={{ animationDuration: '2s' }} />
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        finding.flag ? "bg-red-500" : finding.risk_score >= 0.4 ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-[10px] font-mono text-slate-400">
                      RISK PROBABILITY
                    </span>
                    <span className="text-lg font-bold font-mono tracking-tight text-slate-950 leading-none">
                      {(finding.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
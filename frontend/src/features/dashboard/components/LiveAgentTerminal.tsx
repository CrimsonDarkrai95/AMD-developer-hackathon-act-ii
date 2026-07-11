"use client";

import { useEffect, useRef, useState } from "react";
import { HoverScale } from "@/components/animations/HoverScale";

interface LiveAgentTerminalProps {
  terminalLogs: string[];
  isLoading?: boolean;
  llmStatus?: string;
  llmModel?: string | null;
}

// Typewriter speed for the most-recently-added terminal line, in ms/char.
const TYPE_SPEED_MS = 10;

export function LiveAgentTerminal({
  terminalLogs = [],
  isLoading = false,
  llmStatus = "checking...",
  llmModel = null,
}: LiveAgentTerminalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Only the newest line animates in character-by-character; every earlier
  // line is already fully rendered (no point re-typing history). Tracks the
  // logs array length so it only restarts the animation when a genuinely new
  // line arrives, not on every re-render.
  const [typedCount, setTypedCount] = useState(0);
  const animatedLengthRef = useRef(0);

  useEffect(() => {
    if (terminalLogs.length === 0) {
      animatedLengthRef.current = 0;
      setTypedCount(0);
      return;
    }

    if (terminalLogs.length === animatedLengthRef.current) {
      // Same number of lines as last time — nothing new to type out.
      return;
    }

    animatedLengthRef.current = terminalLogs.length;
    const fullText = terminalLogs[terminalLogs.length - 1];
    setTypedCount(0);

    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setTypedCount(i);
      if (i >= fullText.length) {
        clearInterval(interval);
      }
    }, TYPE_SPEED_MS);

    return () => clearInterval(interval);
  }, [terminalLogs]);

  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTo({
        top: terminalContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [terminalLogs, isLoading, typedCount]);

  return (
    <HoverScale className="flex h-auto flex-col gap-3 rounded-[32px] border border-slate-200 bg-white p-3 sm:p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-nowrap items-center justify-between gap-2">
          <h2 className="ml-1 mt-1 shrink-0 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-800">
            Agent Terminal
          </h2>
          {llmStatus === "offline" ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-xs uppercase tracking-wide text-rose-600 font-semibold">
                LLM: Offline (No Fallback)
              </span>
            </div>
          ) : llmStatus === "checking..." ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                LLM: Checking...
              </span>
            </div>
          ) : (
            (() => {
              // llmStatus is a provider id like "fireworks_serverless_fast" or
              // "amd_notebook_gemma" - reduce it to just its source family for
              // display. The actual model string (llmModel) is shown separately
              // on the line below, so this badge never needs to spell out the
              // specific tier/model itself.
              const isAmd = llmStatus.startsWith("amd_notebook");
              const providerTitle = isAmd ? "AMD Cloud" : "Fireworks";
              const modelDisplay = (llmModel ? llmModel.split("/").pop() : null) || providerTitle;

              return (
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  <span className="min-w-0 truncate text-xs uppercase tracking-wide text-emerald-600 font-semibold">
                    {providerTitle}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide ${
                      isAmd
                        ? "border-blue-400/50 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-zinc-400/50 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {isAmd ? "Gemma" : "GLM"}
                  </span>
                </div>
              );
            })()
          )}
        </div>
        {llmStatus !== "offline" && llmStatus !== "checking..." && (() => {
          const modelDisplay = (llmModel ? llmModel.split("/").pop() : null) || (llmStatus.startsWith("amd_notebook") ? "AMD Cloud" : "Fireworks");
          return (
            <span className="truncate text-right text-[10px] font-mono text-slate-400" title={llmModel || undefined}>
              LLM: {modelDisplay}
            </span>
          );
        })()}
      </div>

      <div className="relative flex h-[350px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner font-mono dark:border-slate-900 dark:bg-slate-950">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-4 py-2 dark:border-white/5 dark:bg-zinc-900/80">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="select-none font-sans text-xs text-slate-400 dark:text-white/40">glycoswarm-terminal ~ stream</span>
          <span className="w-10" />
        </div>

        {/* Content area */}
        <div className="relative flex-1 overflow-hidden">
          {/* Scrollable logs */}
          <div
            ref={terminalContainerRef}
            className="scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10 absolute inset-0 space-y-2 overflow-y-auto p-4 text-xs md:text-sm"
          >
            {terminalLogs.length === 0 && !isLoading && (
              <div className="flex h-full flex-col items-center justify-center text-center font-sans italic text-slate-400 dark:text-white/30">
                <span className="mb-2 font-mono text-xl">_</span>
                <p>&gt; Select a patient record and analyze to begin streaming...</p>
              </div>
            )}

            <div className="space-y-1.5 text-emerald-600 dark:text-emerald-400/90 font-mono">
              {terminalLogs.map((log, index) => {
                const isNewestLine = index === terminalLogs.length - 1;
                const displayedText = isNewestLine ? log.slice(0, typedCount) : log;
                const stillTyping = isNewestLine && typedCount < log.length;
                return (
                  <p key={index} className="leading-relaxed break-words">
                    {displayedText}
                    {stillTyping && (
                      <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-emerald-600 dark:bg-emerald-400 align-middle" />
                    )}
                  </p>
                );
              })}
              {isLoading && terminalLogs.length > 0 && typedCount >= terminalLogs[terminalLogs.length - 1].length && (
                <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-emerald-600 dark:bg-emerald-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </HoverScale>
  );
}
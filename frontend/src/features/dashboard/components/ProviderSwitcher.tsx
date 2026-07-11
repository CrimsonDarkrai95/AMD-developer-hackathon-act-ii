"use client";

import { useEffect, useRef, useState } from "react";
import type { ProviderOption } from "@/types";

interface ProviderSwitcherProps {
  disabled?: boolean;
  onProviderChanged?: () => void;
}

export function ProviderSwitcher({ disabled, onProviderChanged }: ProviderSwitcherProps) {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [forcedProvider, setForcedProvider] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadProviders() {
    try {
      const res = await fetch("/api/providers", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setProviders(data.providers || []);
      setForcedProvider(data.forced_provider ?? null);
    } catch {
      // Silently ignore — the switcher just won't populate options.
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function selectProvider(providerId: string | null) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/providers/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setForcedProvider(data.forced_provider ?? null);
        onProviderChanged?.();
      }
    } catch {
      // Leave state as-is; the dropdown stays open so the user can retry.
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  }

  const activeLabel = forcedProvider
    ? (() => {
        const found = providers.find((p) => p.id === forcedProvider);
        if (!found) return forcedProvider;
        // Show just the model part ("Gemma 4 26B" / "GLM 5.2") - the provider
        // prefix is redundant now that the AMD/Gemma/GLM tags carry that info,
        // and the shorter string fits the pill without truncating.
        return found.label.includes(":") ? found.label.split(":")[1].trim() : found.label;
      })()
    : "Auto";

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        title="Switch LLM provider"
        className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <span className="max-w-[9rem] truncate">{activeLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => selectProvider(null)}
            disabled={isLoading}
            className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800 ${
              forcedProvider === null ? "bg-emerald-50/70 dark:bg-emerald-500/10" : ""
            }`}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Auto</span>
              <span className="text-xs text-slate-400">Normal failover chain</span>
            </span>
            {forcedProvider === null && (
              <svg className="h-4 w-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {providers.map((p) => {
              const [providerName, modelLabel] = p.label.includes(":")
                ? [p.label.split(":")[0].trim(), p.label.split(":")[1].trim()]
                : ["", p.label];
              const isSelected = forcedProvider === p.id;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProvider(p.id)}
                  disabled={isLoading}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800 ${
                    isSelected ? "bg-emerald-50/70 dark:bg-emerald-500/10" : ""
                  }`}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {providerName && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {providerName}
                        </span>
                      )}
                      {p.amd_compute && (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-orange-400/50 bg-orange-500/10 px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide text-orange-600 dark:text-orange-400">
                          AMD
                        </span>
                      )}
                      {p.model_family === "gemma" && (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-blue-400/50 bg-blue-500/10 px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide text-blue-600 dark:text-blue-400">
                          Gemma
                        </span>
                      )}
                      {p.model_family === "glm" && (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-zinc-400/50 bg-zinc-500/10 px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide text-zinc-600 dark:text-zinc-300">
                          GLM
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{modelLabel}</span>
                    <span className="text-xs leading-snug text-slate-400">{p.description}</span>
                  </span>
                  {isSelected && (
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

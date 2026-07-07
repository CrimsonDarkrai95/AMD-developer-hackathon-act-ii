import { Labs } from "@/types";

interface LabRow { label: string; value: number; max: number; unit: string; decimals: number; }

function buildRows(labs: Labs): LabRow[] {
  return [
    { label: "eGFR", value: labs.egfr, max: 120, unit: "", decimals: 1 },
    { label: "UACR", value: labs.uacr_mg_g, max: 60, unit: "mg/g", decimals: 1 },
    { label: "Creatinine", value: labs.creatinine_mg_dl, max: 1.3, unit: "mg/dL", decimals: 2 },
    { label: "LDL cholesterol", value: labs.ldl_mg_dl, max: 190, unit: "mg/dL", decimals: 0 },
    { label: "HDL cholesterol", value: labs.hdl_mg_dl, max: 80, unit: "mg/dL", decimals: 0 },
    { label: "Triglycerides", value: labs.triglycerides_mg_dl, max: 200, unit: "mg/dL", decimals: 0 },
  ];
}

interface LabsPanelProps { labs: Labs | null; isLoading: boolean; }

export function LabsPanel({ labs, isLoading }: LabsPanelProps) {
  if (isLoading || !labs) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:shadow-md">
        <p className="animate-pulse text-base text-slate-400 font-medium">Running swarm...</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Labs</h3>
      <div className="space-y-3">
        {buildRows(labs).map((row) => {
          const pct = Math.max(0, Math.min(100, (row.value / row.max) * 100));
          return (
            <div key={row.label} className="rounded-xl p-2 transition-colors duration-150 hover:bg-slate-50/50">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-semibold text-slate-700">{row.label}</span>
                <span className="font-mono text-slate-500">{row.value.toFixed(row.decimals)} / {row.max} {row.unit}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
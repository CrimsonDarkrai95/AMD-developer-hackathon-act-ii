"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomPatientInput } from "@/types";

interface CustomPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomPatientInput) => void;
  isSubmitting: boolean;
  backendFieldErrors: Record<string, string>;
  clearBackendErrors: () => void;
}

// Numeric fields are held as raw strings while the form is being edited, not
// numbers. This is what lets a user clear a field to type a fresh value
// (e.g. delete "55" to type "19") without React immediately snapping the
// input back to "0" on every keystroke that passes through an empty/NaN
// intermediate state. Values are only coerced to actual numbers at
// validate/submit time, in validateLocal() / buildNumericPayload().
type NumericFieldName = Exclude<keyof CustomPatientInput, "sex" | "name">;
type FormState = { name?: string; sex: "M" | "F" } & Record<NumericFieldName, string>;

// Sane NHANES baseline defaults matching the guidelines
const defaultValues: FormState = {
  name: "",
  age: "55",
  sex: "F",
  years_with_diabetes: "10",
  a1c_percent: "6.5",
  egfr: "75",
  uacr_mg_g: "10",
  creatinine_mg_dl: "0.90",
  ldl_mg_dl: "120",
  hdl_mg_dl: "50",
  triglycerides_mg_dl: "150",
  systolic_bp: "130",
};

const highRiskDemoValues: FormState = {
  name: "",
  age: "65",
  sex: "M",
  years_with_diabetes: "20",
  a1c_percent: "8.5",
  egfr: "45",
  uacr_mg_g: "250",
  creatinine_mg_dl: "1.6",
  ldl_mg_dl: "210",
  hdl_mg_dl: "32",
  triglycerides_mg_dl: "380",
  systolic_bp: "155",
};

const bounds: Record<NumericFieldName, { min: number; max: number; label: string }> = {
  age: { min: 1, max: 120, label: "Age" },
  years_with_diabetes: { min: 0, max: 90, label: "Years with Diabetes" },
  a1c_percent: { min: 3.0, max: 20.0, label: "HbA1c (%)" },
  egfr: { min: 1.0, max: 200.0, label: "eGFR" },
  uacr_mg_g: { min: 0.0, max: 10000.0, label: "UACR (mg/g)" },
  creatinine_mg_dl: { min: 0.1, max: 20.0, label: "Creatinine (mg/dL)" },
  ldl_mg_dl: { min: 0.0, max: 1000.0, label: "LDL (mg/dL)" },
  hdl_mg_dl: { min: 0.0, max: 200.0, label: "HDL (mg/dL)" },
  triglycerides_mg_dl: { min: 0.0, max: 10000.0, label: "Triglycerides (mg/dL)" },
  systolic_bp: { min: 50.0, max: 260.0, label: "Systolic BP (mmHg)" },
};

// One shared label/input style so every field in the form reads consistently
// (the Lipid Panel fields were previously a smaller, bolder, disconnected style).
const labelClass = "flex min-h-[2rem] items-end text-xs font-semibold text-slate-600 mb-1";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none";
const errorClass = "text-[10px] text-rose-500 mt-1";

export function CustomPatientModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  backendFieldErrors,
  clearBackendErrors,
}: CustomPatientModalProps) {
  const [form, setForm] = useState<FormState>(defaultValues);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const handleChange = (name: keyof FormState, val: string) => {
    setForm((prev) => ({ ...prev, [name]: val }));
    if (localErrors[name]) {
      setLocalErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
    clearBackendErrors();
  };

  const handleLoadDemo = (type: "normal" | "high-risk") => {
    clearBackendErrors();
    setLocalErrors({});
    setForm(type === "normal" ? defaultValues : highRiskDemoValues);
  };

  const validateLocal = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Validate ranges — form values are raw strings at this point, so a
    // blank/partial field (e.g. mid-edit) correctly fails here rather than
    // silently becoming 0.
    (Object.keys(bounds) as NumericFieldName[]).forEach((key) => {
      const raw = form[key];
      const bound = bounds[key];
      const val = raw.trim() === "" ? NaN : Number(raw);
      if (Number.isNaN(val)) {
        errors[key] = "Value must be a valid number.";
        isValid = false;
      } else if (val < bound.min || val > bound.max) {
        errors[key] = `Must be between ${bound.min} and ${bound.max}.`;
        isValid = false;
      }
    });

    // Cross-field validation: Age vs Years with Diabetes
    if (!errors.age && !errors.years_with_diabetes) {
      const ageNum = Number(form.age);
      const durationNum = Number(form.years_with_diabetes);
      if (durationNum >= ageNum) {
        errors.years_with_diabetes = "Cannot exceed patient's age.";
        isValid = false;
      }
    }

    setLocalErrors(errors);
    return isValid;
  };

  const buildNumericPayload = (): CustomPatientInput => ({
    name: form.name,
    sex: form.sex,
    age: Number(form.age),
    years_with_diabetes: Number(form.years_with_diabetes),
    a1c_percent: Number(form.a1c_percent),
    egfr: Number(form.egfr),
    uacr_mg_g: Number(form.uacr_mg_g),
    creatinine_mg_dl: Number(form.creatinine_mg_dl),
    ldl_mg_dl: Number(form.ldl_mg_dl),
    hdl_mg_dl: Number(form.hdl_mg_dl),
    triglycerides_mg_dl: Number(form.triglycerides_mg_dl),
    systolic_bp: Number(form.systolic_bp),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateLocal()) {
      onSubmit(buildNumericPayload());
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end xs:items-center justify-center xs:p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative w-full max-w-2xl rounded-t-[32px] xs:rounded-[32px] border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[95dvh] xs:max-h-[90dvh] overflow-hidden"
          >

        {/* Modal Header */}
        <div className="relative border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">Patient Screening</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter patient demographics and lab readings to run a swarm analysis.</p>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-3 sm:right-6 sm:top-4 md:right-8 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">

          {/* Sample data shortcuts */}
          <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-400">Start from:</span>
            <button
              type="button"
              onClick={() => handleLoadDemo("normal")}
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Typical case
            </button>
            <button
              type="button"
              onClick={() => handleLoadDemo("high-risk")}
              className="rounded-lg bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
            >
              High-risk case
            </button>
          </div>

          {/* Demographics (left) + Renal Function (right) - independent
              columns, each stacking its own fields top-down. No shared
              row-by-row grid, so an uneven field count between the two
              sections never leaves an empty filler cell. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Demographics &amp; Profile</h3>

              <div>
                <label className={labelClass}>Full Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Martin Mwai"
                  value={form.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={inputClass}
                />
                {backendFieldErrors.name && <p className={errorClass}>{backendFieldErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Age</label>
                  <input
                    type="number"
                    step="1"
                    value={form.age}
                    onChange={(e) => handleChange("age", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.age || backendFieldErrors.age) && (
                    <p className={errorClass}>{localErrors.age || backendFieldErrors.age}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Sex</label>
                  <select
                    value={form.sex}
                    onChange={(e) => handleChange("sex", e.target.value as "M" | "F")}
                    className={inputClass}
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                  </select>
                  {backendFieldErrors.sex && <p className={errorClass}>{backendFieldErrors.sex}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Diabetes Duration (yrs)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.years_with_diabetes}
                    onChange={(e) => handleChange("years_with_diabetes", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.years_with_diabetes || backendFieldErrors.years_with_diabetes) && (
                    <p className={errorClass}>{localErrors.years_with_diabetes || backendFieldErrors.years_with_diabetes}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>HbA1c (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.a1c_percent}
                    onChange={(e) => handleChange("a1c_percent", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.a1c_percent || backendFieldErrors.a1c_percent) && (
                    <p className={errorClass}>{localErrors.a1c_percent || backendFieldErrors.a1c_percent}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Renal Function</h3>

              <div>
                <label className={labelClass}>eGFR (mL/min/1.73m²)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.egfr}
                  onChange={(e) => handleChange("egfr", e.target.value)}
                  className={inputClass}
                />
                {(localErrors.egfr || backendFieldErrors.egfr) && (
                  <p className={errorClass}>{localErrors.egfr || backendFieldErrors.egfr}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>UACR (mg/g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.uacr_mg_g}
                    onChange={(e) => handleChange("uacr_mg_g", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.uacr_mg_g || backendFieldErrors.uacr_mg_g) && (
                    <p className={errorClass}>{localErrors.uacr_mg_g || backendFieldErrors.uacr_mg_g}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Creatinine (mg/dL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.creatinine_mg_dl}
                    onChange={(e) => handleChange("creatinine_mg_dl", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.creatinine_mg_dl || backendFieldErrors.creatinine_mg_dl) && (
                    <p className={errorClass}>{localErrors.creatinine_mg_dl || backendFieldErrors.creatinine_mg_dl}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cardiovascular & Lipids (left) + Vascular Markers (right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 pt-4 border-t border-slate-100">

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cardiovascular &amp; Lipids</h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>LDL (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.ldl_mg_dl}
                    onChange={(e) => handleChange("ldl_mg_dl", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.ldl_mg_dl || backendFieldErrors.ldl_mg_dl) && (
                    <p className={errorClass}>{localErrors.ldl_mg_dl || backendFieldErrors.ldl_mg_dl}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>HDL (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.hdl_mg_dl}
                    onChange={(e) => handleChange("hdl_mg_dl", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.hdl_mg_dl || backendFieldErrors.hdl_mg_dl) && (
                    <p className={errorClass}>{localErrors.hdl_mg_dl || backendFieldErrors.hdl_mg_dl}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Triglycerides</label>
                  <input
                    type="number"
                    step="1"
                    value={form.triglycerides_mg_dl}
                    onChange={(e) => handleChange("triglycerides_mg_dl", e.target.value)}
                    className={inputClass}
                  />
                  {(localErrors.triglycerides_mg_dl || backendFieldErrors.triglycerides_mg_dl) && (
                    <p className={errorClass}>{localErrors.triglycerides_mg_dl || backendFieldErrors.triglycerides_mg_dl}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vascular Markers</h3>

              <div>
                <label className={labelClass}>Systolic Blood Pressure (mmHg)</label>
                <input
                  type="number"
                  step="1"
                  value={form.systolic_bp}
                  onChange={(e) => handleChange("systolic_bp", e.target.value)}
                  className={inputClass}
                />
                {(localErrors.systolic_bp || backendFieldErrors.systolic_bp) && (
                  <p className={errorClass}>{localErrors.systolic_bp || backendFieldErrors.systolic_bp}</p>
                )}
              </div>
            </div>

          </div>

        </form>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 sm:px-8 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border border-white border-t-transparent" />
                <span>Running Swarm...</span>
              </>
            ) : (
              <span>Run Analysis Swarm</span>
            )}
          </button>
        </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
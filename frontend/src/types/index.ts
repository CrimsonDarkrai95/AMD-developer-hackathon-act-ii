// frontend/src/types/index.ts

export interface PatientDropdownItem {
  patient_id: string;
  age: number;
  sex: string;
  a1c_percent: number;
}

export interface Demographics {
  age: number;
  sex: string;
  a1c_percent: number;
}

export interface SpecialistResult {
  specialist: "retinal" | "renal" | "neuropathy" | "cardiovascular" | string;
  risk_score: number; // float 0-1 from the python sandbox execution
  flag: boolean;      // true if clinical cutoff bounds are breached
  reasoning: string;  // the exact thoughts/code blocks printed by the agent
}

export interface SynthesisReport {
  top_concern: string;
  recommendation: string;
}

export interface PatientAnalysisResponse {
  patient_id: string;
  demographics: Demographics;
  specialists: SpecialistResult[];
  synthesis: SynthesisReport;
}
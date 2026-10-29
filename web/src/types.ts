export type DemoEvent =
  | { type: "agent_started"; agent: string }
  | { type: "tool_call"; agent: string; tool: string; args?: string }
  | { type: "tool_result"; agent: string; tool: string; preview: string }
  | { type: "interruption"; runId: string; tool: string; packet: Packet }
  | { type: "approved"; runId: string; noteId: string }
  | { type: "final"; runId: string; message: string }
  | { type: "audit"; entries: { at: string; event: string; reviewer?: string; feedback?: string }[] }
  | { type: "answer"; text: string }
  | { type: "trace"; traceId: string; url: string }
  | { type: "stats"; seconds: number; inputTokens: number; outputTokens: number; costUsd: number }
  | { type: "error"; message: string };

export type Sourced = { text: string; sources: string[] };

export type Packet = {
  board_summary: string[];
  attention_flags: { kind: "conflict" | "contraindication" | "missing_test" | "stale_source" | "other"; label: string }[];
  patient_snapshot: string;
  disease_characterization: { histology: Sourced; stage: Sourced; biomarkers: Sourced; other_markers: Sourced };
  clinically_relevant_history: Sourced[];
  similar_cases: { summary: string; matched: number; decisions: { decision: string; count: number }[]; caution: string };
  evidence_reviewed: { title: string; version: string; status: string; used: boolean }[];
  candidate_options: {
    option: string;
    patient_facts: Sourced[];
    guideline_facts: Sourced[];
    model_inference: string;
    cautions: string[];
  }[];
  contraindication_candidates: Sourced[];
  missing_information: string[];
  conflicts: { description: string; sources: string[] }[];
  uncertainty_notes: string[];
  verifier_summary: string;
};

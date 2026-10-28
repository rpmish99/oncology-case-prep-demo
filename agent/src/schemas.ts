import { z } from "zod";

const sourced = z.object({
  text: z.string(),
  sources: z.array(z.string()).describe("Source tags, for example pathology_report, clinic_note, pathway v2025.2"),
});

export const candidateOption = z.object({
  option: z.string().describe("Treatment option for the tumor board to consider"),
  patient_facts: z.array(sourced).describe("Facts taken from this patient's record"),
  guideline_facts: z.array(sourced).describe("Statements taken from a guideline or pathway document"),
  model_inference: z.string().describe("Reasoning that combines the facts. Clearly an inference, not a fact."),
  cautions: z.array(z.string()),
});

export const packetSchema = z.object({
  patient_snapshot: z.string(),
  disease_characterization: z.object({
    histology: sourced,
    stage: sourced,
    er_pr_her2: sourced,
    other_markers: sourced,
  }),
  clinically_relevant_history: z.array(sourced),
  evidence_reviewed: z.array(
    z.object({ title: z.string(), version: z.string(), status: z.string(), used: z.boolean() }),
  ),
  candidate_options: z.array(candidateOption),
  contraindication_candidates: z.array(sourced),
  missing_information: z.array(z.string()),
  conflicts: z.array(z.object({ description: z.string(), sources: z.array(z.string()) })),
  uncertainty_notes: z.array(z.string()),
  verifier_summary: z.string().describe("What the verifier checked and what it flagged, in plain words"),
});

export type Packet = z.infer<typeof packetSchema>;

export const verifierSchema = z.object({
  findings: z.array(
    z.object({
      claim: z.string(),
      issue: z.enum(["unsupported", "contradicts_source", "stale_source", "outside_scope", "missing_citation"]),
      detail: z.string(),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
  checked_claims: z.number().int(),
});

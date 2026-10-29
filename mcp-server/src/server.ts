import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(here, "../../data");
const TOKEN = process.env.MCP_TOKEN;
const REFERENCE_DATE = new Date(process.env.CASE_REFERENCE_DATE ?? "2026-10-28");

const readCase = (caseId: string, file: string) => {
  if (!/^case-\d{3}$/.test(caseId)) throw new Error(`Unknown case ${caseId}`);
  return readFileSync(path.join(DATA_DIR, "cases", caseId, file), "utf8");
};

type Identifiers = { name: string; mrn: string; dob: string };

/**
 * Masks direct identifiers before anything is returned to the model: the name and record number become a code and
 * the birth date becomes an age. Clinical dates are kept so the model can reason about timing. A production system
 * would also shift dates.
 */
function masker(ids: Identifiers) {
  let h = 0x811c9dc5;
  for (const ch of ids.mrn) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  const code = `P-${h.toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
  const born = new Date(ids.dob);
  let age = REFERENCE_DATE.getUTCFullYear() - born.getUTCFullYear();
  if (REFERENCE_DATE < new Date(Date.UTC(REFERENCE_DATE.getUTCFullYear(), born.getUTCMonth(), born.getUTCDate()))) age -= 1;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = ids.name.split(" ").filter(Boolean);
  const mask = (text: string) =>
    text
      .replace(new RegExp(esc(ids.name), "gi"), code)
      .replace(new RegExp(esc(ids.mrn), "g"), "[MRN masked]")
      .replace(new RegExp(esc(ids.dob), "g"), "[DOB masked]")
      .replace(new RegExp(`\\b(${parts.map(esc).join("|")})\\b`, "g"), code);
  return { code, age, mask };
}

function caseBundle(caseId: string) {
  const meta = JSON.parse(readCase(caseId, "meta.json"));
  const ids: Identifiers = meta.identifiers;
  const { code, age, mask } = masker(ids);

  const patientBundle = JSON.parse(mask(readCase(caseId, "patient.json")));
  const resources = patientBundle.entry.map((e: any) => e.resource);
  const of = (t: string) => resources.filter((r: any) => r.resourceType === t);
  const patient = of("Patient").map((p: any) => ({ id: code, gender: p.gender, age_years: age, note: p.extension?.[0]?.valueString }));

  const documents: Record<string, string> = {};
  for (const d of meta.documents) documents[d.title] = mask(readCase(caseId, d.file));

  return {
    case_id: caseId,
    identifiers: "Masked. The patient is referred to by a code. Names, record numbers and birth dates are removed.",
    patient,
    conditions: of("Condition"),
    medications: of("MedicationStatement"),
    allergies: of("AllergyIntolerance"),
    observations: of("Observation"),
    procedures: of("Procedure"),
    documents,
  };
}

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

type Past = {
  id: string; tumor_type: string; stage: string; biomarkers: string[]; factors: string[]; age_band: string;
  decision: string; outcome_24mo: string; board_year: number;
};

const BIOMARKER_TOKENS = ["ER+", "ER-", "PR+", "HER2+", "HER2-", "RS_low", "RS_intermediate", "RS_high", "EGFR_exon19", "EGFR_L858R", "ALK+", "PD-L1_low", "PD-L1_high", "MSS", "MSI-H", "pT3", "pT4", "pN1", "pN2"];
const FACTOR_TOKENS = ["premenopausal", "postmenopausal", "node_positive", "family_history_young", "prior_vte", "osteopenia", "ild", "smoker", "neuropathy", "diabetes", "frail"];

const VOCAB = `Biomarker tokens: ER+, ER-, PR+, HER2+, HER2-, RS_low, RS_intermediate, RS_high, EGFR_exon19, EGFR_L858R, ALK+, PD-L1_low, PD-L1_high, MSS, MSI-H, pT3, pT4, pN1, pN2.
Factor tokens: premenopausal, postmenopausal, node_positive, family_history_young, prior_vte, osteopenia, ild, smoker, neuropathy, diabetes, frail.`;

function findSimilar(args: { tumor_type: string; stage?: string; biomarkers?: string[]; factors?: string[]; age_band?: string }) {
  const past: Past[] = JSON.parse(readFileSync(path.join(DATA_DIR, "registry", "past-cases.json"), "utf8")).cases;
  const bands = ["30-39", "40-49", "50-59", "60-69", "70-79", "80-89"];
  const scored = past
    .filter((c) => c.tumor_type === args.tumor_type && (!args.stage || c.stage === args.stage))
    .map((c) => {
      const shared_biomarkers = (args.biomarkers ?? []).filter((b) => c.biomarkers.includes(b));
      const shared_factors = (args.factors ?? []).filter((f) => c.factors.includes(f));
      let score = shared_biomarkers.length * 2 + shared_factors.length * 2;
      if (args.stage && c.stage === args.stage) score += 3;
      if (args.age_band && Math.abs(bands.indexOf(c.age_band) - bands.indexOf(args.age_band)) <= 1) score += 1;
      return { c, score, shared_biomarkers, shared_factors };
    })
    .filter((x) => x.score >= 5 && (!(args.biomarkers ?? []).length || x.shared_biomarkers.length > 0))
    .sort((a, b) => b.score - a.score);
  const matchedTotal = scored.length;
  scored.splice(12);

  const tally = (f: (c: Past) => string) =>
    Object.entries(scored.reduce<Record<string, number>>((m, x) => ((m[f(x.c)] = (m[f(x.c)] ?? 0) + 1), m), {}))
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));

  const unrecognized = [
    ...(args.biomarkers ?? []).filter((t) => !BIOMARKER_TOKENS.includes(t)),
    ...(args.factors ?? []).filter((t) => !FACTOR_TOKENS.includes(t)),
  ];
  return {
    unrecognized_tokens: unrecognized,
    hint: unrecognized.length || matchedTotal === 0 ? "Some tokens were not recognized or nothing matched. Use only the listed tokens and call again once." : undefined,
    registry: "Synthetic registry of past tumor board cases. Invented decisions and outcomes, not real patients.",
    compared: past.filter((c) => c.tumor_type === args.tumor_type).length,
    matched: matchedTotal,
    decisions: tally((c) => c.decision),
    outcomes_24_months: tally((c) => c.outcome_24mo),
    closest: scored.slice(0, 5).map((x) => ({
      id: x.c.id, year: x.c.board_year, stage: x.c.stage, age_band: x.c.age_band, decision: x.c.decision,
      outcome_24mo: x.c.outcome_24mo, shared: [...x.shared_biomarkers, ...x.shared_factors],
    })),
    caution: "Past decisions are precedent, not recommendations. Numbers are small and cases differ from this patient.",
  };
}

function buildServer() {
  const server = new McpServer({ name: "mock-ehr", version: "0.2.0" });

  server.tool(
    "get_case_bundle",
    "Everything in the record for a case in one call: demographics, problem list, medications, allergies, observations, procedures, and the text of every report and note. Direct identifiers are masked.",
    { case_id: z.string().describe("Case identifier, for example case-001") },
    async ({ case_id }) => text(caseBundle(case_id)),
  );

  server.tool(
    "find_similar_cases",
    `Search the registry of past, de-identified tumor board cases for patients like this one. Returns how many matched, what the board decided, outcomes at 24 months, and the closest cases.\n${VOCAB}`,
    {
      tumor_type: z.enum(["breast", "lung", "colon"]),
      stage: z.string().optional().describe("For example I, II, IIIB, IV"),
      biomarkers: z.array(z.string()).optional(),
      factors: z.array(z.string()).optional(),
      age_band: z.string().optional().describe("For example 40-49"),
    },
    async (args) => text(findSimilar(args)),
  );
  return server;
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => void res.json({ ok: true }));

app.post("/mcp", async (req, res) => {
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const methodNotAllowed = (_req: express.Request, res: express.Response) =>
  void res.status(405).json({ error: "method not allowed" });
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => console.log(`mock-ehr MCP server listening on :${port}`));

import { Agent, MCPServerStreamableHttp, fileSearchTool } from "@openai/agents";
import { verifierSchema } from "./schemas.js";
import { emit, preview } from "./events.js";
import { searchPubmed, searchTrials, submitForClinicianReview } from "./tools.js";

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-6.1-sol";
const EFFORT = (process.env.REASONING_EFFORT ?? "low") as "low" | "medium" | "high";
const SETTINGS = { reasoning: { effort: EFFORT } };

export function createEhrServer() {
  return new MCPServerStreamableHttp({
    name: "mock-ehr",
    url: process.env.MCP_URL ?? "http://localhost:3333/mcp",
    requestInit: { headers: { authorization: `Bearer ${process.env.MCP_TOKEN ?? ""}` } },
    cacheToolsList: true,
  });
}

const CASE_RULES = `
Rules that apply to every specialist:
- Use only information returned by your tools. Do not use outside knowledge for patient facts.
- Tag every statement with its source: the record it came from, or the document title and version.
- When two sources disagree, report both and say which is the governing source. Do not resolve it silently.
- Say plainly what is missing. Do not guess.
- You support clinical decision-making. You do not choose treatment.`;

const nested = (agentName: string) => ({
  onStream: ({ event }: { event: any }) => {
    if (event.type === "run_item_stream_event") {
      const raw = event.item?.rawItem ?? {};
      if (event.name === "tool_called")
        emit({ type: "tool_call", agent: agentName, tool: raw.name ?? raw.type ?? "tool", args: raw.arguments });
      if (event.name === "tool_output")
        emit({
          type: "tool_result",
          agent: agentName,
          tool: raw.name ?? "tool",
          preview: preview(event.item?.output, raw.name === "verify_draft" ? 1200 : 160),
        });
    }
  },
});

export function buildAgents(ehr: MCPServerStreamableHttp, vectorStoreId: string) {
  const patientData = new Agent({
    name: "Patient data specialist",
    model: MODEL,
    modelSettings: SETTINGS,
    mcpServers: [ehr],
    instructions: `You collect the current facts about one patient from the record tools.
Call the tools for pathology, radiology, genomics, conditions and the clinic note.
Return a compact list: histology, grade, size, nodal status, stage, ER, PR, HER2, Ki-67, assay results,
menopausal status, imaging findings. Each line ends with its source tag.
Then add a section "Disagreements" listing any value that differs between records, quoting both.
${CASE_RULES}`,
  });

  const history = new Agent({
    name: "Clinical history specialist",
    model: MODEL,
    modelSettings: SETTINGS,
    mcpServers: [ehr],
    instructions: `You build a short timeline of history that could change endocrine therapy or supportive care.
Look at the problem list, medications, allergies, family history, bone density and prior thrombosis.
Return only items that matter for treatment choice, each with its date and source tag.
Add a section "Missing or stale" for tests that have not been done or are old.
${CASE_RULES}`,
  });

  const evidence = new Agent({
    name: "Evidence specialist",
    model: MODEL,
    modelSettings: SETTINGS,
    tools: [
      fileSearchTool([vectorStoreId], { includeSearchResults: true, maxNumResults: 8 }),
      searchPubmed,
      searchTrials,
    ],
    instructions: `You find evidence for the question you are given.
First search the institutional pathway documents with file search. Each document has a version and a status.
Report the version and status of every document you rely on. If a document is marked superseded, say so and
do not use it for recommendations. Then, only if useful, search PubMed and ClinicalTrials.gov with queries
that describe the disease and question, never the patient. Keep PubMed queries short (three to six words),
run at most three searches, and run the searches one after another.
Quote the pathway wording you rely on, with the document title and version.
${CASE_RULES}`,
  });

  const verifier = new Agent({
    name: "Verifier",
    model: MODEL,
    modelSettings: SETTINGS,
    outputType: verifierSchema,
    instructions: `You check a draft evidence packet against the specialist outputs it was built from.
You have no tools. Check every claim for:
- unsupported: not present in any specialist output
- contradicts_source: a patient fact that differs from the pathology or record text
- stale_source: relies on a document marked superseded
- outside_scope: states a treatment decision instead of options for review
- missing_citation: a claim with no source tag
Be specific: quote the claim. If everything checks out, return an empty findings list.`,
  });

  const manager = new Agent({
    name: "Treatment planning manager",
    model: MODEL,
    modelSettings: SETTINGS,
    tools: [
      patientData.asTool({
        toolName: "consult_patient_data",
        toolDescription: "Get current disease and biomarker facts for the case.",
        ...nested("Patient data specialist"),
      }),
      history.asTool({
        toolName: "consult_clinical_history",
        toolDescription: "Get relevant history, comorbidities, and missing or stale tests.",
        ...nested("Clinical history specialist"),
      }),
      evidence.asTool({
        toolName: "consult_evidence",
        toolDescription: "Find pathway guidance and recent evidence. Give it the specific question.",
        ...nested("Evidence specialist"),
      }),
      verifier.asTool({
        toolName: "verify_draft",
        toolDescription:
          "Check a draft packet against specialist outputs. Pass the full draft and all specialist outputs.",
        ...nested("Verifier"),
      }),
      submitForClinicianReview,
    ],
    instructions: `You prepare a case for a breast tumor board. You support the oncologist. You do not decide treatment.

Work in this order:
1. Call consult_patient_data and consult_clinical_history.
2. Call consult_evidence with a specific question built from the findings.
3. Write a draft packet. Keep patient facts, guideline statements and your own inference in separate fields.
   List options for the tumor board, not a decision. Put every disagreement in conflicts and every missing item
   in missing_information. Do not use any document marked superseded.
4. Call verify_draft with the draft and the specialist outputs. Fix anything it flags. If you cannot fix a flag,
   say so in uncertainty_notes.
5. Call submit_for_clinician_review once with the final packet.

Keep the packet short enough to read in two minutes before a meeting:
- At most 4 candidate options, 3 patient facts and 3 guideline facts per option, one sentence each.
- At most 5 items in missing_information, only those that could change the treatment choice. Do not list
  routine workup. Do not call a value missing if a record tool returned it.
- At most 4 conflicts, 3 uncertainty notes, and plain language throughout. No filler about the documents being
  synthetic, since the oncologist already knows that.
- verifier_summary is two sentences: what the verifier flagged and what you changed.
If the clinician returns feedback instead of approving, revise the packet and submit again.`,
  });

  return manager;
}

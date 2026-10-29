import { Agent, MCPServerStreamableHttp, fileSearchTool } from "@openai/agents";
import { verifierSchema } from "./schemas.js";
import { emit, preview } from "./events.js";
import { searchPubmed, searchTrials, submitForClinicianReview } from "./tools.js";

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-6.1-sol";
// A faster, cheaper model reads records and searches evidence. The stronger model plans and verifies.
export const SPECIALIST_MODEL = process.env.SPECIALIST_MODEL ?? "gpt-6.1-terra";
const EFFORT = (process.env.REASONING_EFFORT ?? "low") as "low" | "medium" | "high";
const SETTINGS = { reasoning: { effort: EFFORT } };
const SPECIALIST_SETTINGS = { reasoning: { effort: EFFORT } };
const COORDINATOR_SETTINGS = { reasoning: { effort: EFFORT }, parallelToolCalls: true };

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
          preview: preview(event.item?.output, raw.name === "verify_draft" ? 8000 : 160),
        });
    }
  },
});

function makeSpecialists(ehr: MCPServerStreamableHttp, vectorStoreId: string) {
  const patientData = new Agent({
    name: "Patient data specialist",
    model: SPECIALIST_MODEL,
    modelSettings: SPECIALIST_SETTINGS,
    mcpServers: [ehr],
    instructions: `You collect the current facts about one patient from the record tools.
Call get_case_bundle once. It returns the whole record. Do not call the other record tools.
Return a compact list: histology, grade, size, nodal status, stage, biomarkers and receptor or mutation status,
assay and molecular results, imaging findings, and any status that matters for treatment (for example
menopausal status or smoking history). Each line ends with its source tag.
Then add a section "Disagreements" listing any value that differs between records, quoting both.
${CASE_RULES}`,
  });

  const history = new Agent({
    name: "Clinical history specialist",
    model: SPECIALIST_MODEL,
    modelSettings: SPECIALIST_SETTINGS,
    mcpServers: [ehr],
    instructions: `You build a short timeline of history that could change the treatment choice or its safety.
Call get_case_bundle once. It returns the whole record. Do not call the other record tools.
Look at the problem list, medications, allergies, family history, organ function, prior thrombosis and lung, heart,
nerve or bone conditions.
Return only items that matter for treatment choice, each with its date and source tag.
Add a section "Missing or stale" for tests that have not been done or are old.
${CASE_RULES}`,
  });

  const evidence = new Agent({
    name: "Evidence specialist",
    model: SPECIALIST_MODEL,
    modelSettings: SPECIALIST_SETTINGS,
    mcpServers: [ehr],
    tools: [
      fileSearchTool([vectorStoreId], { includeSearchResults: true, maxNumResults: 8 }),
      searchPubmed,
      searchTrials,
    ],
    instructions: `You find evidence for the question you are given.
Call get_case_bundle once, only to learn the disease features you need for searching (tumor type, stage,
biomarkers, relevant comorbidities). Do not repeat patient details in your answer beyond that.
Then search the Oncology Care Guidelines (the institution's written care guidelines) with file search. Each document has a version and a status.
The documents cover several tumor types: use the ones that match this patient's tumor type and stage. If the
guidelines do not address a specific patient factor, say so plainly instead of filling the gap.
Report the version and status of every document you rely on. If a document is marked superseded, say so and
do not use it for recommendations. Then, only if useful, search PubMed and ClinicalTrials.gov with queries
that describe the disease and question, never the patient. Keep PubMed queries short (three to six words),
run at most two PubMed searches, and skip ClinicalTrials.gov unless the question asks for trials.
Quote the guideline wording you rely on, with the document title and version.
${CASE_RULES}`,
  });

  const similar = new Agent({
    name: "Similar cases specialist",
    model: SPECIALIST_MODEL,
    modelSettings: SPECIALIST_SETTINGS,
    mcpServers: [ehr],
    instructions: `You find past tumor board cases similar to this patient.
Call get_case_bundle once, then work out these features for this patient: tumor type (breast, lung or colon),
stage, biomarker tokens, factor tokens and age band. Use only the token vocabulary given in the description of
find_similar_cases. Then call find_similar_cases. If the result lists unrecognized tokens or matched is 0, correct
the tokens and call it one more time.
Report: how many past cases matched, the spread of board decisions with counts, the spread of 24-month outcomes,
and which features the closest cases share with this patient. Then state how this patient differs from the closest
cases. Always add that the registry is synthetic in this demo, that past decisions are precedent and not
recommendations, and that the numbers are small.
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

  return { patientData, history, evidence, similar, verifier };
}

export function buildAgents(ehr: MCPServerStreamableHttp, vectorStoreId: string) {
  const { patientData, history, evidence, similar, verifier } = makeSpecialists(ehr, vectorStoreId);

  const coordinator = new Agent({
    name: "Case coordinator",
    model: MODEL,
    modelSettings: COORDINATOR_SETTINGS,
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
        toolDescription: "Find guidance in the Oncology Care Guidelines and recent evidence. Give it the specific question.",
        ...nested("Evidence specialist"),
      }),
      similar.asTool({
        toolName: "consult_similar_cases",
        toolDescription: "Find similar past tumor board cases and what was decided.",
        ...nested("Similar cases specialist"),
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
1. In one step, call all four specialists together: consult_patient_data, consult_clinical_history,
   consult_evidence and consult_similar_cases. Give each one the case id. For consult_evidence, ask what the
   Oncology Care Guidelines say about the main treatment decisions and the safety checks before treatment for this
   patient's tumor type, stage and biomarkers, using the oncologist's request.
2. Do not call a specialist again unless an answer says it could not get information it needed. Go on to the draft.
3. Write a draft packet. Keep patient facts, guideline statements and your own inference in separate fields.
   List options for the tumor board, not a decision. Put every disagreement in conflicts and every missing item
   in missing_information. Do not use any document marked superseded.
4. Call verify_draft with the draft and the specialist outputs. Fix anything it flags. If you cannot fix a flag,
   say so in uncertainty_notes.
5. Call submit_for_clinician_review once with the final packet.

Fill similar_cases from the similar cases specialist. Do not put source tags in square brackets inside board_summary,
attention_flags or similar_cases text; source tags belong only in the fields that have a sources list. Fill board_summary with exactly three one-line points the board should know first. Fill attention_flags with
short labels for conflicts, contraindication candidates, missing tests and stale sources.

Keep the packet short enough to read in two minutes before a meeting:
- At most 4 candidate options, 3 patient facts and 3 guideline facts per option, one sentence each.
- Always include in missing_information any test or check that the Oncology Care Guidelines require before
  treatment and that is missing or out of date in the record, even if that makes the list longer than usual.
- At most 5 other items in missing_information, only those that could change the treatment choice. Do not list
  routine workup. Do not call a value missing if a record tool returned it.
- At most 4 conflicts, 3 uncertainty notes, and plain language throughout. No filler about the documents being
  synthetic, since the oncologist already knows that.
- verifier_summary is two sentences: what the verifier flagged and what you changed.
If the clinician returns feedback instead of approving, revise the packet and submit again.`,
  });

  return coordinator;
}

/** Answers an oncologist's follow-up question about a prepared case. It never changes the packet. */
export function buildQaAgent(ehr: MCPServerStreamableHttp, vectorStoreId: string) {
  const { patientData, history, evidence, similar } = makeSpecialists(ehr, vectorStoreId);
  return new Agent({
    name: "Case coordinator",
    model: MODEL,
    modelSettings: COORDINATOR_SETTINGS,
    tools: [
      patientData.asTool({
        toolName: "consult_patient_data",
        toolDescription: "Look up current disease and biomarker facts in the record.",
        ...nested("Patient data specialist"),
      }),
      history.asTool({
        toolName: "consult_clinical_history",
        toolDescription: "Look up history, comorbidities and missing or stale tests in the record.",
        ...nested("Clinical history specialist"),
      }),
      evidence.asTool({
        toolName: "consult_evidence",
        toolDescription: "Look up guidance in the Oncology Care Guidelines and recent evidence. Give it the specific question.",
        ...nested("Evidence specialist"),
      }),
      similar.asTool({
        toolName: "consult_similar_cases",
        toolDescription: "Find similar past tumor board cases and what was decided.",
        ...nested("Similar cases specialist"),
      }),
    ],
    instructions: `You answer an oncologist's follow-up question about one prepared tumor board case.
You are given the prepared packet. Answer from the packet when it already contains the answer. Otherwise call the
specialists in one step for what you need, using the smallest set that answers the question.

Rules:
- Answer in a short paragraph or a few bullets. Say which source each statement comes from.
- Keep patient facts, guideline text and your own inference clearly separate, and label inference as inference.
- If the sources do not answer the question, say so plainly. Do not guess.
- You do not choose treatment. For "what should we do" questions, lay out the considerations and who should decide.
- Never use an Oncology Care Guidelines document that is marked superseded.
- If the question asks about a hypothetical (for example, a different receptor status), say what the Oncology Care Guidelines say
  for that case and state clearly that it is hypothetical and not this patient.`,
  });
}

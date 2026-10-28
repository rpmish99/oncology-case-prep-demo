import { tool } from "@openai/agents";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { packetSchema } from "./schemas.js";
import { saveNote } from "./store.js";

const clip = (s: string, n = 6000) => (s.length > n ? `${s.slice(0, n)}\n[truncated]` : s);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// PubMed allows about 3 requests per second without a key, so calls are spaced and retried.
let lastCall = 0;
async function getJson(url: string, attempts = 4): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    const wait = Math.max(0, lastCall + 400 - Date.now());
    lastCall = Date.now() + wait;
    if (wait) await sleep(wait);
    const res = await fetch(url, { headers: { "user-agent": "case-prep-demo/0.1" } });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`${url} returned ${res.status}`);
    await sleep(800 * (i + 1));
  }
  throw new Error("Service busy after retries");
}

export const searchPubmed = tool({
  name: "search_pubmed",
  description:
    "Search PubMed for recent literature. Query must describe the disease and question only. Never include patient identifiers.",
  parameters: z.object({ query: z.string(), max_results: z.number().int().min(1).max(8) }),
  async execute({ query, max_results }) {
    try {
      return await pubmed(query, max_results);
    } catch {
      return "PubMed is not available right now. Continue with the pathway documents.";
    }
  },
});

async function pubmed(query: string, max_results: number) {
    const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    const search = await getJson(
      `${base}/esearch.fcgi?db=pubmed&retmode=json&sort=date&retmax=${max_results}&term=${encodeURIComponent(query)}`,
    );
    const ids: string[] = search.esearchresult?.idlist ?? [];
    if (!ids.length) return "No results.";
    const summary = await getJson(`${base}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`);
    return clip(
      ids
        .map((id) => {
          const r = summary.result?.[id];
          return `PMID ${id} | ${r?.pubdate ?? ""} | ${r?.source ?? ""} | ${r?.title ?? ""}`;
        })
        .join("\n"),
    );
}

export const searchTrials = tool({
  name: "search_clinical_trials",
  description:
    "Search ClinicalTrials.gov for recruiting trials by condition and intervention terms. Never include patient identifiers.",
  parameters: z.object({ condition: z.string(), terms: z.string(), max_results: z.number().int().min(1).max(8) }),
  async execute({ condition, terms, max_results }) {
    const url =
      `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(condition)}` +
      `&query.term=${encodeURIComponent(terms)}&filter.overallStatus=RECRUITING&pageSize=${max_results}`;
    const data = await getJson(url);
    const studies: any[] = data.studies ?? [];
    if (!studies.length) return "No recruiting trials found.";
    return clip(
      studies
        .map((s) => {
          const p = s.protocolSection;
          return `${p?.identificationModule?.nctId} | ${p?.statusModule?.overallStatus} | ${p?.identificationModule?.briefTitle}`;
        })
        .join("\n"),
    );
  },
});

/**
 * Final step of every run. The SDK pauses here until a clinician approves, so nothing is
 * stored without a decision. In this demo the note is saved to the run store only. There
 * is no write to a patient record.
 */
export const submitForClinicianReview = tool({
  name: "submit_for_clinician_review",
  description:
    "Submit the finished, verified evidence packet to the oncologist for review. Call this exactly once, after the verifier has run.",
  parameters: packetSchema,
  needsApproval: true,
  async execute(packet) {
    const noteId = `note-${randomUUID().slice(0, 8)}`;
    await saveNote(noteId, packet);
    return `Draft note ${noteId} saved after clinician approval.`;
  },
});

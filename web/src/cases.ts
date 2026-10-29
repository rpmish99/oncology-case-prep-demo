import type { Identifiers } from "./mask";

const files = import.meta.glob("../../data/cases/*/*", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const guideFiles = import.meta.glob("../../data/guidelines/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export type CaseDoc = { key: string; title: string; date: string; file: string };
export type CaseMeta = {
  id: string;
  title: string;
  site: "Breast" | "Lung" | "Colon";
  banner: string;
  timeline: [string, string][];
  followUps: string[];
  identifiers: Identifiers;
  documents: CaseDoc[];
};

const read = (id: string, file: string) => files[`../../data/cases/${id}/${file}`] ?? "";

export const CASES: CaseMeta[] = Object.keys(files)
  .filter((k) => k.endsWith("/meta.json"))
  .map((k) => JSON.parse(files[k]) as CaseMeta)
  .sort((a, b) => a.id.localeCompare(b.id));

export const caseFile = read;

export type GuidelineDoc = { file: string; title: string; version: string; status: string; site: CaseMeta["site"]; text: string };

export const GUIDELINES: GuidelineDoc[] = Object.entries(guideFiles).map(([path, text]) => {
  const file = path.split("/").pop()!;
  const front = (k: string) => new RegExp(`^${k}: (.*)$`, "m").exec(text)?.[1]?.trim() ?? "";
  const site: CaseMeta["site"] = /nsclc/.test(file) ? "Lung" : /colon/.test(file) ? "Colon" : "Breast";
  return { file, title: front("title"), version: front("version"), status: front("status"), site, text };
});

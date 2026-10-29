import "../src/bootstrap.js";
import { readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { startRun } from "../src/runner.js";
import type { DemoEvent } from "../src/events.js";

/**
 * Runs every synthetic case several times and checks whether each planted problem was caught. The checks are simple
 * text tests on the structured packet, so they are repeatable and cheap. Expected findings live next to each case in
 * data/cases/<id>/expected.json.
 */
const RUNS = Number(process.env.EVAL_RUNS ?? 5);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 5);
const casesDir = path.resolve(process.cwd(), "../data/cases");

type Check = { id: string; label: string; where: string[]; all?: string[]; none?: string[] };

function pick(obj: any, p: string): unknown[] {
  const [head, ...rest] = p.split(".");
  if (head === "*") return (Array.isArray(obj) ? obj : []).flatMap((x) => (rest.length ? pick(x, rest.join(".")) : [x]));
  const next = obj?.[head];
  return rest.length ? pick(next, rest.join(".")) : [next];
}
const textOf = (packet: any, where: string[]) => JSON.stringify(where.flatMap((p) => pick(packet, p)));
const test = (packet: any, c: Check) => {
  const t = textOf(packet, c.where);
  return (c.all ?? []).every((r) => new RegExp(r, "i").test(t)) && !(c.none ?? []).some((r) => new RegExp(r, "i").test(t));
};

const GENERIC: Check[] = [];
const genericTests: Record<string, (p: any) => boolean> = {
  "Offers at least two options rather than one decision": (p) => p.candidate_options.length >= 2,
  "Every option has patient facts and guideline statements": (p) =>
    p.candidate_options.every((o: any) => o.patient_facts.length > 0 && o.guideline_facts.length > 0),
  "Reports similar past cases with a caution": (p) => p.similar_cases?.matched > 0 && p.similar_cases.decisions.length > 0 && !!p.similar_cases.caution,
  "Does not use a superseded document": (p) =>
    !p.evidence_reviewed.some((e: any) => e.used && /supersed/i.test(e.status) && !/\b(not|no|nor)\b[^.;]{0,20}supersed/i.test(e.status)),
};
void GENERIC;

type Result = { caseId: string; packet: any | null; seconds: number; costUsd: number; error?: string };

async function one(caseId: string): Promise<Result> {
  let packet: any = null;
  let seconds = 0;
  let costUsd = 0;
  let error: string | undefined;
  const onEvent = (e: DemoEvent) => {
    if (e.type === "interruption") packet = e.packet;
    if (e.type === "stats") {
      seconds += e.seconds;
      costUsd += e.costUsd;
    }
    if (e.type === "error") error = e.message;
  };
  try {
    await startRun("Prepare this case for tumor board.", caseId, onEvent);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return { caseId, packet, seconds, costUsd, error };
}

const caseIds = readdirSync(casesDir).filter((d) => /^case-\d{3}$/.test(d)).sort();
const queue = caseIds.flatMap((id) => Array.from({ length: RUNS }, () => id));
const results: Result[] = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const r = await one(id);
      results.push(r);
      console.log(`${id}: ${r.packet ? "packet" : `FAILED ${r.error}`} in ${r.seconds}s`);
    }
  }),
);

const sections: string[] = [];
const jsonRows: any[] = [];
let passedAll = 0;
let totalAll = 0;
for (const id of caseIds) {
  const meta = JSON.parse(readFileSync(path.join(casesDir, id, "meta.json"), "utf8"));
  const expected = JSON.parse(readFileSync(path.join(casesDir, id, "expected.json"), "utf8")) as { checks: Check[]; info: Check[] };
  const ok = results.filter((r) => r.caseId === id && r.packet);
  const rows = [
    ...expected.checks.map((c) => ({ label: c.label, passed: ok.filter((r) => test(r.packet, c)).length })),
    ...Object.entries(genericTests).map(([label, f]) => ({ label, passed: ok.filter((r) => f(r.packet)).length })),
  ];
  rows.forEach((r) => {
    passedAll += r.passed;
    totalAll += ok.length;
  });
  const info = expected.info.map((c) => `- ${c.label}: ${ok.filter((r) => test(r.packet, c)).length} of ${ok.length}`);
  sections.push(
    `## ${id}: ${meta.title}\n\n| Check | Passed |\n|---|---|\n${rows.map((r) => `| ${r.label} | ${r.passed} of ${ok.length} |`).join("\n")}\n${info.length ? `\nObserved, not scored:\n\n${info.join("\n")}\n` : ""}`,
  );
  jsonRows.push({ caseId: id, runs: ok.length, rows });
}

const done = results.filter((r) => r.packet);
const avg = (f: (r: Result) => number) => (done.length ? done.reduce((a, r) => a + f(r), 0) / done.length : 0);
const md = `# Evaluation results

${caseIds.length} synthetic cases, ${RUNS} runs each (${done.length} of ${results.length} completed), run ${new Date().toISOString().slice(0, 10)}.
Checks are text tests on the structured packet. They show how often each planted problem was caught.
Overall: ${passedAll} of ${totalAll} checks passed.

${sections.join("\n")}
Average time to the review step: ${avg((r) => r.seconds).toFixed(0)} seconds (runs were ${CONCURRENCY} at a time).
Average model cost per case at list prices: $${avg((r) => r.costUsd).toFixed(3)}.
`;
if (done.length < results.length) {
  console.error(`Only ${done.length} of ${results.length} runs completed (for example the account may have no credits). Results not written.`);
  process.exit(1);
}
await writeFile(path.resolve(process.cwd(), "../docs/eval-results.md"), md);
await writeFile(
  path.resolve(process.cwd(), "../docs/eval-results.json"),
  JSON.stringify({ passedAll, totalAll, cases: jsonRows, summary: { runs: done.length, avgSeconds: Math.round(avg((r) => r.seconds)), avgCostUsd: Number(avg((r) => r.costUsd).toFixed(3)) } }, null, 2),
);
console.log(md);

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import pathologyText from "../../data/case/pathology_report.txt?raw";
import radiologyText from "../../data/case/radiology_report.txt?raw";
import genomicsText from "../../data/case/genomics_report.txt?raw";
import clinicText from "../../data/case/clinic_note.txt?raw";
import patientJson from "../../data/case/patient.json?raw";
import guidelinesText from "../../data/guidelines/care-guidelines-er-pos-her2-neg-early-v2025-2.md?raw";
import guidelinesOldText from "../../data/guidelines/care-guidelines-er-pos-her2-neg-early-v2022-1-SUPERSEDED.md?raw";
import checklistText from "../../data/guidelines/care-guidelines-endocrine-therapy-safety-checklist-v2025-1.md?raw";
import { invoke } from "./api";
import type { DemoEvent, Packet, Sourced } from "./types";

type Status = "idle" | "running" | "review" | "saving" | "done" | "error";

const QUESTION = "Prepare this case for tumor board. What endocrine and supportive-care options should we discuss?";

const RECORDS: [string, string, string][] = [
  ["Pathology report", "2026-09-14", "pathology"],
  ["Radiology reports", "2026-08-12, 2026-09-21", "radiology"],
  ["Genomic assay", "2026-09-28", "genomic"],
  ["Navigator clinic note", "2026-10-05", "clinic note"],
  ["Problem list, medications, allergies", "current", "patient record"],
];

const GUIDELINE_DOCS: [string, string, string][] = [
  ["Oncology Care Guidelines", "v2025.2, current", "guidelines 2025.2"],
  ["Oncology Care Guidelines", "v2022.1, superseded", "2022.1"],
  ["Endocrine therapy checklist", "v2025.1", "checklist"],
];

const AGENT_LABEL: Record<string, string> = {
  "Case coordinator": "Coordinator",
  "Patient data specialist": "Patient data",
  "Clinical history specialist": "History",
  "Evidence specialist": "Evidence",
  Verifier: "Verifier",
};

const TOOL_LABEL: Record<string, string> = {
  consult_patient_data: "asks the patient data specialist",
  consult_clinical_history: "asks the history specialist",
  consult_evidence: "asks the evidence specialist",
  verify_draft: "sends the draft to the verifier",
  file_search_call: "searches the Oncology Care Guidelines",
  search_pubmed: "searches PubMed",
  search_clinical_trials: "searches ClinicalTrials.gov",
};
const SHOW_RESULT = new Set(["search_pubmed", "search_clinical_trials", "consult_patient_data", "consult_clinical_history", "consult_evidence"]);
const toolName = (t: string) => TOOL_LABEL[t] ?? `reads ${t.replace(/^get_/, "").replace(/_/g, " ")}`;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type Doc = { title: string; text: string };
function formatPatient(json: string): string {
  const entries = (JSON.parse(json).entry as { resource: any }[]).map((e) => e.resource);
  const of = (t: string) => entries.filter((r) => r.resourceType === t);
  const lines: string[] = ["SYNTHETIC PATIENT RECORD (fictional, for demonstration only)", ""];
  const pt = of("Patient")[0];
  lines.push(`Patient: ${pt?.name?.[0]?.text}, ${pt?.gender}, born ${pt?.birthDate}`);
  lines.push(`Menopausal status: ${pt?.extension?.[0]?.valueString}`, "", "PROBLEM LIST");
  of("Condition").forEach((c) =>
    lines.push(`- ${c.code.text} (${c.clinicalStatus}, since ${String(c.onsetDateTime).slice(0, 10)})${c.note ? ". " + c.note : ""}`),
  );
  lines.push("", "MEDICATIONS");
  of("MedicationStatement").forEach((m) => lines.push(`- ${m.medicationCodeableConcept.text} (${m.status})`));
  lines.push("", "ALLERGIES");
  of("AllergyIntolerance").forEach((a) => lines.push(`- ${a.code.text}: ${a.reaction}`));
  lines.push("", "OBSERVATIONS");
  of("Observation").forEach((o) => lines.push(`- ${o.code.text}: ${o.valueString ?? o.valueInteger}`));
  lines.push("", "PROCEDURES");
  of("Procedure").forEach((p) => lines.push(`- ${p.code.text} on ${String(p.performedDateTime).slice(0, 10)}`));
  return lines.join("\n");
}

const SourceCtx = createContext<(tag: string) => void>(() => {});

function resolveSource(tag: string): Doc {
  const t = tag.toLowerCase();
  if (/checklist/.test(t)) return { title: "Oncology Care Guidelines, endocrine therapy safety checklist, version 2025.1", text: checklistText };
  if (/2022/.test(t)) return { title: "Oncology Care Guidelines, version 2022.1 (superseded)", text: guidelinesOldText };
  if (/care guideline|guideline|v20|2025/.test(t)) return { title: "Oncology Care Guidelines, version 2025.2", text: guidelinesText };
  if (/pathology|biops/.test(t)) return { title: "Surgical pathology report, 2026-09-14", text: pathologyText };
  if (/radiolog|imaging|ultrasound|mammo|\bct\b/.test(t)) return { title: "Radiology reports", text: radiologyText };
  if (/genom|assay|recurrence|oncotype|21-gene/.test(t)) return { title: "Genomic assay report, 2026-09-28", text: genomicsText };
  if (/clinic|intake|navigator|note/.test(t)) return { title: "Navigator clinic note, 2026-10-05", text: clinicText };
  return { title: "Patient record: problem list, medications, allergies, observations", text: formatPatient(patientJson) };
}

function SourceTags({ sources }: { sources: string[] }) {
  const open = useContext(SourceCtx);
  return (
    <span className="tags">
      {sources.map((s) => (
        <button key={s} className="tag" onClick={() => open(s)} title="Show the source text">
          {s}
        </button>
      ))}
    </span>
  );
}

function Fact({ item }: { item: Sourced }) {
  return (
    <li>
      {item.text} <SourceTags sources={item.sources} />
    </li>
  );
}

const KIND_LABEL: Record<string, string> = {
  conflict: "Conflict",
  contraindication: "Contraindication",
  missing_test: "Missing test",
  stale_source: "Stale source",
  other: "Note",
};

function PacketView({ p }: { p: Packet }) {
  const d = p.disease_characterization;
  return (
    <div className="packet">
      <section className="summary">
        <h3>What the board should know first</h3>
        <ol>
          {p.board_summary.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ol>
        <div className="chips">
          {p.attention_flags.map((f, i) => (
            <span key={i} className={`chip ${f.kind}`}>
              <b>{KIND_LABEL[f.kind]}</b> {f.label}
            </span>
          ))}
        </div>
      </section>
      {p.conflicts.length > 0 && (
        <section className="conflicts">
          <h3>Conflicts between sources</h3>
          <ul>
            {p.conflicts.map((c, i) => (
              <li key={i}>
                {c.description} <SourceTags sources={c.sources} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3>Options for the tumor board</h3>
        {p.candidate_options.map((o, i) => (
          <div className="option" key={i}>
            <h4>{o.option}</h4>
            <div className="cols">
              <div>
                <span className="label patient">From this patient's record</span>
                <ul>{o.patient_facts.map((x, j) => <Fact key={j} item={x} />)}</ul>
              </div>
              <div>
                <span className="label guideline">From the Oncology Care Guidelines</span>
                <ul>{o.guideline_facts.map((x, j) => <Fact key={j} item={x} />)}</ul>
              </div>
            </div>
            <p className="inference">
              <span className="label inference-l">Model inference</span> {o.model_inference}
            </p>
            {o.cautions.length > 0 && <p className="cautions">Cautions: {o.cautions.join(" ")}</p>}
          </div>
        ))}
      </section>
      <details>
        <summary>Full detail: snapshot, disease, history, missing information, sources, verifier</summary>
        <section>
          <h3>Snapshot</h3>
          <p>{p.patient_snapshot}</p>
        </section>
        <section>
          <h3>Disease</h3>
          <ul>
            {[d.histology, d.stage, d.er_pr_her2, d.other_markers].map((x, i) => (
              <Fact key={i} item={x} />
            ))}
          </ul>
        </section>
        <section>
          <h3>Relevant history</h3>
          <ul>
            {p.clinically_relevant_history.map((x, i) => (
              <Fact key={i} item={x} />
            ))}
          </ul>
        </section>
        {p.contraindication_candidates.length > 0 && (
          <section>
            <h3>Possible contraindications</h3>
            <ul>
              {p.contraindication_candidates.map((x, i) => (
                <Fact key={i} item={x} />
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3>Missing information</h3>
          <ul>{p.missing_information.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </section>
        <section>
          <h3>Sources used</h3>
          <ul className="sources">
            {p.evidence_reviewed.map((e, i) => (
              <li key={i} className={e.used ? "" : "excluded"}>
                {e.title}, version {e.version} {e.used ? "" : "(not used)"}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Verifier</h3>
          <p>{p.verifier_summary}</p>
        </section>
      </details>
    </div>
  );
}

const TIMELINE = [
  ["Aug 12", "Mammogram and ultrasound"],
  ["Aug 18", "Core biopsy"],
  ["Sep 9", "Lumpectomy and sentinel node biopsy"],
  ["Sep 14", "Pathology report"],
  ["Sep 21", "Staging CT"],
  ["Sep 28", "Genomic assay"],
  ["Oct 5", "Navigator note"],
];

function CaseBanner() {
  return (
    <div className="banner">
      <div className="banner-main">
        <div>
          <b>Synthetic Patient A</b> <span className="muted">Case 001</span>
        </div>
        <div className="banner-facts">
          59 F, postmenopausal &nbsp;|&nbsp; Right breast, invasive ductal, grade 2, 1.9 cm &nbsp;|&nbsp; pT1c pN0 (sn)
          &nbsp;|&nbsp; ER 95%, PR 70%, HER2 1+ (negative) &nbsp;|&nbsp; Recurrence score 22
        </div>
      </div>
      <ol className="timeline">
        {TIMELINE.map(([d, e]) => (
          <li key={d}>
            <span className="dot" />
            <b>{d}</b>
            <span>{e}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function App({ onSignOut }: { onSignOut?: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [runId, setRunId] = useState("");
  const [question, setQuestion] = useState(QUESTION);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState({ seconds: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
  const [traceUrl, setTraceUrl] = useState("");
  const [audit, setAudit] = useState<{ at: string; event: string; reviewer?: string; feedback?: string }[]>([]);
  const feedEnd = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [qa, setQa] = useState<{ q: string; a: string }[]>([]);
  const [followQ, setFollowQ] = useState("");
  const [asking, setAsking] = useState(false);
  const lastDecision = useRef<"approve" | "request_changes" | null>(null);

  useEffect(() => {
    if (status !== "running" && status !== "saving") return;
    const t0 = Date.now() - elapsed * 1000;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events]);

  useEffect(() => {
    if (!runId || (status !== "review" && status !== "done")) return;
    void (async () => {
      try {
        for await (const e of invoke({ action: "audit", runId })) if (e.type === "audit") setAudit(e.entries);
      } catch {
        /* the audit panel is optional */
      }
    })();
  }, [status, runId]);

  const verifier = useMemo(() => {
    const r = [...events].reverse().find((e) => e.type === "tool_result" && e.tool === "verify_draft");
    if (!r || r.type !== "tool_result") return null;
    try {
      return JSON.parse(r.preview) as { findings: { claim: string; issue: string; detail: string }[] };
    } catch {
      return null;
    }
  }, [events]);

  async function consume(body: Record<string, unknown>) {
    try {
      for await (const e of invoke(body)) {
        setEvents((prev) => [...prev, e]);
        if (e.type === "trace") setTraceUrl(e.url);
        if (e.type === "stats")
          setStats((s0) => ({
            seconds: s0.seconds + e.seconds,
            inputTokens: s0.inputTokens + e.inputTokens,
            outputTokens: s0.outputTokens + e.outputTokens,
            costUsd: s0.costUsd + e.costUsd,
          }));
        if (e.type === "interruption") {
          setPacket(e.packet);
          setRunId(e.runId);
          setStatus("review");
        } else if (e.type === "final") {
          if (lastDecision.current === "request_changes") {
            setMessage("The revision did not come back with a new packet. Try sending the change request again.");
            setStatus("error");
          } else {
            setMessage(e.message);
            setStatus("done");
          }
        } else if (e.type === "error") {
          setMessage(e.message);
          setStatus("error");
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function start() {
    setEvents([]);
    setPacket(null);
    setMessage("");
    setElapsed(0);
    setStats({ seconds: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    setTraceUrl("");
    setAudit([]);
    setQa([]);
    lastDecision.current = null;
    setStatus("running");
    void consume({ action: "start", question, caseId: "case-001" });
  }

  function decide(decision: "approve" | "request_changes") {
    lastDecision.current = decision;
    setStatus(decision === "approve" ? "saving" : "running");
    if (decision === "request_changes") setPacket(null);
    void consume({ action: "decide", runId, decision, feedback: decision === "approve" ? undefined : feedback });
    setFeedback("");
  }

  async function ask(q: string) {
    if (!packet || !q.trim() || asking) return;
    setAsking(true);
    setFollowQ("");
    let answered = false;
    try {
      for await (const e of invoke({ action: "ask", runId, question: q, packet, history: qa })) {
        if (e.type === "tool_call") setEvents((prev) => [...prev, e]);
        if (e.type === "trace") setTraceUrl(e.url);
        if (e.type === "stats")
          setStats((s0) => ({
            seconds: s0.seconds + e.seconds,
            inputTokens: s0.inputTokens + e.inputTokens,
            outputTokens: s0.outputTokens + e.outputTokens,
            costUsd: s0.costUsd + e.costUsd,
          }));
        if (e.type === "answer") {
          answered = true;
          setQa((prev) => [...prev, { q, a: e.text }]);
        }
        if (e.type === "error") {
          answered = true;
          setQa((prev) => [...prev, { q, a: `Could not answer: ${e.message}` }]);
        }
      }
      if (!answered) setQa((prev) => [...prev, { q, a: "No answer came back. Try asking again." }]);
    } catch (err) {
      setQa((prev) => [...prev, { q, a: `Could not answer: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setAsking(false);
    }
  }

  function reset() {
    setEvents([]);
    setPacket(null);
    setMessage("");
    setElapsed(0);
    setStats({ seconds: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    setTraceUrl("");
    setAudit([]);
    setRunId("");
    setQa([]);
    setStatus("idle");
  }

  const feed = events.filter((e) => e.type === "tool_call" || (e.type === "tool_result" && SHOW_RESULT.has(e.tool)));

  return (
    <SourceCtx.Provider value={(tag) => setDoc(resolveSource(tag))}>
    <div className="app">
      <header>
        <div>
          <h1>Tumor board case prep</h1>
          <p className="sub">Synthetic data only. Prepares options and evidence for a clinician to review. It does not decide treatment.</p>
        </div>
        <div className="head-actions">
          <button className="ghost" onClick={reset} disabled={status === "running" || status === "saving"}>
            Reset demo
          </button>
          {onSignOut && (
            <button className="ghost" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <CaseBanner />

      <main>
        <aside className="panel">
          <h2>Case 001</h2>
          <p className="muted">Synthetic patient, right breast, after lumpectomy. Click any record to read it:</p>
          <ul className="records">
            {RECORDS.map(([name, date, key]) => (
              <li key={name}>
                <button className="rec" onClick={() => setDoc(resolveSource(key))}>
                  {name}
                </button>
                <span className="muted">{date}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Oncology Care Guidelines the evidence specialist searches:</p>
          <ul className="records">
            {GUIDELINE_DOCS.map(([name, date, key]) => (
              <li key={key}>
                <button className="rec" onClick={() => setDoc(resolveSource(key))}>
                  {name}
                </button>
                <span className="muted">{date}</span>
              </li>
            ))}
          </ul>
          <label htmlFor="q">Request from the oncologist</label>
          <textarea id="q" rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={status !== "idle"} />
          <button className="primary" onClick={start} disabled={status !== "idle"}>
            Prepare case
          </button>
          {(status === "running" || status === "saving") && <p className="timer">Working, {clock(elapsed)}</p>}
          {stats.inputTokens > 0 && (
            <div className="stats">
              <h3>This run</h3>
              <p>
                {clock(stats.seconds)} of agent work
                <br />
                {Math.round(stats.inputTokens / 1000)}k tokens in, {Math.round(stats.outputTokens / 1000)}k out
                <br />
                About ${stats.costUsd.toFixed(2)} at list prices
              </p>
              {traceUrl && (
                <a href={traceUrl} target="_blank" rel="noreferrer">
                  View the trace in OpenAI
                </a>
              )}
            </div>
          )}
        </aside>

        <section className="panel feedpanel">
          <h2>What the agents are doing</h2>
          {feed.length === 0 && <p className="muted">Nothing yet. Start a run to see each specialist and tool call.</p>}
          <ol className="feed">
            {feed.map((e, i) =>
              e.type === "tool_call" ? (
                <li key={i} className="call">
                  <span className="agent">{AGENT_LABEL[e.agent] ?? e.agent}</span>
                  <span className="tool">{toolName(e.tool)}</span>
                </li>
              ) : e.type === "tool_result" ? (
                <li key={i} className="result">
                  {e.preview.slice(0, 110)}
                </li>
              ) : null,
            )}
          </ol>
          <div ref={feedEnd} />
          {verifier && (
            <div className="verifier">
              <h3>Verifier findings</h3>
              {verifier.findings.length === 0 ? (
                <p className="muted">No issues found.</p>
              ) : (
                <ul>
                  {verifier.findings.map((f, i) => (
                    <li key={i}>
                      <b>{f.issue.replace(/_/g, " ")}</b>: {f.claim}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="panel packetpanel">
          <div className="panel-head">
            <h2>Evidence packet</h2>
            {packet && (
              <button
                className="ghost"
                onClick={() => {
                  document.querySelectorAll("details").forEach((d) => (d.open = true));
                  window.print();
                }}
              >
                Print board brief
              </button>
            )}
          </div>
          {!packet && status !== "done" && <p className="muted">The packet appears here when the verifier has checked it.</p>}
          {packet && <PacketView p={packet} />}
          {packet && (status === "review" || status === "done") && (
            <div className="followup">
              <h3>Ask a follow-up question</h3>
              {qa.map((x, i) => (
                <div key={i} className="qa">
                  <p className="q">{x.q}</p>
                  <p className="a">{x.a.replace(/\*\*/g, "")}</p>
                </div>
              ))}
              {asking && <p className="muted">Looking it up in the record and the Oncology Care Guidelines...</p>}
              <div className="suggest">
                {[
                  "What do the Oncology Care Guidelines say about extending endocrine therapy?",
                  "Is the prior DVT a hard contraindication to tamoxifen?",
                  "What would change if the tumor were HER2-positive?",
                ].map((q) => (
                  <button key={q} className="chip-btn" disabled={asking} onClick={() => void ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="askrow">
                <input
                  value={followQ}
                  onChange={(e) => setFollowQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void ask(followQ)}
                  placeholder="Ask about this case"
                  disabled={asking}
                />
                <button className="secondary" disabled={asking || !followQ.trim()} onClick={() => void ask(followQ)}>
                  Ask
                </button>
              </div>
              <p className="muted">Answers use the packet, the record and the Oncology Care Guidelines. They do not change the packet.</p>
            </div>
          )}
          {status === "review" && (
            <div className="decision">
              <p>
                <b>Clinician review.</b> Nothing is saved until you approve.
              </p>
              <button className="primary" onClick={() => decide("approve")}>
                Approve and save draft note
              </button>
              <label htmlFor="fb">Or request changes</label>
              <textarea id="fb" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="For example: add the bone density plan to the aromatase inhibitor option" />
              <button className="secondary" disabled={!feedback.trim()} onClick={() => decide("request_changes")}>
                Send back for changes
              </button>
            </div>
          )}
          {status === "done" && (
            <div className="done">
              <b>Approved.</b> {message.replace(/\*\*/g, "")}
            </div>
          )}
          {audit.length > 0 && (
            <div className="audit">
              <h3>Audit trail</h3>
              <ul>
                {audit.map((a, i) => (
                  <li key={i}>
                    <span className="muted">{new Date(a.at).toLocaleTimeString()}</span> {a.event.replace(/_/g, " ")}
                    {a.reviewer ? ` by ${a.reviewer}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status === "error" && <div className="error">Something went wrong: {message}</div>}
        </section>
      </main>
      {doc && (
        <aside className="drawer" role="dialog" aria-label="Source text">
          <div className="drawer-head">
            <b>{doc.title}</b>
            <button className="ghost" onClick={() => setDoc(null)}>
              Close
            </button>
          </div>
          <pre>{doc.text}</pre>
        </aside>
      )}
    </div>
    </SourceCtx.Provider>
  );
}

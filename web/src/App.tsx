import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "./api";
import { CASES, GUIDELINES, caseFile, type CaseMeta, type GuidelineDoc } from "./cases";
import { maskCode, maskText, type Identifiers } from "./mask";
import type { DemoEvent, Packet, Sourced } from "./types";

type Status = "idle" | "running" | "review" | "saving" | "done" | "error";

const QUESTION = "Prepare this case for tumor board. What should we discuss?";

const AGENT_LABEL: Record<string, string> = {
  "Case coordinator": "Coordinator",
  "Patient data specialist": "Patient data",
  "Clinical history specialist": "History",
  "Evidence specialist": "Evidence",
  "Similar cases specialist": "Similar cases",
  Verifier: "Verifier",
};

const TOOL_LABEL: Record<string, string> = {
  consult_patient_data: "asks the patient data specialist",
  consult_clinical_history: "asks the history specialist",
  consult_evidence: "asks the evidence specialist",
  consult_similar_cases: "asks the similar cases specialist",
  find_similar_cases: "searches past tumor board cases",
  verify_draft: "sends the draft to the verifier",
  file_search_call: "searches the Oncology Care Guidelines",
  search_pubmed: "searches PubMed",
  search_clinical_trials: "searches ClinicalTrials.gov",
};
const SHOW_RESULT = new Set(["search_pubmed", "search_clinical_trials", "consult_patient_data", "consult_clinical_history", "consult_evidence", "consult_similar_cases"]);
const toolName = (t: string) => TOOL_LABEL[t] ?? `reads ${t.replace(/^get_/, "").replace(/_/g, " ")}`;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const ICONS: Record<string, string[]> = {
  chevron: ["m6 9 6 6 6-6"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  file: ["M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  shield: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  printer: ["M6 9V2h12v7", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 14h12v8H6z"],
  chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  check: ["M20 6 9 17l-5-5"],
};
function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const AGENT_COLOR: Record<string, string> = {
  "Case coordinator": "#534AB7",
  "Patient data specialist": "#1F5FBF",
  "Clinical history specialist": "#0F7A5C",
  "Evidence specialist": "#B4690E",
  "Similar cases specialist": "#9A4FB0",
  Verifier: "#B3382C",
};

type Doc = { title: string; text: string; mask?: Identifiers };
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

const guidelineDoc = (g: GuidelineDoc): Doc => ({
  title: `${g.title}, version ${g.version}${g.status === "superseded" ? " (superseded)" : ""}`,
  text: g.text,
});

function guidelinesFor(site: CaseMeta["site"]) {
  return GUIDELINES.filter((g) => g.site === site).sort((a, b) => (a.status === "current" ? -1 : 1) - (b.status === "current" ? -1 : 1));
}

function resolveSource(tag: string, c: CaseMeta): Doc {
  const t = tag.toLowerCase();
  if (/guideline|checklist|\bv20\d\d|\b20\d\d\.\d\b/.test(t)) {
    const own = guidelinesFor(c.site);
    const named = GUIDELINES.find((g) => t.includes(g.version) && (g.site === c.site || (/lung|nsclc/.test(t) && g.site === "Lung") || (/colon/.test(t) && g.site === "Colon")));
    const checklist = /checklist/.test(t) ? own.find((g) => /checklist/.test(g.file)) : undefined;
    return guidelineDoc(checklist ?? named ?? own.find((g) => g.status === "current" && !/checklist/.test(g.file)) ?? own[0]);
  }
  const rules: [string, RegExp][] = [
    ["pathology_report.txt", /patholog|biops/],
    ["radiology_report.txt", /radiolog|imaging|ultrasound|mammo|\bmri\b|\bct\b|\bpet/],
    ["genomics_report.txt", /genom|assay|recurrence|oncotype|21-gene/],
    ["molecular_report.txt", /molecular|sequenc|ngs|mutation/],
    ["labs_report.txt", /\blabs?\b|laborator|cea|hba1c|creatinine|dpyd/],
    ["clinic_note.txt", /clinic|intake|navigator|note/],
  ];
  for (const [file, re] of rules) {
    const d = c.documents.find((x) => x.file === file);
    if (d && re.test(t)) return { title: `${d.title}, ${d.date}`, text: caseFile(c.id, file), mask: c.identifiers };
  }
  return { title: "Patient record: problem list, medications, allergies, observations", text: formatPatient(caseFile(c.id, "patient.json")), mask: c.identifiers };
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
      <section className="similar">
        <h3>
          Similar past cases <span className="muted">(synthetic registry)</span>
        </h3>
        <p>{p.similar_cases.summary}</p>
        <ul>
          {p.similar_cases.decisions.map((x, i) => (
            <li key={i}>
              {x.decision} <b>{x.count}</b>
            </li>
          ))}
        </ul>
        <p className="cautions">{p.similar_cases.caution}</p>
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
            {[d.histology, d.stage, d.biomarkers, d.other_markers].map((x, i) => (
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

function CaseBanner({ c, onReset, canReset }: { c: CaseMeta; onReset: () => void; canReset: boolean }) {
  const initials = c.identifiers.name.split(" ").map((p) => p[0]).join("");
  return (
    <section className="banner card">
      <div className="banner-top">
        <div className="avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="banner-id">
          <div className="banner-name">
            {c.identifiers.name} <span className="site-pill">{c.site}</span>
          </div>
          <div className="muted">
            {c.id.replace("case-", "Case ")} | MRN {c.identifiers.mrn}
          </div>
        </div>
        <span className="mask-badge" title="Names, record numbers and birth dates are replaced with a code before the agents see the record">
          <Icon name="shield" size={13} /> Agents see {maskCode(c.identifiers)}
        </span>
        <button className="btn ghost small-btn" onClick={onReset} disabled={!canReset}>
          Reset case
        </button>
      </div>
      <div className="banner-facts">{c.banner.replace(/ \| /g, "   |   ")}</div>
      <ol className="timeline">
        {c.timeline.map(([d, e]) => (
          <li key={d + e}>
            <span className="dot" />
            <b>{d}</b>
            <span>{e}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CaseWorkspace({ meta, active, onStatus }: { meta: CaseMeta; active: boolean; onStatus: (s: Status) => void }) {
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
  const feedBox = useRef<HTMLDivElement>(null);
  const chatBox = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"ask" | "activity">("activity");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [showMasked, setShowMasked] = useState(false);
  useEffect(() => onStatus(status), [status]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (feedBox.current) feedBox.current.scrollTop = feedBox.current.scrollHeight;
  }, [events, tab]);

  useEffect(() => {
    if (chatBox.current) chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [qa, asking, tab]);

  useEffect(() => {
    if (status === "running") setTab("activity");
    if (status === "review") setTab("ask");
  }, [status]);

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
    void consume({ action: "start", question, caseId: meta.id });
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

  const recs: [string, string, string][] = [
    ...meta.documents.map((d) => [d.title.replace(/^Synthetic /, "").replace(/^./, (m) => m.toUpperCase()), d.date, d.title] as [string, string, string]),
    ["Problem list, medications, allergies", "current", "patient record"],
  ];
  const canAsk = !!packet && (status === "review" || status === "done");

  return (
    <SourceCtx.Provider value={(tag) => { setShowMasked(false); setDoc(resolveSource(tag, meta)); }}>
    <div className="workspace" style={{ display: active ? "block" : "none" }}>
      <CaseBanner c={meta} onReset={reset} canReset={status !== "running" && status !== "saving"} />

      <main className="grid">
        <aside className="col-left">
          <section className="card">
            <h2 className="card-title">
              <Icon name="file" /> Case records
            </h2>
            <ul className="records">
              {recs.map(([name, date, key]) => (
                <li key={name}>
                  <button className="rec" onClick={() => { setShowMasked(false); setDoc(resolveSource(key, meta)); }}>
                    {name}
                  </button>
                  <span className="muted">{date}</span>
                </li>
              ))}
            </ul>
            <h3 className="sub-title">Oncology Care Guidelines</h3>
            <ul className="records">
              {guidelinesFor(meta.site).map((g) => (
                <li key={g.file}>
                  <button className="rec" onClick={() => { setShowMasked(false); setDoc(guidelineDoc(g)); }}>
                    {g.title.replace("Oncology Care Guidelines, ", "").replace(/^./, (m) => m.toUpperCase())}
                  </button>
                  <span className={g.status === "superseded" ? "tag-old" : "muted"}>
                    v{g.version}{g.status === "superseded" ? " superseded" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="card-title">Request</h2>
            <textarea id="q" rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={status !== "idle"} aria-label="Request from the oncologist" />
            <button className="btn primary full" onClick={start} disabled={status !== "idle"}>
              Prepare brief
            </button>
            {(status === "running" || status === "saving") && (
              <div className="progress" aria-live="polite">
                <div className="bar" />
                <span>Agents working, {clock(elapsed)}</span>
              </div>
            )}
          </section>
        </aside>

        <section className="col-center card brief">
          <header className="card-head">
            <h2 className="card-title">Case brief</h2>
            <span className={`status ${status}`}>{STATUS_LABEL[status]}</span>
            <span className="spacer" />
            {packet && (
              <button
                className="btn ghost small-btn"
                onClick={() => {
                  document.querySelectorAll("details").forEach((d) => (d.open = true));
                  window.print();
                }}
              >
                <Icon name="printer" size={14} /> Print board brief
              </button>
            )}
          </header>
          <div className="brief-body">
            {!packet && status !== "error" && (
              <div className="empty">
                <h3>{status === "running" ? "Preparing the brief" : "No brief yet"}</h3>
                <p>
                  {status === "running"
                    ? "The agents are reading the record and guidelines. The brief appears here after the verifier has checked it."
                    : "Select Prepare brief. The agents read the masked record, the Oncology Care Guidelines and past cases, then a verifier checks the draft."}
                </p>
              </div>
            )}
            {packet && <PacketView p={packet} />}
            {status === "done" && (
              <div className="done">
                <Icon name="check" size={16} /> <b>Approved.</b> {message.replace(/\*\*/g, "")}
              </div>
            )}
            {status === "error" && <div className="error">Something went wrong: {message}</div>}
          </div>
          {status === "review" && (
            <div className="decision">
              <div className="decision-text">
                <b>Clinician review.</b> Nothing is saved until you approve.
              </div>
              <div className="decision-row">
                <textarea id="fb" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} aria-label="Request changes" placeholder="Request changes, for example: add the safety checks to do before starting the first option" />
                <div className="decision-buttons">
                  <button className="btn ok" onClick={() => decide("approve")}>
                    <Icon name="check" size={15} /> Approve and save
                  </button>
                  <button className="btn outline" disabled={!feedback.trim()} onClick={() => decide("request_changes")}>
                    Send back for changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="col-right card assistant">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "ask"} className={tab === "ask" ? "tab on" : "tab"} onClick={() => setTab("ask")}>
              <Icon name="chat" size={15} /> Ask about this case
              {qa.length > 0 && <span className="count">{qa.length}</span>}
            </button>
            <button role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "tab on" : "tab"} onClick={() => setTab("activity")}>
              <Icon name="activity" size={15} /> Agent activity
              {feed.length > 0 && <span className="count">{feed.length}</span>}
            </button>
          </div>

          {tab === "ask" ? (
            <div className="chat">
              <div className="chat-log" ref={chatBox}>
                {qa.length === 0 && !asking && (
                  <div className="empty small">
                    <h3>{canAsk ? "Ask a follow-up" : "Available once the brief is ready"}</h3>
                    <p>
                      {canAsk
                        ? "Answers come from the brief, the record and the Oncology Care Guidelines, with sources. They never change the brief."
                        : "Prepare the brief first. Then ask about the options, safety checks or what would change under different assumptions."}
                    </p>
                  </div>
                )}
                {qa.map((x, i) => (
                  <div key={i}>
                    <div className="msg user">{x.q}</div>
                    <div className="msg bot">
                      <span className="who">Case assistant</span>
                      {x.a.replace(/\*\*/g, "")}
                    </div>
                  </div>
                ))}
                {asking && (
                  <div className="msg bot">
                    <span className="who">Case assistant</span>
                    <span className="typing">
                      <i /> <i /> <i />
                    </span>{" "}
                    Looking it up in the record and the guidelines
                  </div>
                )}
              </div>
              <div className="suggest">
                {meta.followUps.map((q) => (
                  <button key={q} className="chip-btn" disabled={!canAsk || asking} onClick={() => void ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="composer">
                <textarea
                  rows={2}
                  value={followQ}
                  onChange={(e) => setFollowQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void ask(followQ);
                    }
                  }}
                  placeholder={canAsk ? "Ask about this case" : "Prepare the brief to start asking"}
                  disabled={!canAsk || asking}
                  aria-label="Ask about this case"
                />
                <button className="send" aria-label="Send question" disabled={!canAsk || asking || !followQ.trim()} onClick={() => void ask(followQ)}>
                  <Icon name="send" size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="activity">
              {stats.inputTokens > 0 && (
                <div className="kpis">
                  <div>
                    <b>{clock(stats.seconds)}</b>
                    <span>agent time</span>
                  </div>
                  <div>
                    <b>
                      {Math.round(stats.inputTokens / 1000)}k / {Math.round(stats.outputTokens / 1000)}k
                    </b>
                    <span>tokens in / out</span>
                  </div>
                  <div>
                    <b>${stats.costUsd.toFixed(2)}</b>
                    <span>at list prices</span>
                  </div>
                </div>
              )}
              {traceUrl && (
                <a className="trace" href={traceUrl} target="_blank" rel="noreferrer">
                  View the trace in OpenAI
                </a>
              )}
              <div className="feed-box" ref={feedBox}>
                {feed.length === 0 && <p className="muted">Nothing yet. Prepare the brief to see each agent and tool call.</p>}
                <ol className="feed">
                  {feed.map((e, i) =>
                    e.type === "tool_call" ? (
                      <li key={i} className="call">
                        <span className="agent" style={{ color: AGENT_COLOR[e.agent] }}>
                          <i style={{ background: AGENT_COLOR[e.agent] }} />
                          {AGENT_LABEL[e.agent] ?? e.agent}
                        </span>
                        <span className="tool">{toolName(e.tool)}</span>
                      </li>
                    ) : e.type === "tool_result" ? (
                      <li key={i} className="result">
                        {e.preview.slice(0, 110)}
                      </li>
                    ) : null,
                  )}
                </ol>
              </div>
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
            </div>
          )}
        </aside>
      </main>
      {doc && (
        <aside className="drawer" role="dialog" aria-label="Source text">
          <div className="drawer-head">
            <b>{doc.title}</b>
            <button className="btn ghost small-btn" onClick={() => setDoc(null)}>
              Close
            </button>
          </div>
          {doc.mask && (
            <div className="maskbar">
              <button className={showMasked ? "btn ghost small-btn" : "btn ghost small-btn on"} onClick={() => setShowMasked(false)}>
                Original
              </button>
              <button className={showMasked ? "btn ghost small-btn on" : "btn ghost small-btn"} onClick={() => setShowMasked(true)}>
                What the agents see
              </button>
            </div>
          )}
          <pre>{doc.mask && showMasked ? maskText(doc.text, doc.mask) : doc.text}</pre>
        </aside>
      )}
    </div>
    </SourceCtx.Provider>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "Not prepared",
  running: "Preparing",
  review: "Ready for review",
  saving: "Saving",
  done: "Approved",
  error: "Needs attention",
};

function CaseSelect({ selected, statuses, onSelect }: { selected: string; statuses: Record<string, Status>; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  const idx = CASES.findIndex((c) => c.id === selected);
  const cur = CASES[idx];
  const st = statuses[cur.id] ?? "idle";
  return (
    <div className="select" ref={ref}>
      <span className="select-label">Tumor board agenda, case {idx + 1} of {CASES.length}</span>
      <button className="select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="site-pill">{cur.site}</span>
        <b>{cur.title}</b>
        <span className={`status ${st}`}>{STATUS_LABEL[st]}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <ul className="select-menu" role="listbox">
          {CASES.map((c, i) => {
            const s2 = statuses[c.id] ?? "idle";
            return (
              <li key={c.id} role="option" aria-selected={c.id === selected}>
                <button
                  className={c.id === selected ? "opt on" : "opt"}
                  onClick={() => {
                    onSelect(c.id);
                    setOpen(false);
                  }}
                >
                  <span className="opt-num">{i + 1}</span>
                  <span className="opt-main">
                    <b>{c.title}</b>
                    <span className="muted">
                      {c.identifiers.name} | {c.site}
                    </span>
                  </span>
                  <span className={`status ${s2}`}>{STATUS_LABEL[s2]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function App({ onSignOut }: { onSignOut?: () => void }) {
  const [selected, setSelected] = useState(CASES[0].id);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <div className="brand-name">Tumor Board Case Prep</div>
            <div className="brand-sub">Synthetic data only</div>
          </div>
        </div>
        <CaseSelect selected={selected} statuses={statuses} onSelect={setSelected} />
        <div className="topbar-right">
          {onSignOut && (
            <button className="btn topbar-btn" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </header>
      <div className="notice">Prepares options and evidence for a clinician to review. It does not decide treatment.</div>

      <div className="content">
        {CASES.map((c) => (
          <CaseWorkspace key={c.id} meta={c} active={c.id === selected} onStatus={(st) => setStatuses((prev) => (prev[c.id] === st ? prev : { ...prev, [c.id]: st }))} />
        ))}
      </div>
    </div>
  );
}

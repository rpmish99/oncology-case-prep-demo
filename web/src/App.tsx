import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "./api";
import type { DemoEvent, Packet, Sourced } from "./types";

type Status = "idle" | "running" | "review" | "saving" | "done" | "error";

const QUESTION = "Prepare this case for tumor board. What endocrine and supportive-care options should we discuss?";

const RECORDS = [
  ["Pathology report", "2026-09-14"],
  ["Radiology reports", "2026-08-12, 2026-09-21"],
  ["Genomic assay", "2026-09-28"],
  ["Navigator clinic note", "2026-10-05"],
  ["Problem list, medications, allergies", "current"],
];

const AGENT_LABEL: Record<string, string> = {
  "Treatment planning manager": "Manager",
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
  file_search_call: "searches the pathway documents",
  search_pubmed: "searches PubMed",
  search_clinical_trials: "searches ClinicalTrials.gov",
};
const SHOW_RESULT = new Set(["search_pubmed", "search_clinical_trials", "consult_patient_data", "consult_clinical_history", "consult_evidence"]);
const toolName = (t: string) => TOOL_LABEL[t] ?? `reads ${t.replace(/^get_/, "").replace(/_/g, " ")}`;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function SourceTags({ sources }: { sources: string[] }) {
  return (
    <span className="tags">
      {sources.map((s) => (
        <span key={s} className="tag">
          {s}
        </span>
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

function PacketView({ p }: { p: Packet }) {
  const d = p.disease_characterization;
  return (
    <div className="packet">
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
        <h3>Relevant history</h3>
        <ul>
          {p.clinically_relevant_history.map((x, i) => (
            <Fact key={i} item={x} />
          ))}
        </ul>
      </section>
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
                <span className="label guideline">From the pathway documents</span>
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
  const feedEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "running" && status !== "saving") return;
    const t0 = Date.now() - elapsed * 1000;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events]);

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
        if (e.type === "interruption") {
          setPacket(e.packet);
          setRunId(e.runId);
          setStatus("review");
        } else if (e.type === "final") {
          setMessage(e.message);
          setStatus("done");
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
    setStatus("running");
    void consume({ action: "start", question, caseId: "case-001" });
  }

  function decide(decision: "approve" | "request_changes") {
    setStatus(decision === "approve" ? "saving" : "running");
    if (decision === "request_changes") setPacket(null);
    void consume({ action: "decide", runId, decision, feedback: decision === "approve" ? undefined : feedback });
    setFeedback("");
  }

  function reset() {
    setEvents([]);
    setPacket(null);
    setMessage("");
    setElapsed(0);
    setStatus("idle");
  }

  const feed = events.filter((e) => e.type === "tool_call" || (e.type === "tool_result" && SHOW_RESULT.has(e.tool)));

  return (
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

      <main>
        <aside className="panel">
          <h2>Case 001</h2>
          <p className="muted">Synthetic patient, right breast, after lumpectomy. Records the agents can read:</p>
          <ul className="records">
            {RECORDS.map(([name, date]) => (
              <li key={name}>
                <span>{name}</span>
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
          <h2>Evidence packet</h2>
          {!packet && status !== "done" && <p className="muted">The packet appears here when the verifier has checked it.</p>}
          {packet && <PacketView p={packet} />}
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
          {status === "error" && <div className="error">Something went wrong: {message}</div>}
        </section>
      </main>
    </div>
  );
}

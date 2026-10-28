import "./bootstrap.js";
import express from "express";
import { decide, startRun } from "./runner.js";
import type { DemoEvent } from "./events.js";

/**
 * HTTP contract used by the container runtime: GET /ping and POST /invocations on port 8080.
 * Responses stream newline-delimited server-sent events.
 */
const app = express();
app.use(express.json({ limit: "1mb" }));

// Browsers call the runtime directly, and the local dev server from another port.
app.use((req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization,content-type,x-amzn-bedrock-agentcore-runtime-session-id");
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});

app.get("/ping", (_req, res) => void res.json({ status: "Healthy" }));

app.post("/invocations", async (req, res) => {
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  const send = (e: DemoEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  try {
    const { action, question, caseId = "case-001", runId, decision, feedback, reviewer = "demo-oncologist" } = req.body ?? {};
    if (action === "start") await startRun(question ?? "Prepare this case for tumor board.", caseId, send);
    else if (action === "decide") await decide(runId, decision, feedback, reviewer, send);
    else send({ type: "error", message: "Unknown action" });
  } catch (err) {
    send({ type: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`agent listening on :${port}`));

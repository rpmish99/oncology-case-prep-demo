import { randomUUID } from "node:crypto";
import { RunState, Runner } from "@openai/agents";
import { buildAgents, buildQaAgent, createEhrServer } from "./agents.js";
import { emit, preview, type DemoEvent, withEmitter } from "./events.js";
import { audit, loadRunState, saveRunState } from "./store.js";
import { usageFor } from "./usage.js";

const MAX_TURNS = 30;

async function drive(
  coordinator: ReturnType<typeof buildAgents>,
  input: string | RunState<any, any>,
  runId: string,
  expectSubmission = true,
  retried = false,
) {
  const traceId = `trace_${randomUUID().replace(/-/g, "")}`;
  const t0 = Date.now();
  const runner = new Runner({ traceId, groupId: runId, workflowName: "Tumor board case prep" });
  const stream = await runner.run(coordinator, input, { stream: true, maxTurns: MAX_TURNS });
  emit({ type: "agent_started", agent: coordinator.name });
  emit({ type: "trace", traceId, url: `https://platform.openai.com/traces/trace?trace_id=${traceId}` });

  for await (const event of stream) {
    if (event.type !== "run_item_stream_event") continue;
    const raw: any = event.item.rawItem ?? {};
    if (event.name === "tool_called" && raw.name !== "submit_for_clinician_review") {
      emit({ type: "tool_call", agent: coordinator.name, tool: raw.name ?? "tool", args: raw.arguments });
    }
    if (event.name === "tool_output") {
      emit({
        type: "tool_result",
        agent: coordinator.name,
        tool: raw.name ?? "tool",
        preview: preview((event.item as any).output, raw.name === "verify_draft" ? 8000 : 160),
      });
    }
  }
  await stream.completed;
  const u = usageFor(traceId);
  emit({
    type: "stats",
    seconds: Math.round((Date.now() - t0) / 1000),
    inputTokens: u.input,
    outputTokens: u.output,
    costUsd: Number(u.costUsd.toFixed(4)),
  });

  if (stream.interruptions?.length) {
    const pending = stream.interruptions[0];
    await saveRunState(runId, stream.state.toString());
    const packet = JSON.parse(String((pending.rawItem as any).arguments ?? "{}"));
    await audit({ runId, event: "awaiting_clinician", tool: pending.toolName });
    emit({ type: "interruption", runId, tool: pending.toolName ?? "", packet });
    return;
  }
  // The model sometimes answers in text without calling the submit step. Ask once for the submission.
  if (expectSubmission && !retried) {
    const nudge = {
      role: "user" as const,
      content:
        "You finished without submitting the packet. Call submit_for_clinician_review now with the final, verified packet. Do not reply with text only.",
    };
    await drive(coordinator, [...stream.history, nudge] as any, runId, true, true);
    return;
  }
  emit({ type: "final", runId, message: String(stream.finalOutput ?? "") });
}

export async function startRun(question: string, caseId: string, onEvent: (e: DemoEvent) => void) {
  const runId = `run-${randomUUID().slice(0, 8)}`;
  await withEmitter(onEvent, async () => {
    const ehr = createEhrServer();
    await ehr.connect();
    try {
      const coordinator = buildAgents(ehr, process.env.VECTOR_STORE_ID!);
      await audit({ runId, event: "started", caseId, question });
      await drive(coordinator, `Case ${caseId}. Oncologist request: ${question}`, runId);
    } finally {
      await ehr.close();
    }
  });
  return runId;
}

export async function decide(
  runId: string,
  decision: "approve" | "request_changes",
  feedback: string | undefined,
  reviewer: string,
  onEvent: (e: DemoEvent) => void,
) {
  await withEmitter(onEvent, async () => {
    const ehr = createEhrServer();
    await ehr.connect();
    try {
      const coordinator = buildAgents(ehr, process.env.VECTOR_STORE_ID!);
      const state = await RunState.fromString(coordinator, await loadRunState(runId));
      const pending = state.getInterruptions()[0];
      if (decision === "approve") {
        state.approve(pending);
        await audit({ runId, event: "approved", reviewer });
        onEvent({ type: "approved", runId, noteId: "pending" });
      } else {
        state.reject(pending, {
          message:
            `The clinician asked for changes: ${feedback ?? "please revise"}. ` +
            "Revise the packet to address this, then call submit_for_clinician_review again with the full revised packet. " +
            "Do not answer with text only.",
        });
        await audit({ runId, event: "changes_requested", reviewer, feedback });
      }
      await drive(coordinator, state, runId, decision === "request_changes");
    } finally {
      await ehr.close();
    }
  });
}

/** Follow-up question about a prepared case. The packet is sent by the client, and nothing is changed or saved. */
export async function ask(
  runId: string,
  question: string,
  packet: unknown,
  history: { q: string; a: string }[],
  onEvent: (e: DemoEvent) => void,
) {
  await withEmitter(onEvent, async () => {
    const ehr = createEhrServer();
    await ehr.connect();
    try {
      const agent = buildQaAgent(ehr, process.env.VECTOR_STORE_ID!);
      const traceId = `trace_${randomUUID().replace(/-/g, "")}`;
      const t0 = Date.now();
      await audit({ runId, event: "question_asked", question });
      const prior = history.map((h) => `Earlier question: ${h.q}\nEarlier answer: ${h.a}`).join("\n\n");
      const input =
        `Prepared packet (JSON):\n${JSON.stringify(packet)}\n\n` +
        (prior ? `${prior}\n\n` : "") +
        `Oncologist's question: ${question}`;
      const runner = new Runner({ traceId, groupId: runId, workflowName: "Tumor board follow-up question" });
      const stream = await runner.run(agent, input, { stream: true, maxTurns: MAX_TURNS });
      for await (const event of stream) {
        if (event.type !== "run_item_stream_event") continue;
        const raw: any = event.item.rawItem ?? {};
        if (event.name === "tool_called")
          onEvent({ type: "tool_call", agent: agent.name, tool: raw.name ?? "tool", args: raw.arguments });
      }
      await stream.completed;
      const u = usageFor(traceId);
      onEvent({
        type: "stats",
        seconds: Math.round((Date.now() - t0) / 1000),
        inputTokens: u.input,
        outputTokens: u.output,
        costUsd: Number(u.costUsd.toFixed(4)),
      });
      onEvent({ type: "trace", traceId, url: `https://platform.openai.com/traces/trace?trace_id=${traceId}` });
      onEvent({ type: "answer", text: String(stream.finalOutput ?? "") });
    } finally {
      await ehr.close();
    }
  });
}

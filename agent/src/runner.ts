import { randomUUID } from "node:crypto";
import { RunState, run } from "@openai/agents";
import { buildAgents, createEhrServer } from "./agents.js";
import { emit, preview, type DemoEvent, withEmitter } from "./events.js";
import { audit, loadRunState, saveRunState } from "./store.js";

const MAX_TURNS = 30;

async function drive(
  manager: ReturnType<typeof buildAgents>,
  input: string | RunState<any, any>,
  runId: string,
) {
  const stream = await run(manager, input, { stream: true, maxTurns: MAX_TURNS });
  emit({ type: "agent_started", agent: manager.name });

  for await (const event of stream) {
    if (event.type !== "run_item_stream_event") continue;
    const raw: any = event.item.rawItem ?? {};
    if (event.name === "tool_called" && raw.name !== "submit_for_clinician_review") {
      emit({ type: "tool_call", agent: manager.name, tool: raw.name ?? "tool", args: raw.arguments });
    }
    if (event.name === "tool_output") {
      emit({
        type: "tool_result",
        agent: manager.name,
        tool: raw.name ?? "tool",
        preview: preview((event.item as any).output, raw.name === "verify_draft" ? 8000 : 160),
      });
    }
  }
  await stream.completed;

  if (stream.interruptions?.length) {
    const pending = stream.interruptions[0];
    await saveRunState(runId, stream.state.toString());
    const packet = JSON.parse(String((pending.rawItem as any).arguments ?? "{}"));
    await audit({ runId, event: "awaiting_clinician", tool: pending.toolName });
    emit({ type: "interruption", runId, tool: pending.toolName ?? "", packet });
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
      const manager = buildAgents(ehr, process.env.VECTOR_STORE_ID!);
      await audit({ runId, event: "started", caseId, question });
      await drive(manager, `Case ${caseId}. Oncologist request: ${question}`, runId);
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
      const manager = buildAgents(ehr, process.env.VECTOR_STORE_ID!);
      const state = await RunState.fromString(manager, await loadRunState(runId));
      const pending = state.getInterruptions()[0];
      if (decision === "approve") {
        state.approve(pending);
        await audit({ runId, event: "approved", reviewer });
        onEvent({ type: "approved", runId, noteId: "pending" });
      } else {
        state.reject(pending, { message: feedback ?? "Please revise." });
        await audit({ runId, event: "changes_requested", reviewer, feedback });
      }
      await drive(manager, state, runId);
    } finally {
      await ehr.close();
    }
  });
}

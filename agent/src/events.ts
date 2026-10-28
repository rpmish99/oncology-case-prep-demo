import { AsyncLocalStorage } from "node:async_hooks";

export type DemoEvent =
  | { type: "agent_started"; agent: string }
  | { type: "tool_call"; agent: string; tool: string; args?: string }
  | { type: "tool_result"; agent: string; tool: string; preview: string }
  | { type: "interruption"; runId: string; tool: string; packet: unknown }
  | { type: "approved"; runId: string; noteId: string }
  | { type: "final"; runId: string; message: string }
  | { type: "answer"; text: string }
  | { type: "trace"; traceId: string; url: string }
  | { type: "stats"; seconds: number; inputTokens: number; outputTokens: number; costUsd: number }
  | { type: "error"; message: string };

type Emit = (event: DemoEvent) => void;

const sink = new AsyncLocalStorage<Emit>();

export const withEmitter = <T>(emit: Emit, fn: () => T): T => sink.run(emit, fn);
export const emit: Emit = (event) => sink.getStore()?.(event);

export const preview = (value: unknown, max = 160) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").replace(/\s+/g, " ").slice(0, max);
};

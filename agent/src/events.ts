import { AsyncLocalStorage } from "node:async_hooks";

export type DemoEvent =
  | { type: "agent_started"; agent: string }
  | { type: "tool_call"; agent: string; tool: string; args?: string }
  | { type: "tool_result"; agent: string; tool: string; preview: string }
  | { type: "interruption"; runId: string; tool: string; packet: unknown }
  | { type: "approved"; runId: string; noteId: string }
  | { type: "final"; runId: string; message: string }
  | { type: "error"; message: string };

type Emit = (event: DemoEvent) => void;

const sink = new AsyncLocalStorage<Emit>();

export const withEmitter = <T>(emit: Emit, fn: () => T): T => sink.run(emit, fn);
export const emit: Emit = (event) => sink.getStore()?.(event);

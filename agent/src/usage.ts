import { addTraceProcessor } from "@openai/agents";

/** List prices in USD per million tokens, from the model pages. */
const PRICES: Record<string, { in: number; cached: number; out: number }> = {
  "gpt-6.1-sol": { in: 2, cached: 0.1, out: 10 },
  "gpt-6.1-terra": { in: 1, cached: 0.05, out: 5 },
  "gpt-6-luna": { in: 0.1, cached: 0.01, out: 0.5 },
};

type Tally = { input: number; cached: number; output: number; costUsd: number };
const byTrace = new Map<string, Tally>();

/** Adds up token usage from every model call in a trace, including the specialists' calls. */
addTraceProcessor({
  async onTraceStart() {},
  async onTraceEnd() {},
  async onSpanStart() {},
  async onSpanEnd(span: any) {
    const data = span.spanData ?? {};
    const response = data._response ?? data.response ?? {};
    const usage = response.usage ?? data.usage;
    if (!usage) return;
    const input = usage.input_tokens ?? usage.inputTokens ?? 0;
    const output = usage.output_tokens ?? usage.outputTokens ?? 0;
    const cached = usage.input_tokens_details?.cached_tokens ?? 0;
    const model = String(response.model ?? data.model ?? "");
    const price = Object.entries(PRICES).find(([k]) => model.startsWith(k))?.[1];
    const t = byTrace.get(span.traceId) ?? { input: 0, cached: 0, output: 0, costUsd: 0 };
    t.input += input;
    t.cached += cached;
    t.output += output;
    if (price) t.costUsd += ((input - cached) * price.in + cached * price.cached + output * price.out) / 1e6;
    byTrace.set(span.traceId, t);
  },
  async shutdown() {},
  async forceFlush() {},
});

export const usageFor = (traceId: string): Tally => byTrace.get(traceId) ?? { input: 0, cached: 0, output: 0, costUsd: 0 };

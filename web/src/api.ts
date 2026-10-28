import { fetchAuthSession } from "aws-amplify/auth";
import type { DemoEvent } from "./types";

const region = import.meta.env.VITE_REGION ?? "us-east-1";
const localUrl = import.meta.env.VITE_AGENT_URL as string | undefined;
const authOff = import.meta.env.VITE_AUTH === "off";

const agentUrl = () =>
  localUrl ??
  `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${encodeURIComponent(
    import.meta.env.VITE_AGENT_ARN,
  )}/invocations?qualifier=DEFAULT`;

// The runtime requires a session id of at least 33 characters.
const sessionId = `${crypto.randomUUID()}-${crypto.randomUUID().slice(0, 8)}`;

export const authDisabled = authOff;

/** Streams events from the agent. Each server-sent event carries one JSON event. */
export async function* invoke(body: Record<string, unknown>): AsyncGenerator<DemoEvent> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": sessionId,
  };
  if (!authOff) {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (!token) throw new Error("Not signed in");
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(agentUrl(), { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(`Agent returned ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data:")) yield JSON.parse(line.slice(5).trim()) as DemoEvent;
      }
    }
  }
}

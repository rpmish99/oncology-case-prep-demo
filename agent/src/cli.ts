import readline from "node:readline/promises";
import { decide, startRun } from "./runner.js";
import type { DemoEvent } from "./events.js";

let pendingRun: string | undefined;

const print = (e: DemoEvent) => {
  switch (e.type) {
    case "tool_call":
      console.log(`  [${e.agent}] -> ${e.tool}`);
      break;
    case "tool_result":
      console.log(`  [${e.agent}] <- ${e.tool}: ${e.preview.replace(/\s+/g, " ")}`);
      break;
    case "interruption":
      pendingRun = e.runId;
      console.log("\n=== PACKET AWAITING CLINICIAN REVIEW ===");
      console.log(JSON.stringify(e.packet, null, 2));
      break;
    case "trace":
      console.log(`  trace: ${e.url}`);
      break;
    case "stats":
      console.log(`  stats: ${e.seconds}s, ${e.inputTokens} in, ${e.outputTokens} out, about $${e.costUsd}`);
      break;
    case "final":
      console.log(`\n${e.message}`);
      break;
    case "error":
      console.error(`error: ${e.message}`);
      break;
  }
};

const question = process.argv.slice(2).join(" ") || "Prepare this case for tumor board.";
await startRun(question, "case-001", print);

while (pendingRun) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("\n[a]pprove, or type feedback to request changes: ")).trim();
  rl.close();
  const runId = pendingRun;
  pendingRun = undefined;
  if (answer.toLowerCase() === "a") await decide(runId, "approve", undefined, "cli-reviewer", print);
  else await decide(runId, "request_changes", answer, "cli-reviewer", print);
}

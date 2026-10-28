import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

/**
 * Run state and audit trail. This file-backed store is for local use. The deployed version
 * swaps in DynamoDB behind the same functions.
 */
const DIR = process.env.RUN_STORE_DIR ?? path.resolve(process.cwd(), ".runs");

const file = (name: string) => path.join(DIR, name);
const ready = mkdir(DIR, { recursive: true });

export async function saveRunState(runId: string, serialized: string) {
  await ready;
  await writeFile(file(`${runId}.state.json`), serialized);
}

export async function loadRunState(runId: string): Promise<string> {
  await ready;
  return readFile(file(`${runId}.state.json`), "utf8");
}

export async function saveNote(noteId: string, packet: unknown) {
  await ready;
  await writeFile(file(`${noteId}.json`), JSON.stringify(packet, null, 2));
}

export async function audit(entry: Record<string, unknown>) {
  await ready;
  await appendFile(file("audit.log.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

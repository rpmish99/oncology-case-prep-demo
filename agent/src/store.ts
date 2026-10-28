import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Run state, saved notes and the audit trail. With TABLE_NAME set they go to DynamoDB, so a paused run
 * survives between requests. Without it they go to local files for development.
 */
const TABLE = process.env.TABLE_NAME;
const ddb = TABLE ? DynamoDBDocumentClient.from(new DynamoDBClient({})) : undefined;
const TTL_SECONDS = 7 * 24 * 3600;

const DIR = process.env.RUN_STORE_DIR ?? path.resolve(process.cwd(), ".runs");
const file = (name: string) => path.join(DIR, name);
const ready = TABLE ? Promise.resolve() : mkdir(DIR, { recursive: true });

const put = (pk: string, sk: string, body: Record<string, unknown>) =>
  ddb!.send(
    new PutCommand({
      TableName: TABLE,
      Item: { pk, sk, ...body, expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS },
    }),
  );

export async function saveRunState(runId: string, serialized: string) {
  await ready;
  if (ddb) return void (await put(`run#${runId}`, "state", { serialized }));
  await writeFile(file(`${runId}.state.json`), serialized);
}

export async function loadRunState(runId: string): Promise<string> {
  await ready;
  if (ddb) {
    const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: `run#${runId}`, sk: "state" } }));
    if (!out.Item) throw new Error(`No saved state for ${runId}`);
    return out.Item.serialized as string;
  }
  return readFile(file(`${runId}.state.json`), "utf8");
}

export async function saveNote(noteId: string, packet: unknown) {
  await ready;
  if (ddb) return void (await put(`note#${noteId}`, "packet", { packet: JSON.stringify(packet) }));
  await writeFile(file(`${noteId}.json`), JSON.stringify(packet, null, 2));
}

export async function audit(entry: Record<string, unknown>) {
  await ready;
  const at = new Date().toISOString();
  if (ddb) return void (await put(`audit#${String(entry.runId ?? "none")}`, at, entry));
  await appendFile(file("audit.log.jsonl"), `${JSON.stringify({ at, ...entry })}\n`);
}

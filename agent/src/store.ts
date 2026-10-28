import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

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

/** Audit entries for one run, oldest first. */
export async function listAudit(runId: string): Promise<Record<string, unknown>[]> {
  await ready;
  if (ddb) {
    const out = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `audit#${runId}` },
      }),
    );
    return (out.Items ?? []).map(({ pk: _pk, sk, expiresAt: _e, ...rest }) => ({ at: sk, ...rest }));
  }
  try {
    const lines = (await readFile(file("audit.log.jsonl"), "utf8")).trim().split("\n");
    return lines.map((l) => JSON.parse(l)).filter((e) => e.runId === runId);
  } catch {
    return [];
  }
}

/** Daily limit on new runs, so a public link cannot run up model costs. Local runs are not limited. */
export async function underDailyCap(limit = Number(process.env.DAILY_RUN_LIMIT ?? 40)): Promise<boolean> {
  if (!ddb) return true;
  const day = new Date().toISOString().slice(0, 10);
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: `cap#${day}`, sk: "runs" },
        UpdateExpression: "ADD n :one SET expiresAt = :ttl",
        ConditionExpression: "attribute_not_exists(n) OR n < :limit",
        ExpressionAttributeValues: { ":one": 1, ":limit": limit, ":ttl": Math.floor(Date.now() / 1000) + 2 * 86400 },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

import OpenAI, { toFile } from "openai";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const client = new OpenAI();
const dir = path.resolve(process.cwd(), "../data/guidelines");

const store = await client.vectorStores.create({ name: "case-prep-demo-pathways" });
for (const name of await readdir(dir)) {
  if (!name.endsWith(".md")) continue;
  const file = await client.files.create({
    file: await toFile(await readFile(path.join(dir, name)), name),
    purpose: "assistants",
  });
  await client.vectorStores.files.createAndPoll(store.id, { file_id: file.id });
  console.log(`indexed ${name}`);
}
console.log(`\nVECTOR_STORE_ID=${store.id}`);

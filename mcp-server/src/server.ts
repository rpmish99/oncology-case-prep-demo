import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(here, "../../data/case");
const TOKEN = process.env.MCP_TOKEN;

const read = (file: string) => readFileSync(path.join(DATA_DIR, file), "utf8");
const bundle = () => JSON.parse(read("patient.json")) as { entry: { resource: Record<string, any> }[] };
const byType = (type: string) =>
  bundle().entry.map((e) => e.resource).filter((r) => r.resourceType === type);

const caseId = z.string().describe("Case identifier, for example case-001");
const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

function buildServer() {
  const server = new McpServer({ name: "mock-ehr", version: "0.1.0" });

  server.tool(
    "get_case_bundle",
    "Everything in the record for a case in one call: demographics, problem list, medications, allergies, observations, procedures, pathology, imaging, genomics and the latest clinic note. Prefer this over the individual tools.",
    { case_id: caseId },
    async () =>
      text({
        patient: byType("Patient"),
        conditions: byType("Condition"),
        medications: byType("MedicationStatement"),
        allergies: byType("AllergyIntolerance"),
        observations: byType("Observation"),
        procedures: byType("Procedure"),
        pathology_report: read("pathology_report.txt"),
        radiology_reports: read("radiology_report.txt"),
        genomics_report: read("genomics_report.txt"),
        clinic_note: read("clinic_note.txt"),
      }),
  );
  server.tool("get_patient_summary", "Demographics and menopausal status for a case.", { case_id: caseId }, async () =>
    text(byType("Patient")),
  );
  server.tool("get_conditions", "Problem list with onset dates and status.", { case_id: caseId }, async () =>
    text(byType("Condition")),
  );
  server.tool(
    "get_medications_and_allergies",
    "Active medications and documented allergies.",
    { case_id: caseId },
    async () => text({ medications: byType("MedicationStatement"), allergies: byType("AllergyIntolerance") }),
  );
  server.tool(
    "get_observations",
    "Performance status and family history observations.",
    { case_id: caseId },
    async () => text(byType("Observation")),
  );
  server.tool("get_procedures", "Surgical procedures performed.", { case_id: caseId }, async () =>
    text(byType("Procedure")),
  );
  server.tool("get_pathology_report", "Final surgical pathology report text.", { case_id: caseId }, async () =>
    text(read("pathology_report.txt")),
  );
  server.tool("get_radiology_reports", "Imaging report text.", { case_id: caseId }, async () =>
    text(read("radiology_report.txt")),
  );
  server.tool("get_genomics_report", "Genomic assay and genetic testing status.", { case_id: caseId }, async () =>
    text(read("genomics_report.txt")),
  );
  server.tool("get_clinic_notes", "Recent clinic and navigator notes.", { case_id: caseId }, async () =>
    text(read("clinic_note.txt")),
  );
  return server;
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => void res.json({ ok: true }));

app.post("/mcp", async (req, res) => {
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const methodNotAllowed = (_req: express.Request, res: express.Response) =>
  void res.status(405).json({ error: "method not allowed" });
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => console.log(`mock-ehr MCP server listening on :${port}`));

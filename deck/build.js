const pptxgen = require("pptxgenjs");
const path = require("path");
const { applyTheme } = require(
  "/Users/rupeshmishra/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/f7f26c42-0bcf-42bb-82c9-cefc9e4a4c4b/c49ac775-14da-419a-9e23-a2d67fb542e1/skills/pptx/scripts/apply_theme.js"
);

const THEME = {
  name: "Case prep",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "17212B", lt1: "FFFFFF", dk2: "0B3D3A", lt2: "EEF4F2",
    accent1: "0F766E", accent2: "C2410C", accent3: "534AB7",
    accent4: "5F6B76", accent5: "B45309", accent6: "2563EB",
    hlink: "0F766E", folHlink: "5F6B76",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Preparing cases for tumor board";
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  slideNumber: { x: 12.4, y: 7.0, w: 0.5, h: 0.3, color: "A9C7C2", fontSize: 10 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.5, w: 12.1, h: 1.2, fontSize: 36, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "LIGHT",
  background: { color: C.background1 },
  slideNumber: { x: 12.4, y: 7.0, w: 0.5, h: 0.3, color: "5F6B76", fontSize: 10 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.5, w: 12.1, h: 0.9, fontSize: 34, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});

const card = (slide, x, y, w, h, name) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: C.background2 }, line: { color: C.background2 }, objectName: name,
  });

// ---------- 1. Customer and problem ----------
pres.addSection({ title: "Setup" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Setup" });
  s.addText("Preparing cases for tumor board", { placeholder: "title" });

  s.addText(
    [
      { text: "Customer", options: { bold: true, color: "9FD8CF", breakLine: true } },
      { text: "Lakeview Cancer Institute, a fictional regional cancer center that runs weekly tumor boards for breast, lung and colon cancer.", options: { breakLine: true, paraSpaceAfter: 14 } },
      { text: "Who does the work", options: { bold: true, color: "9FD8CF", breakLine: true } },
      { text: "Oncologists and nurse navigators who prepare each board's case list.", options: { breakLine: true, paraSpaceAfter: 14 } },
      { text: "The problem", options: { bold: true, color: "9FD8CF", breakLine: true } },
      { text: "For each case, someone reads pathology, imaging, genomics, clinic notes and the problem list in separate places, then checks the institution's Oncology Care Guidelines. It is slow, and a disagreement between two sources is easy to miss.", options: {} },
    ],
    { x: 0.6, y: 1.8, w: 6.6, h: 4.8, fontSize: 18, color: C.background1, valign: "top", margin: 0, isTextBox: true, objectName: "Customer text" }
  );

  const stats = [
    ["60 to 90 min", "to prepare one case today"],
    ["5", "places a reviewer reads for each case"],
    ["4", "demo cases across 3 tumor types, each with a hidden record problem"],
  ];
  stats.forEach(([big, small], i) => {
    const y = 1.8 + i * 1.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.9, y, w: 4.8, h: 1.45, rectRadius: 0.12, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Stat card ${i + 1}` });
    s.addText(big, { x: 8.15, y: y + 0.12, w: 4.3, h: 0.75, fontSize: 36, bold: true, color: C.background1, margin: 0, valign: "middle", isTextBox: true, objectName: `Stat ${i + 1}` });
    s.addText(small, { x: 8.15, y: y + 0.85, w: 4.3, h: 0.45, fontSize: 14, color: C.background1, margin: 0, valign: "top", isTextBox: true, objectName: `Stat label ${i + 1}` });
  });
  s.addText("Prep time is an assumption to confirm in a pilot. All patient data in the demo is synthetic.", { x: 0.6, y: 6.75, w: 11, h: 0.35, fontSize: 12, color: "A9C7C2", margin: 0, isTextBox: true, objectName: "Footnote" });
  s.addNotes("Introduce the customer and the two users. The point is not that charts are hard to read. It is that the reviewer has to look in five places and compare them by eye. Each of the four demo cases has a planted problem, such as a navigator note that disagrees with the signed pathology or molecular report. That kind of mismatch is what we want caught before the meeting.");
}

// ---------- 2. Workflow ----------
{
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Setup" });
  s.addText("The workflow, before and after", { placeholder: "title" });

  const before = ["Open pathology, imaging, genomics and notes one by one", "Copy the key facts into a summary", "Look up the current Oncology Care Guidelines", "Compare sources by eye and chase gaps", "Present from memory and the summary"];
  const after = ["Oncologist asks for the case to be prepared", "Specialists read each record and the Oncology Care Guidelines", "A draft keeps patient facts, guideline text, similar past cases and inference separate", "A second check flags conflicts and unsupported claims", "The oncologist reviews and approves before anything is saved"];

  [["Today", before, 0.6, C.text1], ["With the OpenAI API", after, 6.85, C.accent1]].forEach(([head, items, x, col]) => {
    card(s, x, 1.6, 5.9, 4.1, `${head} card`);
    s.addText(head, { x: x + 0.3, y: 1.75, w: 5.3, h: 0.5, fontSize: 20, bold: true, color: col, margin: 0, isTextBox: true, objectName: `${head} heading` });
    s.addText(
      items.map((t, i) => ({ text: t, options: { bullet: { type: "number", numberStartAt: i + 1 }, breakLine: i < items.length - 1, paraSpaceAfter: 10 } })),
      { x: x + 0.3, y: 2.35, w: 5.3, h: 3.2, fontSize: 16, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `${head} steps` }
    );
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.95, w: 12.15, h: 0.95, rectRadius: 0.12, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: "Surface banner" });
  s.addText(
    [
      { text: "Product surface: OpenAI Platform and APIs. ", options: { bold: true } },
      { text: "Responses API for the model calls, Agents SDK for the case coordinator and specialists, File Search for the Oncology Care Guidelines, MCP for the masked patient record and past cases, tracing for review." },
    ],
    { x: 0.85, y: 6.0, w: 11.65, h: 0.85, fontSize: 16, color: C.background1, valign: "middle", margin: 0, isTextBox: true, objectName: "Surface text" }
  );
  s.addNotes("Left side is what the team does now. Right side is what the demo does. Stress that the oncologist is still the decision maker: the tool prepares and checks, and a person approves. The product surface is the OpenAI Platform. Everything you will see is built from the Responses API and the Agents SDK, with File Search and MCP as the tools.");
}

// ---------- 3. How it works ----------
pres.addSection({ title: "Demo" });
{
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Demo" });
  s.addText("How it works", { placeholder: "title" });
  s.addImage({ path: path.resolve(__dirname, "../docs/agent-graph.png"), x: 0.6, y: 1.5, w: 7.3, h: 4.59, altText: "Agent graph: the oncologist's request goes to a case coordinator agent, which starts three specialists together (patient data, clinical history, evidence). A verifier checks the draft, a clinician approves, and the note is saved with an audit trail.", objectName: "Agent graph" });
  s.addText("Runs in the customer's AWS account: Cognito sign-in, AgentCore Runtime, an MCP server for the record, and DynamoDB for run state and the audit trail.", { x: 0.6, y: 6.2, w: 7.3, h: 0.7, fontSize: 14, color: C.accent4, margin: 0, valign: "top", isTextBox: true, objectName: "Graph caption" });

  const steps = [
    ["1", "Four specialists start together: record, history, guidelines and similar past cases"],
    ["2", "The coordinator drafts a packet that keeps patient facts, guideline text and inference apart"],
    ["3", "A separate verifier checks every claim against its source"],
    ["4", "Names and record numbers are masked first. The run pauses until the oncologist approves"],
  ];
  card(s, 8.3, 1.5, 4.45, 5.4, "Steps card");
  s.addText("What happens in a run", { x: 8.55, y: 1.65, w: 4.0, h: 0.45, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Steps heading" });
  steps.forEach(([n, d], i) => {
    const y = 2.35 + i * 1.12;
    s.addShape(pres.shapes.OVAL, { x: 8.55, y, w: 0.45, h: 0.45, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Step badge ${n}` });
    s.addText(n, { x: 8.55, y, w: 0.45, h: 0.45, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `Step number ${n}` });
    s.addText(d, { x: 9.2, y: y - 0.05, w: 3.4, h: 1.0, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Step text ${n}` });
  });
  s.addNotes("This slide is the OpenAI side. A case coordinator agent on gpt-6.1-sol starts four specialists together. The patient data and history specialists read the record through an MCP server that masks names, record numbers and birth dates before the model sees anything. The similar cases specialist searches a synthetic registry of past tumor board cases. The evidence specialist searches the Oncology Care Guidelines with File Search and looks up PubMed. The specialists use gpt-6.1-terra, which is faster and cheaper, because they are reading and extracting. A separate verifier checks the draft. Then the run pauses for the oncologist. Everything runs in the customer's own AWS account; only model calls and the guideline search go to OpenAI.");
}

// ---------- 4. Expected value ----------
pres.addSection({ title: "Value" });
{
  const ev = JSON.parse(require("fs").readFileSync(path.resolve(__dirname, "../docs/eval-results.json"), "utf8"));
  const secs = ev.summary.avgSeconds;
  const cost = ev.summary.avgCostUsd;
  const passedChecks = ev.passedAll;
  const totalChecks = ev.totalAll;
  const caseCount = ev.cases.length;
  const runCount = ev.summary.runs;
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Value" });
  s.addText("Expected value", { placeholder: "title" });

  s.addChart(pres.charts.BAR, [{ name: "Minutes per case", labels: ["Today", "With the assistant"], values: [75, 25] }], {
    x: 0.6, y: 1.5, w: 5.6, h: 4.6, barDir: "col", chartColors: ["5F6B76", "0F766E"], showTitle: true, title: "Preparation time per case, minutes (assumption)",
    titleFontSize: 14, titleColor: "17212B", titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: "17212B", dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: "17212B", catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt",
    valAxisLabelColor: "5F6B76", valAxisLabelFontSize: 12, valAxisLabelFontFace: "+mn-lt", valAxisMaxVal: 100, valAxisMinVal: 0,
    valGridLine: { color: "DDE3E7", size: 0.5 }, catGridLine: { style: "none" }, showLegend: false, invertedColors: ["5F6B76"],
  });

  const stats = [
    [`${secs} seconds`, `of agent work per case, measured over ${runCount} runs on ${caseCount} cases`],
    [`About ${Math.round(cost * 100)} cents`, "of model cost per case at list prices, measured"],
    [`${passedChecks} of ${totalChecks} checks`, `on the planted problems passed across ${runCount} runs`],
    ["About 33 hours a month", "of clinician time saved (assumed: 40 cases, 75 down to 25 min)"],
  ];
  stats.forEach(([big, small], i) => {
    const y = 1.5 + i * 1.2;
    card(s, 6.6, y, 6.15, 1.1, `Value card ${i + 1}`);
    s.addText(big, { x: 6.85, y: y + 0.08, w: 5.65, h: 0.5, fontSize: 22, bold: true, color: i === 3 ? C.accent4 : C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: `Value ${i + 1}` });
    s.addText(small, { x: 6.85, y: y + 0.58, w: 5.65, h: 0.45, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Value label ${i + 1}` });
  });
  s.addText("Time and cost are measured on the synthetic cases. Hours saved is an assumption, editable in the value model. A pilot would measure real preparation times.", { x: 0.6, y: 6.35, w: 12.1, h: 0.55, fontSize: 12, color: C.accent4, margin: 0, isTextBox: true, objectName: "Value footnote" });
  s.addNotes("Separate measured from assumed. Measured on the four synthetic cases: about 90 seconds of agent work and about ten cents of model cost per case. The checks on the planted problems are in the evaluation results file, with every miss listed. Assumed: forty cases a month and preparation dropping from seventy-five minutes to twenty-five, which gives about thirty-three hours a month. The dollar value of that time is modest. The bigger reason is catching conflicts before the meeting, which a pilot would measure.");
}

// ---------- 5. Governance, assumptions, next steps ----------
{
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Value" });
  s.addText("Guardrails and next steps", { placeholder: "title" });

  card(s, 0.6, 1.6, 5.9, 5.1, "Guardrails card");
  s.addText("Guardrails", { x: 0.9, y: 1.75, w: 5.3, h: 0.5, fontSize: 20, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Guardrails heading" });
  s.addText(
    [
      "A clinician approves before anything is saved",
      "No write to the patient record",
      "Every run and approval is logged",
      "The agent sees patient data only through scoped record tools",
      "Synthetic data only in this demo",
      "Before real patient data: confirm the business associate agreement and data retention terms with OpenAI",
    ].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1, paraSpaceAfter: 8 } })),
    { x: 0.9, y: 2.35, w: 5.3, h: 4.2, fontSize: 16, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: "Guardrails list" }
  );

  card(s, 6.85, 1.6, 5.9, 5.1, "Next steps card");
  s.addText("Next steps", { x: 7.15, y: 1.75, w: 5.3, h: 0.5, fontSize: 20, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: "Next steps heading" });
  s.addText(
    [
      "Weeks 1 to 4: run on 50 de-identified past cases and compare with the tumor board notes",
      "Weeks 5 to 8: read-only connection to the record system, with oncologist feedback",
      "Measure prep time, conflicts caught and how often clinicians edit the draft",
      "Then decide whether to add more cancer types or trial matching",
    ].map((t, i, a) => ({ text: t, options: { bullet: { type: "number", numberStartAt: i + 1 }, breakLine: i < a.length - 1, paraSpaceAfter: 10 } })),
    { x: 7.15, y: 2.35, w: 5.3, h: 4.2, fontSize: 16, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: "Next steps list" }
  );
  s.addNotes("Close on safety first, then the plan. The tool prepares and checks. A clinician decides. Nothing is written to a record. For real patient data we would first confirm the contract terms and run on de-identified past cases, so we can compare the assistant against what the tumor board actually concluded.");
}

(async () => {
  const out = path.resolve(__dirname, "case-prep-deck.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
})();
